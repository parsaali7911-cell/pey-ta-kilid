import { readFileSync } from 'fs';
import {
  AiCompleteInput,
  AiCompleteOutput,
  AiEmbedInput,
  AiEmbedOutput,
  AiImageGenerateInput,
  AiImageGenerateOutput,
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
  readonly #imageModel: string;

  constructor(apiKey: string, model: string, imageModel = 'gpt-image-1') {
    if (!apiKey) {
      throw Object.assign(new Error(AI_PROVIDER_NOT_CONFIGURED), {
        code: AI_PROVIDER_NOT_CONFIGURED,
      });
    }
    this.#apiKey = apiKey;
    this.#model = model;
    this.#imageModel = imageModel;
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

  async vision(input: AiVisionInput): Promise<AiVisionOutput> {
    const imageUrl = await resolveImageDataUrl(input.imageRef);
    const prompt =
      input.prompt ||
      'Describe this construction/interior space photo. Return JSON only with keys: caption (string), color (string), material (string optional), categoryHint (string optional), roomType (string optional).';

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
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You extract visual attributes for a construction marketplace. Never invent prices or stock. Reply with JSON only.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OPENAI_VISION_FAILED:${res.status}:${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const raw = json.choices?.[0]?.message?.content ?? '{}';
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = { caption: raw.slice(0, 240) };
    }

    const attributes: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k === 'caption') continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        attributes[k] = v;
      }
    }

    return {
      attributes,
      caption: typeof parsed.caption === 'string' ? parsed.caption : undefined,
      provider: this.name,
      model: json.model ?? this.#model,
    };
  }

  async imageGenerate(input: AiImageGenerateInput): Promise<AiImageGenerateOutput> {
    if (input.imageRef) {
      return this.imageEdit(input);
    }

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.#imageModel,
        prompt: input.prompt,
        size: input.size || '1024x1024',
        n: 1,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OPENAI_IMAGE_GENERATE_FAILED:${res.status}:${body.slice(0, 200)}`);
    }

    return parseImageResponse(await res.json(), this.name, this.#imageModel);
  }

  private async imageEdit(input: AiImageGenerateInput): Promise<AiImageGenerateOutput> {
    const spaceBytes = await readImageBytes(input.imageRef!);
    const form = new FormData();
    form.append('model', this.#imageModel);
    form.append('prompt', input.prompt);
    form.append('size', input.size || '1024x1024');
    form.append('n', '1');
    form.append(
      'image',
      new Blob([new Uint8Array(spaceBytes.buffer)], { type: spaceBytes.mimeType }),
      'space.png',
    );
    if (input.productImageRef) {
      const productBytes = await readImageBytes(input.productImageRef);
      form.append(
        'image',
        new Blob([new Uint8Array(productBytes.buffer)], { type: productBytes.mimeType }),
        'product.png',
      );
    }

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OPENAI_IMAGE_EDIT_FAILED:${res.status}:${body.slice(0, 200)}`);
    }

    return parseImageResponse(await res.json(), this.name, this.#imageModel);
  }
}

function parseImageResponse(
  json: unknown,
  provider: string,
  model: string,
): AiImageGenerateOutput {
  const data = json as {
    data?: Array<{ b64_json?: string; url?: string }>;
    model?: string;
  };
  const first = data.data?.[0];
  if (first?.b64_json) {
    return {
      imageBase64: first.b64_json,
      mimeType: 'image/png',
      provider,
      model: data.model ?? model,
    };
  }
  throw new Error('OPENAI_IMAGE_EMPTY_RESPONSE');
}

async function resolveImageDataUrl(imageRef: string): Promise<string> {
  if (imageRef.startsWith('data:') || imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
    return imageRef;
  }
  const bytes = await readImageBytes(imageRef);
  return `data:${bytes.mimeType};base64,${bytes.buffer.toString('base64')}`;
}

async function readImageBytes(
  imageRef: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (imageRef.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(imageRef);
    if (!match) throw new Error('OPENAI_BAD_DATA_URL');
    return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
  }
  if (imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
    const res = await fetch(imageRef);
    if (!res.ok) throw new Error(`OPENAI_IMAGE_FETCH_FAILED:${res.status}`);
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    const ab = await res.arrayBuffer();
    return { buffer: Buffer.from(ab), mimeType };
  }
  // Local filesystem path (designer/search uploads).
  const buffer = readFileSync(imageRef);
  const lower = imageRef.toLowerCase();
  const mimeType = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  return { buffer, mimeType };
}
