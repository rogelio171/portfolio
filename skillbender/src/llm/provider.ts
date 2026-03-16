/**
 * Core provider-agnostic LLM interface.
 * All providers must implement this contract.
 * Backed by Vercel AI SDK for actual adapters.
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
  };
  model: string;
  provider: string;
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  tools?: Tool[];
  systemPrompt?: string;
}

/**
 * Core LLM abstraction — implemented by each provider adapter.
 */
export interface LLMProvider {
  readonly name: string;
  readonly model: string;

  complete(messages: Message[], options?: CompletionOptions): Promise<LLMResponse>;
  stream(messages: Message[], options?: CompletionOptions): AsyncIterable<LLMStreamChunk>;
}

/**
 * Provider registry for multi-provider fallback chains.
 */
export class ProviderChain {
  constructor(private readonly providers: LLMProvider[]) {
    if (providers.length === 0) throw new Error('ProviderChain requires at least one provider');
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        return await provider.complete(messages, options);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  async *stream(
    messages: Message[],
    options?: CompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    for (const provider of this.providers) {
      try {
        yield* provider.stream(messages, options);
        return;
      } catch {
        continue;
      }
    }
    throw new Error('All providers failed for streaming');
  }
}
