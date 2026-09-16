import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AI_PROVIDER_NOT_CONFIGURED,
  RequestIntent,
} from '@peytakilid/shared-types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { IntentService } from '../intent/intent.service';
import { SearchService } from './search.service';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'search');

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function toneFromRgb(r: number, g: number, b: number): string {
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r > 150 && g > 120 && b < 100) return 'beige';
  if (r > 160 && g < 90 && b < 90) return 'red';
  if (g > r && g > b) return 'green';
  if (b > r && b > g) return 'blue';
  if (r < 60 && g < 60 && b < 60) return 'black';
  if (Math.abs(r - g) < 25 && Math.abs(g - b) < 25) return 'grey';
  return 'mixed';
}

function parseClientHex(hex?: string | null): { hex: string; tone: string } | null {
  if (!hex) return null;
  const clean = hex.replace('#', '').trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { hex: `#${clean}`, tone: toneFromRgb(r, g, b) };
}

@Injectable()
export class VisualVoiceSearchService {
  constructor(
    private readonly search: SearchService,
    private readonly intent: IntentService,
    private readonly ai: AiGatewayService,
  ) {}

  async visualSearch(input: {
    buffer?: Buffer;
    locale?: string;
    clientHex?: string | null;
    userText?: string | null;
  }) {
    const locale = input.locale || 'fa';
    const fromClient = parseClientHex(input.clientHex);
    let hex = fromClient?.hex || null;
    let tone = fromClient?.tone || null;
    let visionAttributes: Record<string, string | number | boolean> = {};
    let caption: string | undefined;
    let imageAssetId: string | null = null;

    if (input.buffer?.length) {
      if (input.buffer.length > 12 * 1024 * 1024) {
        throw new BadRequestException('Max upload size is 12MB');
      }
      ensureDir(UPLOAD_ROOT);
      const id = randomUUID();
      const path = join(UPLOAD_ROOT, `${id}.bin`);
      writeFileSync(path, input.buffer);
      imageAssetId = id;

      try {
        const vision = await this.ai.vision({
          imageRef: `file://${path}`,
          prompt:
            'Extract construction material attributes as flat JSON keys: material, color, pattern, finish, categoryHint. Do not invent prices or stock.',
        });
        visionAttributes = vision.attributes || {};
        caption = vision.caption;
        if (!tone && typeof visionAttributes.color === 'string') {
          tone = String(visionAttributes.color).toLowerCase();
        }
      } catch {
        // Provider may be unset — continue with client hex / caption-less path.
      }
    }

    const userText = (input.userText || '').trim();

    if (!hex && !tone && !Object.keys(visionAttributes).length && !caption && !userText) {
      throw new BadRequestException(
        'Provide an image (and preferably clientHex) for visual search',
      );
    }

    const textParts = [
      userText || null,
      caption,
      typeof visionAttributes.material === 'string' ? String(visionAttributes.material) : null,
      typeof visionAttributes.categoryHint === 'string'
        ? String(visionAttributes.categoryHint)
        : null,
      tone && tone !== 'mixed' ? tone : null,
    ].filter(Boolean) as string[];

    const softText = textParts.join(' ').trim();

    const nl = this.intent.parseHomepageRequest({
      text: softText || 'material',
      locale,
      market: 'IRAN',
      imageAssetId,
    });

    // Only real catalog attribute codes — never put tone/clientHex here (hard excludes).
    const realAttrHints: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(visionAttributes)) {
      if (['tone', 'clientHex', 'softText', 'caption', 'color'].includes(k)) continue;
      if (v !== undefined && v !== null && v !== '') realAttrHints[k] = v;
    }

    const base = nl.searchQuery || {
      requirements: {
        ...nl.intent.requirements,
        intent: RequestIntent.PRODUCT,
      },
      filters: { locale },
      limit: 24,
    };

    const ranked = await this.search.search({
      requirements: {
        ...base.requirements,
        intent: RequestIntent.PRODUCT,
        rawText: softText || null,
        attributeFilters: {
          ...(base.requirements.attributeFilters || {}),
        },
        missingFields: [],
        confidence: Math.max(base.requirements.confidence ?? 0.5, 0.6),
      },
      filters: {
        locale,
        text: softText || undefined,
        categoryHints: base.requirements.categoryHints?.length
          ? base.requirements.categoryHints
          : undefined,
        attributeFilters: {},
        visionAttributeHints: Object.keys(realAttrHints).length ? realAttrHints : undefined,
        requireAvailable: false,
        location: null,
      },
      limit: base.limit ?? 24,
    });

    return {
      hex,
      tone,
      caption: caption || userText || null,
      attributes: {
        ...visionAttributes,
        ...(base.requirements.attributeFilters || {}),
      },
      imageAssetId,
      city: nl.route?.city || nl.intent.requirements.location?.city || null,
      categorySlug: nl.route?.categorySlug || null,
      matchCount: ranked.hits.length,
      results: ranked.hits.map((h) => ({
        listingId: h.listingId,
        score: h.score,
        ...h.preview,
        matchedColor: hex,
      })),
      searchQuery: {
        requirements: {
          ...base.requirements,
          intent: RequestIntent.PRODUCT,
          rawText: softText || null,
        },
        filters: {
          locale,
          text: softText || undefined,
          categoryHints: base.requirements.categoryHints?.length
            ? base.requirements.categoryHints
            : undefined,
          visionAttributeHints: {
            ...(Object.keys(realAttrHints).length ? realAttrHints : {}),
            ...(tone ? { tone } : {}),
            ...(hex ? { clientHex: hex } : {}),
          },
          location: null,
        },
        limit: 24,
      },
      next: 'search' as const,
      route: nl.route,
    };
  }

  async voiceTranscribe(_input: { buffer: Buffer; locale?: string }) {
    void _input;
    void this.ai;
    throw new ServiceUnavailableException({
      code: AI_PROVIDER_NOT_CONFIGURED,
      message: 'Voice transcription provider not configured',
    });
  }
}
