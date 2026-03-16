/**
 * Layered configuration loader.
 * Priority (highest to lowest):
 *   1. CLI arguments (passed programmatically)
 *   2. Environment variables (SKILLBENDER_*)
 *   3. Project config (.skillbender/config.yaml)
 *   4. Global user config (~/.config/skillbender/config.yaml)
 *   5. Defaults (defined in schema)
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';
import { SkillBenderConfigSchema, type SkillBenderConfig } from './schema.js';

function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(join(dir, '.skillbender', 'config.yaml'))) return dir;
    if (existsSync(join(dir, 'package.json'))) return dir;
    dir = resolve(dir, '..');
  }
  return startDir;
}

function readYaml(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    return (parseYaml(readFileSync(filePath, 'utf-8')) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

function envOverrides(): Partial<Record<string, unknown>> {
  const overrides: Record<string, unknown> = {};

  const provider = process.env['SKILLBENDER_LLM_PROVIDER'];
  const model = process.env['SKILLBENDER_LLM_MODEL'];
  const logLevel = process.env['SKILLBENDER_LOG_LEVEL'];
  const logFormat = process.env['SKILLBENDER_LOG_FORMAT'];

  if (provider || model) {
    overrides['llm'] = {
      ...(provider && { provider }),
      ...(model && { model }),
    };
  }
  if (logLevel || logFormat) {
    overrides['logging'] = {
      ...(logLevel && { level: logLevel }),
      ...(logFormat && { format: logFormat }),
    };
  }

  return overrides;
}

let _cached: SkillBenderConfig | null = null;

export function loadConfig(cliOverrides?: Partial<Record<string, unknown>>): SkillBenderConfig {
  if (_cached && !cliOverrides) return _cached;

  const projectRoot = findProjectRoot(process.cwd());
  const globalConfigPath = join(homedir(), '.config', 'skillbender', 'config.yaml');
  const projectConfigPath = join(projectRoot, '.skillbender', 'config.yaml');

  const globalCfg = readYaml(globalConfigPath);
  const projectCfg = readYaml(projectConfigPath);
  const envCfg = envOverrides();

  const merged = deepMerge(globalCfg, projectCfg, envCfg, cliOverrides ?? {});

  const result = SkillBenderConfigSchema.safeParse(merged);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${result.error.message}`);
  }

  if (!cliOverrides) _cached = result.data;
  return result.data;
}

export function resetConfigCache(): void {
  _cached = null;
}

function deepMerge(...objects: Partial<Record<string, unknown>>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        if (
          typeof value === 'object' &&
          !Array.isArray(value) &&
          typeof result[key] === 'object' &&
          result[key] !== null &&
          !Array.isArray(result[key])
        ) {
          result[key] = deepMerge(
            result[key] as Record<string, unknown>,
            value as Record<string, unknown>
          );
        } else {
          result[key] = value;
        }
      }
    }
  }
  return result;
}
