import { buildSystemMap } from '../../src/graph/system-map.js';
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

describe('buildSystemMap', () => {
  it('should produce empty map from empty specs', () => {
    const map = buildSystemMap(makeSpecs());
    expect(map.modules).toEqual([]);
    expect(map.capabilities).toEqual([]);
    expect(map.entities).toEqual([]);
    expect(map.unresolved).toEqual([]);
    expect(map.version).toBe('0.1.0');
    expect(map.generatedAt).toBeDefined();
  });

  it('should list entities and capabilities for each module', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'User', fields: [], module: 'auth' },
        { name: 'Role', description: 'Role', fields: [], module: 'auth' },
      ],
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: ['User'],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
      modules: [
        {
          name: 'auth',
          description: 'Auth module',
          entities: ['User', 'Role'],
          capabilities: ['create-user'],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });

    const map = buildSystemMap(specs);
    expect(map.modules).toHaveLength(1);
    const authModule = map.modules[0]!;
    expect(authModule.name).toBe('auth');
    expect(authModule.entities).toEqual(['Role', 'User']); // sorted
    expect(authModule.capabilities).toEqual(['create-user']);
  });

  it('should list module, entities, policies, and invariants for each capability', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'User', fields: [], module: 'auth' },
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
          invariants: ['user-email-unique'],
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
          name: 'user-email-unique',
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

    const map = buildSystemMap(specs);
    expect(map.capabilities).toHaveLength(1);
    const cap = map.capabilities[0]!;
    expect(cap.name).toBe('create-user');
    expect(cap.module).toBe('auth');
    expect(cap.entities).toEqual(['User']);
    expect(cap.policies).toEqual(['admin-only']);
    expect(cap.invariants).toEqual(['user-email-unique']);
  });

  it('should track unresolved references', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: ['NonExistentEntity'],
          input: [],
          output: [],
          policies: ['missing-policy'],
          invariants: ['missing-invariant'],
        },
      ],
    });

    const map = buildSystemMap(specs);
    expect(map.unresolved).toContain('entity:NonExistentEntity');
    expect(map.unresolved).toContain('policy:missing-policy');
    expect(map.unresolved).toContain('invariant:missing-invariant');
    expect(map.unresolved).toContain('module:auth');
  });

  it('should track unresolved module dependencies', () => {
    const specs = makeSpecs({
      modules: [
        {
          name: 'billing',
          description: 'Billing module',
          entities: [],
          capabilities: [],
          allowedDependencies: ['non-existent-module'],
          forbiddenDependencies: [],
        },
      ],
    });

    const map = buildSystemMap(specs);
    expect(map.unresolved).toContain('module:non-existent-module');
  });

  it('should include routes in capability map entries', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: [],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
      modules: [
        {
          name: 'auth',
          description: 'Auth module',
          entities: [],
          capabilities: ['create-user'],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });

    const routes = [
      { method: 'POST' as const, path: '/users', capability: 'create-user' },
    ];

    const map = buildSystemMap(specs, routes);
    const cap = map.capabilities[0]!;
    expect(cap.routes).toEqual(['POST /users']);
  });
});
