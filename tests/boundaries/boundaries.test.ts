import { describe, it, expect } from 'vitest';
import {
  validateModuleBoundaries,
  validateCapabilityBoundaries,
  detectModuleCycles,
} from '../../src/boundaries/engine.js';
import type { ModuleSpec, CapabilitySpec, EntitySpec } from '../../src/types/index.js';

function makeModule(overrides: Partial<ModuleSpec> = {}): ModuleSpec {
  return {
    name: 'test_module',
    description: 'Test module',
    entities: [],
    capabilities: [],
    allowedDependencies: [],
    forbiddenDependencies: [],
    ...overrides,
  };
}

describe('validateModuleBoundaries', () => {
  it('returns no diagnostics for valid modules', () => {
    const modules = [
      makeModule({ name: 'users' }),
      makeModule({ name: 'billing', allowedDependencies: ['users'] }),
    ];
    const diags = validateModuleBoundaries(modules);
    expect(diags).toHaveLength(0);
  });

  it('detects conflicting allowed/forbidden deps', () => {
    const modules = [
      makeModule({ name: 'users' }),
      makeModule({
        name: 'billing',
        allowedDependencies: ['users'],
        forbiddenDependencies: ['users'],
      }),
    ];
    const diags = validateModuleBoundaries(modules);
    expect(diags.some((d) => d.code === 'MOD_CONFLICTING_DEP')).toBe(true);
  });

  it('detects self-referencing allowed dependency', () => {
    const modules = [makeModule({ name: 'users', allowedDependencies: ['users'] })];
    const diags = validateModuleBoundaries(modules);
    expect(diags.some((d) => d.code === 'MOD_SELF_DEP')).toBe(true);
  });

  it('detects undefined dependency', () => {
    const modules = [makeModule({ name: 'users', allowedDependencies: ['nonexistent'] })];
    const diags = validateModuleBoundaries(modules);
    expect(diags.some((d) => d.code === 'MOD_UNDEFINED_DEP')).toBe(true);
  });
});

describe('validateCapabilityBoundaries', () => {
  it('allows capabilities to reference entities in own module', () => {
    const modules = [makeModule({ name: 'users', entities: ['user'] })];
    const entities: EntitySpec[] = [
      { name: 'user', description: 'A user', fields: [], module: 'users' },
    ];
    const capabilities: CapabilitySpec[] = [
      {
        name: 'create_user',
        description: 'Create user',
        module: 'users',
        entities: ['user'],
        input: [],
        output: [],
        policies: [],
        invariants: [],
      },
    ];
    const diags = validateCapabilityBoundaries(capabilities, modules, entities);
    expect(diags).toHaveLength(0);
  });

  it('allows capabilities to reference entities in allowed dependency modules', () => {
    const modules = [
      makeModule({ name: 'users', entities: ['user'] }),
      makeModule({ name: 'billing', allowedDependencies: ['users'] }),
    ];
    const entities: EntitySpec[] = [
      { name: 'user', description: 'A user', fields: [], module: 'users' },
    ];
    const capabilities: CapabilitySpec[] = [
      {
        name: 'charge_user',
        description: 'Charge a user',
        module: 'billing',
        entities: ['user'],
        input: [],
        output: [],
        policies: [],
        invariants: [],
      },
    ];
    const diags = validateCapabilityBoundaries(capabilities, modules, entities);
    expect(diags).toHaveLength(0);
  });

  it('detects cross-module boundary violation', () => {
    const modules = [
      makeModule({ name: 'users', entities: ['user'] }),
      makeModule({ name: 'billing' }), // no allowed deps
    ];
    const entities: EntitySpec[] = [
      { name: 'user', description: 'A user', fields: [], module: 'users' },
    ];
    const capabilities: CapabilitySpec[] = [
      {
        name: 'charge_user',
        description: 'Charge user',
        module: 'billing',
        entities: ['user'],
        input: [],
        output: [],
        policies: [],
        invariants: [],
      },
    ];
    const diags = validateCapabilityBoundaries(capabilities, modules, entities);
    expect(diags.some((d) => d.code === 'CAP_BOUNDARY_VIOLATION')).toBe(true);
  });

  it('detects capability in undefined module', () => {
    const modules: ModuleSpec[] = [];
    const entities: EntitySpec[] = [];
    const capabilities: CapabilitySpec[] = [
      {
        name: 'create_user',
        description: 'Create user',
        module: 'nonexistent',
        entities: [],
        input: [],
        output: [],
        policies: [],
        invariants: [],
      },
    ];
    const diags = validateCapabilityBoundaries(capabilities, modules, entities);
    expect(diags.some((d) => d.code === 'CAP_BOUNDARY_UNDEFINED_MODULE')).toBe(true);
  });
});

describe('detectModuleCycles', () => {
  it('returns no cycles for acyclic graph', () => {
    const modules = [
      makeModule({ name: 'a', allowedDependencies: ['b'] }),
      makeModule({ name: 'b', allowedDependencies: ['c'] }),
      makeModule({ name: 'c' }),
    ];
    const cycles = detectModuleCycles(modules);
    expect(cycles).toHaveLength(0);
  });

  it('detects direct cycle', () => {
    const modules = [
      makeModule({ name: 'a', allowedDependencies: ['b'] }),
      makeModule({ name: 'b', allowedDependencies: ['a'] }),
    ];
    const cycles = detectModuleCycles(modules);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('detects indirect cycle', () => {
    const modules = [
      makeModule({ name: 'a', allowedDependencies: ['b'] }),
      makeModule({ name: 'b', allowedDependencies: ['c'] }),
      makeModule({ name: 'c', allowedDependencies: ['a'] }),
    ];
    const cycles = detectModuleCycles(modules);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('returns empty for no modules', () => {
    const cycles = detectModuleCycles([]);
    expect(cycles).toHaveLength(0);
  });
});
