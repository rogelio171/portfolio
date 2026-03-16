/**
 * Pipeline state — the shared context passed between all stages.
 * Stages read from and write to this object.
 */

import type { Spec } from '../tracker/spec.js';
import type { CodebaseSnapshot } from '../analyzer/codebase.js';

export type StageName = 'analyze' | 'spec' | 'implement' | 'validate' | 'document';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface StageResult {
  stage: StageName;
  status: StageStatus;
  startedAt: string;
  completedAt?: string;
  output?: string;
  error?: string;
  tokensUsed?: number;
  costUsd?: number;
}

export interface PipelineState {
  /** Unique run ID */
  runId: string;
  /** Human-readable feature description from the user */
  featureDescription: string;
  /** Optional path to existing spec file (for resume flows) */
  specFilePath?: string;

  // ── Populated by stages ──────────────────────────────────────────────────
  /** Codebase snapshot (populated by analyze stage) */
  codebaseSnapshot?: CodebaseSnapshot;
  /** Similar code patterns found (populated by analyze stage) */
  similarPatterns?: string;
  /** Generated spec document (populated by spec stage) */
  spec?: Spec;
  /** Generated implementation files: path → content */
  implementationFiles?: Map<string, string>;
  /** Validation results */
  validationResult?: ValidationResult;
  /** Documentation updates */
  documentationUpdates?: DocumentationUpdate[];

  // ── Meta ─────────────────────────────────────────────────────────────────
  stageResults: StageResult[];
  totalTokensUsed: number;
  totalCostUsd: number;
  startedAt: string;
  completedAt?: string;
}

export interface ValidationResult {
  passed: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  lintErrors: string[];
  typeErrors: string[];
  summary: string;
}

export interface DocumentationUpdate {
  filePath: string;
  action: 'created' | 'updated';
  summary: string;
}

export function createInitialState(
  featureDescription: string,
  specFilePath?: string
): PipelineState {
  return {
    runId: `run-${Date.now()}`,
    featureDescription,
    specFilePath,
    stageResults: [],
    totalTokensUsed: 0,
    totalCostUsd: 0,
    startedAt: new Date().toISOString(),
  };
}

export function recordStageStart(state: PipelineState, stage: StageName): StageResult {
  const result: StageResult = {
    stage,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  state.stageResults.push(result);
  return result;
}

export function recordStageEnd(
  state: PipelineState,
  result: StageResult,
  status: Exclude<StageStatus, 'pending' | 'running'>,
  output?: string,
  error?: string,
  tokensUsed?: number,
  costUsd?: number
): void {
  result.status = status;
  result.completedAt = new Date().toISOString();
  if (output) result.output = output;
  if (error) result.error = error;
  if (tokensUsed) {
    result.tokensUsed = tokensUsed;
    state.totalTokensUsed += tokensUsed;
  }
  if (costUsd) {
    result.costUsd = costUsd;
    state.totalCostUsd += costUsd;
  }
}
