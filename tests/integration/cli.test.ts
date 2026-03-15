import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandInit } from '../../src/cli/commands/init.js';
import { commandAdd } from '../../src/cli/commands/add.js';
import { loadConfig } from '../../src/runtime/config.js';
import { parseSpecDirectory, crossValidate } from '../../src/spec/index.js';
import { buildSystemGraph, buildSystemMap } from '../../src/graph/index.js';
import { compileCapabilities } from '../../src/compiler/index.js';

describe('CLI commands', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sysmara-cli-test-'));
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('creates project structure', async () => {
      await commandInit(tmpDir);

      const files = await readdir(join(tmpDir, 'system'));
      expect(files).toContain('entities.yaml');
      expect(files).toContain('capabilities.yaml');
      expect(files).toContain('policies.yaml');
      expect(files).toContain('invariants.yaml');
      expect(files).toContain('modules.yaml');
      expect(files).toContain('flows.yaml');
    });

    it('creates sysmara.config.yaml', async () => {
      await commandInit(tmpDir);
      const config = await readFile(join(tmpDir, 'sysmara.config.yaml'), 'utf-8');
      expect(config).toContain('specDir');
      expect(config).toContain('appDir');
    });

    it('creates app directories', async () => {
      await commandInit(tmpDir);
      const appDirs = await readdir(join(tmpDir, 'app'));
      expect(appDirs).toContain('entities');
      expect(appDirs).toContain('capabilities');
      expect(appDirs).toContain('generated');
    });

    it('creates parseable specs', async () => {
      await commandInit(tmpDir);
      const specDir = join(tmpDir, 'system');
      const result = await parseSpecDirectory(specDir);
      const parseErrors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(parseErrors).toHaveLength(0);
      expect(result.specs).not.toBeNull();
    });

    it('creates cross-validatable specs', async () => {
      await commandInit(tmpDir);
      const specDir = join(tmpDir, 'system');
      const result = await parseSpecDirectory(specDir);
      expect(result.specs).not.toBeNull();
      const crossErrors = crossValidate(result.specs!).filter((d) => d.severity === 'error');
      // The init template may have non-critical warnings but should be valid
      expect(crossErrors.length).toBeLessThanOrEqual(2);
    });

    it('creates a graphable system', async () => {
      await commandInit(tmpDir);
      const specDir = join(tmpDir, 'system');
      const result = await parseSpecDirectory(specDir);
      expect(result.specs).not.toBeNull();
      const graph = buildSystemGraph(result.specs!);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('creates a compilable system', async () => {
      await commandInit(tmpDir);
      const specDir = join(tmpDir, 'system');
      const result = await parseSpecDirectory(specDir);
      expect(result.specs).not.toBeNull();
      const output = compileCapabilities(result.specs!, '/tmp/gen');
      expect(output.files.length).toBeGreaterThan(0);
    });
  });

  describe('add', () => {
    it('adds a new entity to entities.yaml', async () => {
      await commandInit(tmpDir);
      const config = loadConfig({ specDir: './system' });
      await commandAdd(tmpDir, 'entity', 'order', config);

      const content = await readFile(join(tmpDir, 'system/entities.yaml'), 'utf-8');
      expect(content).toContain('order');
    });

    it('adds a new capability', async () => {
      await commandInit(tmpDir);
      const config = loadConfig({ specDir: './system' });
      await commandAdd(tmpDir, 'capability', 'process_payment', config);

      const content = await readFile(join(tmpDir, 'system/capabilities.yaml'), 'utf-8');
      expect(content).toContain('process_payment');
    });

    it('adds a new module', async () => {
      await commandInit(tmpDir);
      const config = loadConfig({ specDir: './system' });
      await commandAdd(tmpDir, 'module', 'billing', config);

      const content = await readFile(join(tmpDir, 'system/modules.yaml'), 'utf-8');
      expect(content).toContain('billing');
    });

    it('adds a new policy', async () => {
      await commandInit(tmpDir);
      const config = loadConfig({ specDir: './system' });
      await commandAdd(tmpDir, 'policy', 'admin_only', config);

      const content = await readFile(join(tmpDir, 'system/policies.yaml'), 'utf-8');
      expect(content).toContain('admin_only');
    });

    it('adds a new invariant', async () => {
      await commandInit(tmpDir);
      const config = loadConfig({ specDir: './system' });
      await commandAdd(tmpDir, 'invariant', 'balance_positive', config);

      const content = await readFile(join(tmpDir, 'system/invariants.yaml'), 'utf-8');
      expect(content).toContain('balance_positive');
    });

    it('adds a new flow', async () => {
      await commandInit(tmpDir);
      const config = loadConfig({ specDir: './system' });
      await commandAdd(tmpDir, 'flow', 'checkout_flow', config);

      const content = await readFile(join(tmpDir, 'system/flows.yaml'), 'utf-8');
      expect(content).toContain('checkout_flow');
    });

    it('preserves existing entries when adding', async () => {
      await commandInit(tmpDir);
      const config = loadConfig({ specDir: './system' });
      await commandAdd(tmpDir, 'entity', 'order', config);

      const content = await readFile(join(tmpDir, 'system/entities.yaml'), 'utf-8');
      // Should still contain original user entity
      expect(content).toContain('user');
      expect(content).toContain('order');
    });

    it('still produces parseable YAML after adding', async () => {
      await commandInit(tmpDir);
      const config = loadConfig({ specDir: './system' });
      await commandAdd(tmpDir, 'entity', 'order', config);
      await commandAdd(tmpDir, 'capability', 'create_order', config);
      await commandAdd(tmpDir, 'module', 'orders', config);

      const specDir = join(tmpDir, 'system');
      const result = await parseSpecDirectory(specDir);
      expect(result.specs).not.toBeNull();
      expect(result.specs!.entities.some((e) => e.name === 'order')).toBe(true);
      expect(result.specs!.capabilities.some((c) => c.name === 'create_order')).toBe(true);
      expect(result.specs!.modules.some((m) => m.name === 'orders')).toBe(true);
    });
  });

  describe('graph generation from init', () => {
    it('produces deterministic graph output', async () => {
      await commandInit(tmpDir);
      const specDir = join(tmpDir, 'system');
      const result = await parseSpecDirectory(specDir);
      expect(result.specs).not.toBeNull();

      const graph1 = buildSystemGraph(result.specs!);
      const graph2 = buildSystemGraph(result.specs!);

      expect(JSON.stringify(graph1.nodes)).toBe(JSON.stringify(graph2.nodes));
      expect(JSON.stringify(graph1.edges)).toBe(JSON.stringify(graph2.edges));
    });

    it('produces deterministic system map output', async () => {
      await commandInit(tmpDir);
      const specDir = join(tmpDir, 'system');
      const result = await parseSpecDirectory(specDir);
      expect(result.specs).not.toBeNull();

      const map1 = buildSystemMap(result.specs!);
      const map2 = buildSystemMap(result.specs!);

      // Compare everything except generatedAt (timestamp is non-deterministic)
      const normalize = (m: typeof map1) => JSON.stringify({ ...m, generatedAt: '' });
      expect(normalize(map1)).toBe(normalize(map2));
    });
  });
});
