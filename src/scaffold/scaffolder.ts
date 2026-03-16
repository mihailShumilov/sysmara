/**
 * @module scaffold/scaffolder
 * Orchestrates scaffold file generation from system specs.
 * Pure function — no I/O. The CLI layer handles file existence checks and writes.
 */

import type { SystemSpecs } from '../types/index.js';
import {
  generateEntityStub,
  generateCapabilityStub,
  generatePolicyStub,
  generateInvariantStub,
  generateServiceStub,
} from './generators.js';
import {
  generateEntityImpl,
  generateCapabilityImpl,
  generatePolicyImpl,
  generateInvariantImpl,
  generateServiceImpl,
} from './generators-impl.js';

/**
 * A single scaffold file to be written to the app/ directory.
 *
 * @property path - Relative path within appDir (e.g., "entities/user.ts")
 * @property content - The full TypeScript source content
 * @property source - Source identifier (e.g., "entity:user")
 */
export interface ScaffoldFile {
  path: string;
  content: string;
  source: string;
}

/**
 * The result of scaffold generation.
 *
 * @property files - All scaffold files to write
 */
export interface ScaffoldOutput {
  files: ScaffoldFile[];
}

/**
 * Options for scaffold generation.
 *
 * @property implement - When true, generate working implementations instead of TODO stubs.
 */
export interface ScaffoldOptions {
  implement?: boolean;
}

/**
 * Generates starter TypeScript implementation files for all entities, capabilities,
 * policies, invariants, and module services defined in the system specs.
 *
 * @param specs - The parsed system specifications.
 * @param options - Generation options. When `implement` is true, generates real logic.
 * @returns A {@link ScaffoldOutput} containing all files to write.
 */
export function scaffoldSpecs(specs: SystemSpecs, options: ScaffoldOptions = {}): ScaffoldOutput {
  const files: ScaffoldFile[] = [];
  const impl = options.implement ?? false;

  const genEntity = impl ? generateEntityImpl : generateEntityStub;
  const genCapability = impl ? generateCapabilityImpl : generateCapabilityStub;
  const genPolicy = impl ? generatePolicyImpl : generatePolicyStub;
  const genInvariant = impl ? generateInvariantImpl : generateInvariantStub;
  const genService = impl ? generateServiceImpl : generateServiceStub;

  for (const entity of specs.entities) {
    files.push({
      path: `entities/${entity.name}.ts`,
      content: genEntity(entity),
      source: `entity:${entity.name}`,
    });
  }

  for (const capability of specs.capabilities) {
    files.push({
      path: `capabilities/${capability.name}.ts`,
      content: genCapability(capability, specs),
      source: `capability:${capability.name}`,
    });
  }

  for (const policy of specs.policies) {
    files.push({
      path: `policies/${policy.name}.ts`,
      content: genPolicy(policy),
      source: `policy:${policy.name}`,
    });
  }

  for (const invariant of specs.invariants) {
    files.push({
      path: `invariants/${invariant.name}.ts`,
      content: genInvariant(invariant),
      source: `invariant:${invariant.name}`,
    });
  }

  for (const mod of specs.modules) {
    files.push({
      path: `services/${mod.name}.ts`,
      content: genService(mod, specs),
      source: `module:${mod.name}`,
    });
  }

  return { files };
}
