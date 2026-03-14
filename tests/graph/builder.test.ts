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

describe('buildSystemGraph', () => {
  it('should produce empty graph from empty specs', () => {
    const graph = buildSystemGraph(makeSpecs());
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.version).toBe('0.1.0');
    expect(graph.generatedAt).toBeDefined();
  });

  it('should produce entity node from single entity', () => {
    const specs = makeSpecs({
      entities: [
        {
          name: 'User',
          description: 'A user entity',
          fields: [],
          module: 'auth',
        },
      ],
    });

    const graph = buildSystemGraph(specs);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toEqual({
      id: 'entity:User',
      type: 'entity',
      name: 'User',
      metadata: {},
    });
  });

  it('should produce belongs_to edge when entity is listed in module', () => {
    const specs = makeSpecs({
      entities: [
        {
          name: 'User',
          description: 'A user entity',
          fields: [],
          module: 'auth',
        },
      ],
      modules: [
        {
          name: 'auth',
          description: 'Auth module',
          entities: ['User'],
          capabilities: [],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });

    const graph = buildSystemGraph(specs);
    const belongsToEdges = graph.edges.filter((e) => e.type === 'belongs_to');
    expect(belongsToEdges).toHaveLength(1);
    expect(belongsToEdges[0]).toEqual({
      source: 'entity:User',
      target: 'module:auth',
      type: 'belongs_to',
    });
  });

  it('should produce uses_entity edges for capability entities', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'User', fields: [], module: 'auth' },
        { name: 'Session', description: 'Session', fields: [], module: 'auth' },
      ],
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: ['User', 'Session'],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
    });

    const graph = buildSystemGraph(specs);
    const usesEdges = graph.edges.filter((e) => e.type === 'uses_entity');
    expect(usesEdges).toHaveLength(2);
    expect(usesEdges).toContainEqual({
      source: 'capability:create-user',
      target: 'entity:User',
      type: 'uses_entity',
    });
    expect(usesEdges).toContainEqual({
      source: 'capability:create-user',
      target: 'entity:Session',
      type: 'uses_entity',
    });
  });

  it('should produce governed_by edges for policies that list capabilities', () => {
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
    });

    const graph = buildSystemGraph(specs);
    const governedEdges = graph.edges.filter((e) => e.type === 'governed_by');
    expect(governedEdges).toHaveLength(1);
    expect(governedEdges[0]).toEqual({
      source: 'capability:create-user',
      target: 'policy:admin-only',
      type: 'governed_by',
    });
  });

  it('should produce depends_on edges for module dependencies', () => {
    const specs = makeSpecs({
      modules: [
        {
          name: 'billing',
          description: 'Billing module',
          entities: [],
          capabilities: [],
          allowedDependencies: ['auth'],
          forbiddenDependencies: [],
        },
        {
          name: 'auth',
          description: 'Auth module',
          entities: [],
          capabilities: [],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });

    const graph = buildSystemGraph(specs);
    const dependsEdges = graph.edges.filter((e) => e.type === 'depends_on');
    expect(dependsEdges).toHaveLength(1);
    expect(dependsEdges[0]).toEqual({
      source: 'module:billing',
      target: 'module:auth',
      type: 'depends_on',
    });
  });

  it('should produce deterministically ordered nodes and edges', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'Zebra', description: 'Z', fields: [], module: 'zoo' },
        { name: 'Apple', description: 'A', fields: [], module: 'food' },
      ],
      modules: [
        {
          name: 'zoo',
          description: 'Zoo',
          entities: ['Zebra'],
          capabilities: [],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
        {
          name: 'food',
          description: 'Food',
          entities: ['Apple'],
          capabilities: [],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });

    const graph1 = buildSystemGraph(specs);
    const graph2 = buildSystemGraph(specs);

    // Nodes should be sorted by id
    expect(graph1.nodes.map((n) => n.id)).toEqual(graph2.nodes.map((n) => n.id));
    expect(graph1.nodes[0]!.id).toBe('entity:Apple');
    expect(graph1.nodes[1]!.id).toBe('entity:Zebra');

    // Edges should be sorted by source, then target, then type
    expect(graph1.edges.map((e) => `${e.source}->${e.target}`)).toEqual(
      graph2.edges.map((e) => `${e.source}->${e.target}`),
    );
  });

  it('should produce route nodes and exposes edges from route specs', () => {
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
    });

    const routes: RouteSpec[] = [
      {
        method: 'POST',
        path: '/users',
        capability: 'create-user',
        description: 'Create a user',
      },
    ];

    const graph = buildSystemGraph(specs, routes);

    // Route node
    const routeNodes = graph.nodes.filter((n) => n.type === 'route');
    expect(routeNodes).toHaveLength(1);
    expect(routeNodes[0]).toEqual({
      id: 'route:POST:/users',
      type: 'route',
      name: 'POST:/users',
      metadata: {
        method: 'POST',
        path: '/users',
        capability: 'create-user',
        description: 'Create a user',
      },
    });

    // Exposes edge
    const exposesEdges = graph.edges.filter((e) => e.type === 'exposes');
    expect(exposesEdges).toHaveLength(1);
    expect(exposesEdges[0]).toEqual({
      source: 'route:POST:/users',
      target: 'capability:create-user',
      type: 'exposes',
    });
  });
});
