import type { LLMProvider } from './provider.js';
import { ProviderChain } from './provider.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { OllamaProvider } from './providers/ollama.js';
import type { LLMProviderConfig } from '../config/schema.js';
import { loadConfig } from '../config/loader.js';

export function createProvider(cfg?: LLMProviderConfig): LLMProvider {
  const config = cfg ?? loadConfig().llm;

  const primary = buildProvider(config.provider, config.model, config.apiKey);

  if (!config.fallback || config.fallback.length === 0) {
    return primary;
  }

  const fallbacks = config.fallback.map((fb) => buildProvider(fb.provider, fb.model));
  return new ProviderChain([primary, ...fallbacks]);
}

function buildProvider(
  provider: 'anthropic' | 'openai' | 'ollama',
  model: string,
  apiKey?: string
): LLMProvider {
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(model, apiKey);
    case 'openai':
      return new OpenAIProvider(model, apiKey);
    case 'ollama':
      return new OllamaProvider(model);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
