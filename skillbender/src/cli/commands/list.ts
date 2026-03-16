import chalk from 'chalk';
import { listSpecs, type SpecStatus } from '../../tracker/spec.js';

const STATUS_COLORS: Record<SpecStatus, (text: string) => string> = {
  'todo': chalk.gray,
  'in-progress': chalk.blue,
  'review': chalk.yellow,
  'done': chalk.green,
  'blocked': chalk.red,
};

export async function runListCommand(options: { status?: string }): Promise<void> {
  const specs = listSpecs();

  const filtered = options.status
    ? specs.filter((s) => s.status === options.status)
    : specs;

  if (filtered.length === 0) {
    console.log(chalk.gray('No specs found.'));
    return;
  }

  console.log(chalk.bold(`\n  Feature Specs (${filtered.length})\n`));
  console.log(chalk.gray('  ' + '─'.repeat(70)));

  for (const spec of filtered) {
    const colorFn = STATUS_COLORS[spec.status] ?? chalk.white;
    const tasks = spec.tasks.length;
    const done = spec.tasks.filter((t) => t.status === 'done').length;
    const progress = tasks > 0 ? `${done}/${tasks} tasks` : 'no tasks';

    console.log(
      `  ${colorFn(`[${spec.status.padEnd(11)}]`)} ${chalk.bold(spec.title)}`
    );
    console.log(
      chalk.gray(`                   ${spec.id}  |  ${progress}  |  ${spec.updatedAt.slice(0, 10)}`)
    );
    console.log();
  }
}
