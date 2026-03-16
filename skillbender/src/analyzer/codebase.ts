/**
 * Codebase scanner — reads relevant files and finds similar patterns.
 * Produces a structured summary for the LLM context.
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import { glob } from 'glob';
import { loadConfig } from '../config/loader.js';

export interface FileEntry {
  path: string;
  relativePath: string;
  content: string;
  sizeBytes: number;
  language: string;
}

export interface CodebaseSnapshot {
  rootDir: string;
  files: FileEntry[];
  totalFiles: number;
  totalSizeBytes: number;
  summary: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.toml': 'toml',
  '.sh': 'bash',
  '.sql': 'sql',
};

function detectLanguage(filePath: string): string {
  return LANGUAGE_MAP[extname(filePath).toLowerCase()] ?? 'text';
}

export async function scanCodebase(rootDir: string = process.cwd()): Promise<CodebaseSnapshot> {
  const cfg = loadConfig();
  const { include, exclude, maxFileSize } = cfg.analyzer;

  const patterns = include.map((dir) => `${dir}/**/*`);
  const ignorePatterns = [...exclude, '**/node_modules/**', '**/.git/**'];

  const allPaths: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: rootDir,
      ignore: ignorePatterns,
      nodir: true,
      absolute: false,
    });
    allPaths.push(...matches);
  }

  // Deduplicate
  const uniquePaths = [...new Set(allPaths)];

  const files: FileEntry[] = [];
  let totalSize = 0;

  for (const rel of uniquePaths) {
    const abs = join(rootDir, rel);
    if (!existsSync(abs)) continue;

    const stat = statSync(abs);
    if (stat.size > maxFileSize) continue;

    let content: string;
    try {
      content = readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }

    files.push({
      path: abs,
      relativePath: relative(rootDir, abs),
      content,
      sizeBytes: stat.size,
      language: detectLanguage(rel),
    });

    totalSize += stat.size;
  }

  const summary = buildSummary(files, rootDir);

  return {
    rootDir,
    files,
    totalFiles: files.length,
    totalSizeBytes: totalSize,
    summary,
  };
}

function buildSummary(files: FileEntry[], rootDir: string): string {
  const byLang = new Map<string, number>();
  for (const f of files) {
    byLang.set(f.language, (byLang.get(f.language) ?? 0) + 1);
  }

  const langBreakdown = [...byLang.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `  - ${lang}: ${count} files`)
    .join('\n');

  return [
    `Codebase root: ${rootDir}`,
    `Total files scanned: ${files.length}`,
    `Language breakdown:`,
    langBreakdown,
    ``,
    `Files:`,
    files.map((f) => `  ${f.relativePath}`).join('\n'),
  ].join('\n');
}

/**
 * Build a compact LLM context from the codebase snapshot.
 * Prioritizes smaller files and known patterns.
 * Respects a rough token budget.
 */
export function buildLLMContext(
  snapshot: CodebaseSnapshot,
  maxChars: number = 80_000
): string {
  const parts: string[] = [
    '## Codebase Overview',
    snapshot.summary,
    '',
    '## File Contents',
  ];

  let usedChars = parts.join('\n').length;

  // Sort: smaller files first (usually utilities/interfaces — most reusable)
  const sorted = [...snapshot.files].sort((a, b) => a.sizeBytes - b.sizeBytes);

  for (const file of sorted) {
    const block = [
      `### ${file.relativePath} (${file.language})`,
      '```' + file.language,
      file.content.trim(),
      '```',
      '',
    ].join('\n');

    if (usedChars + block.length > maxChars) continue;

    parts.push(block);
    usedChars += block.length;
  }

  return parts.join('\n');
}
