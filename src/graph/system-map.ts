import type {
  SystemSpecs,
  RouteSpec,
  SystemMap,
  SystemMapModule,
  SystemMapCapability,
} from '../types/index.js';

export function buildSystemMap(specs: SystemSpecs, routes?: RouteSpec[]): SystemMap {
  const definedEntities = new Set(specs.entities.map((e) => e.name));
  const definedCapabilities = new Set(specs.capabilities.map((c) => c.name));
  const definedPolicies = new Set(specs.policies.map((p) => p.name));
  const definedInvariants = new Set(specs.invariants.map((i) => i.name));
  const definedModules = new Set(specs.modules.map((m) => m.name));
  const unresolved = new Set<string>();

  // Build route lookup: capability name -> route descriptions
  const routesByCapability = new Map<string, string[]>();
  if (routes) {
    for (const route of routes) {
      if (!definedCapabilities.has(route.capability)) {
        unresolved.add(`capability:${route.capability}`);
      }
      const key = route.capability;
      const existing = routesByCapability.get(key);
      const routeStr = `${route.method} ${route.path}`;
      if (existing) {
        existing.push(routeStr);
      } else {
        routesByCapability.set(key, [routeStr]);
      }
    }
  }

  // Build modules
  const modules: SystemMapModule[] = specs.modules.map((mod) => {
    for (const entityName of mod.entities) {
      if (!definedEntities.has(entityName)) {
        unresolved.add(`entity:${entityName}`);
      }
    }
    for (const capName of mod.capabilities) {
      if (!definedCapabilities.has(capName)) {
        unresolved.add(`capability:${capName}`);
      }
    }
    for (const dep of mod.allowedDependencies) {
      if (!definedModules.has(dep)) {
        unresolved.add(`module:${dep}`);
      }
    }

    return {
      name: mod.name,
      entities: [...mod.entities].sort(),
      capabilities: [...mod.capabilities].sort(),
      dependencies: [...mod.allowedDependencies].sort(),
    };
  });

  // Build capabilities
  const capabilities: SystemMapCapability[] = specs.capabilities.map((cap) => {
    for (const entityName of cap.entities) {
      if (!definedEntities.has(entityName)) {
        unresolved.add(`entity:${entityName}`);
      }
    }
    for (const policyName of cap.policies) {
      if (!definedPolicies.has(policyName)) {
        unresolved.add(`policy:${policyName}`);
      }
    }
    for (const invName of cap.invariants) {
      if (!definedInvariants.has(invName)) {
        unresolved.add(`invariant:${invName}`);
      }
    }
    if (!definedModules.has(cap.module)) {
      unresolved.add(`module:${cap.module}`);
    }

    const capRoutes = routesByCapability.get(cap.name) ?? [];

    return {
      name: cap.name,
      module: cap.module,
      entities: [...cap.entities].sort(),
      policies: [...cap.policies].sort(),
      invariants: [...cap.invariants].sort(),
      routes: [...capRoutes].sort(),
    };
  });

  // Check flow references
  for (const flow of specs.flows) {
    if (!definedCapabilities.has(flow.trigger)) {
      unresolved.add(`capability:${flow.trigger}`);
    }
    if (!definedModules.has(flow.module)) {
      unresolved.add(`module:${flow.module}`);
    }
    for (const step of flow.steps) {
      if (!definedCapabilities.has(step.action)) {
        unresolved.add(`capability:${step.action}`);
      }
    }
  }

  // Check policy references
  for (const policy of specs.policies) {
    for (const capName of policy.capabilities) {
      if (!definedCapabilities.has(capName)) {
        unresolved.add(`capability:${capName}`);
      }
    }
  }

  // Check invariant references
  for (const invariant of specs.invariants) {
    if (!definedEntities.has(invariant.entity)) {
      unresolved.add(`entity:${invariant.entity}`);
    }
  }

  // Deterministic ordering
  modules.sort((a, b) => a.name.localeCompare(b.name));
  capabilities.sort((a, b) => a.name.localeCompare(b.name));

  const entityNames = specs.entities.map((e) => e.name).sort();
  const unresolvedSorted = [...unresolved].sort();

  return {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    modules,
    capabilities,
    entities: entityNames,
    unresolved: unresolvedSorted,
  };
}
