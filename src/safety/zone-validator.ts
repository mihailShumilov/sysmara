/**
 * @module safety/zone-validator
 *
 * Validates safe edit zones and module boundary constraints. Ensures that generated
 * files match their declared edit zone permissions, and that module dependencies
 * do not violate boundary rules (forbidden dependencies, cross-module entity access,
 * circular dependencies).
 */

import type {
  SafeEditZoneSpec,
  EditZone,
  GeneratedManifest,
  ModuleSpec,
  SystemSpecs,
  Diagnostic,
} from '../types/index.js';

/**
 * Represents a single edit zone violation found during validation.
 *
 * @property path - The file path where the violation was detected.
 * @property expectedZone - The expected edit zone for the file (`'editable'`, `'protected'`, etc.).
 * @property violation - A human-readable description of the zone mismatch or issue.
 */
export interface ZoneViolation {
  path: string;
  expectedZone: EditZone;
  violation: string;
}

/**
 * Validates that generated files conform to their declared safe edit zone permissions.
 *
 * Performs three checks:
 * 1. Zone declarations match manifest entries (zone type consistency).
 * 2. Protected files are not marked as editable in the manifest.
 * 3. All manifest entries have corresponding zone declarations.
 *
 * @param safeEditZones - The declared safe edit zone specifications for known file paths.
 * @param manifest - The generated file manifest to validate against zone declarations.
 * @returns An array of {@link ZoneViolation} objects describing any mismatches found.
 *   Returns an empty array if all zones are consistent.
 *
 * @example
 * ```ts
 * const violations = validateEditZones(specs.safeEditZones, generatedManifest);
 * if (violations.length > 0) {
 *   console.warn('Zone violations found:', violations);
 * }
 * ```
 */
export function validateEditZones(
  safeEditZones: SafeEditZoneSpec[],
  manifest: GeneratedManifest,
): ZoneViolation[] {
  const violations: ZoneViolation[] = [];
  const zoneMap = new Map<string, SafeEditZoneSpec>();

  for (const zone of safeEditZones) {
    zoneMap.set(zone.path, zone);
  }

  // Check that generated files match their declared zones
  for (const entry of manifest.files) {
    const zoneDecl = zoneMap.get(entry.path);

    if (zoneDecl) {
      // File has a zone declaration — check it matches
      if (zoneDecl.zone !== entry.zone) {
        violations.push({
          path: entry.path,
          expectedZone: zoneDecl.zone,
          violation: `Manifest declares zone "${entry.zone}" but safe edit zone declares "${zoneDecl.zone}"`,
        });
      }

      // Protected files must not be marked as editable
      if (zoneDecl.zone === 'protected' && entry.zone === 'editable') {
        violations.push({
          path: entry.path,
          expectedZone: 'protected',
          violation: `Protected file "${entry.path}" is marked as editable in manifest`,
        });
      }
    }
  }

  // Check that manifest entries have corresponding zone declarations
  for (const entry of manifest.files) {
    if (!zoneMap.has(entry.path)) {
      violations.push({
        path: entry.path,
        expectedZone: entry.zone,
        violation: `Generated file "${entry.path}" has no corresponding safe edit zone declaration`,
      });
    }
  }

  // Check no protected files appear as editable in zone declarations
  for (const zone of safeEditZones) {
    if (zone.zone === 'protected') {
      const manifestEntry = manifest.files.find((f) => f.path === zone.path);
      if (manifestEntry && manifestEntry.zone === 'editable') {
        violations.push({
          path: zone.path,
          expectedZone: 'protected',
          violation: `Protected path "${zone.path}" appears as editable in generated manifest`,
        });
      }
    }
  }

  return violations;
}

/**
 * Checks for module boundary violations in the system specification.
 *
 * Performs three categories of checks:
 * 1. **Forbidden dependency conflicts** (`BOUNDARY_FORBIDDEN_DEP`): A module lists the same
 *    dependency in both `allowedDependencies` and `forbiddenDependencies`.
 * 2. **Cross-module entity access** (`BOUNDARY_CROSS_MODULE_ENTITY`): A capability references
 *    an entity from a module that is not in the owning module's allowed dependencies.
 *    Also reports `BOUNDARY_UNDEFINED_MODULE` if a capability's module does not exist.
 * 3. **Circular dependencies** (`BOUNDARY_CIRCULAR_DEP`): Detects cycles in the module
 *    dependency graph using DFS.
 *
 * @param modules - The list of module specifications defining dependency rules.
 * @param specs - The full system specifications containing entities and capabilities.
 * @returns An array of {@link Diagnostic} objects describing any boundary violations found.
 *   Returns an empty array if no violations are detected.
 *
 * @example
 * ```ts
 * const diagnostics = checkBoundaryViolations(specs.modules, specs);
 * for (const d of diagnostics) {
 *   console.error(`[${d.code}] ${d.message}`);
 * }
 * ```
 */
export function checkBoundaryViolations(
  modules: ModuleSpec[],
  specs: SystemSpecs,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const moduleMap = new Map<string, ModuleSpec>();

  for (const mod of modules) {
    moduleMap.set(mod.name, mod);
  }

  // Check modules don't depend on forbidden dependencies
  for (const mod of modules) {
    for (const dep of mod.allowedDependencies) {
      if (mod.forbiddenDependencies.includes(dep)) {
        diagnostics.push({
          code: 'BOUNDARY_FORBIDDEN_DEP',
          severity: 'error',
          message: `Module "${mod.name}" has "${dep}" in both allowed and forbidden dependencies`,
          source: `module:${mod.name}`,
          path: `modules.${mod.name}.dependencies`,
          suggestion: `Remove "${dep}" from either allowedDependencies or forbiddenDependencies`,
        });
      }
    }
  }

  // Check capabilities only reference entities within their module or allowed dependency modules
  const entityModuleMap = new Map<string, string>();
  for (const entity of specs.entities) {
    entityModuleMap.set(entity.name, entity.module);
  }

  for (const cap of specs.capabilities) {
    const capModule = moduleMap.get(cap.module);
    if (!capModule) {
      diagnostics.push({
        code: 'BOUNDARY_UNDEFINED_MODULE',
        severity: 'error',
        message: `Capability "${cap.name}" references undefined module "${cap.module}"`,
        source: `capability:${cap.name}`,
        path: `capabilities.${cap.name}.module`,
        suggestion: `Define module "${cap.module}" or assign capability to an existing module`,
      });
      continue;
    }

    const allowedModules = new Set<string>([
      cap.module,
      ...capModule.allowedDependencies,
    ]);

    for (const entityRef of cap.entities) {
      const entityModule = entityModuleMap.get(entityRef);
      if (entityModule && !allowedModules.has(entityModule)) {
        diagnostics.push({
          code: 'BOUNDARY_CROSS_MODULE_ENTITY',
          severity: 'error',
          message: `Capability "${cap.name}" in module "${cap.module}" references entity "${entityRef}" from module "${entityModule}" which is not an allowed dependency`,
          source: `capability:${cap.name}`,
          path: `capabilities.${cap.name}.entities`,
          suggestion: `Add "${entityModule}" to module "${cap.module}" allowedDependencies, or move the entity`,
        });
      }
    }
  }

  // Detect circular module dependencies
  const cycles = detectCycles(modules);
  for (const cycle of cycles) {
    diagnostics.push({
      code: 'BOUNDARY_CIRCULAR_DEP',
      severity: 'error',
      message: `Circular module dependency detected: ${cycle.join(' -> ')}`,
      source: `module:${cycle[0]}`,
      path: `modules.${cycle[0]}.allowedDependencies`,
      suggestion: `Break the circular dependency between modules: ${cycle.join(', ')}`,
    });
  }

  return diagnostics;
}

/**
 * Detects circular dependencies in the module dependency graph using
 * depth-first search with an explicit recursion stack.
 *
 * Builds a directed adjacency list from each module's `allowedDependencies`
 * (filtering to only defined module names) and walks the graph, recording
 * any back-edges that indicate cycles.
 *
 * @param modules - The list of module specifications to analyze.
 * @returns An array of cycles, where each cycle is an ordered array of
 *   module names ending with a repetition of the cycle's starting node
 *   (e.g., `['A', 'B', 'C', 'A']`).
 */
function detectCycles(modules: ModuleSpec[]): string[][] {
  const cycles: string[][] = [];
  const moduleNames = new Set(modules.map((m) => m.name));
  const adjacency = new Map<string, string[]>();

  for (const mod of modules) {
    adjacency.set(
      mod.name,
      mod.allowedDependencies.filter((d) => moduleNames.has(d)),
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
        // Found a cycle
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
