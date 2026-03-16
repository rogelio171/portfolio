import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type {
  LLMProvider,
  Message,
  CompletionOptions,
  LLMResponse,
  LLMStreamChunk,
} from '../provider.js';

const COST_PER_M_INPUT: Record<string, number> = {
  'gpt-4o': 2.5,
  'gpt-4o-mini': 0.15,
  'o1': 15.0,
  'o1-mini': 3.0,
};
const COST_PER_M_OUTPUT: Record<string, number> = {
  'gpt-4o': 10.0,
  'gpt-4o-mini': 0.6,
  'o1': 60.0,
  'o1-mini': 12.0,
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const inRate = COST_PER_M_INPUT[model] ?? 2.5;
  const outRate = COST_PER_M_OUTPUT[model] ?? 10.0;
  return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly client;

  constructor(
    readonly model: string,
    apiKey?: string
  ) {
    this.client = createOpenAI({
      apiKey: apiKey ?? process.env['OPENAI_API_KEY'],
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
        estimatedCostUsd: estimateCost(this.model, inputTokens, outputTokens),
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
