import chalk from 'chalk';
import ora from 'ora';
import { loadSpec } from '../../tracker/spec.js';
import { runPipeline } from '../../agent/pipeline.js';
import { getLogger } from '../../logger/index.js';

const log = getLogger('cli:document');

export async function runDocumentCommand(
  specFile: string | undefined,
  options: { description?: string }
): Promise<void> {
  const spinner = ora('Generating documentation...').start();

  try {
    let featureDescription = options.description ?? '';
    let specFilePath: string | undefined;

    if (specFile) {
      const spec = loadSpec(specFile);
      featureDescription = spec.title;
      specFilePath = specFile;
    }

    if (!featureDescription) {
      console.error(chalk.red('Provide either a spec file or --description'));
      process.exit(1);
    }

    const state = await runPipeline({
      featureDescription,
      specFilePath,
      stages: ['document'],
      nonInteractive: true,
    });

    spinner.succeed('Documentation updated');

    if (state.documentationUpdates && state.documentationUpdates.length > 0) {
      console.log(chalk.bold('\nDocumentation changes:'));
      for (const update of state.documentationUpdates) {
        const icon = update.action === 'created' ? chalk.green('+') : chalk.blue('~');
        console.log(`  ${icon} ${update.filePath}: ${update.summary}`);
      }
    } else {
      console.log(chalk.gray('No documentation files were modified.'));
    }
  } catch (err) {
    spinner.fail('Failed');
    log.error(err, 'Document command error');
    process.exit(1);
  }
}
