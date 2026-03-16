import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetConfigCache } from '../src/config/loader.js';

describe('Config loader', () => {
  beforeEach(() => {
    resetConfigCache();
  });

  it('returns default config when no config file exists', async () => {
    vi.stubEnv('SKILLBENDER_LLM_PROVIDER', 'anthropic');
    vi.stubEnv('SKILLBENDER_LLM_MODEL', 'claude-sonnet-4-6');

    const { loadConfig } = await import('../src/config/loader.js');
    const cfg = loadConfig();

    expect(cfg.llm.provider).toBe('anthropic');
    expect(cfg.llm.model).toBe('claude-sonnet-4-6');
    expect(cfg.pipeline.stages).toContain('analyze');
    expect(cfg.pipeline.stages).toContain('spec');
    expect(cfg.pipeline.stages).toContain('implement');

    vi.unstubAllEnvs();
  });
});
