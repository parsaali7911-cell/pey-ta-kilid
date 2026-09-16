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
      dailyLimit: 20,
      usedInLast24h: [...jobs.values()].filter((j) => Date.now() - j.createdAt < 86_400_000)
        .length,
      remaining: 20,
      provider: this.ai.getProviderName(),
      imageEditConfigured: this.ai.getProviderName() !== 'none',
      providerStatus: this.ai.getProviderName() === 'none' ? 'not_configured' : 'ready',
      note: 'Design must bind to a real Peytakilid Listing. AI must not invent materials.',
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
    return listing;
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
      let spaceCaption = '';
      try {
        const vision = await this.ai.vision({
          imageRef: spaceMeta.path,
          prompt:
            'Describe this interior/construction space for applying a real marketplace material. JSON with caption, roomType, color.',
          maxOutputTokens: 180,
        });
        spaceCaption = vision.caption || JSON.stringify(vision.attributes);
      } catch {
        // Vision optional — image edit can still run from space photo + listing text.
        spaceCaption = '';
      }

      const productImageRef = resolveListingProductImage(listing.media[0]);
      const vizPrompt = [
        `Apply ONLY this real Peytakilid catalog product into the uploaded customer space photo.`,
        `Product title: ${listing.title}`,
        listing.description ? `Product description: ${listing.description.slice(0, 280)}` : '',
        spaceCaption ? `Space description: ${spaceCaption}` : '',
        `Customer request: ${input.prompt.trim()}`,
        `Keep room geometry realistic. Do not invent a different product, brand, price, or stock.`,
        `Photorealistic visualization suitable for construction marketplace.`,
      ]
        .filter(Boolean)
        .join('\n');

      const image = await this.ai.imageGenerate({
        prompt: vizPrompt,
        size: '1024x1024',
        imageRef: spaceMeta.path,
        productImageRef: productImageRef || undefined,
      });

      ensureDir(DESIGN_RESULTS);
      const resultFile = `${publicId}.png`;
      const resultPath = join(DESIGN_RESULTS, resultFile);
      writeFileSync(resultPath, Buffer.from(image.imageBase64, 'base64'));

      job.status = 'READY';
      job.resultImageUrl = `/api/uploads/designer/results/${resultFile}`;
      job.resultNote =
        input.locale === 'en'
          ? `Visualization of “${listing.title}” in your uploaded space.`
          : input.locale === 'ar'
            ? `تصور لمنتج «${listing.title}» في المساحة التي رفعتها.`
            : `نمایش «${listing.title}» در فضای آپلود‌شده شما.`;
    } catch (e) {
      const code = (e as { code?: string; response?: { code?: string } })?.code;
      const responseCode = (e as { response?: { code?: string } })?.response?.code;
      if (
        code === AI_PROVIDER_NOT_CONFIGURED ||
        responseCode === AI_PROVIDER_NOT_CONFIGURED ||
        e instanceof ServiceUnavailableException
      ) {
        // Fallback text-only note when OpenAI is not configured — still bound to real listing.
        try {
          const out = await this.ai.complete({
            system:
              'You assist a construction marketplace design tool. Only describe applying the given REAL listing material to the uploaded space. Never invent a product, price, or stock.',
            prompt: `Listing: ${listing.title} (slug=${listing.slug}). User request: ${input.prompt}`,
            maxOutputTokens: 220,
          });
          job.status = 'READY';
          job.resultNote = out.text;
        } catch {
          job.status = 'PROVIDER_UNAVAILABLE';
          job.resultNote =
            'Design request captured and bound to a real listing. Image generation provider is not configured yet — RFQ/search can continue from this listing.';
        }
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
