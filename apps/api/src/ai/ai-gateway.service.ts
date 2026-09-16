import {
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AI_PROVIDER_NOT_CONFIGURED,
  AiCompleteInput,
  AiCompleteOutput,
  AiEmbedInput,
  AiEmbedOutput,
  AiImageGenerateInput,
  AiImageGenerateOutput,
  AiProvider,
  AiVisionInput,
  AiVisionOutput,
  DEFAULT_AI_BUDGETS,
} from '@peytakilid/shared-types';

/** Deterministic null provider — never invents catalog facts. */
export class NullAiProvider implements AiProvider {
  readonly name = 'none';

  async complete(): Promise<AiCompleteOutput> {
    throw Object.assign(new Error(AI_PROVIDER_NOT_CONFIGURED), {
      code: AI_PROVIDER_NOT_CONFIGURED,
    });
  }

  async embed(): Promise<AiEmbedOutput> {
    throw Object.assign(new Error(AI_PROVIDER_NOT_CONFIGURED), {
      code: AI_PROVIDER_NOT_CONFIGURED,
    });
  }

  async vision(): Promise<AiVisionOutput> {
    throw Object.assign(new Error(AI_PROVIDER_NOT_CONFIGURED), {
      code: AI_PROVIDER_NOT_CONFIGURED,
    });
  }

  async imageGenerate(): Promise<AiImageGenerateOutput> {
    throw Object.assign(new Error(AI_PROVIDER_NOT_CONFIGURED), {
      code: AI_PROVIDER_NOT_CONFIGURED,
    });
  }
}

export class AiGatewayService {
  constructor(
    private readonly provider: AiProvider,
    private readonly budgets = DEFAULT_AI_BUDGETS,
  ) {}

  getProviderName() {
    return this.provider.name;
  }

  async complete(input: Omit<AiCompleteInput, 'maxOutputTokens'> & { maxOutputTokens?: number }) {
    const maxOutputTokens = Math.min(
      input.maxOutputTokens ?? this.budgets.maxCompleteOutputTokens,
      this.budgets.maxCompleteOutputTokens,
    );
    try {
      return await this.provider.complete({ ...input, maxOutputTokens });
    } catch (e) {
      this.rethrowProvider(e);
    }
  }

  async embed(input: Omit<AiEmbedInput, 'maxTexts'> & { maxTexts?: number; texts: string[] }) {
    const maxTexts = Math.min(
      input.maxTexts ?? this.budgets.maxEmbedTexts,
      this.budgets.maxEmbedTexts,
    );
    const texts = input.texts.slice(0, maxTexts);
    try {
      return await this.provider.embed({ texts, maxTexts });
    } catch (e) {
      this.rethrowProvider(e);
    }
  }

  async vision(input: Omit<AiVisionInput, 'maxOutputTokens'> & { maxOutputTokens?: number }) {
    const maxOutputTokens = Math.min(
      input.maxOutputTokens ?? this.budgets.maxVisionOutputTokens,
      this.budgets.maxVisionOutputTokens,
    );
    try {
      return await this.provider.vision({ ...input, maxOutputTokens });
    } catch (e) {
      this.rethrowProvider(e);
    }
  }

  async imageGenerate(input: AiImageGenerateInput): Promise<AiImageGenerateOutput> {
    try {
      if (!this.provider.imageGenerate) {
        throw Object.assign(new Error(AI_PROVIDER_NOT_CONFIGURED), {
          code: AI_PROVIDER_NOT_CONFIGURED,
        });
      }
      return await this.provider.imageGenerate(input);
    } catch (e) {
      this.rethrowProvider(e);
    }
  }

  /** Rule-path only — AI must not invent prices/stock/identity. */
  assertReadOnlyCatalogAccess() {
    return {
      mayRead: ['publicListing', 'publicPrice', 'publicInventory', 'publicFacilityLocation'] as const,
      mayWrite: [] as const,
      forbidden: [
        'supplierCost',
        'onHand',
        'reserved',
        'line1',
        'sellerPrivateContact',
        'inventAvailability',
        'inventPrice',
      ] as const,
    };
  }

  private rethrowProvider(e: unknown): never {
    const err = e as { code?: string; message?: string };
    if (err?.code === AI_PROVIDER_NOT_CONFIGURED || err?.message === AI_PROVIDER_NOT_CONFIGURED) {
      throw new ServiceUnavailableException({
        code: AI_PROVIDER_NOT_CONFIGURED,
        message: 'AI provider is not configured',
      });
    }
    throw e;
  }
}
