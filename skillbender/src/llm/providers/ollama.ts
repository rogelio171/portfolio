import { generateText, streamText } from 'ai';
import { createOllama } from '@ai-sdk/ollama';
import type {
  LLMProvider,
  Message,
  CompletionOptions,
  LLMResponse,
  LLMStreamChunk,
} from '../provider.js';

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private readonly client;

  constructor(
    readonly model: string,
    baseUrl?: string
  ) {
    this.client = createOllama({
      baseURL: baseUrl ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434/api',
    });
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<LLMResponse> {
    const result = await generateText({
      model: this.client(this.model),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });

    const inputTokens = result.usage?.promptTokens ?? 0;
    const outputTokens = result.usage?.completionTokens ?? 0;

    return {
      content: result.text,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        // Local models have no API cost
        estimatedCostUsd: 0,
      },
      model: this.model,
      provider: this.name,
    };
  }

  async *stream(messages: Message[], options?: CompletionOptions): AsyncIterable<LLMStreamChunk> {
    const result = streamText({
      model: this.client(this.model),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });

    for await (const chunk of result.textStream) {
      yield { delta: chunk, done: false };
    }
    yield { delta: '', done: true };
  }
}
