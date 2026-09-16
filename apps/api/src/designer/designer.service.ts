import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ListingStatus } from '@prisma/client';
import { AI_PROVIDER_NOT_CONFIGURED } from '@peytakilid/shared-types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { PrismaService } from '../prisma/prisma.service';

const DESIGN_ROOT = join(process.cwd(), 'uploads', 'designer');

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
    const path = join(DESIGN_ROOT, `${publicId}.bin`);
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
      select: { publicId: true, slug: true, title: true },
    });
    if (!listing) throw new NotFoundException('Published listing not found');
    return listing;
  }

  async generate(input: {
    spaceMediaPublicId: string;
    listingRef: string;
    prompt: string;
    locale?: string;
  }) {
    if (!mediaMeta.has(input.spaceMediaPublicId)) {
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
      errorMessage: null,
      createdAt: Date.now(),
    };
    jobs.set(publicId, job);

    try {
      const out = await this.ai.complete({
        system:
          'You assist a construction marketplace design tool. Only describe applying the given REAL listing material to the uploaded space. Never invent a product, price, or stock.',
        prompt: `Listing: ${listing.title} (slug=${listing.slug}). User request: ${input.prompt}`,
        maxOutputTokens: 220,
      });
      job.status = 'READY';
      job.resultNote = out.text;
    } catch (e) {
      const code = (e as { code?: string; response?: { code?: string } })?.code;
      if (code === AI_PROVIDER_NOT_CONFIGURED || e instanceof ServiceUnavailableException) {
        job.status = 'PROVIDER_UNAVAILABLE';
        job.resultNote =
          'Design request captured and bound to a real listing. Image generation provider is not configured yet — RFQ/search can continue from this listing.';
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
