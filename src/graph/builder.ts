/**
 * @module graph/builder
 *
 * Builds a directed system dependency graph from parsed specifications.
 * The graph represents all spec elements as nodes and their relationships as typed edges.
 */

import type {
  SystemSpecs,
  RouteSpec,
  SystemGraph,
  GraphNode,
  GraphEdge,
} from '../types/index.js';

/**
 * Builds a directed system dependency graph from parsed specifications and optional route definitions.
 *
 * Creates nodes for every entity, capability, module, policy, invariant, flow, route,
 * and generated file. Creates typed edges representing relationships such as:
 * - `belongs_to`: entity -> module
 * - `uses_entity`: capability -> entity
 * - `governed_by`: capability -> policy
 * - `enforces`: invariant -> entity
 * - `protects`: invariant -> capability
 * - `depends_on`: module -> module
 * - `triggers`: capability -> flow
 * - `exposes`: route -> capability
 * - `step_of`: capability -> flow
 * - `owns`: module -> file
 *
 * Nodes and edges are sorted deterministically by ID for stable output.
 *
 * @param specs - The parsed and validated system specifications
 * @param routes - Optional array of HTTP route definitions to include in the graph
 * @returns A {@link SystemGraph} with version "0.1.0" containing all nodes and edges
 *
 * @example
 * ```ts
 * const graph = buildSystemGraph(specs, routes);
 * console.log(`Graph has ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
 * ```
 */
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

  // Build a map from capability name to its owning module
  const capToModule = new Map<string, string>();
  for (const cap of specs.capabilities) {
    capToModule.set(cap.name, cap.module);
  }

  // Generated file nodes for each capability (route handler, test scaffold, metadata)
  for (const capability of specs.capabilities) {
    const filePaths = [
      `app/generated/routes/${capability.name}.ts`,
      `app/generated/tests/${capability.name}.test.ts`,
      `app/generated/metadata/${capability.name}.json`,
    ];
    for (const filePath of filePaths) {
      nodes.push({
        id: `file:${filePath}`,
        type: 'file',
        name: filePath,
        metadata: { capability: capability.name, module: capability.module },
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

  // module owns generated files (via capability's module assignment)
  for (const capability of specs.capabilities) {
    const moduleName = capability.module;
    const filePaths = [
      `app/generated/routes/${capability.name}.ts`,
      `app/generated/tests/${capability.name}.test.ts`,
      `app/generated/metadata/${capability.name}.json`,
    ];
    for (const filePath of filePaths) {
      edges.push({
        source: `module:${moduleName}`,
        target: `file:${filePath}`,
        type: 'owns',
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
