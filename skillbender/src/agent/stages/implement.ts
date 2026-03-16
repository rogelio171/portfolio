/**
 * Implement stage — generates implementation code based on the spec.
 * Supports review loops (LLM self-reviews and refines up to maxReviewLoops).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { addProgressEntry, saveSpec, type SpecTask } from '../../tracker/spec.js';
import { createProvider } from '../../llm/factory.js';
import { buildLLMContext } from '../../analyzer/codebase.js';
import { withRetry } from '../../utils/retry.js';
import { loadConfig } from '../../config/loader.js';
import { getLogger } from '../../logger/index.js';
import type { PipelineState } from '../state.js';

const log = getLogger('implement');

export async function runImplementStage(state: PipelineState): Promise<void> {
  const cfg = loadConfig();
  const provider = createProvider();

  if (!state.spec) throw new Error('No spec available. Run the spec stage first.');

  const codebaseContext = state.codebaseSnapshot
    ? buildLLMContext(state.codebaseSnapshot, 60_000)
    : '';

  const promptPath = join(process.cwd(), 'prompts', 'implement.md');
  const promptTemplate = existsSync(promptPath)
    ? readFileSync(promptPath, 'utf-8')
    : DEFAULT_IMPLEMENT_PROMPT;

  const systemPrompt = promptTemplate
    .replace('{{SPEC_CONTENT}}', formatSpec(state))
    .replace('{{CODEBASE_CONTEXT}}', codebaseContext);

  const files = new Map<string, string>();
  let reviewLoop = 0;

  log.info('Generating implementation...');

  while (reviewLoop <= cfg.pipeline.maxReviewLoops) {
    const response = await withRetry(
      () =>
        provider.complete(
          [
            {
              role: 'user',
              content:
                reviewLoop === 0
                  ? `Implement the feature according to the spec.`
                  : `Review the previous implementation and improve it. Focus on correctness, edge cases, and code quality.`,
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
          log.warn({ attempt, delay }, 'Retrying implement LLM call'),
      }
    );

    const extracted = extractCodeBlocks(response.content);

    // If no new files extracted or no changes, stop looping
    if (extracted.size === 0 && reviewLoop > 0) break;

    for (const [path, content] of extracted) {
      files.set(path, content);
    }

    reviewLoop++;

    // Check if LLM signals it's done
    if (response.content.toLowerCase().includes('implementation complete')) break;
  }

  state.implementationFiles = files;

  // Write files to disk
  for (const [relativePath, content] of files) {
    const abs = join(process.cwd(), relativePath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf-8');
    log.info({ file: relativePath }, 'File written');
  }

  // Update task statuses in spec
  if (state.spec.tasks.length > 0) {
    state.spec.tasks = state.spec.tasks.map((t: SpecTask) => ({ ...t, status: 'done' as const }));
  }

  addProgressEntry(
    state.spec,
    'implement',
    `Implementation generated: ${files.size} file(s) written after ${reviewLoop} review loop(s).`
  );
  saveSpec(state.spec);

  log.info({ filesWritten: files.size, reviewLoops: reviewLoop }, 'Implement stage complete');
}

function formatSpec(state: PipelineState): string {
  if (!state.spec) return state.featureDescription;

  return [
    `## Feature: ${state.spec.title}`,
    `## Goal\n${state.spec.description}`,
    `## Approach\n${state.spec.approach}`,
    `## Tasks\n${state.spec.tasks.map((t) => `- ${t.description}`).join('\n')}`,
    `## Implementation Notes\n${state.spec.implementationNotes}`,
  ].join('\n\n');
}

/**
 * Extract code blocks from LLM response.
 * Looks for blocks annotated with a file path:
 *
 * ```typescript:src/foo/bar.ts
 * ...
 * ```
 */
function extractCodeBlocks(content: string): Map<string, string> {
  const files = new Map<string, string>();
  const regex = /```[\w]+:([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [, filePath, code] = match;
    if (filePath && code) {
      files.set(filePath.trim(), code.trim());
    }
  }

  // Also handle plain ```lang blocks with a // filepath comment
  const plainRegex = /```[\w]+\n\/\/ filepath: ([^\n]+)\n([\s\S]*?)```/g;
  while ((match = plainRegex.exec(content)) !== null) {
    const [, filePath, code] = match;
    if (filePath && code) {
      files.set(filePath.trim(), code.trim());
    }
  }

  return files;
}

const DEFAULT_IMPLEMENT_PROMPT = `You are a senior software engineer implementing a feature.

## Specification
{{SPEC_CONTENT}}

## Existing Codebase
{{CODEBASE_CONTEXT}}

## Instructions
1. Implement the feature according to the specification
2. Follow existing code conventions and patterns in the codebase
3. Write clean, well-structured, production-quality code
4. For each file, use this exact format so it can be parsed:

\`\`\`typescript:src/path/to/file.ts
// your code here
\`\`\`

5. After all files, write "Implementation complete." and a brief summary

## Requirements
- Match existing code style (naming conventions, imports, exports)
- Include proper error handling
- Do NOT include test files in this stage (they are generated in validate)
- Do NOT include documentation files (generated in document stage)
`;
