import type {
  SystemSpecs,
  RouteSpec,
  SystemGraph,
  GraphNode,
  GraphEdge,
} from '../types/index.js';

export function buildSystemGraph(specs: SystemSpecs, routes?: RouteSpec[]): SystemGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // --- Create nodes ---

  for (const entity of specs.entities) {
    nodes.push({
      id: `entity:${entity.name}`,
      type: 'entity',
      name: entity.name,
      metadata: {},
    });
  }

  for (const capability of specs.capabilities) {
    nodes.push({
      id: `capability:${capability.name}`,
      type: 'capability',
      name: capability.name,
      metadata: { module: capability.module },
    });
  }

  for (const mod of specs.modules) {
    nodes.push({
      id: `module:${mod.name}`,
      type: 'module',
      name: mod.name,
      metadata: {},
    });
  }

  for (const policy of specs.policies) {
    nodes.push({
      id: `policy:${policy.name}`,
      type: 'policy',
      name: policy.name,
      metadata: {},
    });
  }

  for (const invariant of specs.invariants) {
    nodes.push({
      id: `invariant:${invariant.name}`,
      type: 'invariant',
      name: invariant.name,
      metadata: { entity: invariant.entity },
    });
  }

  for (const flow of specs.flows) {
    nodes.push({
      id: `flow:${flow.name}`,
      type: 'flow',
      name: flow.name,
      metadata: { module: flow.module, trigger: flow.trigger },
    });
  }

  if (routes) {
    for (const route of routes) {
      const routeId = `${route.method}:${route.path}`;
      nodes.push({
        id: `route:${routeId}`,
        type: 'route',
        name: routeId,
        metadata: {
          method: route.method,
          path: route.path,
          capability: route.capability,
          ...(route.description ? { description: route.description } : {}),
        },
      });
    }
  }

  // --- Create edges ---

  // entity belongs_to its module
  for (const mod of specs.modules) {
    for (const entityName of mod.entities) {
      edges.push({
        source: `entity:${entityName}`,
        target: `module:${mod.name}`,
        type: 'belongs_to',
      });
    }
  }

  // capability uses_entity for each entity it references
  for (const capability of specs.capabilities) {
    for (const entityName of capability.entities) {
      edges.push({
        source: `capability:${capability.name}`,
        target: `entity:${entityName}`,
        type: 'uses_entity',
      });
    }
  }

  // capability governed_by each policy that lists it
  for (const policy of specs.policies) {
    for (const capName of policy.capabilities) {
      edges.push({
        source: `capability:${capName}`,
        target: `policy:${policy.name}`,
        type: 'governed_by',
      });
    }
  }

  // invariant enforces its entity
  for (const invariant of specs.invariants) {
    edges.push({
      source: `invariant:${invariant.name}`,
      target: `entity:${invariant.entity}`,
      type: 'enforces',
    });
  }

  // invariant protects capabilities that reference the invariant
  for (const invariant of specs.invariants) {
    for (const capability of specs.capabilities) {
      if (capability.invariants.includes(invariant.name)) {
        edges.push({
          source: `invariant:${invariant.name}`,
          target: `capability:${capability.name}`,
          type: 'protects',
        });
      }
    }
  }

  // module depends_on its allowedDependencies
  for (const mod of specs.modules) {
    for (const dep of mod.allowedDependencies) {
      edges.push({
        source: `module:${mod.name}`,
        target: `module:${dep}`,
        type: 'depends_on',
      });
    }
  }

  // capability triggers flow (where flow.trigger matches capability name)
  for (const flow of specs.flows) {
    edges.push({
      source: `capability:${flow.trigger}`,
      target: `flow:${flow.name}`,
      type: 'triggers',
    });
  }

  // route exposes capability
  if (routes) {
    for (const route of routes) {
      const routeId = `${route.method}:${route.path}`;
      edges.push({
        source: `route:${routeId}`,
        target: `capability:${route.capability}`,
        type: 'exposes',
      });
    }
  }

  // flow steps: action capability step_of flow
  for (const flow of specs.flows) {
    for (const step of flow.steps) {
      edges.push({
        source: `capability:${step.action}`,
        target: `flow:${flow.name}`,
        type: 'step_of',
      });
    }
  }

  // --- Deterministic ordering ---
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => {
    const srcCmp = a.source.localeCompare(b.source);
    if (srcCmp !== 0) return srcCmp;
    const tgtCmp = a.target.localeCompare(b.target);
    if (tgtCmp !== 0) return tgtCmp;
    return a.type.localeCompare(b.type);
  });

  return {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  };
}
