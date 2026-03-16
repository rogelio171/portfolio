#!/usr/bin/env node

/**
 * SkillBender CLI entry point.
 * Uses Commander.js for command parsing.
 */

import { Command } from 'commander';
import { createRequire } from 'module';
import { resolve } from 'path';
import { existsSync } from 'fs';

const require = createRequire(import.meta.url);

// Read version from package.json
const packagePath = resolve(import.meta.dirname ?? process.cwd(), '../../package.json');
const pkg = existsSync(packagePath) ? (require(packagePath) as { version: string }) : { version: '0.0.0' };

const program = new Command();

program
  .name('skillbender')
  .description('Enterprise autonomous feature resolution workflow')
  .version(pkg.version);

// ── Commands ─────────────────────────────────────────────────────────────────

program
  .command('resolve <description>')
  .description('Run the full feature resolution pipeline (analyze → spec → implement → validate → document)')
  .option('-s, --stages <stages>', 'Comma-separated list of stages to run', 'analyze,spec,implement,validate,document')
  .option('-y, --yes', 'Skip all human checkpoints (non-interactive)', false)
  .option('--spec <file>', 'Resume from an existing spec file')
  .option('--provider <provider>', 'LLM provider override (anthropic|openai|ollama)')
  .option('--model <model>', 'LLM model override')
  .action(async (description: string, options: {
    stages: string;
    yes: boolean;
    spec?: string;
    provider?: string;
    model?: string;
  }) => {
    const { runResolveCommand } = await import('./commands/resolve.js');
    await runResolveCommand(description, options);
  });

program
  .command('analyze [description]')
  .description('Scan the codebase and find similar patterns for a feature')
  .option('--output <file>', 'Save analysis to file')
  .action(async (description: string | undefined, options: { output?: string }) => {
    const { runAnalyzeCommand } = await import('./commands/analyze.js');
    await runAnalyzeCommand(description ?? '', options);
  });

program
  .command('spec <description>')
  .description('Generate a feature specification (without implementing)')
  .option('--analysis <file>', 'Use prior analysis file')
  .action(async (description: string, options: { analysis?: string }) => {
    const { runSpecCommand } = await import('./commands/spec.js');
    await runSpecCommand(description, options);
  });

program
  .command('document [specFile]')
  .description('Update documentation based on a spec or description')
  .option('-d, --description <desc>', 'Feature description')
  .action(async (specFile: string | undefined, options: { description?: string }) => {
    const { runDocumentCommand } = await import('./commands/document.js');
    await runDocumentCommand(specFile, options);
  });

program
  .command('list')
  .description('List all feature specs')
  .option('--status <status>', 'Filter by status')
  .action(async (options: { status?: string }) => {
    const { runListCommand } = await import('./commands/list.js');
    await runListCommand(options);
  });

program
  .command('init')
  .description('Initialize skillbender in the current project')
  .action(async () => {
    const { runInitCommand } = await import('./commands/init.js');
    await runInitCommand();
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
