import { ServiceUnavailableException } from '@nestjs/common';
import {
  AI_PROVIDER_NOT_CONFIGURED,
  DEFAULT_AI_BUDGETS,
} from '@peytakilid/shared-types';
import { AI_CATALOG_ACCESS_POLICY } from '../common/contracts/ai-catalog-access';
import { AiGatewayService, NullAiProvider } from './ai-gateway.service';

describe('AiGateway (Phase 0-F)', () => {
  it('null provider surfaces as 503 PROVIDER_NOT_CONFIGURED', async () => {
    const gateway = new AiGatewayService(new NullAiProvider(), DEFAULT_AI_BUDGETS);
    expect(gateway.getProviderName()).toBe('none');
    await expect(gateway.complete({ prompt: 'ping' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    try {
      await gateway.embed({ texts: ['a'] });
    } catch (e) {
      const err = e as ServiceUnavailableException;
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(err.getResponse()).toEqual(
        expect.objectContaining({ code: AI_PROVIDER_NOT_CONFIGURED }),
      );
    }
  });

  it('enforces token/output budgets', async () => {
    const calls: number[] = [];
    const provider = {
      name: 'test',
      async complete(input: { maxOutputTokens: number }) {
        calls.push(input.maxOutputTokens);
        return { text: 'ok', provider: 'test' };
      },
      async embed() {
        return { vectors: [[0]], provider: 'test' };
      },
      async vision(input: { maxOutputTokens: number }) {
        calls.push(input.maxOutputTokens);
        return { attributes: {}, provider: 'test' };
      },
    };
    const gateway = new AiGatewayService(provider, {
      maxCompleteOutputTokens: 32,
      maxEmbedTexts: 2,
      maxVisionOutputTokens: 16,
    });
    await gateway.complete({ prompt: 'x', maxOutputTokens: 999 });
    await gateway.vision({ imageRef: 'img', maxOutputTokens: 999 });
    expect(calls).toEqual([32, 16]);
    const embed = await gateway.embed({ texts: ['a', 'b', 'c'], maxTexts: 99 });
    expect(embed.vectors).toHaveLength(1);
  });

  it('declares read-only public catalog access policy', () => {
    const gateway = new AiGatewayService(new NullAiProvider());
    const access = gateway.assertReadOnlyCatalogAccess();
    expect(access.mayWrite).toEqual([]);
    expect(access.mayRead).toEqual(
      expect.arrayContaining(['publicListing', 'publicPrice', 'publicInventory']),
    );
    expect(AI_CATALOG_ACCESS_POLICY.mode).toBe('read_only');
    expect(AI_CATALOG_ACCESS_POLICY.mayWrite).toEqual([]);
  });
});
