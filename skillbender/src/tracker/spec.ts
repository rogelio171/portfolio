/**
 * Spec tracker — manages feature spec markdown documents.
 *
 * Each spec file follows this structure:
 *   ## Goal
 *   ## Status  (todo | in-progress | review | done | blocked)
 *   ## Approach
 *   ## Tasks
 *   ## Progress Log
 *   ## Implementation Notes
 *   ## Documentation
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { loadConfig } from '../config/loader.js';

export type SpecStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';

export interface SpecTask {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'done' | 'skipped';
}

export interface Spec {
  id: string;
  title: string;
  description: string;
  status: SpecStatus;
  createdAt: string;
  updatedAt: string;
  approach: string;
  tasks: SpecTask[];
  progressLog: ProgressEntry[];
  implementationNotes: string;
  documentation: string;
  filePath: string;
}

export interface ProgressEntry {
  timestamp: string;
  stage: string;
  message: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function specDir(): string {
  const cfg = loadConfig();
  return resolve(process.cwd(), cfg.tracker.outputDir);
}

export function createSpec(title: string, description: string): Spec {
  const id = `${Date.now()}-${slugify(title)}`;
  const now = new Date().toISOString();

  const spec: Spec = {
    id,
    title,
    description,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    approach: '',
    tasks: [],
    progressLog: [],
    implementationNotes: '',
    documentation: '',
    filePath: join(specDir(), `${id}.md`),
  };

  return spec;
}

export function saveSpec(spec: Spec): void {
  const dir = specDir();
  mkdirSync(dir, { recursive: true });

  spec.updatedAt = new Date().toISOString();
  const content = serializeSpec(spec);
  writeFileSync(spec.filePath, content, 'utf-8');
}

export function loadSpec(filePath: string): Spec {
  if (!existsSync(filePath)) {
    throw new Error(`Spec file not found: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf-8');
  return parseSpec(content, filePath);
}

export function listSpecs(): Spec[] {
  const dir = specDir();
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      try {
        return loadSpec(join(dir, f));
      } catch {
        return null;
      }
    })
    .filter((s): s is Spec => s !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addProgressEntry(spec: Spec, stage: string, message: string): void {
  spec.progressLog.push({
    timestamp: new Date().toISOString(),
    stage,
    message,
  });
  spec.updatedAt = new Date().toISOString();
}

export function updateSpecStatus(spec: Spec, status: SpecStatus): void {
  spec.status = status;
  spec.updatedAt = new Date().toISOString();
}

// ─── Serialization ────────────────────────────────────────────────────────────

function serializeSpec(spec: Spec): string {
  const taskList = spec.tasks
    .map((t) => {
      const check = t.status === 'done' ? '[x]' : t.status === 'skipped' ? '[-]' : '[ ]';
      return `- ${check} **${t.id}**: ${t.description}`;
    })
    .join('\n');

  const progressList = spec.progressLog
    .map((p) => `- **${p.timestamp}** [${p.stage}] ${p.message}`)
    .join('\n');

  return `---
id: ${spec.id}
title: "${spec.title}"
status: ${spec.status}
created: ${spec.createdAt}
updated: ${spec.updatedAt}
---

# ${spec.title}

## Goal

${spec.description}

## Status

\`${spec.status}\`

## Approach

${spec.approach || '_Not yet determined._'}

## Tasks

${taskList || '_No tasks defined yet._'}

## Progress Log

${progressList || '_No progress recorded yet._'}

## Implementation Notes

${spec.implementationNotes || '_No implementation notes yet._'}

## Documentation

${spec.documentation || '_No documentation yet._'}
`;
}

function parseSpec(content: string, filePath: string): Spec {
  // Extract frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, string> = {};

  if (fmMatch?.[1]) {
    for (const line of fmMatch[1].split('\n')) {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        frontmatter[key.trim()] = rest
          .join(':')
          .trim()
          .replace(/^"|"$/g, '');
      }
    }
  }

  const extractSection = (name: string): string => {
    const regex = new RegExp(`## ${name}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
    return content.match(regex)?.[1]?.trim() ?? '';
  };

  const parseTasks = (raw: string): SpecTask[] => {
    return raw.split('\n').flatMap((line) => {
      const match = line.match(/^- \[(.)\] \*\*([^*]+)\*\*: (.+)$/);
      if (!match) return [];
      const [, check, id, description] = match;
      const status =
        check === 'x' ? 'done' : check === '-' ? 'skipped' : 'pending';
      return [{ id: id ?? '', description: description ?? '', status }];
    });
  };

  const parseLog = (raw: string): ProgressEntry[] => {
    return raw.split('\n').flatMap((line) => {
      const match = line.match(/^- \*\*([^*]+)\*\* \[([^\]]+)\] (.+)$/);
      if (!match) return [];
      const [, timestamp, stage, message] = match;
      return [{ timestamp: timestamp ?? '', stage: stage ?? '', message: message ?? '' }];
    });
  };

  return {
    id: frontmatter['id'] ?? '',
    title: frontmatter['title'] ?? '',
    description: extractSection('Goal'),
    status: (frontmatter['status'] as SpecStatus) ?? 'todo',
    createdAt: frontmatter['created'] ?? '',
    updatedAt: frontmatter['updated'] ?? '',
    approach: extractSection('Approach'),
    tasks: parseTasks(extractSection('Tasks')),
    progressLog: parseLog(extractSection('Progress Log')),
    implementationNotes: extractSection('Implementation Notes'),
    documentation: extractSection('Documentation'),
    filePath,
  };
}
