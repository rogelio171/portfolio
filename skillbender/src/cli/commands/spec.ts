import { readFileSync, existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { runPipeline } from '../../agent/pipeline.js';
import { getLogger } from '../../logger/index.js';

const log = getLogger('cli:spec');

export async function runSpecCommand(
  description: string,
  options: { analysis?: string }
): Promise<void> {
  const spinner = ora('Generating specification...').start();

  try {
    let similarPatterns: string | undefined;

    if (options.analysis && existsSync(options.analysis)) {
      similarPatterns = readFileSync(options.analysis, 'utf-8');
    }

    const state = await runPipeline({
      featureDescription: description,
      stages: similarPatterns ? ['spec'] : ['analyze', 'spec'],
      nonInteractive: true,
    });

    if (state.spec) {
      spinner.succeed('Spec generated');
      console.log(chalk.green(`\nSpec saved to: ${state.spec.filePath}`));
      console.log(chalk.gray(`Status: ${state.spec.status}`));
      console.log(chalk.gray(`Tasks: ${state.spec.tasks.length}`));
    } else {
      spinner.fail('Spec generation failed');
      process.exit(1);
    }
  } catch (err) {
    spinner.fail('Failed');
    log.error(err, 'Spec command error');
    process.exit(1);
  }
}
