import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { runPipeline, type PipelineOptions } from '../../agent/pipeline.js';
import { resetConfigCache, loadConfig } from '../../config/loader.js';
import { getLogger } from '../../logger/index.js';
import type { StageName, PipelineState } from '../../agent/state.js';

const log = getLogger('cli:resolve');

const VALID_STAGES: StageName[] = ['analyze', 'spec', 'implement', 'validate', 'document'];

export async function runResolveCommand(
  description: string,
  options: {
    stages: string;
    yes: boolean;
    spec?: string;
    provider?: string;
    model?: string;
  }
): Promise<void> {
  // Apply CLI overrides to config
  if (options.provider || options.model) {
    resetConfigCache();
    process.env['SKILLBENDER_LLM_PROVIDER'] = options.provider ?? loadConfig().llm.provider;
    if (options.model) process.env['SKILLBENDER_LLM_MODEL'] = options.model;
  }

  const stages = options.stages
    .split(',')
    .map((s) => s.trim() as StageName)
    .filter((s) => VALID_STAGES.includes(s));

  if (stages.length === 0) {
    console.error(chalk.red('No valid stages specified.'));
    process.exit(1);
  }

  const pipelineOptions: PipelineOptions = {
    featureDescription: description,
    specFilePath: options.spec,
    stages,
    nonInteractive: options.yes,
    onCheckpoint: options.yes ? undefined : createCheckpointHandler(),
  };

  try {
    const state = await runPipeline(pipelineOptions);
    process.exit(state.stageResults.every((r) => r.status === 'done') ? 0 : 1);
  } catch (err) {
    log.error(err, 'Pipeline failed with uncaught error');
    console.error(chalk.red('\nPipeline error:'), err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function createCheckpointHandler(): PipelineOptions['onCheckpoint'] {
  return async (stage: StageName, state: PipelineState): Promise<boolean> => {
    console.log('\n' + chalk.bold.yellow('━'.repeat(60)));
    console.log(chalk.bold.yellow(`  CHECKPOINT: Ready to proceed to "${stage}" stage`));
    console.log(chalk.bold.yellow('━'.repeat(60)));

    if (stage === 'spec' && state.spec) {
      console.log(chalk.gray(`\n  Spec file: ${state.spec.filePath}`));
      console.log(chalk.gray('  Review the spec above before implementation begins.\n'));
    }

    const answer = await select({
      message: `Proceed with "${stage}" stage?`,
      choices: [
        { name: 'Yes, continue', value: 'yes' },
        { name: 'Skip this stage', value: 'skip' },
        { name: 'Abort pipeline', value: 'abort' },
      ],
    });

    if (answer === 'abort') return false;
    if (answer === 'skip') {
      console.log(chalk.gray(`Skipping ${stage} stage.`));
      return false;
    }
    return true;
  };
}
