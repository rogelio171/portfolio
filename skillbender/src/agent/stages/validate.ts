/**
 * Validate stage — runs tests, linting, and type checking.
 * Uses execa to run project commands and reports results.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execa } from 'execa';
import { addProgressEntry, saveSpec, updateSpecStatus } from '../../tracker/spec.js';
import { createProvider } from '../../llm/factory.js';
import { withRetry } from '../../utils/retry.js';
import { loadConfig } from '../../config/loader.js';
import { getLogger } from '../../logger/index.js';
import type { PipelineState, ValidationResult } from '../state.js';

const log = getLogger('validate');

interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCommand(cmd: string, args: string[], cwd: string): Promise<CommandResult> {
  try {
    const result = await execa(cmd, args, { cwd, reject: false });
    return {
      command: `${cmd} ${args.join(' ')}`,
      exitCode: result.exitCode ?? 0,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } catch (err) {
    return {
      command: `${cmd} ${args.join(' ')}`,
      exitCode: 1,
      stdout: '',
      stderr: String(err),
    };
  }
}

export async function runValidateStage(state: PipelineState): Promise<void> {
  const cfg = loadConfig();
  const cwd = process.cwd();
  const results: CommandResult[] = [];

  // Detect package manager and available scripts
  const packageJsonPath = join(cwd, 'package.json');
  const hasPackageJson = existsSync(packageJsonPath);

  let scripts: Record<string, string> = {};
  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { scripts?: Record<string, string> };
      scripts = pkg.scripts ?? {};
    } catch {
      // ignore
    }
  }

  // Run typecheck
  if (scripts['typecheck']) {
    log.info('Running typecheck...');
    results.push(await runCommand('npm', ['run', 'typecheck'], cwd));
  } else if (existsSync(join(cwd, 'tsconfig.json'))) {
    results.push(await runCommand('npx', ['tsc', '--noEmit'], cwd));
  }

  // Run lint
  if (scripts['lint']) {
    log.info('Running lint...');
    results.push(await runCommand('npm', ['run', 'lint'], cwd));
  }

  // Run tests
  if (scripts['test']) {
    log.info('Running tests...');
    results.push(await runCommand('npm', ['run', 'test'], cwd));
  }

  // Parse results
  const validationResult = parseValidationResults(results);
  state.validationResult = validationResult;

  // If validation failed, ask LLM to suggest fixes
  if (!validationResult.passed && state.implementationFiles && state.spec) {
    log.warn('Validation failed — asking LLM for fix suggestions...');

    const provider = createProvider();
    const promptPath = join(cwd, 'prompts', 'validate.md');
    const promptTemplate = existsSync(promptPath)
      ? readFileSync(promptPath, 'utf-8')
      : DEFAULT_VALIDATE_PROMPT;

    const errorSummary = [
      ...validationResult.lintErrors,
      ...validationResult.typeErrors,
    ].join('\n');

    const systemPrompt = promptTemplate.replace('{{ERROR_SUMMARY}}', errorSummary);

    const response = await withRetry(
      () =>
        provider.complete(
          [{ role: 'user', content: `Fix the following validation errors:\n${errorSummary}` }],
          {
            systemPrompt,
            maxTokens: cfg.llm.maxTokens,
            temperature: 0.1,
          }
        ),
      { maxAttempts: cfg.pipeline.maxRetries }
    );

    // Store suggestions in spec notes
    state.spec.implementationNotes +=
      '\n\n### Validation Issues\n' + errorSummary + '\n\n### Suggested Fixes\n' + response.content;
  }

  if (state.spec) {
    const statusMsg = validationResult.passed
      ? `Validation passed: ${validationResult.testsPassed} tests, no errors.`
      : `Validation failed: ${validationResult.testsFailed} test failures, ${validationResult.lintErrors.length} lint errors.`;

    addProgressEntry(state.spec, 'validate', statusMsg);
    updateSpecStatus(state.spec, validationResult.passed ? 'review' : 'blocked');
    saveSpec(state.spec);
  }

  log.info(
    {
      passed: validationResult.passed,
      tests: `${validationResult.testsPassed}/${validationResult.testsRun}`,
      lintErrors: validationResult.lintErrors.length,
    },
    'Validate stage complete'
  );
}

function parseValidationResults(results: CommandResult[]): ValidationResult {
  const lintErrors: string[] = [];
  const typeErrors: string[] = [];
  let testsRun = 0;
  let testsPassed = 0;
  let testsFailed = 0;

  for (const r of results) {
    if (r.exitCode !== 0) {
      const output = (r.stdout + '\n' + r.stderr).trim();

      if (r.command.includes('tsc') || r.command.includes('typecheck')) {
        typeErrors.push(...output.split('\n').filter((l) => l.includes('error TS')));
      } else if (r.command.includes('lint') || r.command.includes('eslint')) {
        lintErrors.push(...output.split('\n').filter((l) => l.trim().length > 0).slice(0, 20));
      }
    }

    // Parse test output (vitest/jest compatible)
    const passMatch = (r.stdout + r.stderr).match(/(\d+) passed/);
    const failMatch = (r.stdout + r.stderr).match(/(\d+) failed/);
    if (passMatch?.[1]) testsPassed += parseInt(passMatch[1], 10);
    if (failMatch?.[1]) testsFailed += parseInt(failMatch[1], 10);
    if (passMatch || failMatch) testsRun = testsPassed + testsFailed;
  }

  const passed =
    typeErrors.length === 0 && lintErrors.length === 0 && testsFailed === 0;

  const summary = passed
    ? `All checks passed. ${testsRun} tests run.`
    : [
        typeErrors.length > 0 ? `${typeErrors.length} type error(s)` : null,
        lintErrors.length > 0 ? `${lintErrors.length} lint error(s)` : null,
        testsFailed > 0 ? `${testsFailed} test failure(s)` : null,
      ]
        .filter(Boolean)
        .join(', ');

  return { passed, testsRun, testsPassed, testsFailed, lintErrors, typeErrors, summary };
}

const DEFAULT_VALIDATE_PROMPT = `You are a senior software engineer debugging validation errors.

## Errors Found
{{ERROR_SUMMARY}}

## Instructions
Analyze the errors and provide:
1. Root cause analysis for each error
2. Specific code changes to fix each error
3. Any follow-up checks recommended

Be concise and precise. Show exact code changes where possible.
`;
