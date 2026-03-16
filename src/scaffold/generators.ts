/**
 * @module scaffold/generators
 * Pure string-generation functions that produce starter TypeScript implementation
 * files from parsed YAML specs. No I/O — each function returns a file content string.
 */

import type {
  EntitySpec,
  CapabilitySpec,
  PolicySpec,
  InvariantSpec,
  ModuleSpec,
  SystemSpecs,
} from '../types/index.js';
import { toPascalCase, toCamelCase, renderFieldLines } from './type-utils.js';

/**
 * Generates a starter TypeScript entity file with an interface, type alias,
 * and a runtime validation helper.
 */
export function generateEntityStub(entity: EntitySpec): string {
  const pascal = toPascalCase(entity.name);
  const fieldLines = renderFieldLines(entity.fields);

  return `// ============================================================
// SCAFFOLD: entity:${entity.name}
// Edit Zone: editable — generated once, safe to modify
// Source: system/entities.yaml
// ============================================================

/**
 * ${entity.description}
 * Module: ${entity.module}
 */
export interface ${pascal} {
${fieldLines}
}

/**
 * Runtime validation helper.
 * TODO: Implement field-level validation logic.
 */
export function validate${pascal}(data: unknown): data is ${pascal} {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
${entity.fields
  .filter((f) => f.required)
  .map((f) => `  if (obj.${f.name} === undefined) return false;`)
  .join('\n')}
  return true;
}
`;
}

/**
 * Generates a starter TypeScript capability handler file with typed input/output
 * imports from the generated routes and TODO comments for each policy and invariant.
 */
export function generateCapabilityStub(
  capability: CapabilitySpec,
  _specs: SystemSpecs,
): string {
  const pascal = toPascalCase(capability.name);

  const policyChecks = capability.policies.length > 0
    ? capability.policies
        .map((p) => `  // TODO: Enforce policy: ${p}`)
        .join('\n') + '\n'
    : '';

  const invariantChecks = capability.invariants.length > 0
    ? capability.invariants
        .map((i) => `  // TODO: Validate invariant: ${i}`)
        .join('\n') + '\n'
    : '';

  const entityRefs = capability.entities.length > 0
    ? capability.entities
        .map((e) => `  // TODO: Load entity: ${e}`)
        .join('\n') + '\n'
    : '';

  return `// ============================================================
// SCAFFOLD: capability:${capability.name}
// Edit Zone: editable — generated once, safe to modify
// Source: system/capabilities.yaml
// ============================================================

import type { HandlerContext } from '@sysmara/core';
import type { ${pascal}Input, ${pascal}Output } from '../generated/routes/${capability.name}.js';

/**
 * ${capability.description}
 *
 * Module: ${capability.module}
 * Entities: ${capability.entities.join(', ') || 'none'}
 * Policies: ${capability.policies.join(', ') || 'none'}
 * Invariants: ${capability.invariants.join(', ') || 'none'}
 */
export async function handle${pascal}(ctx: HandlerContext): Promise<${pascal}Output> {
  const input = ctx.body as ${pascal}Input;

${policyChecks}${entityRefs}  // TODO: Implement business logic

${invariantChecks}  void input; // remove when implemented
  throw new Error('Not implemented: ${capability.name}');
}
`;
}

/**
 * Generates a starter TypeScript policy enforcement file with a typed
 * enforce function and TODO comments for each condition.
 */
export function generatePolicyStub(policy: PolicySpec): string {
  const pascal = toPascalCase(policy.name);

  const conditionComments = policy.conditions.length > 0
    ? policy.conditions
        .map((c) => {
          const val = Array.isArray(c.value) ? `[${c.value.join(', ')}]` : c.value;
          return `  // Condition: ${c.field} ${c.operator} ${val}`;
        })
        .join('\n') + '\n'
    : '';

  return `// ============================================================
// SCAFFOLD: policy:${policy.name}
// Edit Zone: editable — generated once, safe to modify
// Source: system/policies.yaml
// ============================================================

import type { ActorContext } from '@sysmara/core';

/**
 * ${policy.description}
 *
 * Actor: ${policy.actor}
 * Effect: ${policy.effect}
 * Capabilities: ${policy.capabilities.join(', ')}
 */
export function enforce${pascal}(actor: ActorContext): boolean {
${conditionComments}  // TODO: Implement policy logic

  void actor; // remove when implemented
  return false; // default deny — change after implementing
}
`;
}

/**
 * Generates a starter TypeScript invariant validation file with a typed
 * validate function and the rule description as a TODO.
 */
export function generateInvariantStub(invariant: InvariantSpec): string {
  const pascal = toPascalCase(invariant.name);
  const entityPascal = toPascalCase(invariant.entity);

  return `// ============================================================
// SCAFFOLD: invariant:${invariant.name}
// Edit Zone: editable — generated once, safe to modify
// Source: system/invariants.yaml
// ============================================================

import type { ${entityPascal} } from '../entities/${invariant.entity}.js';

/**
 * ${invariant.description}
 *
 * Entity: ${invariant.entity}
 * Rule: ${invariant.rule}
 * Severity: ${invariant.severity}
 * Enforcement: ${invariant.enforcement}
 */
export interface InvariantViolation {
  invariant: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validates the ${invariant.name} invariant.
 * Returns null if valid, or a violation describing the breach.
 *
 * TODO: Implement rule: "${invariant.rule}"
 */
export function validate${pascal}(entity: ${entityPascal}): InvariantViolation | null {
  // TODO: Implement invariant check

  void entity; // remove when implemented
  return null; // assume valid until implemented
}
`;
}

/**
 * Generates a starter TypeScript service file for a module with one
 * method stub per capability the module owns.
 */
export function generateServiceStub(
  mod: ModuleSpec,
  specs: SystemSpecs,
): string {
  const pascal = toPascalCase(mod.name);
  const capabilityMap = new Map(specs.capabilities.map((c) => [c.name, c]));

  const methodStubs = mod.capabilities
    .map((capName) => {
      const cap = capabilityMap.get(capName);
      const camel = toCamelCase(capName);
      const desc = cap ? cap.description : capName;
      return `
  /**
   * ${desc}
   * TODO: Implement ${capName}
   */
  async ${camel}(input: unknown): Promise<unknown> {
    void input; // remove when implemented
    throw new Error('Not implemented: ${capName}');
  }`;
    })
    .join('\n');

  return `// ============================================================
// SCAFFOLD: service:${mod.name}
// Edit Zone: editable — generated once, safe to modify
// Source: system/modules.yaml
// ============================================================

/**
 * Service layer for the ${mod.name} module.
 * ${mod.description}
 *
 * Capabilities:
${mod.capabilities.map((c) => ` *   - ${c}`).join('\n')}
 *
 * TODO: Inject dependencies (repositories, adapters) via constructor.
 */
export class ${pascal}Service {
  constructor() {
    // TODO: inject repository, logger, external adapters
  }
${methodStubs}
}
`;
}
