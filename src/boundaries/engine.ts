import type {
  ModuleSpec,
  CapabilitySpec,
  EntitySpec,
  Diagnostic,
} from '../types/index.js';

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
