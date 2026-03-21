import { analyzeImpact } from '../../src/impact/analyzer.js';
import { buildSystemGraph } from '../../src/graph/builder.js';
import type { SystemSpecs, RouteSpec } from '../../src/types/index.js';

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

function buildConnectedSpecs(): { specs: SystemSpecs; routes: RouteSpec[] } {
  const specs = makeSpecs({
    entities: [
      { name: 'User', description: 'A user', fields: [], module: 'auth' },
      { name: 'Order', description: 'An order', fields: [], module: 'billing' },
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
      {
        name: 'create-order',
        description: 'Creates an order',
        module: 'billing',
        entities: ['Order', 'User'],
        input: [],
        output: [],
        policies: [],
        invariants: [],
      },
    ],
    policies: [
      {
        name: 'admin-only',
        description: 'Admin only policy',
        actor: 'admin',
        capabilities: ['create-user'],
        conditions: [],
        effect: 'allow',
      },
    ],
    invariants: [
      {
        name: 'email-unique',
        description: 'Unique email',
        entity: 'User',
        rule: 'email must be unique',
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
      {
        name: 'billing',
        description: 'Billing module',
        entities: ['Order'],
        capabilities: ['create-order'],
        allowedDependencies: ['auth'],
        forbiddenDependencies: [],
      },
    ],
  });

  const routes: RouteSpec[] = [
    { method: 'POST', path: '/users', capability: 'create-user' },
    { method: 'POST', path: '/orders', capability: 'create-order' },
  ];

  return { specs, routes };
}

describe('analyzeImpact', () => {
  it('should return null for a non-existent target', () => {
    const specs = makeSpecs();
    const graph = buildSystemGraph(specs);
    const result = analyzeImpact(graph, 'entity:DoesNotExist');
    expect(result).toBeNull();
  });

  it('should include connected capabilities, modules, and invariants for entity impact', () => {
    const { specs, routes } = buildConnectedSpecs();
    const graph = buildSystemGraph(specs, routes);
    const result = analyzeImpact(graph, 'entity:User');

    expect(result).not.toBeNull();
    expect(result!.target).toBe('entity:User');
    expect(result!.targetType).toBe('entity');
    expect(result!.affectedCapabilities).toContain('create-user');
    expect(result!.affectedCapabilities).toContain('create-order');
    expect(result!.affectedModules).toContain('auth');
    expect(result!.affectedInvariants).toContain('email-unique');
  });

  it('should include connected entities and policies for capability impact', () => {
    const { specs, routes } = buildConnectedSpecs();
    const graph = buildSystemGraph(specs, routes);
    const result = analyzeImpact(graph, 'capability:create-user');

    expect(result).not.toBeNull();
    expect(result!.target).toBe('capability:create-user');
    expect(result!.targetType).toBe('capability');
    expect(result!.affectedPolicies).toContain('admin-only');
  });

  it('should have deterministic ordering in impact surface', () => {
    const { specs, routes } = buildConnectedSpecs();
    const graph = buildSystemGraph(specs, routes);

    const result1 = analyzeImpact(graph, 'entity:User');
    const result2 = analyzeImpact(graph, 'entity:User');

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1!.affectedCapabilities).toEqual(result2!.affectedCapabilities);
    expect(result1!.affectedModules).toEqual(result2!.affectedModules);
    expect(result1!.generatedArtifacts).toEqual(result2!.generatedArtifacts);

    // Verify sorted
    const caps = result1!.affectedCapabilities;
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i]! >= caps[i - 1]!).toBe(true);
    }
  });

  it('should generate correct artifact paths', () => {
    const { specs, routes } = buildConnectedSpecs();
    const graph = buildSystemGraph(specs, routes);
    const result = analyzeImpact(graph, 'entity:User');

    expect(result).not.toBeNull();
    // The target itself plus affected nodes generate artifacts
    expect(result!.generatedArtifacts).toContain('generated/entity/User.ts');

    // All artifacts follow the pattern generated/<type>/<name>.ts
    for (const artifact of result!.generatedArtifacts) {
      expect(artifact).toMatch(/^generated\/\w+\/.+\.ts$/);
    }
  });

  it('should generate correct test file paths for affected capabilities', () => {
    const { specs, routes } = buildConnectedSpecs();
    const graph = buildSystemGraph(specs, routes);
    const result = analyzeImpact(graph, 'entity:User');

    expect(result).not.toBeNull();
    // User entity is used by create-user and create-order
    expect(result!.affectedTests).toContain('tests/capabilities/create-user.test.ts');
    expect(result!.affectedTests).toContain('tests/capabilities/create-order.test.ts');

    for (const test of result!.affectedTests) {
      expect(test).toMatch(/^tests\/capabilities\/.+\.test\.ts$/);
    }
  });

  it('should include target capability in affectedTests when target is a capability', () => {
    const { specs, routes } = buildConnectedSpecs();
    const graph = buildSystemGraph(specs, routes);
    const result = analyzeImpact(graph, 'capability:create-user');

    expect(result).not.toBeNull();
    expect(result!.affectedTests).toContain('tests/capabilities/create-user.test.ts');
  });

  it('should include affected files reachable via module owns edges', () => {
    const { specs, routes } = buildConnectedSpecs();
    const graph = buildSystemGraph(specs, routes);
    const result = analyzeImpact(graph, 'entity:User');

    expect(result).not.toBeNull();
    // User entity belongs_to auth module, which owns file nodes for create-user
    expect(result!.affectedFiles.length).toBeGreaterThan(0);
    expect(result!.affectedFiles).toContain('app/generated/routes/create-user.ts');
  });

  it('should not include file nodes in generatedArtifacts', () => {
    const { specs, routes } = buildConnectedSpecs();
    const graph = buildSystemGraph(specs, routes);
    const result = analyzeImpact(graph, 'entity:User');

    expect(result).not.toBeNull();
    // generatedArtifacts should only contain non-file node paths
    for (const artifact of result!.generatedArtifacts) {
      expect(artifact).toMatch(/^generated\/\w+\/.+\.ts$/);
      expect(artifact).not.toContain('file');
    }
  });
});
