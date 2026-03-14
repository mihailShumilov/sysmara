/**
 * @module capability-compiler
 *
 * Compiles capability specifications into generated TypeScript route handlers,
 * test scaffolds, and JSON metadata files. Produces a manifest tracking all
 * generated artifacts along with diagnostics for unresolved references.
 */

import { createHash } from 'node:crypto';
import type {
  SystemSpecs,
  CapabilitySpec,
  CapabilityField,
  EditZone,
  GeneratedManifest,
  GeneratedFileEntry,
  Diagnostic,
} from '../types/index.js';

/**
 * The result returned by {@link compileCapabilities}.
 *
 * @property files - Array of generated file descriptors (route handlers, tests, metadata).
 * @property manifest - A manifest recording every generated file with its checksum and edit zone.
 * @property diagnostics - Any errors or warnings discovered during compilation (e.g., undefined entity references).
 */
export interface CompilerOutput {
  files: GeneratedFile[];
  manifest: GeneratedManifest;
  diagnostics: Diagnostic[];
}

/**
 * Represents a single file produced by the capability compiler.
 *
 * @property path - The output file path relative to the output directory.
 * @property content - The full text content of the generated file.
 * @property source - A source identifier in the form `capability:<name>` indicating which capability produced this file.
 * @property zone - The edit zone designation: `"generated"` (do not edit) or `"editable"` (scaffold, safe to modify).
 */
export interface GeneratedFile {
  path: string;
  content: string;
  source: string;
  zone: EditZone;
}

/**
 * Converts a hyphen- or underscore-delimited string to PascalCase.
 *
 * @param str - The input string (e.g., `"create-order"` or `"create_order"`).
 * @returns The PascalCase version of the string (e.g., `"CreateOrder"`).
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Maps a specification-level type name to its TypeScript equivalent.
 *
 * Handles common aliases such as `"integer"`, `"float"`, `"decimal"` (all map to
 * `number`), `"bool"` (maps to `boolean`), and temporal types like `"date"`,
 * `"datetime"`, `"timestamp"` (all map to `Date`). Array types (`"string[]"`,
 * `"number[]"`, `"boolean[]"`) and object types (`"object"`, `"json"`) are also
 * supported. Unrecognized types fall back to `"unknown"`.
 *
 * @param specType - The type string from the capability specification (case-insensitive).
 * @returns The corresponding TypeScript type as a string.
 */
function mapFieldType(specType: string): string {
  switch (specType.toLowerCase()) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
    case 'float':
    case 'decimal':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'Date';
    case 'string[]':
      return 'string[]';
    case 'number[]':
      return 'number[]';
    case 'boolean[]':
      return 'boolean[]';
    case 'object':
    case 'json':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

/**
 * Computes the SHA-256 hex digest of the given string content.
 *
 * @param content - The UTF-8 string to hash.
 * @returns The lowercase hexadecimal SHA-256 hash.
 */
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Generates TypeScript interface field declarations from an array of capability fields.
 *
 * Each field is rendered as a typed property line, marked optional (`?`) when
 * `field.required` is false. If a field has a description, a JSDoc comment line
 * is prepended above the property.
 *
 * @param fields - The capability field definitions to render.
 * @param indent - The whitespace string to prepend to each line for indentation.
 * @returns A newline-joined string of TypeScript interface property declarations.
 */
function generateFieldLines(fields: CapabilityField[], indent: string): string {
  return fields
    .map((f) => {
      const optional = f.required ? '' : '?';
      const tsType = mapFieldType(f.type);
      const desc = f.description ? `${indent}/** ${f.description} */\n` : '';
      return `${desc}${indent}${f.name}${optional}: ${tsType};`;
    })
    .join('\n');
}

/**
 * Generates a TypeScript route handler source file for a single capability.
 *
 * The output includes a file header (marked as `generated` edit zone), an async
 * `handle` function stub that throws `"Not implemented"`, and exported
 * `Input`/`Output` interfaces derived from the capability's field definitions.
 *
 * @param capability - The capability specification to generate a handler for.
 * @returns The full TypeScript source code of the route handler file.
 */
function generateRouteHandler(capability: CapabilitySpec): string {
  const pascalName = toPascalCase(capability.name);
  const policiesJoined = capability.policies.join(', ');
  const invariantsJoined = capability.invariants.join(', ');
  const inputFields = generateFieldLines(capability.input, '  ');
  const outputFields = generateFieldLines(capability.output, '  ');

  return `// ============================================================
// GENERATED BY SYSMARA CAPABILITY COMPILER
// Source: capability:${capability.name}
// Edit Zone: generated
// DO NOT EDIT — this file will be regenerated
// ============================================================

import type { HandlerContext } from '@sysmara/core';

/**
 * ${capability.description}
 * Module: ${capability.module}
 * Policies: ${policiesJoined}
 * Invariants: ${invariantsJoined}
 */
export async function handle(ctx: HandlerContext): Promise<${pascalName}Output> {
  // TODO: Implement ${capability.name}
  throw new Error('Not implemented: ${capability.name}');
}

// Input/Output types
export interface ${pascalName}Input {
${inputFields}
}

export interface ${pascalName}Output {
${outputFields}
}
`;
}

/**
 * Generates a Vitest test scaffold source file for a single capability.
 *
 * The scaffold includes a basic `"should be defined"` test plus one placeholder
 * test case for each policy and each invariant referenced by the capability.
 * The file is marked as an `editable` edit zone, meaning users are expected to
 * fill in real assertions.
 *
 * @param capability - The capability specification to generate tests for.
 * @param _specs - The full system specifications (currently unused, reserved for future resolution).
 * @returns The full TypeScript source code of the test scaffold file.
 */
function generateTestScaffold(
  capability: CapabilitySpec,
  _specs: SystemSpecs,
): string {
  const policyTests = capability.policies
    .map((policyName) => {
      return `
  it('should enforce policy: ${policyName}', () => {
    // Policy enforcement test
    expect(true).toBe(true); // Replace with real test
  });`;
    })
    .join('\n');

  const invariantTests = capability.invariants
    .map((invariantName) => {
      return `
  it('should maintain invariant: ${invariantName}', () => {
    // Invariant validation test
    expect(true).toBe(true); // Replace with real test
  });`;
    })
    .join('\n');

  return `// ============================================================
// GENERATED BY SYSMARA CAPABILITY COMPILER
// Source: capability:${capability.name}
// Edit Zone: editable
// This file was generated as a scaffold — you may edit it
// ============================================================

import { describe, it, expect } from 'vitest';

describe('${capability.name}', () => {
  it('should be defined', () => {
    // Capability: ${capability.description}
    // Module: ${capability.module}
    expect(true).toBe(true); // Replace with real test
  });
${policyTests}
${invariantTests}
});
`;
}

/**
 * The JSON-serializable metadata structure for a compiled capability.
 *
 * Contains the capability's resolved entities, policies, and invariants along
 * with its input/output field definitions, side effects, and idempotency flag.
 * This is written to a `.json` metadata file during compilation.
 */
interface CapabilityMetadata {
  name: string;
  description: string;
  module: string;
  entities: ResolvedEntity[];
  input: CapabilityField[];
  output: CapabilityField[];
  policies: ResolvedPolicy[];
  invariants: ResolvedInvariant[];
  sideEffects: string[];
  idempotent: boolean;
}

/**
 * An entity reference that has been resolved against the system specification.
 *
 * @property name - The entity's unique name.
 * @property description - A human-readable description of the entity.
 * @property module - The module that owns this entity.
 */
interface ResolvedEntity {
  name: string;
  description: string;
  module: string;
}

/**
 * A policy reference that has been resolved against the system specification.
 *
 * @property name - The policy's unique name.
 * @property description - A human-readable description of the policy.
 * @property effect - Whether the policy allows or denies the action.
 */
interface ResolvedPolicy {
  name: string;
  description: string;
  effect: 'allow' | 'deny';
}

/**
 * An invariant reference that has been resolved against the system specification.
 *
 * @property name - The invariant's unique name.
 * @property description - A human-readable description of the invariant.
 * @property entity - The entity this invariant applies to.
 * @property severity - Whether a violation is an `"error"` or a `"warning"`.
 * @property enforcement - When the invariant is enforced: `"runtime"`, `"compile"`, or `"both"`.
 */
interface ResolvedInvariant {
  name: string;
  description: string;
  entity: string;
  severity: 'error' | 'warning';
  enforcement: 'runtime' | 'compile' | 'both';
}

/**
 * Generates a JSON metadata file for a single capability.
 *
 * Resolves the capability's entity, policy, and invariant references against
 * the system specifications, building a {@link CapabilityMetadata} object that
 * is serialized to a pretty-printed JSON string. References that do not exist
 * in the specs are silently filtered out (diagnostics are handled separately
 * by {@link collectDiagnostics}).
 *
 * @param capability - The capability specification to generate metadata for.
 * @param specs - The full system specifications used to resolve references.
 * @returns A pretty-printed JSON string representing the capability metadata.
 */
function generateMetadata(
  capability: CapabilitySpec,
  specs: SystemSpecs,
): string {
  const entityMap = new Map(specs.entities.map((e) => [e.name, e]));
  const policyMap = new Map(specs.policies.map((p) => [p.name, p]));
  const invariantMap = new Map(specs.invariants.map((i) => [i.name, i]));

  const resolvedEntities: ResolvedEntity[] = capability.entities
    .filter((eName) => entityMap.has(eName))
    .map((eName) => {
      const e = entityMap.get(eName)!;
      return { name: e.name, description: e.description, module: e.module };
    });

  const resolvedPolicies: ResolvedPolicy[] = capability.policies
    .filter((pName) => policyMap.has(pName))
    .map((pName) => {
      const p = policyMap.get(pName)!;
      return { name: p.name, description: p.description, effect: p.effect };
    });

  const resolvedInvariants: ResolvedInvariant[] = capability.invariants
    .filter((iName) => invariantMap.has(iName))
    .map((iName) => {
      const inv = invariantMap.get(iName)!;
      return {
        name: inv.name,
        description: inv.description,
        entity: inv.entity,
        severity: inv.severity,
        enforcement: inv.enforcement,
      };
    });

  const metadata: CapabilityMetadata = {
    name: capability.name,
    description: capability.description,
    module: capability.module,
    entities: resolvedEntities,
    input: capability.input,
    output: capability.output,
    policies: resolvedPolicies,
    invariants: resolvedInvariants,
    sideEffects: capability.sideEffects ?? [],
    idempotent: capability.idempotent ?? false,
  };

  return JSON.stringify(metadata, null, 2) + '\n';
}

/**
 * Validates all capability references and collects diagnostics for unresolved ones.
 *
 * Iterates over every capability in the system specs and checks that each
 * referenced entity, policy, and invariant name corresponds to a definition
 * in the specs. Produces an error-level {@link Diagnostic} (with codes
 * `CAP_UNDEFINED_ENTITY`, `CAP_UNDEFINED_POLICY`, or `CAP_UNDEFINED_INVARIANT`)
 * for each missing reference, including a suggested fix.
 *
 * @param specs - The full system specifications to validate.
 * @returns An array of diagnostics describing any unresolved references.
 */
function collectDiagnostics(specs: SystemSpecs): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const entityNames = new Set(specs.entities.map((e) => e.name));
  const policyNames = new Set(specs.policies.map((p) => p.name));
  const invariantNames = new Set(specs.invariants.map((i) => i.name));

  for (const cap of specs.capabilities) {
    for (const entityRef of cap.entities) {
      if (!entityNames.has(entityRef)) {
        diagnostics.push({
          code: 'CAP_UNDEFINED_ENTITY',
          severity: 'error',
          message: `Capability "${cap.name}" references undefined entity "${entityRef}"`,
          source: `capability:${cap.name}`,
          path: `capabilities.${cap.name}.entities`,
          suggestion: `Define entity "${entityRef}" or remove it from capability "${cap.name}"`,
        });
      }
    }

    for (const policyRef of cap.policies) {
      if (!policyNames.has(policyRef)) {
        diagnostics.push({
          code: 'CAP_UNDEFINED_POLICY',
          severity: 'error',
          message: `Capability "${cap.name}" references undefined policy "${policyRef}"`,
          source: `capability:${cap.name}`,
          path: `capabilities.${cap.name}.policies`,
          suggestion: `Define policy "${policyRef}" or remove it from capability "${cap.name}"`,
        });
      }
    }

    for (const invariantRef of cap.invariants) {
      if (!invariantNames.has(invariantRef)) {
        diagnostics.push({
          code: 'CAP_UNDEFINED_INVARIANT',
          severity: 'error',
          message: `Capability "${cap.name}" references undefined invariant "${invariantRef}"`,
          source: `capability:${cap.name}`,
          path: `capabilities.${cap.name}.invariants`,
          suggestion: `Define invariant "${invariantRef}" or remove it from capability "${cap.name}"`,
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Compiles all capabilities defined in the system specs into generated artifacts.
 *
 * For each capability, three files are produced:
 * 1. A TypeScript route handler stub (`routes/<name>.ts`) with input/output interfaces (zone: `generated`).
 * 2. A Vitest test scaffold (`tests/<name>.test.ts`) with placeholder tests for policies and invariants (zone: `editable`).
 * 3. A JSON metadata file (`metadata/<name>.json`) containing resolved entities, policies, and invariants (zone: `generated`).
 *
 * The function also validates that all entity, policy, and invariant references within
 * capabilities resolve to definitions present in the specs, emitting diagnostics for any
 * that are missing.
 *
 * @param specs - The full system specification containing capabilities, entities, policies, invariants, etc.
 * @param outputDir - The base directory path under which generated files will be placed.
 * @returns A {@link CompilerOutput} containing the generated files, a manifest, and any diagnostics.
 *
 * @example
 * ```ts
 * const output = compileCapabilities(specs, './generated');
 * for (const file of output.files) {
 *   await fs.writeFile(file.path, file.content);
 * }
 * ```
 */
export function compileCapabilities(
  specs: SystemSpecs,
  outputDir: string,
): CompilerOutput {
  const files: GeneratedFile[] = [];
  const diagnostics = collectDiagnostics(specs);

  for (const capability of specs.capabilities) {
    // 1. Route handler stub
    const routeContent = generateRouteHandler(capability);
    const routePath = `${outputDir}/routes/${capability.name}.ts`;
    files.push({
      path: routePath,
      content: routeContent,
      source: `capability:${capability.name}`,
      zone: 'generated',
    });

    // 2. Test scaffold
    const testContent = generateTestScaffold(capability, specs);
    const testPath = `${outputDir}/tests/${capability.name}.test.ts`;
    files.push({
      path: testPath,
      content: testContent,
      source: `capability:${capability.name}`,
      zone: 'editable',
    });

    // 3. Capability metadata
    const metadataContent = generateMetadata(capability, specs);
    const metadataPath = `${outputDir}/metadata/${capability.name}.json`;
    files.push({
      path: metadataPath,
      content: metadataContent,
      source: `capability:${capability.name}`,
      zone: 'generated',
    });
  }

  const manifestEntries: GeneratedFileEntry[] = files.map((f) => ({
    path: f.path,
    source: f.source,
    zone: f.zone,
    checksum: sha256(f.content),
    regenerable: f.zone === 'generated',
  }));

  const manifest: GeneratedManifest = {
    generatedAt: new Date().toISOString(),
    files: manifestEntries,
  };

  return { files, manifest, diagnostics };
}
