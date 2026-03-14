import { describe, it, expect } from 'vitest';
import {
  validateInvariantSpecs,
  resolveInvariantsForEntity,
  resolveInvariantsForCapability,
} from '../../src/invariants/engine.js';
import type { InvariantSpec, EntitySpec, CapabilitySpec } from '../../src/types/index.js';

function makeInvariant(overrides: Partial<InvariantSpec> = {}): InvariantSpec {
  return {
    name: 'test_invariant',
    description: 'Test invariant',
    entity: 'user',
    rule: 'must be valid',
    severity: 'error',
    enforcement: 'runtime',
    ...overrides,
  };
}

function makeEntity(overrides: Partial<EntitySpec> = {}): EntitySpec {
  return {
    name: 'user',
    description: 'A user',
    fields: [],
    module: 'users',
    ...overrides,
  };
}

describe('validateInvariantSpecs', () => {
  it('returns no diagnostics for valid invariants', () => {
    const entities = [makeEntity()];
    const invariants = [makeInvariant({ name: 'email_unique', entity: 'user' })];
    const diags = validateInvariantSpecs(invariants, entities);
    expect(diags).toHaveLength(0);
  });

  it('detects undefined entity reference', () => {
    const entities = [makeEntity()];
    const invariants = [makeInvariant({ name: 'inv1', entity: 'nonexistent' })];
    const diags = validateInvariantSpecs(invariants, entities);
    expect(diags.some((d) => d.code === 'INV_UNDEFINED_ENTITY')).toBe(true);
  });

  it('detects duplicate invariant names', () => {
    const entities = [makeEntity()];
    const invariants = [
      makeInvariant({ name: 'dup', entity: 'user' }),
      makeInvariant({ name: 'dup', entity: 'user' }),
    ];
    const diags = validateInvariantSpecs(invariants, entities);
    expect(diags.some((d) => d.code === 'INV_DUPLICATE_NAME')).toBe(true);
  });
});

describe('resolveInvariantsForEntity', () => {
  it('returns invariants matching the entity', () => {
    const invariants = [
      makeInvariant({ name: 'inv1', entity: 'user' }),
      makeInvariant({ name: 'inv2', entity: 'order' }),
      makeInvariant({ name: 'inv3', entity: 'user' }),
    ];
    const result = resolveInvariantsForEntity('user', invariants);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.name)).toEqual(['inv1', 'inv3']);
  });

  it('returns empty for unknown entity', () => {
    const invariants = [makeInvariant({ name: 'inv1', entity: 'user' })];
    const result = resolveInvariantsForEntity('nonexistent', invariants);
    expect(result).toHaveLength(0);
  });
});

describe('resolveInvariantsForCapability', () => {
  it('returns invariants referenced by the capability', () => {
    const capabilities: CapabilitySpec[] = [
      {
        name: 'create_user',
        description: 'Create user',
        module: 'users',
        entities: ['user'],
        input: [],
        output: [],
        policies: [],
        invariants: ['email_unique', 'name_required'],
      },
    ];
    const invariants = [
      makeInvariant({ name: 'email_unique', entity: 'user' }),
      makeInvariant({ name: 'name_required', entity: 'user' }),
      makeInvariant({ name: 'other_inv', entity: 'order' }),
    ];
    const result = resolveInvariantsForCapability('create_user', capabilities, invariants);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.name)).toEqual(['email_unique', 'name_required']);
  });

  it('returns empty for unknown capability', () => {
    const result = resolveInvariantsForCapability('nonexistent', [], []);
    expect(result).toHaveLength(0);
  });
});
