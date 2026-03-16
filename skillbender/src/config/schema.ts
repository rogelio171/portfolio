import { z } from 'zod';

const LLMProviderConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'ollama']),
  model: z.string(),
  apiKey: z.string().optional(),
  maxTokens: z.number().int().positive().default(8192),
  temperature: z.number().min(0).max(2).default(0.2),
  fallback: z
    .array(
      z.object({
        provider: z.enum(['anthropic', 'openai', 'ollama']),
        model: z.string(),
      })
    )
    .optional(),
});

const PipelineConfigSchema = z.object({
  stages: z
    .array(z.enum(['analyze', 'spec', 'implement', 'validate', 'document']))
    .default(['analyze', 'spec', 'implement', 'validate', 'document']),
  checkpoints: z.array(z.string()).default(['spec']),
  maxRetries: z.number().int().positive().default(3),
  maxReviewLoops: z.number().int().positive().default(3),
});

const AnalyzerConfigSchema = z.object({
  include: z.array(z.string()).default(['src', 'lib', 'app']),
  exclude: z
    .array(z.string())
    .default(['node_modules', 'dist', '.git', '*.test.*', '*.spec.*']),
  maxFileSize: z.number().int().positive().default(102400),
});

const TrackerConfigSchema = z.object({
  outputDir: z.string().default('.skillbender/specs'),
  autoCommit: z.boolean().default(false),
});

const DocsConfigSchema = z.object({
  dirs: z.array(z.string()).default(['docs', 'README.md']),
  createIfMissing: z.boolean().default(true),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['pretty', 'json']).default('pretty'),
});

export const SkillBenderConfigSchema = z.object({
  version: z.string().default('1'),
  llm: LLMProviderConfigSchema,
  pipeline: PipelineConfigSchema.default({}),
  analyzer: AnalyzerConfigSchema.default({}),
  tracker: TrackerConfigSchema.default({}),
  docs: DocsConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
});

export type SkillBenderConfig = z.infer<typeof SkillBenderConfigSchema>;
export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>;
