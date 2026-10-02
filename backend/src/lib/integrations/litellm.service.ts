import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isUnconfigured, resolveConfig } from '../config';
import { ServiceUnconfiguredError } from '../../common/errors/service-unconfigured.error';

const SERVICE = 'litellm';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type CompleteArgs = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type EmbedArgs = {
  input: string | string[];
  model?: string;
};

/**
 * LiteLLM proxy client.
 *
 * LiteLLM exposes an OpenAI-compatible REST surface — we use plain fetch so
 * there is no extra SDK dependency. The `OPENAI_MODEL` env var, if present,
 * overrides the default chat model (LiteLLM maps "default" to the configured
 * provider; OpenShift AI requires the exact deployed model name).
 *
 * Throws `ServiceUnconfiguredError` whenever LITELLM_BASE_URL or
 * LITELLM_API_KEY resolve to null/placeholder — the global filter maps that
 * to a 503 with `{ service: 'litellm' }`.
 */
@Injectable()
export class LiteLLMService {
  private readonly logger = new Logger('LiteLLMService');

  constructor(private readonly prisma: PrismaService) {}

  private async getCredentials(): Promise<{ baseUrl: string; apiKey: string }> {
    const baseUrl = await resolveConfig(this.prisma, 'LITELLM_BASE_URL');
    const apiKey = await resolveConfig(this.prisma, 'LITELLM_API_KEY');
    if (isUnconfigured(baseUrl) || isUnconfigured(apiKey)) {
      throw new ServiceUnconfiguredError(
        SERVICE,
        'LiteLLM base URL / API key are not configured.',
      );
    }
    return { baseUrl: baseUrl!.replace(/\/+$/, ''), apiKey: apiKey! };
  }

  async complete(args: CompleteArgs): Promise<string> {
    const { baseUrl, apiKey } = await this.getCredentials();
    const model =
      args.model ?? process.env.OPENAI_MODEL ?? 'default';

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: args.messages,
        temperature: args.temperature ?? 0.2,
        max_tokens: args.maxTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`LiteLLM chat failed (${res.status}): ${text}`);
      throw new ServiceUnconfiguredError(
        SERVICE,
        `LiteLLM returned ${res.status} — check the proxy is reachable.`,
      );
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content ?? '';
  }

  async embed(args: EmbedArgs): Promise<number[][]> {
    const { baseUrl, apiKey } = await this.getCredentials();
    const model =
      args.model ?? process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small';

    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: args.input }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`LiteLLM embed failed (${res.status}): ${text}`);
      throw new ServiceUnconfiguredError(
        SERVICE,
        `LiteLLM embeddings returned ${res.status}.`,
      );
    }

    const body = (await res.json()) as {
      data?: { embedding: number[] }[];
    };
    return (body.data ?? []).map((d) => d.embedding);
  }
}
