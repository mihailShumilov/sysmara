import { describe, it, expect } from 'vitest';
import { validateEditZones, checkBoundaryViolations } from '../../src/safety/zone-validator.js';
import type {
  SafeEditZoneSpec,
  GeneratedManifest,
  ModuleSpec,
  SystemSpecs,
} from '../../src/types/index.js';

function makeManifest(files: GeneratedManifest['files'] = []): GeneratedManifest {
  return { generatedAt: '2025-01-01T00:00:00Z', files };
}

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

describe('validateEditZones', () => {
  it('returns no violations when zones and manifest match', () => {
    const zones: SafeEditZoneSpec[] = [
      { path: 'app/generated/handler.ts', zone: 'generated' },
    ];
    const manifest = makeManifest([
      { path: 'app/generated/handler.ts', source: 'cap:create_user', zone: 'generated', checksum: 'abc', regenerable: true },
    ]);
    const violations = validateEditZones(zones, manifest);
    expect(violations).toHaveLength(0);
  });

  it('detects zone mismatch between manifest and safe-edit-zones', () => {
    const zones: SafeEditZoneSpec[] = [
      { path: 'app/generated/handler.ts', zone: 'protected' },
    ];
    const manifest = makeManifest([
      { path: 'app/generated/handler.ts', source: 'cap:create_user', zone: 'editable', checksum: 'abc', regenerable: true },
    ]);
    const violations = validateEditZones(zones, manifest);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.violation).toContain('editable');
  });

  it('detects manifest entries without zone declarations', () => {
    const zones: SafeEditZoneSpec[] = [];
    const manifest = makeManifest([
      { path: 'app/generated/handler.ts', source: 'cap:create_user', zone: 'generated', checksum: 'abc', regenerable: true },
    ]);
    const violations = validateEditZones(zones, manifest);
    expect(violations.some((v) => v.violation.includes('no corresponding'))).toBe(true);
  });
});

describe('checkBoundaryViolations', () => {
  it('returns no diagnostics for valid boundaries', () => {
    const modules: ModuleSpec[] = [
      { name: 'users', description: 'Users', entities: ['user'], capabilities: ['create_user'], allowedDependencies: [], forbiddenDependencies: [] },
    ];
    const specs = makeSpecs({
      modules,
      entities: [{ name: 'user', description: 'User', fields: [], module: 'users' }],
      capabilities: [{
        name: 'create_user', description: 'Create', module: 'users',
        entities: ['user'], input: [], output: [], policies: [], invariants: [],
      }],
    });
    const diags = checkBoundaryViolations(modules, specs);
    expect(diags).toHaveLength(0);
  });

  it('detects forbidden dependency conflict', () => {
    const modules: ModuleSpec[] = [
      { name: 'users', description: 'Users', entities: [], capabilities: [], allowedDependencies: ['billing'], forbiddenDependencies: ['billing'] },
      { name: 'billing', description: 'Billing', entities: [], capabilities: [], allowedDependencies: [], forbiddenDependencies: [] },
    ];
    const specs = makeSpecs({ modules });
    const diags = checkBoundaryViolations(modules, specs);
    expect(diags.some((d) => d.code === 'BOUNDARY_FORBIDDEN_DEP')).toBe(true);
  });

  it('detects cross-module entity access', () => {
    const modules: ModuleSpec[] = [
      { name: 'users', description: 'Users', entities: ['user'], capabilities: [], allowedDependencies: [], forbiddenDependencies: [] },
      { name: 'billing', description: 'Billing', entities: [], capabilities: ['charge_user'], allowedDependencies: [], forbiddenDependencies: [] },
    ];
    const specs = makeSpecs({
      modules,
      entities: [{ name: 'user', description: 'User', fields: [], module: 'users' }],
      capabilities: [{
        name: 'charge_user', description: 'Charge', module: 'billing',
        entities: ['user'], input: [], output: [], policies: [], invariants: [],
      }],
    });
    const diags = checkBoundaryViolations(modules, specs);
    expect(diags.some((d) => d.code === 'BOUNDARY_CROSS_MODULE_ENTITY')).toBe(true);
  });
});
