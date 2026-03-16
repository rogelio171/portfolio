import { generateText, streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type {
  LLMProvider,
  Message,
  CompletionOptions,
  LLMResponse,
  LLMStreamChunk,
} from '../provider.js';

// Approximate cost per million tokens (update as pricing changes)
const COST_PER_M_INPUT: Record<string, number> = {
  'claude-opus-4-6': 15.0,
  'claude-sonnet-4-6': 3.0,
  'claude-haiku-4-5-20251001': 0.25,
};
const COST_PER_M_OUTPUT: Record<string, number> = {
  'claude-opus-4-6': 75.0,
  'claude-sonnet-4-6': 15.0,
  'claude-haiku-4-5-20251001': 1.25,
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const inRate = COST_PER_M_INPUT[model] ?? 3.0;
  const outRate = COST_PER_M_OUTPUT[model] ?? 15.0;
  return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly client;

  constructor(
    readonly model: string,
    apiKey?: string
  ) {
    this.client = createAnthropic({
      apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
  }

  async complete(messages: Message[], options?: CompletionOptions): Promise<LLMResponse> {
    const systemMsg = options?.systemPrompt ?? messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system');

    const result = await generateText({
      model: this.client(this.model),
      system: systemMsg,
      messages: userMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
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
        estimatedCostUsd: estimateCost(this.model, inputTokens, outputTokens),
      },
      model: this.model,
      provider: this.name,
    };
  }

  async *stream(messages: Message[], options?: CompletionOptions): AsyncIterable<LLMStreamChunk> {
    const systemMsg = options?.systemPrompt ?? messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system');

    const result = streamText({
      model: this.client(this.model),
      system: systemMsg,
      messages: userMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });

    for await (const chunk of result.textStream) {
      yield { delta: chunk, done: false };
    }
    yield { delta: '', done: true };
  }
}
