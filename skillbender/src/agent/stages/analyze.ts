/**
 * Analyze stage — scans the codebase and finds similar implementations.
 * Output: structured summary injected into subsequent stages.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { scanCodebase, buildLLMContext } from '../../analyzer/codebase.js';
import { addProgressEntry, saveSpec } from '../../tracker/spec.js';
import { createProvider } from '../../llm/factory.js';
import { withRetry } from '../../utils/retry.js';
import { loadConfig } from '../../config/loader.js';
import { getLogger } from '../../logger/index.js';
import type { PipelineState } from '../state.js';

const log = getLogger('analyze');

export async function runAnalyzeStage(state: PipelineState): Promise<void> {
  const cfg = loadConfig();
  const provider = createProvider();

  log.info('Scanning codebase...');
  const snapshot = await scanCodebase(process.cwd());
  state.codebaseSnapshot = snapshot;

  log.info({ files: snapshot.totalFiles }, 'Codebase scanned');

  // Read relevant prompts
  const promptPath = join(process.cwd(), 'prompts', 'analyze.md');
  const promptTemplate = existsSync(promptPath)
    ? readFileSync(promptPath, 'utf-8')
    : DEFAULT_ANALYZE_PROMPT;

  const codebaseContext = buildLLMContext(snapshot);

  const systemPrompt = promptTemplate
    .replace('{{FEATURE_DESCRIPTION}}', state.featureDescription)
    .replace('{{CODEBASE_CONTEXT}}', codebaseContext);

  log.info('Asking LLM to identify similar patterns...');

  const response = await withRetry(
    () =>
      provider.complete(
        [
          {
            role: 'user',
            content: `Feature to implement: ${state.featureDescription}`,
          },
        ],
        {
          systemPrompt,
          maxTokens: cfg.llm.maxTokens,
          temperature: cfg.llm.temperature,
        }
      ),
    {
      maxAttempts: cfg.pipeline.maxRetries,
      onRetry: (attempt, err, delay) =>
        log.warn({ attempt, delay, err }, 'Retrying analyze LLM call'),
    }
  );

  state.similarPatterns = response.content;

  if (state.spec) {
    addProgressEntry(
      state.spec,
      'analyze',
      `Scanned ${snapshot.totalFiles} files. Found similar patterns.`
    );
    saveSpec(state.spec);
  }

  log.info(
    {
      tokens: response.usage.totalTokens,
      cost: response.usage.estimatedCostUsd?.toFixed(4),
    },
    'Analyze stage complete'
  );
}

const DEFAULT_ANALYZE_PROMPT = `You are an expert software architect analyzing a codebase.

## Task
Analyze the codebase below and identify:
1. Existing patterns, utilities, or modules that are similar to the requested feature
2. Conventions and coding styles used in the project
3. Relevant files that the implementer should be aware of
4. Potential integration points for the new feature
5. Any potential conflicts or dependencies to watch for

## Feature to Implement
{{FEATURE_DESCRIPTION}}

## Codebase
{{CODEBASE_CONTEXT}}

## Output Format
Return a structured markdown analysis with:
- **Similar Patterns Found**: List of existing implementations relevant to this feature
- **Coding Conventions**: Key patterns, naming conventions, and architectural decisions observed
- **Relevant Files**: Most important files the implementer should read
- **Integration Points**: Where the new feature should hook into existing code
- **Risks & Dependencies**: Anything to watch for during implementation
`;
