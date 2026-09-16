export type AiCompleteInput = {
  system?: string;
  prompt: string;
  maxOutputTokens: number;
};

export type AiCompleteOutput = {
  text: string;
  provider: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type AiEmbedInput = {
  texts: string[];
  maxTexts: number;
};

export type AiEmbedOutput = {
  vectors: number[][];
  provider: string;
  model?: string;
};

export type AiVisionInput = {
  imageRef: string;
  prompt?: string;
  maxOutputTokens: number;
};

export type AiVisionOutput = {
  attributes: Record<string, string | number | boolean>;
  caption?: string;
  provider: string;
  model?: string;
};

/**
 * Provider-agnostic AI port. Implementations must never invent catalog prices/stock.
 * Null provider throws PROVIDER_NOT_CONFIGURED (HTTP 503 at gateway).
 */
export interface AiProvider {
  readonly name: string;
  complete(input: AiCompleteInput): Promise<AiCompleteOutput>;
  embed(input: AiEmbedInput): Promise<AiEmbedOutput>;
  vision(input: AiVisionInput): Promise<AiVisionOutput>;
}

export type AiGatewayBudgets = {
  maxCompleteOutputTokens: number;
  maxEmbedTexts: number;
  maxVisionOutputTokens: number;
};

export const DEFAULT_AI_BUDGETS: AiGatewayBudgets = {
  maxCompleteOutputTokens: 512,
  maxEmbedTexts: 16,
  maxVisionOutputTokens: 256,
};

export const AI_PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED';
