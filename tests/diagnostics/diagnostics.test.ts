import { runDiagnostics } from '../../src/diagnostics/engine.js';
import {
  formatDiagnosticsTerminal,
  formatDiagnosticsJSON,
} from '../../src/diagnostics/formatter.js';
import type { SystemSpecs } from '../../src/types/index.js';

function makeSpecs(overrides: Partial<SystemSpecs> = {}): SystemSpecs {
  return {
    entities: [],
    capabilities: [],
    policies: [],
    invariants: [],
    modules: [],
    flows: [],
    safeEditZones: [],
    glossary: [],
    ...overrides,
  };
}

describe('runDiagnostics', () => {
  it('should produce no errors for valid specs', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'A user', fields: [], module: 'auth' },
      ],
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: ['User'],
          input: [],
          output: [],
          policies: ['admin-only'],
          invariants: ['email-unique'],
        },
      ],
      policies: [
        {
          name: 'admin-only',
          description: 'Only admins',
          actor: 'admin',
          capabilities: ['create-user'],
          conditions: [],
          effect: 'allow',
        },
      ],
      invariants: [
        {
          name: 'email-unique',
          description: 'Email must be unique',
          entity: 'User',
          rule: 'email is unique',
          severity: 'error',
          enforcement: 'runtime',
        },
      ],
      modules: [
        {
          name: 'auth',
          description: 'Auth module',
          entities: ['User'],
          capabilities: ['create-user'],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });

    const report = runDiagnostics(specs);
    expect(report.totalErrors).toBe(0);
    expect(report.totalWarnings).toBe(0);
    expect(report.diagnostics).toHaveLength(0);
  });

  it('should produce AX101 for duplicate entity names', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'First', fields: [], module: 'auth' },
        { name: 'User', description: 'Second', fields: [], module: 'auth' },
      ],
    });

    const report = runDiagnostics(specs);
    const ax101 = report.diagnostics.filter((d) => d.code === 'AX101');
    expect(ax101).toHaveLength(1);
    expect(ax101[0]!.severity).toBe('error');
    expect(ax101[0]!.message).toContain('User');
  });

  it('should produce AX201 for capability referencing undefined entity', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: ['NonExistent'],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
    });

    const report = runDiagnostics(specs);
    const ax201 = report.diagnostics.filter((d) => d.code === 'AX201');
    expect(ax201).toHaveLength(1);
    expect(ax201[0]!.severity).toBe('error');
    expect(ax201[0]!.message).toContain('NonExistent');
    expect(ax201[0]!.message).toContain('create-user');
  });

  it('should produce AX302 for module with circular dependencies', () => {
    const specs = makeSpecs({
      modules: [
        {
          name: 'auth',
          description: 'Auth module',
          entities: [],
          capabilities: [],
          allowedDependencies: ['billing'],
          forbiddenDependencies: [],
        },
        {
          name: 'billing',
          description: 'Billing module',
          entities: [],
          capabilities: [],
          allowedDependencies: ['auth'],
          forbiddenDependencies: [],
        },
      ],
    });

    const report = runDiagnostics(specs);
    const ax302 = report.diagnostics.filter((d) => d.code === 'AX302');
    expect(ax302.length).toBeGreaterThanOrEqual(1);
    expect(ax302[0]!.severity).toBe('error');
    expect(ax302[0]!.message).toContain('Circular');
  });

  it('should produce AX401 for orphan entity not in any module', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'OrphanEntity', description: 'No module', fields: [], module: 'auth' },
      ],
      // No modules defined, so entity is orphaned
    });

    const report = runDiagnostics(specs);
    const ax401 = report.diagnostics.filter((d) => d.code === 'AX401');
    expect(ax401).toHaveLength(1);
    expect(ax401[0]!.severity).toBe('warning');
    expect(ax401[0]!.message).toContain('OrphanEntity');
  });

  it('should produce AX602 for self-referencing module dependency', () => {
    const specs = makeSpecs({
      modules: [
        {
          name: 'auth',
          description: 'Auth module',
          entities: [],
          capabilities: [],
          allowedDependencies: ['auth'],
          forbiddenDependencies: [],
        },
      ],
    });

    const report = runDiagnostics(specs);
    const ax602 = report.diagnostics.filter((d) => d.code === 'AX602');
    expect(ax602.length).toBeGreaterThanOrEqual(1);
    expect(ax602[0]!.severity).toBe('error');
    expect(ax602[0]!.message).toContain('auth');
  });

  it('should have correct error/warning counts', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'User', fields: [], module: 'auth' },
        { name: 'User', description: 'Dup', fields: [], module: 'auth' },
      ],
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: ['Missing'],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
    });

    const report = runDiagnostics(specs);
    const errors = report.diagnostics.filter((d) => d.severity === 'error');
    const warnings = report.diagnostics.filter((d) => d.severity === 'warning');
    expect(report.totalErrors).toBe(errors.length);
    expect(report.totalWarnings).toBe(warnings.length);
    expect(report.timestamp).toBeDefined();
  });
});

describe('formatDiagnosticsTerminal', () => {
  it('should produce readable terminal output', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'User', fields: [], module: 'auth' },
        { name: 'User', description: 'Dup', fields: [], module: 'auth' },
      ],
    });

    const report = runDiagnostics(specs);
    const output = formatDiagnosticsTerminal(report);

    expect(output).toContain('SYSMARA DIAGNOSTICS');
    expect(output).toContain('ERROR');
    expect(output).toContain('[AX101]');
    expect(output).toContain('Errors:');
    expect(output).toContain('Warnings:');
    expect(output).toContain('source:');
  });
});

describe('formatDiagnosticsJSON', () => {
  it('should produce valid JSON', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'User', fields: [], module: 'auth' },
        { name: 'User', description: 'Dup', fields: [], module: 'auth' },
      ],
    });

    const report = runDiagnostics(specs);
    const jsonStr = formatDiagnosticsJSON(report);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.totalErrors).toBe(report.totalErrors);
    expect(parsed.totalWarnings).toBe(report.totalWarnings);
    expect(parsed.diagnostics).toBeInstanceOf(Array);
    expect(parsed.diagnostics.length).toBe(report.diagnostics.length);
  });
});
