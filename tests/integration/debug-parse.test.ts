import { it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandInit } from '../../src/cli/commands/init.js';
import { parseSpecDirectory } from '../../src/spec/index.js';

it('debug parse errors from init', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'sysmara-debug-'));
  try {
    await commandInit(tmpDir);
    const result = await parseSpecDirectory(join(tmpDir, 'system'));
    for (const d of result.diagnostics) {
      console.error(`${d.severity} | ${d.code ?? 'NO_CODE'} | ${d.message} | ${d.source}`);
    }
    expect(result.diagnostics).toHaveLength(0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
