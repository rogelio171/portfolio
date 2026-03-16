import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Spec tracker', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `skillbender-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    // Redirect spec output to temp dir
    vi.stubEnv('SKILLBENDER_LOG_LEVEL', 'error');
    process.chdir(tmpDir);
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
  });

  it('creates a spec with correct structure', async () => {
    const { createSpec } = await import('../src/tracker/spec.js');
    const spec = createSpec('Test Feature', 'A test feature description');

    expect(spec.title).toBe('Test Feature');
    expect(spec.description).toBe('A test feature description');
    expect(spec.status).toBe('todo');
    expect(spec.tasks).toHaveLength(0);
    expect(spec.progressLog).toHaveLength(0);
    expect(spec.id).toMatch(/^\d+-test-feature$/);
  });

  it('saves and loads a spec', async () => {
    const { createSpec, saveSpec, loadSpec } = await import('../src/tracker/spec.js');

    // Create .skillbender/specs dir
    mkdirSync(join(tmpDir, '.skillbender', 'specs'), { recursive: true });

    const spec = createSpec('Save Test', 'Testing save and load');
    spec.approach = 'Use a simple approach';
    spec.tasks = [{ id: 'task-1', description: 'Do the thing', status: 'pending' }];

    saveSpec(spec);

    expect(existsSync(spec.filePath)).toBe(true);

    const loaded = loadSpec(spec.filePath);
    expect(loaded.title).toBe('Save Test');
    expect(loaded.approach).toBe('Use a simple approach');
    expect(loaded.tasks).toHaveLength(1);
    expect(loaded.tasks[0]?.description).toBe('Do the thing');
  });

  it('adds progress entries', async () => {
    const { createSpec, addProgressEntry } = await import('../src/tracker/spec.js');

    const spec = createSpec('Progress Test', 'Testing progress tracking');
    addProgressEntry(spec, 'analyze', 'Scanned 10 files');
    addProgressEntry(spec, 'spec', 'Generated spec');

    expect(spec.progressLog).toHaveLength(2);
    expect(spec.progressLog[0]?.stage).toBe('analyze');
    expect(spec.progressLog[1]?.message).toBe('Generated spec');
  });
});
