import {
  AiCompleteInput,
  AiCompleteOutput,
  AiEmbedInput,
  AiEmbedOutput,
  AiProvider,
  AiVisionInput,
  AiVisionOutput,
  AI_PROVIDER_NOT_CONFIGURED,
} from '@peytakilid/shared-types';

/** OpenAI provider — used only via AiGatewayService. Never expose apiKey. */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  readonly #apiKey: string;
  readonly #model: string;

  constructor(apiKey: string, model: string) {
    if (!apiKey) {
      throw Object.assign(new Error(AI_PROVIDER_NOT_CONFIGURED), {
        code: AI_PROVIDER_NOT_CONFIGURED,
      });
    }
    this.#apiKey = apiKey;
    this.#model = model;
  }

  async complete(input: AiCompleteInput): Promise<AiCompleteOutput> {
    const messages: Array<{ role: string; content: string }> = [];
    if (input.system) messages.push({ role: 'system', content: input.system });
    messages.push({ role: 'user', content: input.prompt });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.#model,
        temperature: 0,
        max_tokens: input.maxOutputTokens,
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OPENAI_COMPLETE_FAILED:${res.status}:${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      text: json.choices?.[0]?.message?.content ?? '',
      provider: this.name,
      model: json.model ?? this.#model,
      usage: {
        inputTokens: json.usage?.prompt_tokens,
        outputTokens: json.usage?.completion_tokens,
      },
    };
  }

  async embed(input: AiEmbedInput): Promise<AiEmbedOutput> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: input.texts.slice(0, input.maxTexts),
      }),
    });
    if (!res.ok) throw new Error(`OPENAI_EMBED_FAILED:${res.status}`);
    const json = (await res.json()) as {
      data?: Array<{ embedding: number[] }>;
      model?: string;
    };
    return {
      vectors: (json.data ?? []).map((d) => d.embedding),
      provider: this.name,
      model: json.model,
    };
  }

  async vision(_input: AiVisionInput): Promise<AiVisionOutput> {
    throw new Error('OPENAI_VISION_NOT_IMPLEMENTED');
  }
}
