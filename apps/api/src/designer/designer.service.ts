import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ListingStatus, MediaStatus } from '@prisma/client';
import { AI_PROVIDER_NOT_CONFIGURED } from '@peytakilid/shared-types';
import sharp from 'sharp';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { PrismaService } from '../prisma/prisma.service';

const DESIGN_ROOT = join(process.cwd(), 'uploads', 'designer');
const DESIGN_RESULTS = join(DESIGN_ROOT, 'results');

type DesignJob = {
  publicId: string;
  status: 'QUEUED' | 'READY' | 'FAILED' | 'PROVIDER_UNAVAILABLE';
  prompt: string;
  locale: string;
  spaceMediaPublicId: string;
  listingPublicId: string | null;
  listingSlug: string | null;
  listingTitle: string | null;
  resultNote: string | null;
  resultImageUrl: string | null;
  errorMessage: string | null;
  createdAt: number;
};

const jobs = new Map<string, DesignJob>();
const mediaMeta = new Map<
  string,
  { kind: 'space' | 'listing'; path: string; mimeType: string }
>();

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

@Injectable()
export class DesignerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
  ) {}

  createGuestSessionToken() {
    return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  }

  hashGuestToken(token: string) {
    return createHash('sha256').update(token).digest('hex').slice(0, 24);
  }

  status() {
    return {
      enabled: true,
      dailyLimit: 12,
      usedInLast24h: [...jobs.values()].filter((j) => Date.now() - j.createdAt < 86_400_000)
        .length,
      remaining: 12,
      provider: this.ai.getProviderName(),
      imageEditConfigured: this.ai.getProviderName() !== 'none',
      providerStatus: this.ai.getProviderName() === 'none' ? 'not_configured' : 'ready',
      note: 'Design binds to a real listing photo. Product identity is locked via a reference swatch.',
    };
  }

  async uploadInput(input: {
    kind: 'space' | 'listing';
    file: Express.Multer.File;
    locale?: string;
  }) {
    if (!input.file?.buffer?.length) throw new BadRequestException('file required');
    ensureDir(DESIGN_ROOT);
    const publicId = randomUUID();
    const ext =
      input.file.mimetype === 'image/png'
        ? '.png'
        : input.file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';
    const path = join(DESIGN_ROOT, `${publicId}${ext}`);
    writeFileSync(path, input.file.buffer);
    mediaMeta.set(publicId, {
      kind: input.kind,
      path,
      mimeType: input.file.mimetype || 'image/jpeg',
    });
    return {
      publicId,
      kind: input.kind,
      mimeType: input.file.mimetype || 'image/jpeg',
      bytes: input.file.buffer.length,
      locale: input.locale || 'fa',
    };
  }

  async bindListing(listingRef: string, locale = 'fa') {
    const listing = await this.prisma.listing.findFirst({
      where: {
        status: ListingStatus.PUBLISHED,
        OR: [{ publicId: listingRef }, { slug: listingRef }, { id: listingRef }],
      },
      select: {
        publicId: true,
        slug: true,
        title: true,
        description: true,
        media: {
          where: { status: MediaStatus.APPROVED },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { url: true, storageKey: true },
        },
      },
    });
    if (!listing) throw new NotFoundException('Published listing not found');
    return {
      ...listing,
      imageUrl: listing.media[0]?.url || null,
      hasProductImage: Boolean(resolveListingProductImage(listing.media[0])),
    };
  }

  /** Catalog picker for designer — published listings only. */
  async listPublishedForPicker(q?: string, limit = 24) {
    const needle = (q || '').trim();
    const rows = await this.prisma.listing.findMany({
      where: {
        status: ListingStatus.PUBLISHED,
        ...(needle
          ? {
              OR: [
                { title: { contains: needle, mode: 'insensitive' } },
                { slug: { contains: needle.toLowerCase(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 48),
      select: {
        publicId: true,
        slug: true,
        title: true,
        media: {
          where: { status: MediaStatus.APPROVED },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { url: true },
        },
      },
    });
    return rows.map((r) => ({
      publicId: r.publicId,
      slug: r.slug,
      title: r.title,
      imageUrl: r.media[0]?.url || null,
    }));
  }

  async generate(input: {
    spaceMediaPublicId: string;
    listingRef: string;
    /** Phone/gallery product photo overrides catalog listing media when set. */
    productMediaPublicId?: string;
    prompt: string;
    locale?: string;
  }) {
    const spaceMeta = mediaMeta.get(input.spaceMediaPublicId);
    if (!spaceMeta) {
      throw new BadRequestException('Unknown space media');
    }
    if (!input.prompt || input.prompt.trim().length < 8) {
      throw new BadRequestException('prompt too short');
    }
    const listing = await this.bindListing(input.listingRef, input.locale);
    const publicId = randomUUID();
    const job: DesignJob = {
      publicId,
      status: 'QUEUED',
      prompt: input.prompt.trim(),
      locale: input.locale || 'fa',
      spaceMediaPublicId: input.spaceMediaPublicId,
      listingPublicId: listing.publicId,
      listingSlug: listing.slug,
      listingTitle: listing.title,
      resultNote: null,
      resultImageUrl: null,
      errorMessage: null,
      createdAt: Date.now(),
    };
    jobs.set(publicId, job);

    try {
      let productImageRef: string | null = null;
      let productSource: 'phone' | 'catalog' = 'catalog';
      const uploadedProductId = (input.productMediaPublicId || '').trim();
      if (uploadedProductId) {
        const productMeta = mediaMeta.get(uploadedProductId);
        if (!productMeta || productMeta.kind !== 'listing') {
          throw new BadRequestException('Unknown product media upload');
        }
        productImageRef = productMeta.path;
        productSource = 'phone';
      } else {
        productImageRef = resolveListingProductImage(listing.media[0]);
      }
      if (!productImageRef) {
        throw new BadRequestException(
          'No product photo. Pick a catalog listing with a photo, or upload a clear product image from your phone.',
        );
      }

      // Bake product swatch into one edit image (OpenAI edits allow a single image field).
      const compositePath = join(DESIGN_ROOT, `${publicId}-composite.png`);
      await composeSpaceWithProductSwatch(spaceMeta.path, productImageRef, compositePath);

      const vizPrompt = [
        'Photoreal construction-marketplace visualization.',
        'The input image has TWO parts: LEFT = customer room/space, RIGHT = PRODUCT MATERIAL SWATCH (reference strip).',
        `Product title: “${listing.title}”`,
        listing.description ? `Notes: ${listing.description.slice(0, 180)}` : '',
        `Customer request: ${input.prompt.trim()}`,
        'RULES:',
        '1) Apply ONLY the material from the RIGHT swatch onto the correct surface in the LEFT room (usually floor, unless asked otherwise).',
        '2) Preserve swatch identity exactly: color, pattern, veins, gloss/matte, scale of motif. Do NOT invent another tile/stone/wood.',
        '3) Keep room geometry, openings, and furniture silhouette. Realistic lighting/perspective.',
        '4) FINAL OUTPUT must show ONLY the room — remove the right swatch panel completely.',
        '5) Fidelity to the catalog swatch is more important than beautification.',
      ]
        .filter(Boolean)
        .join('\n');

      const image = await this.ai.imageGenerate({
        prompt: vizPrompt,
        size: '1024x1024',
        imageRef: compositePath,
      });

      ensureDir(DESIGN_RESULTS);
      const resultFile = `${publicId}.png`;
      const resultPath = join(DESIGN_RESULTS, resultFile);
      writeFileSync(resultPath, Buffer.from(image.imageBase64, 'base64'));

      job.status = 'READY';
      job.resultImageUrl = `/api/uploads/designer/results/${resultFile}`;
      job.resultNote =
        input.locale === 'en'
          ? productSource === 'phone'
            ? `Visualization of “${listing.title}” using your uploaded product photo.`
            : `Visualization of “${listing.title}” using the listing’s real product photo.`
          : input.locale === 'ar'
            ? productSource === 'phone'
              ? `تصور لـ«${listing.title}» اعتماداً على صورة المنتج التي رفعتها.`
              : `تصور لـ«${listing.title}» اعتماداً على صورة المنتج الحقيقية.`
            : productSource === 'phone'
              ? `نمایش «${listing.title}» با عکس کالایی که از گوشی بارگذاری کردید.`
              : `نمایش «${listing.title}» با حفظ ظاهر واقعی عکس کالا.`;
    } catch (e) {
      const code = (e as { code?: string; response?: { code?: string } })?.code;
      const responseCode = (e as { response?: { code?: string } })?.response?.code;
      if (
        code === AI_PROVIDER_NOT_CONFIGURED ||
        responseCode === AI_PROVIDER_NOT_CONFIGURED ||
        e instanceof ServiceUnavailableException
      ) {
        job.status = 'PROVIDER_UNAVAILABLE';
        job.resultNote =
          'Design request captured and bound to a real listing. Image generation provider is not configured yet.';
      } else if (e instanceof BadRequestException) {
        job.status = 'FAILED';
        job.errorMessage = e.message;
      } else {
        job.status = 'FAILED';
        job.errorMessage = e instanceof Error ? e.message : 'design_failed';
      }
    }
    jobs.set(publicId, job);
    return job;
  }

  getJob(publicId: string) {
    const job = jobs.get(publicId);
    if (!job) throw new NotFoundException('Design job not found');
    return job;
  }
}

function resolveListingProductImage(
  media?: { url: string | null; storageKey: string | null } | null,
): string | null {
  if (!media) return null;
  if (media.storageKey) {
    const abs = join(process.cwd(), 'uploads', media.storageKey);
    if (existsSync(abs)) return abs;
  }
  if (media.url && (media.url.startsWith('http://') || media.url.startsWith('https://'))) {
    return media.url;
  }
  if (media.url?.startsWith('/api/uploads/')) {
    const key = media.url.replace(/^\/api\/uploads\//, '');
    const abs = join(process.cwd(), 'uploads', key);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/** LEFT room + RIGHT product swatch in one PNG for single-image edit APIs. */
async function composeSpaceWithProductSwatch(
  spacePath: string,
  productPath: string,
  outPath: string,
) {
  ensureDir(DESIGN_ROOT);
  const width = 1024;
  const height = 1024;
  const swatchW = 280;
  const roomW = width - swatchW;

  const room = await sharp(spacePath)
    .resize(roomW, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
  const swatch = await sharp(productPath)
    .resize(swatchW, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  // Label bar on swatch edge so the model clearly sees "reference".
  const label = await sharp({
    create: {
      width: swatchW,
      height: 36,
      channels: 3,
      background: { r: 20, g: 30, b: 28 },
    },
  })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 245, g: 240, b: 232 },
    },
  })
    .composite([
      { input: room, left: 0, top: 0 },
      { input: swatch, left: roomW, top: 0 },
      { input: label, left: roomW, top: 0 },
    ])
    .png()
    .toFile(outPath);
}
