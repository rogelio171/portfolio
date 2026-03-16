import { writeFileSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { scanCodebase, buildLLMContext } from '../../analyzer/codebase.js';
import { createProvider } from '../../llm/factory.js';
import { loadConfig } from '../../config/loader.js';
import { getLogger } from '../../logger/index.js';

const log = getLogger('cli:analyze');

export async function runAnalyzeCommand(
  description: string,
  options: { output?: string }
): Promise<void> {
  const cfg = loadConfig();
  const spinner = ora('Scanning codebase...').start();

  try {
    const snapshot = await scanCodebase(process.cwd());
    spinner.succeed(`Scanned ${snapshot.totalFiles} files`);

    if (!description) {
      console.log('\n' + chalk.bold('Codebase Summary:'));
      console.log(snapshot.summary);
      return;
    }

    spinner.start('Analyzing for similar patterns...');
    const provider = createProvider();
    const context = buildLLMContext(snapshot);

    const response = await provider.complete(
      [{ role: 'user', content: `Feature: ${description}` }],
      {
        systemPrompt: `Analyze this codebase and find patterns relevant to: "${description}"\n\n${context}`,
        maxTokens: cfg.llm.maxTokens,
        temperature: cfg.llm.temperature,
      }
    );

    spinner.succeed('Analysis complete');

    if (options.output) {
      writeFileSync(options.output, response.content, 'utf-8');
      console.log(chalk.green(`\nAnalysis saved to: ${options.output}`));
    } else {
      console.log('\n' + chalk.bold('Analysis:'));
      console.log(response.content);
    }

    console.log(
      chalk.gray(
        `\nTokens: ${response.usage.totalTokens} | Cost: $${response.usage.estimatedCostUsd?.toFixed(4)}`
      )
    );
  } catch (err) {
    spinner.fail('Analysis failed');
    log.error(err, 'Analyze command error');
    process.exit(1);
  }
}
