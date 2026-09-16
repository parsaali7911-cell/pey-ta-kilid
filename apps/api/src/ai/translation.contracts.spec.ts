import {
  AiUsageOperation,
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
  defaultTargetLocales,
  estimateOpenAiCostUsd,
  hashTranslationSource,
  normalizeSourceText,
  parseTranslationPayload,
  sanitizeAiUsageMetadata,
  TranslationJobStatus,
} from '@peytakilid/shared-types';
import { AiGatewayService, NullAiProvider } from './ai-gateway.service';
import { OpenAiProvider } from './openai.provider';
import { TranslationService } from './translation.service';

describe('translation contracts (Phase 0-H)', () => {
  it('supports fa→en/ar and en→fa/ar locale paths', () => {
    expect(defaultTargetLocales('fa')).toEqual(['en', 'ar']);
    expect(defaultTargetLocales('en')).toEqual(['fa', 'ar']);
    expect(defaultTargetLocales('ar')).toEqual(['fa', 'en']);
  });

  it('is null-safe and preserves exact source text', () => {
    expect(normalizeSourceText(null)).toBeNull();
    expect(normalizeSourceText('   ')).toBeNull();
    expect(normalizeSourceText('  Tile  ')).toBe('  Tile  ');
  });

  it('hashes source for cache keys and changes when source changes', () => {
    const a = hashTranslationSource('کاشی', 'fa');
    const b = hashTranslationSource('کاشی', 'fa');
    const c = hashTranslationSource('کاشی جدید', 'fa');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('parses deterministic JSON translation payloads', () => {
    const parsed = parseTranslationPayload(
      'Here you go:\n{"title":"Ceramic Tile","description":null}\n',
      ['title', 'description', 'seoTitle'],
    );
    expect(parsed.title).toBe('Ceramic Tile');
    expect(parsed.description).toBeNull();
    expect(parsed.seoTitle).toBeNull();
  });

  it('builds structured prompts without inventing catalog facts', () => {
    expect(buildTranslationSystemPrompt()).toMatch(/Do not invent product facts/);
    const prompt = buildTranslationUserPrompt({
      sourceLocale: 'fa',
      targetLocale: 'en',
      fields: { title: 'کاشی', description: null },
    });
    expect(JSON.parse(prompt)).toEqual({
      sourceLocale: 'fa',
      targetLocale: 'en',
      fields: { title: 'کاشی', description: null },
    });
  });

  it('sanitizes usage metadata and never keeps API keys', () => {
    const clean = sanitizeAiUsageMetadata({
      apiKey: 'sk-secret',
      OPENAI_API_KEY: 'sk-abc1234567890',
      note: 'ok',
      authorization: 'Bearer x',
    });
    expect(clean).toEqual({ note: 'ok' });
    expect(JSON.stringify(clean)).not.toMatch(/sk-|apiKey|OPENAI/i);
  });

  it('estimates cost when tokens available', () => {
    expect(
      estimateOpenAiCostUsd({
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        inputPer1M: 0.15,
        outputPer1M: 0.6,
      }),
    ).toBe(0.75);
    expect(estimateOpenAiCostUsd({})).toBeNull();
  });

  it('routes complete() through AI Gateway (null → 503 path)', async () => {
    const gateway = new AiGatewayService(new NullAiProvider());
    expect(gateway.getProviderName()).toBe('none');
    await expect(
      gateway.complete({
        system: buildTranslationSystemPrompt(),
        prompt: buildTranslationUserPrompt({
          sourceLocale: 'en',
          targetLocale: 'fa',
          fields: { title: 'Tile' },
        }),
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PROVIDER_NOT_CONFIGURED' }) });
  });

  it('constructs OpenAI provider only with key (never returns key)', () => {
    const provider = new OpenAiProvider('sk-test-key-not-returned', 'gpt-4o-mini');
    expect(provider.name).toBe('openai');
    expect(JSON.stringify(provider)).not.toMatch(/sk-test-key/);
  });
});

describe('translation service cache + failure behavior', () => {
  function mockDeps(opts?: {
    existing?: {
      status: string;
      sourceHash: string;
      translatedText: string | null;
    } | null;
    completeImpl?: () => Promise<{
      text: string;
      provider: string;
      model?: string;
      usage?: { inputTokens?: number; outputTokens?: number };
    }>;
  }) {
    const upserts: unknown[] = [];
    const records: unknown[] = [];
    const usageEvents: unknown[] = [];
    let completeCalls = 0;

    const localization = {
      upsertContent: jest.fn(async (input: unknown) => {
        upserts.push(input);
        return input;
      }),
    };

    const prisma = {
      translationRecord: {
        findUnique: jest.fn(async () => opts?.existing ?? null),
        update: jest.fn(async () => ({})),
        upsert: jest.fn(async (args: { create: unknown }) => {
          records.push(args.create);
          return args.create;
        }),
      },
    };

    const ai = {
      getProviderName: () => 'test',
      complete: jest.fn(async () => {
        completeCalls += 1;
        if (opts?.completeImpl) return opts.completeImpl();
        return {
          text: '{"title":"کاشی","description":"توضیح"}',
          provider: 'openai',
          model: 'gpt-4o-mini',
          usage: { inputTokens: 10, outputTokens: 20 },
        };
      }),
    };

    const usage = {
      record: jest.fn(async (e: unknown) => {
        usageEvents.push(e);
        return e;
      }),
    };

    const service = new TranslationService(
      prisma as never,
      localization as never,
      ai as never,
      usage as never,
    );

    return { service, localization, prisma, ai, usage, upserts, records, usageEvents, getCompleteCalls: () => completeCalls };
  }

  it('skips API call when sourceHash unchanged (cache hit)', async () => {
    const source = 'Ceramic Tile';
    const hash = hashTranslationSource(source, 'en');
    const { service, ai, getCompleteCalls } = mockDeps({
      existing: {
        status: 'READY',
        sourceHash: hash,
        translatedText: 'کاشی سرامیکی',
      },
    });

    const result = await service.translateContent({
      entityType: 'LISTING',
      entityId: 'lst1',
      sourceLocale: 'en',
      targetLocales: ['fa'],
      fields: [{ field: 'title', sourceText: source }],
    });

    expect(getCompleteCalls()).toBe(0);
    expect(ai.complete).not.toHaveBeenCalled();
    expect(result.results[0].cached).toBe(true);
    expect(result.results[0].status).toBe(TranslationJobStatus.SKIPPED);
    expect(result.preservedSource.title).toBe(source);
  });

  it('regenerates when source content changes', async () => {
    const oldHash = hashTranslationSource('Old title', 'en');
    const { service, getCompleteCalls, records } = mockDeps({
      existing: {
        status: 'READY',
        sourceHash: oldHash,
        translatedText: 'قدیمی',
      },
    });

    const result = await service.translateContent({
      entityType: 'LISTING',
      entityId: 'lst1',
      sourceLocale: 'en',
      targetLocales: ['fa'],
      fields: [{ field: 'title', sourceText: 'New title' }],
    });

    expect(getCompleteCalls()).toBe(1);
    expect(result.results[0].cached).toBe(false);
    expect(result.results[0].status).toBe(TranslationJobStatus.READY);
    expect(records.length).toBeGreaterThan(0);
  });

  it('failure does not destroy original source content', async () => {
    const { service, upserts, getCompleteCalls } = mockDeps({
      completeImpl: async () => {
        throw new Error('provider down');
      },
    });

    const result = await service.translateContent({
      entityType: 'LISTING',
      entityId: 'lst1',
      sourceLocale: 'en',
      targetLocales: ['fa', 'ar'],
      fields: [
        { field: 'title', sourceText: 'Keep me' },
        { field: 'description', sourceText: null },
      ],
    });

    expect(getCompleteCalls()).toBeGreaterThan(0);
    // Source locale upsert preserved
    expect(upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          localeCode: 'en',
          field: 'title',
          value: 'Keep me',
        }),
      ]),
    );
    // No target locale overwrite with empty destroy
    expect(upserts.every((u) => (u as { localeCode: string }).localeCode === 'en')).toBe(true);
    expect(result.preservedSource.title).toBe('Keep me');
    expect(result.results.every((r) => r.status === TranslationJobStatus.FAILED)).toBe(true);
  });

  it('records TRANSLATION usage with provider and tokens', async () => {
    const { service, usageEvents } = mockDeps();
    await service.translateContent({
      entityType: 'LISTING',
      entityId: 'lst1',
      sourceLocale: 'en',
      targetLocales: ['fa'],
      fields: [{ field: 'title', sourceText: 'Tile' }],
    });
    expect(usageEvents[0]).toEqual(
      expect.objectContaining({
        provider: 'openai',
        operation: AiUsageOperation.TRANSLATION,
        sourceLocale: 'en',
        targetLocale: 'fa',
        inputTokens: 10,
        outputTokens: 20,
      }),
    );
  });

  it('scheduleAfterContentChange returns immediately without blocking', () => {
    const { service } = mockDeps();
    const accepted = service.scheduleAfterContentChange({
      entityType: 'LISTING',
      entityId: 'lst1',
      sourceLocale: 'fa',
      fields: [{ field: 'title', sourceText: 'کاشی' }],
    });
    expect(accepted).toEqual({
      accepted: true,
      mode: 'async',
      entityType: 'LISTING',
      entityId: 'lst1',
    });
  });
});
