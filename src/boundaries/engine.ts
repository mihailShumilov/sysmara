/**
 * @module boundaries/engine
 *
 * Boundary validation engine for Sysmara module specifications. Provides
 * functions to check module dependency rules, detect cross-boundary
 * capability-entity violations, and find circular dependency cycles
 * in the module dependency graph.
 */

import type {
  ModuleSpec,
  CapabilitySpec,
  EntitySpec,
  Diagnostic,
} from '../types/index.js';

/**
 * Validates module-level boundary rules and returns diagnostics for any violations.
 *
 * Checks performed:
 * - **MOD_CONFLICTING_DEP** (error): A module lists the same dependency in both `allowedDependencies` and `forbiddenDependencies`.
 * - **MOD_SELF_DEP** (warning): A module lists itself in `allowedDependencies`.
 * - **MOD_SELF_FORBIDDEN** (warning): A module lists itself in `forbiddenDependencies`.
 * - **MOD_UNDEFINED_DEP** (error): A module references a dependency that does not exist in the provided modules list.
 * - **MOD_UNDEFINED_FORBIDDEN_DEP** (warning): A module forbids a dependency that does not exist in the provided modules list.
 *
 * @param modules - The array of module specifications to validate.
 * @returns An array of {@link Diagnostic} objects describing any boundary violations found.
 *
 * @example
 * ```ts
 * const diagnostics = validateModuleBoundaries(specs.modules);
 * const errors = diagnostics.filter(d => d.severity === 'error');
 * ```
 */
export function validateModuleBoundaries(modules: ModuleSpec[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const moduleNames = new Set(modules.map((m) => m.name));

  for (const mod of modules) {
    // Check forbidden deps aren't in allowed deps
    for (const dep of mod.forbiddenDependencies) {
      if (mod.allowedDependencies.includes(dep)) {
        diagnostics.push({
          code: 'MOD_CONFLICTING_DEP',
          severity: 'error',
          message: `Module "${mod.name}" lists "${dep}" in both allowedDependencies and forbiddenDependencies`,
          source: `module:${mod.name}`,
          path: `modules.${mod.name}.dependencies`,
          suggestion: `Remove "${dep}" from either allowedDependencies or forbiddenDependencies in module "${mod.name}"`,
        });
      }
    }

    // Check self-referencing deps
    if (mod.allowedDependencies.includes(mod.name)) {
      diagnostics.push({
        code: 'MOD_SELF_DEP',
        severity: 'warning',
        message: `Module "${mod.name}" lists itself as an allowed dependency`,
        source: `module:${mod.name}`,
        path: `modules.${mod.name}.allowedDependencies`,
        suggestion: `Remove self-reference from allowedDependencies in module "${mod.name}"`,
      });
    }

    if (mod.forbiddenDependencies.includes(mod.name)) {
      diagnostics.push({
        code: 'MOD_SELF_FORBIDDEN',
        severity: 'warning',
        message: `Module "${mod.name}" lists itself as a forbidden dependency`,
        source: `module:${mod.name}`,
        path: `modules.${mod.name}.forbiddenDependencies`,
        suggestion: `Remove self-reference from forbiddenDependencies in module "${mod.name}"`,
      });
    }

    // Check referenced deps exist
    for (const dep of mod.allowedDependencies) {
      if (dep !== mod.name && !moduleNames.has(dep)) {
        diagnostics.push({
          code: 'MOD_UNDEFINED_DEP',
          severity: 'error',
          message: `Module "${mod.name}" references undefined dependency "${dep}"`,
          source: `module:${mod.name}`,
          path: `modules.${mod.name}.allowedDependencies`,
          suggestion: `Define module "${dep}" or remove it from allowedDependencies in module "${mod.name}"`,
        });
      }
    }

    for (const dep of mod.forbiddenDependencies) {
      if (dep !== mod.name && !moduleNames.has(dep)) {
        diagnostics.push({
          code: 'MOD_UNDEFINED_FORBIDDEN_DEP',
          severity: 'warning',
          message: `Module "${mod.name}" forbids undefined dependency "${dep}"`,
          source: `module:${mod.name}`,
          path: `modules.${mod.name}.forbiddenDependencies`,
          suggestion: `Define module "${dep}" or remove it from forbiddenDependencies in module "${mod.name}"`,
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Validates that capabilities only reference entities within their module boundary
 * (i.e., the capability's own module or its allowed dependencies).
 *
 * Checks performed:
 * - **CAP_BOUNDARY_UNDEFINED_MODULE** (error): A capability belongs to a module that is not defined.
 * - **CAP_BOUNDARY_VIOLATION** (error): A capability references an entity from a module that is not in its owning module's allowed dependencies.
 *
 * @param capabilities - The array of capability specifications to validate.
 * @param modules - The array of module specifications defining boundaries and allowed dependencies.
 * @param entities - The array of entity specifications used to resolve entity-to-module mappings.
 * @returns An array of {@link Diagnostic} objects describing any boundary violations found.
 *
 * @example
 * ```ts
 * const diagnostics = validateCapabilityBoundaries(
 *   specs.capabilities,
 *   specs.modules,
 *   specs.entities,
 * );
 * ```
 */
export function validateCapabilityBoundaries(
  capabilities: CapabilitySpec[],
  modules: ModuleSpec[],
  entities: EntitySpec[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const moduleMap = new Map<string, ModuleSpec>();

  for (const mod of modules) {
    moduleMap.set(mod.name, mod);
  }

  const entityModuleMap = new Map<string, string>();
  for (const entity of entities) {
    entityModuleMap.set(entity.name, entity.module);
  }

  for (const cap of capabilities) {
    const capModule = moduleMap.get(cap.module);
    if (!capModule) {
      diagnostics.push({
        code: 'CAP_BOUNDARY_UNDEFINED_MODULE',
        severity: 'error',
        message: `Capability "${cap.name}" belongs to undefined module "${cap.module}"`,
        source: `capability:${cap.name}`,
        path: `capabilities.${cap.name}.module`,
        suggestion: `Define module "${cap.module}" or reassign capability "${cap.name}" to an existing module`,
      });
      continue;
    }

    const allowedModules = new Set<string>([
      cap.module,
      ...capModule.allowedDependencies,
    ]);

    for (const entityRef of cap.entities) {
      const entityModule = entityModuleMap.get(entityRef);
      if (entityModule !== undefined && !allowedModules.has(entityModule)) {
        diagnostics.push({
          code: 'CAP_BOUNDARY_VIOLATION',
          severity: 'error',
          message: `Capability "${cap.name}" (module "${cap.module}") references entity "${entityRef}" from module "${entityModule}", which is not in allowed dependencies`,
          source: `capability:${cap.name}`,
          path: `capabilities.${cap.name}.entities`,
          suggestion: `Add "${entityModule}" to allowedDependencies of module "${cap.module}", or move entity "${entityRef}"`,
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Detects circular dependencies in the module dependency graph using depth-first search.
 *
 * Builds a directed graph from each module's `allowedDependencies` (excluding self-references
 * and references to undefined modules) and performs DFS cycle detection. Each detected cycle
 * is returned as an array of module names forming the cycle path, with the first element
 * repeated at the end (e.g., `["A", "B", "C", "A"]`).
 *
 * @param modules - The array of module specifications whose dependency graph to analyze.
 * @returns An array of cycles, where each cycle is an array of module name strings.
 *
 * @example
 * ```ts
 * const cycles = detectModuleCycles(specs.modules);
 * if (cycles.length > 0) {
 *   console.error('Circular dependencies found:', cycles);
 * }
 * ```
 */
export function detectModuleCycles(modules: ModuleSpec[]): string[][] {
  const cycles: string[][] = [];
  const moduleNames = new Set(modules.map((m) => m.name));
  const adjacency = new Map<string, string[]>();

  for (const mod of modules) {
    adjacency.set(
      mod.name,
      mod.allowedDependencies.filter((d) => moduleNames.has(d) && d !== mod.name),
    );
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const neighbors = adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        const cycleStart = stack.indexOf(neighbor);
        const cycle = [...stack.slice(cycleStart), neighbor];
        cycles.push(cycle);
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const mod of modules) {
    if (!visited.has(mod.name)) {
      dfs(mod.name);
    }
  }

  return cycles;
}
