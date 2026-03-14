import type { Diagnostic, SystemSpecs } from '../types/index.js';

/**
 * Cross-validate a fully parsed SystemSpecs, checking referential integrity,
 * uniqueness constraints, cycle detection, and orphan detection.
 */
export function crossValidate(specs: SystemSpecs): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const entityNames = new Set(specs.entities.map((e) => e.name));
  const capabilityNames = new Set(specs.capabilities.map((c) => c.name));
  const policyNames = new Set(specs.policies.map((p) => p.name));
  const invariantNames = new Set(specs.invariants.map((i) => i.name));
  const moduleNames = new Set(specs.modules.map((m) => m.name));

  // ── Uniqueness checks ──

  checkUniqueness(specs.entities.map((e) => e.name), 'Entity', diagnostics);
  checkUniqueness(specs.capabilities.map((c) => c.name), 'Capability', diagnostics);
  checkUniqueness(specs.policies.map((p) => p.name), 'Policy', diagnostics);
  checkUniqueness(specs.invariants.map((i) => i.name), 'Invariant', diagnostics);
  checkUniqueness(specs.modules.map((m) => m.name), 'Module', diagnostics);
  checkUniqueness(specs.flows.map((f) => f.name), 'Flow', diagnostics);

  // ── Entity reference checks in capabilities ──

  for (const cap of specs.capabilities) {
    for (const entityRef of cap.entities) {
      if (!entityNames.has(entityRef)) {
        diagnostics.push({
          code: 'UNRESOLVED_ENTITY_REF',
          severity: 'error',
          message: `Capability "${cap.name}" references undefined entity "${entityRef}"`,
          source: `capability:${cap.name}`,
          path: 'entities',
          suggestion: `Define entity "${entityRef}" or fix the reference`,
        });
      }
    }

    // Check invariant references in capabilities
    for (const invRef of cap.invariants) {
      if (!invariantNames.has(invRef)) {
        diagnostics.push({
          code: 'UNRESOLVED_INVARIANT_REF',
          severity: 'error',
          message: `Capability "${cap.name}" references undefined invariant "${invRef}"`,
          source: `capability:${cap.name}`,
          path: 'invariants',
          suggestion: `Define invariant "${invRef}" or fix the reference`,
        });
      }
    }

    // Check policy references in capabilities
    for (const polRef of cap.policies) {
      if (!policyNames.has(polRef)) {
        diagnostics.push({
          code: 'UNRESOLVED_POLICY_REF',
          severity: 'error',
          message: `Capability "${cap.name}" references undefined policy "${polRef}"`,
          source: `capability:${cap.name}`,
          path: 'policies',
          suggestion: `Define policy "${polRef}" or fix the reference`,
        });
      }
    }

    // Check module reference in capabilities
    if (!moduleNames.has(cap.module)) {
      diagnostics.push({
        code: 'UNRESOLVED_MODULE_REF',
        severity: 'error',
        message: `Capability "${cap.name}" references undefined module "${cap.module}"`,
        source: `capability:${cap.name}`,
        path: 'module',
        suggestion: `Define module "${cap.module}" or fix the reference`,
      });
    }
  }

  // ── Capability reference checks in policies ──

  for (const pol of specs.policies) {
    for (const capRef of pol.capabilities) {
      if (!capabilityNames.has(capRef)) {
        diagnostics.push({
          code: 'UNRESOLVED_CAPABILITY_REF',
          severity: 'error',
          message: `Policy "${pol.name}" references undefined capability "${capRef}"`,
          source: `policy:${pol.name}`,
          path: 'capabilities',
          suggestion: `Define capability "${capRef}" or fix the reference`,
        });
      }
    }
  }

  // ── Entity reference checks in invariants ──

  for (const inv of specs.invariants) {
    if (!entityNames.has(inv.entity)) {
      diagnostics.push({
        code: 'UNRESOLVED_ENTITY_REF',
        severity: 'error',
        message: `Invariant "${inv.name}" references undefined entity "${inv.entity}"`,
        source: `invariant:${inv.name}`,
        path: 'entity',
        suggestion: `Define entity "${inv.entity}" or fix the reference`,
      });
    }
  }

  // ── Module reference checks ──

  for (const mod of specs.modules) {
    // Check entity references
    for (const entityRef of mod.entities) {
      if (!entityNames.has(entityRef)) {
        diagnostics.push({
          code: 'UNRESOLVED_ENTITY_REF',
          severity: 'error',
          message: `Module "${mod.name}" references undefined entity "${entityRef}"`,
          source: `module:${mod.name}`,
          path: 'entities',
          suggestion: `Define entity "${entityRef}" or fix the reference`,
        });
      }
    }

    // Check capability references
    for (const capRef of mod.capabilities) {
      if (!capabilityNames.has(capRef)) {
        diagnostics.push({
          code: 'UNRESOLVED_CAPABILITY_REF',
          severity: 'error',
          message: `Module "${mod.name}" references undefined capability "${capRef}"`,
          source: `module:${mod.name}`,
          path: 'capabilities',
          suggestion: `Define capability "${capRef}" or fix the reference`,
        });
      }
    }

    // Check allowed dependency references
    for (const depRef of mod.allowedDependencies) {
      if (!moduleNames.has(depRef)) {
        diagnostics.push({
          code: 'UNRESOLVED_MODULE_REF',
          severity: 'error',
          message: `Module "${mod.name}" lists undefined module "${depRef}" in allowedDependencies`,
          source: `module:${mod.name}`,
          path: 'allowedDependencies',
          suggestion: `Define module "${depRef}" or remove the dependency`,
        });
      }
    }

    // Check forbidden dependency references
    for (const depRef of mod.forbiddenDependencies) {
      if (!moduleNames.has(depRef)) {
        diagnostics.push({
          code: 'UNRESOLVED_MODULE_REF',
          severity: 'warning',
          message: `Module "${mod.name}" lists undefined module "${depRef}" in forbiddenDependencies`,
          source: `module:${mod.name}`,
          path: 'forbiddenDependencies',
          suggestion: `Define module "${depRef}" or remove the forbidden dependency`,
        });
      }
    }

    // Check forbidden dependencies aren't violated
    for (const forbidden of mod.forbiddenDependencies) {
      if (mod.allowedDependencies.includes(forbidden)) {
        diagnostics.push({
          code: 'FORBIDDEN_DEPENDENCY_VIOLATION',
          severity: 'error',
          message: `Module "${mod.name}" has "${forbidden}" in both allowedDependencies and forbiddenDependencies`,
          source: `module:${mod.name}`,
          path: 'forbiddenDependencies',
          suggestion: `Remove "${forbidden}" from either allowedDependencies or forbiddenDependencies`,
        });
      }
    }
  }

  // ── Entity module reference checks ──

  for (const entity of specs.entities) {
    if (!moduleNames.has(entity.module)) {
      diagnostics.push({
        code: 'UNRESOLVED_MODULE_REF',
        severity: 'error',
        message: `Entity "${entity.name}" references undefined module "${entity.module}"`,
        source: `entity:${entity.name}`,
        path: 'module',
        suggestion: `Define module "${entity.module}" or fix the reference`,
      });
    }

    // Check entity-level invariant references
    if (entity.invariants) {
      for (const invRef of entity.invariants) {
        if (!invariantNames.has(invRef)) {
          diagnostics.push({
            code: 'UNRESOLVED_INVARIANT_REF',
            severity: 'error',
            message: `Entity "${entity.name}" references undefined invariant "${invRef}"`,
            source: `entity:${entity.name}`,
            path: 'invariants',
            suggestion: `Define invariant "${invRef}" or fix the reference`,
          });
        }
      }
    }
  }

  // ── Flow reference checks ──

  for (const flow of specs.flows) {
    // Check trigger capability
    if (!capabilityNames.has(flow.trigger)) {
      diagnostics.push({
        code: 'UNRESOLVED_CAPABILITY_REF',
        severity: 'error',
        message: `Flow "${flow.name}" trigger references undefined capability "${flow.trigger}"`,
        source: `flow:${flow.name}`,
        path: 'trigger',
        suggestion: `Define capability "${flow.trigger}" or fix the trigger reference`,
      });
    }

    // Check module reference
    if (!moduleNames.has(flow.module)) {
      diagnostics.push({
        code: 'UNRESOLVED_MODULE_REF',
        severity: 'error',
        message: `Flow "${flow.name}" references undefined module "${flow.module}"`,
        source: `flow:${flow.name}`,
        path: 'module',
        suggestion: `Define module "${flow.module}" or fix the reference`,
      });
    }

    // Check step actions (they can reference capabilities)
    for (const step of flow.steps) {
      if (capabilityNames.size > 0 && !capabilityNames.has(step.action)) {
        // Side-effects are allowed as actions, so only warn
        diagnostics.push({
          code: 'UNRESOLVED_STEP_ACTION',
          severity: 'warning',
          message: `Flow "${flow.name}" step "${step.name}" action "${step.action}" is not a known capability (may be a side-effect)`,
          source: `flow:${flow.name}`,
          path: `steps.${step.name}.action`,
        });
      }

      // Check compensation references
      if (step.compensation && !capabilityNames.has(step.compensation)) {
        diagnostics.push({
          code: 'UNRESOLVED_COMPENSATION_REF',
          severity: 'warning',
          message: `Flow "${flow.name}" step "${step.name}" compensation "${step.compensation}" is not a known capability`,
          source: `flow:${flow.name}`,
          path: `steps.${step.name}.compensation`,
        });
      }
    }
  }

  // ── Orphan detection ──

  const entitiesInModules = new Set(specs.modules.flatMap((m) => m.entities));
  for (const entity of specs.entities) {
    if (!entitiesInModules.has(entity.name)) {
      diagnostics.push({
        code: 'ORPHAN_ENTITY',
        severity: 'warning',
        message: `Entity "${entity.name}" is not listed in any module's entities`,
        source: `entity:${entity.name}`,
        suggestion: `Add "${entity.name}" to a module's entities list`,
      });
    }
  }

  const capabilitiesInModules = new Set(specs.modules.flatMap((m) => m.capabilities));
  for (const cap of specs.capabilities) {
    if (!capabilitiesInModules.has(cap.name)) {
      diagnostics.push({
        code: 'ORPHAN_CAPABILITY',
        severity: 'warning',
        message: `Capability "${cap.name}" is not listed in any module's capabilities`,
        source: `capability:${cap.name}`,
        suggestion: `Add "${cap.name}" to a module's capabilities list`,
      });
    }
  }

  // ── Module dependency cycle detection ──

  const cycleErrors = detectModuleCycles(specs.modules);
  diagnostics.push(...cycleErrors);

  return diagnostics;
}

/**
 * Check that all names in a list are unique.
 */
function checkUniqueness(
  names: string[],
  kind: string,
  diagnostics: Diagnostic[],
): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      diagnostics.push({
        code: 'DUPLICATE_NAME',
        severity: 'error',
        message: `Duplicate ${kind.toLowerCase()} name: "${name}"`,
        source: `${kind.toLowerCase()}:${name}`,
        suggestion: `Rename one of the duplicate ${kind.toLowerCase()}s`,
      });
    }
    seen.add(name);
  }
}

/**
 * Detect cycles in module dependency graph using DFS.
 */
function detectModuleCycles(
  modules: SystemSpecs['modules'],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const adjacency = new Map<string, string[]>();

  for (const mod of modules) {
    adjacency.set(mod.name, mod.allowedDependencies);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      diagnostics.push({
        code: 'MODULE_DEPENDENCY_CYCLE',
        severity: 'error',
        message: `Module dependency cycle detected: ${cycle.join(' -> ')}`,
        source: `module:${node}`,
        path: 'allowedDependencies',
        suggestion: 'Break the cycle by removing one of the dependencies',
      });
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    inStack.add(node);

    const deps = adjacency.get(node) ?? [];
    for (const dep of deps) {
      if (adjacency.has(dep)) {
        dfs(dep, [...path, node]);
      }
    }

    inStack.delete(node);
    return false;
  }

  for (const mod of modules) {
    if (!visited.has(mod.name)) {
      dfs(mod.name, []);
    }
  }

  return diagnostics;
}
