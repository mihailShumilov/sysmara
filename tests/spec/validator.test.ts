import type { SystemSpecs } from '../../src/types/index.js';
import { crossValidate } from '../../src/spec/validator.js';

// ── Helpers ──

function emptySpecs(): SystemSpecs {
  return {
    entities: [],
    capabilities: [],
    policies: [],
    invariants: [],
    modules: [],
    flows: [],
    safeEditZones: [],
    glossary: [],
  };
}

function minimalValidSpecs(): SystemSpecs {
  return {
    entities: [
      {
        name: 'User',
        description: 'A user',
        fields: [{ name: 'id', type: 'string', required: true }],
        module: 'auth',
      },
    ],
    capabilities: [
      {
        name: 'CreateUser',
        description: 'Creates a user',
        module: 'auth',
        entities: ['User'],
        input: [{ name: 'email', type: 'string', required: true }],
        output: [{ name: 'id', type: 'string', required: true }],
        policies: ['AdminOnly'],
        invariants: ['UniqueEmail'],
      },
    ],
    policies: [
      {
        name: 'AdminOnly',
        description: 'Only admins',
        actor: 'admin',
        capabilities: ['CreateUser'],
        conditions: [{ field: 'role', operator: 'has_role', value: 'admin' }],
        effect: 'allow',
      },
    ],
    invariants: [
      {
        name: 'UniqueEmail',
        description: 'Email must be unique',
        entity: 'User',
        rule: 'No duplicate emails',
        severity: 'error',
        enforcement: 'runtime',
      },
    ],
    modules: [
      {
        name: 'auth',
        description: 'Auth module',
        entities: ['User'],
        capabilities: ['CreateUser'],
        allowedDependencies: [],
        forbiddenDependencies: [],
      },
    ],
    flows: [],
    safeEditZones: [],
    glossary: [],
  };
}

// ── Valid specs ──

describe('crossValidate', () => {
  it('produces no diagnostics for empty specs', () => {
    const diagnostics = crossValidate(emptySpecs());
    expect(diagnostics).toHaveLength(0);
  });

  it('produces no error diagnostics for minimal valid specs', () => {
    const diagnostics = crossValidate(minimalValidSpecs());
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  // ── Capability referencing undefined entity ──

  it('reports error when capability references undefined entity', () => {
    const specs = minimalValidSpecs();
    specs.capabilities[0]!.entities = ['NonExistentEntity'];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_ENTITY_REF' && d.source === 'capability:CreateUser',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('NonExistentEntity');
    expect(errors[0]!.severity).toBe('error');
  });

  // ── Capability referencing undefined policy ──

  it('reports error when capability references undefined policy', () => {
    const specs = minimalValidSpecs();
    specs.capabilities[0]!.policies = ['GhostPolicy'];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_POLICY_REF' && d.source === 'capability:CreateUser',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('GhostPolicy');
    expect(errors[0]!.severity).toBe('error');
  });

  // ── Capability referencing undefined invariant ──

  it('reports error when capability references undefined invariant', () => {
    const specs = minimalValidSpecs();
    specs.capabilities[0]!.invariants = ['GhostInvariant'];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_INVARIANT_REF' && d.source === 'capability:CreateUser',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('GhostInvariant');
    expect(errors[0]!.severity).toBe('error');
  });

  // ── Capability referencing undefined module ──

  it('reports error when capability references undefined module', () => {
    const specs = minimalValidSpecs();
    specs.capabilities[0]!.module = 'nonexistent-module';

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_MODULE_REF' && d.source === 'capability:CreateUser',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('nonexistent-module');
  });

  // ── Policy referencing undefined capability ──

  it('reports error when policy references undefined capability', () => {
    const specs = minimalValidSpecs();
    specs.policies[0]!.capabilities = ['GhostCapability'];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_CAPABILITY_REF' && d.source === 'policy:AdminOnly',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('GhostCapability');
    expect(errors[0]!.severity).toBe('error');
  });

  // ── Invariant referencing undefined entity ──

  it('reports error when invariant references undefined entity', () => {
    const specs = minimalValidSpecs();
    specs.invariants[0]!.entity = 'GhostEntity';

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_ENTITY_REF' && d.source === 'invariant:UniqueEmail',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('GhostEntity');
    expect(errors[0]!.severity).toBe('error');
  });

  // ── Module referencing undefined entity ──

  it('reports error when module references undefined entity', () => {
    const specs = minimalValidSpecs();
    specs.modules[0]!.entities = ['User', 'GhostEntity'];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_ENTITY_REF' && d.source === 'module:auth',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('GhostEntity');
  });

  // ── Module referencing undefined capability ──

  it('reports error when module references undefined capability', () => {
    const specs = minimalValidSpecs();
    specs.modules[0]!.capabilities = ['CreateUser', 'GhostCapability'];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_CAPABILITY_REF' && d.source === 'module:auth',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('GhostCapability');
  });

  // ── Module dependency cycle detection ──

  it('detects module dependency cycles', () => {
    const specs = emptySpecs();
    specs.modules = [
      {
        name: 'A',
        description: 'Module A',
        entities: [],
        capabilities: [],
        allowedDependencies: ['B'],
        forbiddenDependencies: [],
      },
      {
        name: 'B',
        description: 'Module B',
        entities: [],
        capabilities: [],
        allowedDependencies: ['C'],
        forbiddenDependencies: [],
      },
      {
        name: 'C',
        description: 'Module C',
        entities: [],
        capabilities: [],
        allowedDependencies: ['A'],
        forbiddenDependencies: [],
      },
    ];

    const diagnostics = crossValidate(specs);
    const cycleErrors = diagnostics.filter((d) => d.code === 'MODULE_DEPENDENCY_CYCLE');
    expect(cycleErrors.length).toBeGreaterThanOrEqual(1);
    expect(cycleErrors[0]!.severity).toBe('error');
    expect(cycleErrors[0]!.message).toContain('cycle');
  });

  it('does not report cycles for acyclic dependencies', () => {
    const specs = emptySpecs();
    specs.modules = [
      {
        name: 'A',
        description: 'Module A',
        entities: [],
        capabilities: [],
        allowedDependencies: ['B'],
        forbiddenDependencies: [],
      },
      {
        name: 'B',
        description: 'Module B',
        entities: [],
        capabilities: [],
        allowedDependencies: ['C'],
        forbiddenDependencies: [],
      },
      {
        name: 'C',
        description: 'Module C',
        entities: [],
        capabilities: [],
        allowedDependencies: [],
        forbiddenDependencies: [],
      },
    ];

    const diagnostics = crossValidate(specs);
    const cycleErrors = diagnostics.filter((d) => d.code === 'MODULE_DEPENDENCY_CYCLE');
    expect(cycleErrors).toHaveLength(0);
  });

  it('detects self-referencing module cycle', () => {
    const specs = emptySpecs();
    specs.modules = [
      {
        name: 'A',
        description: 'Module A',
        entities: [],
        capabilities: [],
        allowedDependencies: ['A'],
        forbiddenDependencies: [],
      },
    ];

    const diagnostics = crossValidate(specs);
    const cycleErrors = diagnostics.filter((d) => d.code === 'MODULE_DEPENDENCY_CYCLE');
    expect(cycleErrors.length).toBeGreaterThanOrEqual(1);
  });

  // ── Orphan entity detection ──

  it('warns about orphan entities not listed in any module', () => {
    const specs = minimalValidSpecs();
    // Add an entity that is not in any module's entities list
    specs.entities.push({
      name: 'OrphanEntity',
      description: 'Not in any module',
      fields: [{ name: 'id', type: 'string', required: true }],
      module: 'auth',
    });

    const diagnostics = crossValidate(specs);
    const orphans = diagnostics.filter(
      (d) => d.code === 'ORPHAN_ENTITY' && d.message.includes('OrphanEntity'),
    );
    expect(orphans.length).toBeGreaterThanOrEqual(1);
    expect(orphans[0]!.severity).toBe('warning');
  });

  it('does not warn about entities that are listed in a module', () => {
    const specs = minimalValidSpecs();
    const diagnostics = crossValidate(specs);
    const orphans = diagnostics.filter(
      (d) => d.code === 'ORPHAN_ENTITY' && d.message.includes('User'),
    );
    expect(orphans).toHaveLength(0);
  });

  // ── Orphan capability detection ──

  it('warns about orphan capabilities not listed in any module', () => {
    const specs = minimalValidSpecs();
    // Add a capability that is not in any module's capabilities list
    specs.capabilities.push({
      name: 'OrphanCap',
      description: 'Not in any module',
      module: 'auth',
      entities: ['User'],
      input: [],
      output: [],
      policies: [],
      invariants: [],
    });

    const diagnostics = crossValidate(specs);
    const orphans = diagnostics.filter(
      (d) => d.code === 'ORPHAN_CAPABILITY' && d.message.includes('OrphanCap'),
    );
    expect(orphans.length).toBeGreaterThanOrEqual(1);
    expect(orphans[0]!.severity).toBe('warning');
  });

  it('does not warn about capabilities listed in a module', () => {
    const specs = minimalValidSpecs();
    const diagnostics = crossValidate(specs);
    const orphans = diagnostics.filter(
      (d) => d.code === 'ORPHAN_CAPABILITY' && d.message.includes('CreateUser'),
    );
    expect(orphans).toHaveLength(0);
  });

  // ── Duplicate name detection ──

  it('reports error for duplicate entity names', () => {
    const specs = minimalValidSpecs();
    specs.entities.push({ ...specs.entities[0]! });

    const diagnostics = crossValidate(specs);
    const dupes = diagnostics.filter(
      (d) => d.code === 'DUPLICATE_NAME' && d.message.includes('entity'),
    );
    expect(dupes.length).toBeGreaterThanOrEqual(1);
    expect(dupes[0]!.severity).toBe('error');
    expect(dupes[0]!.message).toContain('User');
  });

  it('reports error for duplicate capability names', () => {
    const specs = minimalValidSpecs();
    specs.capabilities.push({ ...specs.capabilities[0]! });

    const diagnostics = crossValidate(specs);
    const dupes = diagnostics.filter(
      (d) => d.code === 'DUPLICATE_NAME' && d.message.includes('capability'),
    );
    expect(dupes.length).toBeGreaterThanOrEqual(1);
    expect(dupes[0]!.severity).toBe('error');
  });

  it('reports error for duplicate policy names', () => {
    const specs = minimalValidSpecs();
    specs.policies.push({ ...specs.policies[0]! });

    const diagnostics = crossValidate(specs);
    const dupes = diagnostics.filter(
      (d) => d.code === 'DUPLICATE_NAME' && d.message.includes('policy'),
    );
    expect(dupes.length).toBeGreaterThanOrEqual(1);
  });

  it('reports error for duplicate invariant names', () => {
    const specs = minimalValidSpecs();
    specs.invariants.push({ ...specs.invariants[0]! });

    const diagnostics = crossValidate(specs);
    const dupes = diagnostics.filter(
      (d) => d.code === 'DUPLICATE_NAME' && d.message.includes('invariant'),
    );
    expect(dupes.length).toBeGreaterThanOrEqual(1);
  });

  it('reports error for duplicate module names', () => {
    const specs = minimalValidSpecs();
    specs.modules.push({ ...specs.modules[0]! });

    const diagnostics = crossValidate(specs);
    const dupes = diagnostics.filter(
      (d) => d.code === 'DUPLICATE_NAME' && d.message.includes('module'),
    );
    expect(dupes.length).toBeGreaterThanOrEqual(1);
  });

  it('reports error for duplicate flow names', () => {
    const specs = minimalValidSpecs();
    specs.flows = [
      {
        name: 'TestFlow',
        description: 'A flow',
        trigger: 'CreateUser',
        steps: [{ name: 'step1', action: 'CreateUser', onFailure: 'abort' }],
        module: 'auth',
      },
      {
        name: 'TestFlow',
        description: 'Duplicate flow',
        trigger: 'CreateUser',
        steps: [{ name: 'step1', action: 'CreateUser', onFailure: 'abort' }],
        module: 'auth',
      },
    ];

    const diagnostics = crossValidate(specs);
    const dupes = diagnostics.filter(
      (d) => d.code === 'DUPLICATE_NAME' && d.message.includes('flow'),
    );
    expect(dupes.length).toBeGreaterThanOrEqual(1);
  });

  // ── Entity module reference ──

  it('reports error when entity references undefined module', () => {
    const specs = minimalValidSpecs();
    specs.entities[0]!.module = 'nonexistent';

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_MODULE_REF' && d.source === 'entity:User',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('nonexistent');
  });

  // ── Entity invariant reference ──

  it('reports error when entity references undefined invariant', () => {
    const specs = minimalValidSpecs();
    specs.entities[0]!.invariants = ['GhostInvariant'];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_INVARIANT_REF' && d.source === 'entity:User',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('GhostInvariant');
  });

  // ── Flow reference checks ──

  it('reports error when flow trigger references undefined capability', () => {
    const specs = minimalValidSpecs();
    specs.flows = [
      {
        name: 'TestFlow',
        description: 'A flow',
        trigger: 'NonExistentCapability',
        steps: [{ name: 'step1', action: 'CreateUser', onFailure: 'abort' }],
        module: 'auth',
      },
    ];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_CAPABILITY_REF' && d.source === 'flow:TestFlow',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain('NonExistentCapability');
  });

  it('reports error when flow references undefined module', () => {
    const specs = minimalValidSpecs();
    specs.flows = [
      {
        name: 'TestFlow',
        description: 'A flow',
        trigger: 'CreateUser',
        steps: [{ name: 'step1', action: 'CreateUser', onFailure: 'abort' }],
        module: 'nonexistent',
      },
    ];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_MODULE_REF' && d.source === 'flow:TestFlow',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  // ── Forbidden dependency violation ──

  it('reports error when module has same dep in allowed and forbidden', () => {
    const specs = emptySpecs();
    specs.modules = [
      {
        name: 'A',
        description: 'Module A',
        entities: [],
        capabilities: [],
        allowedDependencies: ['B'],
        forbiddenDependencies: ['B'],
      },
      {
        name: 'B',
        description: 'Module B',
        entities: [],
        capabilities: [],
        allowedDependencies: [],
        forbiddenDependencies: [],
      },
    ];

    const diagnostics = crossValidate(specs);
    const violations = diagnostics.filter((d) => d.code === 'FORBIDDEN_DEPENDENCY_VIOLATION');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]!.severity).toBe('error');
    expect(violations[0]!.message).toContain('allowedDependencies');
    expect(violations[0]!.message).toContain('forbiddenDependencies');
  });

  // ── Module allowed dependency referencing undefined module ──

  it('reports error when module allowedDependencies references undefined module', () => {
    const specs = emptySpecs();
    specs.modules = [
      {
        name: 'A',
        description: 'Module A',
        entities: [],
        capabilities: [],
        allowedDependencies: ['NonExistent'],
        forbiddenDependencies: [],
      },
    ];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter(
      (d) => d.code === 'UNRESOLVED_MODULE_REF' && d.source === 'module:A' && d.path === 'allowedDependencies',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  // ── Multiple issues at once ──

  it('reports multiple issues in a single validation pass', () => {
    const specs = emptySpecs();
    specs.entities = [
      {
        name: 'User',
        description: 'A user',
        fields: [{ name: 'id', type: 'string', required: true }],
        module: 'nonexistent',
      },
    ];
    specs.capabilities = [
      {
        name: 'CreateUser',
        description: 'Creates a user',
        module: 'nonexistent',
        entities: ['GhostEntity'],
        input: [],
        output: [],
        policies: ['GhostPolicy'],
        invariants: ['GhostInvariant'],
      },
    ];

    const diagnostics = crossValidate(specs);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    // Should have at least: unresolved entity ref, unresolved policy ref,
    // unresolved invariant ref, unresolved module refs
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});
