import { describe, it, expect } from 'vitest';
import { parseSpecDirectory, crossValidate } from '../../src/spec/index.js';
import { buildSystemGraph, buildSystemMap } from '../../src/graph/index.js';
import { runDiagnostics } from '../../src/diagnostics/index.js';
import { compileCapabilities } from '../../src/compiler/index.js';
import * as path from 'node:path';

const EXAMPLES_DIR = path.resolve(import.meta.dirname, '../../examples');

async function loadExampleSpecs(exampleName: string) {
  const specDir = path.join(EXAMPLES_DIR, exampleName, 'system');
  const result = await parseSpecDirectory(specDir);
  return result;
}

describe('SaaS Billing example', () => {
  it('parses specs without errors', async () => {
    const result = await loadExampleSpecs('saas-billing');
    const parseErrors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(parseErrors).toHaveLength(0);
    expect(result.specs).not.toBeNull();
  });

  it('has expected entities', async () => {
    const { specs } = await loadExampleSpecs('saas-billing');
    expect(specs).not.toBeNull();
    const entityNames = specs!.entities.map((e) => e.name);
    expect(entityNames).toContain('user');
    expect(entityNames).toContain('workspace');
    expect(entityNames).toContain('subscription');
    expect(entityNames).toContain('invoice');
  });

  it('has expected modules', async () => {
    const { specs } = await loadExampleSpecs('saas-billing');
    expect(specs).not.toBeNull();
    const moduleNames = specs!.modules.map((m) => m.name);
    expect(moduleNames).toContain('users');
    expect(moduleNames).toContain('billing');
  });

  it('builds system graph', async () => {
    const { specs } = await loadExampleSpecs('saas-billing');
    expect(specs).not.toBeNull();
    const graph = buildSystemGraph(specs!);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('builds system map', async () => {
    const { specs } = await loadExampleSpecs('saas-billing');
    expect(specs).not.toBeNull();
    const map = buildSystemMap(specs!);
    expect(map.modules.length).toBeGreaterThan(0);
    expect(map.capabilities.length).toBeGreaterThan(0);
  });

  it('compiles capabilities', async () => {
    const { specs } = await loadExampleSpecs('saas-billing');
    expect(specs).not.toBeNull();
    const output = compileCapabilities(specs!, '/tmp/test-output');
    expect(output.files.length).toBeGreaterThan(0);
    expect(output.manifest.files.length).toBeGreaterThan(0);
  });

  it('runs diagnostics', async () => {
    const { specs } = await loadExampleSpecs('saas-billing');
    expect(specs).not.toBeNull();
    const report = runDiagnostics(specs!);
    // May have warnings, but should be usable
    expect(report.totalErrors).toBeDefined();
  });
});

describe('Admin Approvals example', () => {
  it('parses specs without errors', async () => {
    const result = await loadExampleSpecs('admin-approvals');
    const parseErrors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(parseErrors).toHaveLength(0);
    expect(result.specs).not.toBeNull();
  });

  it('has expected entities', async () => {
    const { specs } = await loadExampleSpecs('admin-approvals');
    expect(specs).not.toBeNull();
    const entityNames = specs!.entities.map((e) => e.name);
    expect(entityNames).toContain('user');
    expect(entityNames).toContain('approval_request');
    expect(entityNames).toContain('audit_log');
  });

  it('has expected modules', async () => {
    const { specs } = await loadExampleSpecs('admin-approvals');
    expect(specs).not.toBeNull();
    const moduleNames = specs!.modules.map((m) => m.name);
    expect(moduleNames).toContain('identity');
    expect(moduleNames).toContain('approvals');
  });

  it('builds system graph', async () => {
    const { specs } = await loadExampleSpecs('admin-approvals');
    expect(specs).not.toBeNull();
    const graph = buildSystemGraph(specs!);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('compiles capabilities', async () => {
    const { specs } = await loadExampleSpecs('admin-approvals');
    expect(specs).not.toBeNull();
    const output = compileCapabilities(specs!, '/tmp/test-output');
    expect(output.files.length).toBeGreaterThan(0);
  });
});

describe('Content Publishing example', () => {
  it('parses specs without errors', async () => {
    const result = await loadExampleSpecs('content-publishing');
    const parseErrors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(parseErrors).toHaveLength(0);
    expect(result.specs).not.toBeNull();
  });

  it('has expected entities', async () => {
    const { specs } = await loadExampleSpecs('content-publishing');
    expect(specs).not.toBeNull();
    const entityNames = specs!.entities.map((e) => e.name);
    expect(entityNames).toContain('article');
    expect(entityNames).toContain('author');
    expect(entityNames).toContain('category');
  });

  it('has expected modules', async () => {
    const { specs } = await loadExampleSpecs('content-publishing');
    expect(specs).not.toBeNull();
    const moduleNames = specs!.modules.map((m) => m.name);
    expect(moduleNames).toContain('content');
  });

  it('builds system graph', async () => {
    const { specs } = await loadExampleSpecs('content-publishing');
    expect(specs).not.toBeNull();
    const graph = buildSystemGraph(specs!);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('compiles capabilities', async () => {
    const { specs } = await loadExampleSpecs('content-publishing');
    expect(specs).not.toBeNull();
    const output = compileCapabilities(specs!, '/tmp/test-output');
    expect(output.files.length).toBeGreaterThan(0);
  });
});
