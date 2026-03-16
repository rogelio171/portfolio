/**
 * Pipeline orchestrator — runs stages in order, manages checkpoints,
 * tracks total cost and tokens, and surfaces progress to the user.
 */

import chalk from 'chalk';
import { loadConfig } from '../config/loader.js';
import { getLogger } from '../logger/index.js';
import {
  createInitialState,
  recordStageStart,
  recordStageEnd,
  type PipelineState,
  type StageName,
} from './state.js';
import { runAnalyzeStage } from './stages/analyze.js';
import { runSpecStage } from './stages/spec.js';
import { runImplementStage } from './stages/implement.js';
import { runValidateStage } from './stages/validate.js';
import { runDocumentStage } from './stages/document.js';

const log = getLogger('pipeline');

export interface PipelineOptions {
  featureDescription: string;
  specFilePath?: string;
  /** Override configured stages */
  stages?: StageName[];
  /** Skip human checkpoint prompts (non-interactive mode) */
  nonInteractive?: boolean;
  /** Callback to request human approval at checkpoints */
  onCheckpoint?: (stage: StageName, state: PipelineState) => Promise<boolean>;
}

const STAGE_RUNNERS: Record<StageName, (state: PipelineState) => Promise<void>> = {
  analyze: runAnalyzeStage,
  spec: runSpecStage,
  implement: runImplementStage,
  validate: runValidateStage,
  document: runDocumentStage,
};

export async function runPipeline(options: PipelineOptions): Promise<PipelineState> {
  const cfg = loadConfig();
  const stages = options.stages ?? cfg.pipeline.stages;
  const checkpoints = new Set(cfg.pipeline.checkpoints);

  const state = createInitialState(options.featureDescription, options.specFilePath);

  log.info({ runId: state.runId, stages }, 'Pipeline started');
  printBanner(state.featureDescription);

  for (const stage of stages) {
    // Human-in-the-loop checkpoint
    if (checkpoints.has(stage) && !options.nonInteractive && options.onCheckpoint) {
      const approved = await options.onCheckpoint(stage, state);
      if (!approved) {
        log.warn({ stage }, 'Stage rejected at checkpoint — pipeline aborted');
        console.log(chalk.yellow(`\n Checkpoint rejected. Pipeline stopped at: ${stage}`));
        break;
      }
    }

    printStageHeader(stage);
    const result = recordStageStart(state, stage);

    try {
      await STAGE_RUNNERS[stage](state);
      recordStageEnd(
        state,
        result,
        'done',
        result.output,
        undefined,
        result.tokensUsed,
        result.costUsd
      );
      printStageSuccess(stage);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      recordStageEnd(state, result, 'failed', undefined, error);
      printStageFailure(stage, error);
      log.error({ stage, error }, 'Stage failed');

      // Don't continue past a failed stage
      break;
    }
  }

  state.completedAt = new Date().toISOString();
  printSummary(state);

  return state;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function printBanner(description: string): void {
  console.log('\n' + chalk.bold.cyan('━'.repeat(60)));
  console.log(chalk.bold.cyan('  SkillBender — Feature Resolution Pipeline'));
  console.log(chalk.bold.cyan('━'.repeat(60)));
  console.log(chalk.gray(`  Feature: ${description}`));
  console.log(chalk.bold.cyan('━'.repeat(60)) + '\n');
}

function printStageHeader(stage: StageName): void {
  const icons: Record<StageName, string> = {
    analyze: '🔍',
    spec: '📋',
    implement: '⚙️ ',
    validate: '✅',
    document: '📚',
  };
  console.log(chalk.bold(`\n${icons[stage]} Stage: ${stage.toUpperCase()}`));
  console.log(chalk.gray('─'.repeat(40)));
}

function printStageSuccess(stage: StageName): void {
  console.log(chalk.green(`  ✓ ${stage} complete`));
}

function printStageFailure(stage: StageName, error: string): void {
  console.log(chalk.red(`  ✗ ${stage} failed: ${error}`));
}

function printSummary(state: PipelineState): void {
  const duration = state.completedAt
    ? Math.round(
        (new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime()) / 1000
      )
    : 0;

  console.log('\n' + chalk.bold.cyan('━'.repeat(60)));
  console.log(chalk.bold('  Pipeline Summary'));
  console.log(chalk.bold.cyan('━'.repeat(60)));
  console.log(`  Run ID:      ${chalk.gray(state.runId)}`);
  console.log(`  Duration:    ${duration}s`);
  console.log(`  Tokens used: ${state.totalTokensUsed.toLocaleString()}`);
  console.log(`  Est. cost:   $${state.totalCostUsd.toFixed(4)}`);

  if (state.spec) {
    console.log(`  Spec file:   ${chalk.cyan(state.spec.filePath)}`);
    console.log(`  Spec status: ${chalk.bold(state.spec.status)}`);
  }

  console.log('\n  Stage results:');
  for (const r of state.stageResults) {
    const icon = r.status === 'done' ? chalk.green('✓') : chalk.red('✗');
    console.log(`    ${icon} ${r.stage} (${r.status})`);
  }

  console.log(chalk.bold.cyan('\n' + '━'.repeat(60) + '\n'));
}
