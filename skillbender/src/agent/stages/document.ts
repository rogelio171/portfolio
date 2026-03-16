/**
 * Document stage — creates or updates documentation based on what was implemented.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { addProgressEntry, saveSpec, updateSpecStatus } from '../../tracker/spec.js';
import { createProvider } from '../../llm/factory.js';
import { withRetry } from '../../utils/retry.js';
import { loadConfig } from '../../config/loader.js';
import { getLogger } from '../../logger/index.js';
import type { PipelineState, DocumentationUpdate } from '../state.js';

const log = getLogger('document');

export async function runDocumentStage(state: PipelineState): Promise<void> {
  const cfg = loadConfig();
  const provider = createProvider();
  const cwd = process.cwd();

  const promptPath = join(cwd, 'prompts', 'document.md');
  const promptTemplate = existsSync(promptPath)
    ? readFileSync(promptPath, 'utf-8')
    : DEFAULT_DOCUMENT_PROMPT;

  const implementationSummary = buildImplementationSummary(state);

  const systemPrompt = promptTemplate
    .replace('{{FEATURE_DESCRIPTION}}', state.featureDescription)
    .replace('{{IMPLEMENTATION_SUMMARY}}', implementationSummary)
    .replace(
      '{{VALIDATION_SUMMARY}}',
      state.validationResult?.summary ?? 'Validation not run.'
    );

  log.info('Generating documentation updates...');

  const response = await withRetry(
    () =>
      provider.complete(
        [
          {
            role: 'user',
            content: `Generate documentation for: ${state.featureDescription}`,
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
      onRetry: (attempt, _err, delay) =>
        log.warn({ attempt, delay }, 'Retrying document LLM call'),
    }
  );

  const docUpdates = await applyDocumentationUpdates(response.content, cwd, cfg.docs);
  state.documentationUpdates = docUpdates;

  // Update spec with documentation section
  if (state.spec) {
    state.spec.documentation = docUpdates
      .map((u) => `- **${u.action}** \`${u.filePath}\`: ${u.summary}`)
      .join('\n');

    addProgressEntry(
      state.spec,
      'document',
      `Documentation ${docUpdates.length > 0 ? 'updated' : 'reviewed'}: ${docUpdates.map((d) => d.filePath).join(', ') || 'no changes needed'}`
    );
    updateSpecStatus(state.spec, 'done');
    saveSpec(state.spec);
  }

  log.info(
    {
      docsUpdated: docUpdates.length,
      tokens: response.usage.totalTokens,
    },
    'Document stage complete'
  );
}

function buildImplementationSummary(state: PipelineState): string {
  const lines: string[] = [];

  if (state.spec) {
    lines.push(`## Feature: ${state.spec.title}`, state.spec.description, '');
    lines.push('## Approach', state.spec.approach, '');
  }

  if (state.implementationFiles && state.implementationFiles.size > 0) {
    lines.push('## Files Implemented');
    for (const [path] of state.implementationFiles) {
      lines.push(`- \`${path}\``);
    }
  }

  return lines.join('\n');
}

interface DocFile {
  path: string;
  content: string;
  action: 'created' | 'updated';
}

async function applyDocumentationUpdates(
  llmResponse: string,
  cwd: string,
  docsCfg: { dirs: string[]; createIfMissing: boolean }
): Promise<DocumentationUpdate[]> {
  const updates: DocumentationUpdate[] = [];

  // Extract doc blocks: ```markdown:docs/foo.md
  const regex = /```(?:markdown|md):([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(llmResponse)) !== null) {
    const [, relativePath, content] = match;
    if (!relativePath || !content) continue;

    const absPath = join(cwd, relativePath.trim());
    const existed = existsSync(absPath);

    if (!existed && !docsCfg.createIfMissing) continue;

    mkdirSync(dirname(absPath), { recursive: true });

    let finalContent: string;
    if (existed) {
      // Merge: append new sections rather than overwriting
      const existing = readFileSync(absPath, 'utf-8');
      finalContent = mergeDocContent(existing, content.trim());
    } else {
      finalContent = content.trim();
    }

    writeFileSync(absPath, finalContent, 'utf-8');

    updates.push({
      filePath: relativePath.trim(),
      action: existed ? 'updated' : 'created',
      summary: extractFirstLine(content),
    });

    log.info({ file: relativePath.trim(), action: existed ? 'updated' : 'created' }, 'Doc file written');
  }

  return updates;
}

/**
 * Merges new doc content into existing content.
 * Adds new sections, avoids duplicating existing ones.
 */
function mergeDocContent(existing: string, newContent: string): string {
  const newSections = newContent.split(/^## /m).filter(Boolean);
  let result = existing;

  for (const section of newSections) {
    const title = section.split('\n')[0]?.trim() ?? '';
    if (!existing.includes(`## ${title}`)) {
      result = result.trimEnd() + '\n\n## ' + section;
    }
  }

  return result;
}

function extractFirstLine(text: string): string {
  return text.split('\n').find((l) => l.trim().length > 0)?.trim().slice(0, 100) ?? '';
}

const DEFAULT_DOCUMENT_PROMPT = `You are a technical writer generating documentation for a newly implemented feature.

## Feature
{{FEATURE_DESCRIPTION}}

## Implementation Summary
{{IMPLEMENTATION_SUMMARY}}

## Validation
{{VALIDATION_SUMMARY}}

## Instructions
Generate documentation that:
1. Explains what the feature does and when to use it
2. Documents the public API (functions, classes, configuration)
3. Provides usage examples
4. Notes any important constraints or edge cases

For each documentation file, use this format:

\`\`\`markdown:docs/feature-name.md
# Feature Name

## Overview
...

## Usage
...

## API Reference
...
\`\`\`

Also update the main README if relevant.
`;
