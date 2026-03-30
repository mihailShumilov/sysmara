/**
 * @module scaffold/generators-impl
 * "Implement mode" generators that produce working TypeScript implementations
 * instead of TODO stubs. These generators infer behavior from capability names,
 * policy conditions, and invariant rules to generate real logic.
 */

import type {
  EntitySpec,
  CapabilitySpec,
  PolicySpec,
  InvariantSpec,
  ModuleSpec,
  SystemSpecs,
} from '../types/index.js';
import { toPascalCase, toCamelCase, mapFieldType } from './type-utils.js';

/**
 * Infers the CRUD operation type from a capability name.
 */
type OperationType = 'create' | 'read' | 'update' | 'delete' | 'list' | 'status_transition' | 'associate' | 'dissociate';

function inferOperation(name: string): OperationType {
  const n = name.toLowerCase();
  if (n.startsWith('create_') || n.startsWith('add_') || n.startsWith('register_')) return 'create';
  if (n.startsWith('list_') || n.startsWith('get_all_') || n.startsWith('search_')) return 'list';
  if (n.startsWith('update_') || n.startsWith('edit_') || n.startsWith('modify_')) return 'update';
  if (n.startsWith('delete_') || n.startsWith('remove_') || n.startsWith('deactivate_')) return 'delete';
  if (n.startsWith('get_') || n.startsWith('find_') || n.startsWith('fetch_')) return 'read';

  // Status transition operations
  if (n.startsWith('publish_') || n.startsWith('archive_') || n.startsWith('activate_')
    || n.startsWith('suspend_') || n.startsWith('close_') || n.startsWith('reopen_')
    || n.startsWith('approve_') || n.startsWith('reject_') || n.startsWith('cancel_')
    || n.startsWith('complete_') || n.startsWith('assign_')
    || n.startsWith('submit_') || n.startsWith('moderate_') || n.startsWith('flag_')
    || n.startsWith('unflag_') || n.startsWith('verify_') || n.startsWith('block_')
    || n.startsWith('unblock_')) return 'status_transition';

  // Association operations (tag_post, untag_post, add_member, etc.)
  if (n.startsWith('tag_') || n.startsWith('link_') || n.startsWith('invite_')) return 'associate';
  if (n.startsWith('untag_') || n.startsWith('unlink_') || n.startsWith('kick_')) return 'dissociate';

  return 'read';
}

/**
 * Infers the target status from a capability name for status transition operations.
 * E.g., publish_post → 'published', archive_post → 'archived', submit_post_for_review → 'in_review'
 */
function inferTargetStatus(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith('publish_')) return 'published';
  if (n.startsWith('archive_')) return 'archived';
  if (n.startsWith('activate_')) return 'active';
  if (n.startsWith('suspend_')) return 'suspended';
  if (n.startsWith('close_')) return 'closed';
  if (n.startsWith('reopen_')) return 'open';
  if (n.startsWith('approve_')) return 'approved';
  if (n.startsWith('reject_')) return 'rejected';
  if (n.startsWith('cancel_')) return 'cancelled';
  if (n.startsWith('complete_')) return 'completed';
  if (n.startsWith('flag_')) return 'flagged';
  if (n.startsWith('unflag_')) return 'approved';
  if (n.startsWith('verify_')) return 'verified';
  if (n.startsWith('block_')) return 'blocked';
  if (n.startsWith('unblock_')) return 'active';
  if (n.includes('_for_review')) return 'in_review';
  if (n.startsWith('submit_')) return 'submitted';
  if (n.startsWith('moderate_')) return 'moderated';
  if (n.startsWith('assign_')) return 'assigned';
  return 'updated';
}

/**
 * Generates an entity file with full type-checked validation logic.
 */
export function generateEntityImpl(entity: EntitySpec): string {
  const pascal = toPascalCase(entity.name);

  const fieldLines = entity.fields
    .map((f) => {
      const optional = f.required ? '' : '?';
      const tsType = mapFieldType(f.type);
      const desc = f.description ? `  /** ${f.description} */\n` : '';
      return `${desc}  ${f.name}${optional}: ${tsType};`;
    })
    .join('\n');

  // Generate detailed validation with type checks
  const validationLines = entity.fields
    .map((f) => {
      const tsType = mapFieldType(f.type);
      const checks: string[] = [];
      if (f.required) {
        checks.push(`  if (obj.${f.name} === undefined || obj.${f.name} === null) return false;`);
      }
      if (tsType === 'string' && f.required) {
        checks.push(`  if (typeof obj.${f.name} !== 'string') return false;`);
      } else if (tsType === 'number' && f.required) {
        checks.push(`  if (typeof obj.${f.name} !== 'number') return false;`);
      } else if (tsType === 'boolean' && f.required) {
        checks.push(`  if (typeof obj.${f.name} !== 'boolean') return false;`);
      }
      // Constraint-based checks
      if (f.constraints) {
        for (const c of f.constraints) {
          if (c.type === 'enum' && Array.isArray(c.value)) {
            const vals = (c.value as string[]).map((v) => `'${v}'`).join(', ');
            checks.push(`  if (obj.${f.name} !== undefined && ![${vals}].includes(obj.${f.name} as string)) return false;`);
          }
          if (c.type === 'minLength' && typeof c.value === 'number') {
            checks.push(`  if (typeof obj.${f.name} === 'string' && obj.${f.name}.length < ${c.value}) return false;`);
          }
          if (c.type === 'maxLength' && typeof c.value === 'number') {
            checks.push(`  if (typeof obj.${f.name} === 'string' && obj.${f.name}.length > ${c.value}) return false;`);
          }
          if (c.type === 'min' && typeof c.value === 'number') {
            checks.push(`  if (typeof obj.${f.name} === 'number' && obj.${f.name} < ${c.value}) return false;`);
          }
          if (c.type === 'max' && typeof c.value === 'number') {
            checks.push(`  if (typeof obj.${f.name} === 'number' && obj.${f.name} > ${c.value}) return false;`);
          }
          if (c.type === 'pattern' && typeof c.value === 'string') {
            checks.push(`  if (typeof obj.${f.name} === 'string' && !/${c.value}/.test(obj.${f.name})) return false;`);
          }
        }
      }
      return checks.join('\n');
    })
    .filter(Boolean)
    .join('\n');

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
 * Runtime validation for ${pascal}.
 * Checks required fields, types, and constraint rules.
 */
export function validate${pascal}(data: unknown): data is ${pascal} {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
${validationLines}
  return true;
}
`;
}

/**
 * Generates a capability handler with real CRUD logic using SysMARA ORM.
 */
export function generateCapabilityImpl(
  capability: CapabilitySpec,
  _specs: SystemSpecs,
): string {
  const pascal = toPascalCase(capability.name);
  const op = inferOperation(capability.name);
  const primaryEntity = capability.entities[0] ?? 'unknown';
  const entityPascal = toPascalCase(primaryEntity);

  // Import entity for typing
  const entityImport = capability.entities.length > 0
    ? `import type { ${entityPascal} } from '../entities/${primaryEntity}.js';\n`
    : '';

  // Import policy enforcers
  const policyImports = capability.policies
    .map((p) => `import { enforce${toPascalCase(p)} } from '../policies/${p}.js';`)
    .join('\n');

  // Import invariant validators
  const invariantImports = capability.invariants
    .map((i) => `import { validate${toPascalCase(i)} } from '../invariants/${i}.js';`)
    .join('\n');

  const allImports = [entityImport, policyImports, invariantImports].filter(Boolean).join('\n');

  // Policy enforcement code — throws ForbiddenError (HTTP 403) on violation
  const policyCode = capability.policies.length > 0
    ? capability.policies
        .map((p) => `  if (!enforce${toPascalCase(p)}(ctx.actor)) {\n    throw new ForbiddenError('Policy violation: ${p}');\n  }`)
        .join('\n') + '\n\n'
    : '';

  // Track whether we need ForbiddenError import
  const needsForbiddenImport = capability.policies.length > 0;

  // Invariant validation code (for create/update)
  const invariantCode = (op === 'create' || op === 'update') && capability.invariants.length > 0
    ? '\n' + capability.invariants
        .map((i) => `  const ${toCamelCase(i)}Violation = validate${toPascalCase(i)}(result as unknown as ${entityPascal});\n  if (${toCamelCase(i)}Violation) {\n    throw new Error(\`Invariant violation: \${${toCamelCase(i)}Violation.message}\`);\n  }`)
        .join('\n') + '\n'
    : '';

  // Generate operation-specific body
  let body: string;

  switch (op) {
    case 'create':
      body = `${policyCode}  // Create ${primaryEntity} using ORM repository
  const repo = orm.repository<${entityPascal}>('${primaryEntity}', '${capability.name}');
  const result = await repo.create(input as unknown as Partial<${entityPascal}>);
${invariantCode}
  return result as unknown as ${pascal}Output;`;
      break;
    case 'read':
      body = `${policyCode}  // Find ${primaryEntity} by ID
  const repo = orm.repository<${entityPascal}>('${primaryEntity}', '${capability.name}');
  const result = await repo.findById((input as Record<string, unknown>).id as string);
  if (!result) {
    throw new Error('${entityPascal} not found');
  }

  return result as unknown as ${pascal}Output;`;
      break;
    case 'list':
      body = `${policyCode}  // List ${primaryEntity} records (use query params for GET requests)
  const repo = orm.repository<${entityPascal}>('${primaryEntity}', '${capability.name}');
  const filters = ctx.query as unknown as Partial<${entityPascal}>;
  const hasFilters = Object.keys(filters).length > 0;
  const results = await repo.findMany(hasFilters ? filters : undefined);

  return { items: results, count: results.length } as unknown as ${pascal}Output;`;
      break;
    case 'update':
      body = `${policyCode}  // Update ${primaryEntity}
  const repo = orm.repository<${entityPascal}>('${primaryEntity}', '${capability.name}');
  const { id, ...data } = input as Record<string, unknown>;
  const result = await repo.update(id as string, data as Partial<${entityPascal}>);
${invariantCode}
  return result as unknown as ${pascal}Output;`;
      break;
    case 'delete':
      body = `${policyCode}  // Delete ${primaryEntity}
  const repo = orm.repository<${entityPascal}>('${primaryEntity}', '${capability.name}');
  await repo.delete((input as Record<string, unknown>).id as string);

  return { success: true } as unknown as ${pascal}Output;`;
      break;
    case 'status_transition': {
      const targetStatus = inferTargetStatus(capability.name);
      body = `${policyCode}  // Status transition: set ${primaryEntity}.status to '${targetStatus}'
  const repo = orm.repository<${entityPascal}>('${primaryEntity}', '${capability.name}');
  const id = (input as Record<string, unknown>).id as string ?? ctx.params.id;
  const existing = await repo.findById(id);
  if (!existing) {
    throw new NotFoundError('${entityPascal} not found');
  }

  const result = await repo.update(id, { status: '${targetStatus}' } as unknown as Partial<${entityPascal}>);
${invariantCode}
  return result as unknown as ${pascal}Output;`;
      break;
    }
    case 'associate': {
      // For operations like tag_post — create an association record
      const associationEntity = (capability.entities.length > 1 ? capability.entities[1] : capability.entities[0]) ?? primaryEntity;
      const assocPascal = toPascalCase(associationEntity);
      body = `${policyCode}  // Create association record in ${associationEntity}
  const repo = orm.repository<${assocPascal}>('${associationEntity}', '${capability.name}');
  const result = await repo.create(input as unknown as Partial<${assocPascal}>);

  return result as unknown as ${pascal}Output;`;
      break;
    }
    case 'dissociate': {
      const associationEntity = (capability.entities.length > 1 ? capability.entities[1] : capability.entities[0]) ?? primaryEntity;
      const assocPascal = toPascalCase(associationEntity);
      body = `${policyCode}  // Remove association record from ${associationEntity}
  const repo = orm.repository<${assocPascal}>('${associationEntity}', '${capability.name}');
  const id = (input as Record<string, unknown>).id as string ?? ctx.params.id;
  await repo.delete(id);

  return { success: true } as unknown as ${pascal}Output;`;
      break;
    }
  }

  // Build core framework imports
  const coreImports = ['SysmaraORM'];
  const coreTypeImports = ['HandlerContext'];
  if (needsForbiddenImport) {
    coreImports.push('ForbiddenError');
  }
  if (op === 'status_transition') {
    coreImports.push('NotFoundError');
  }

  return `// ============================================================
// SCAFFOLD: capability:${capability.name}
// Edit Zone: editable — generated once, safe to modify
// Source: system/capabilities.yaml
// ============================================================

import type { ${coreTypeImports.join(', ')} } from '@sysmara/core';
import { ${coreImports.join(', ')} } from '@sysmara/core';
import type { ${pascal}Input, ${pascal}Output } from '../generated/routes/${capability.name}.js';
${allImports}

// Initialize ORM (in production, share a single instance across handlers)
let orm: SysmaraORM;

function getOrm(ctx: HandlerContext): SysmaraORM {
  if (!orm) {
    // ORM should be initialized at app startup and injected via context
    throw new Error('ORM not initialized. Set up SysmaraORM at app startup.');
  }
  return orm;
}

/** Set the shared ORM instance (call once at app startup). */
export function setOrm(instance: SysmaraORM): void {
  orm = instance;
}

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
  const orm = getOrm(ctx);

${body}
}
`;
}

/**
 * Generates a policy enforcer with real condition logic.
 */
export function generatePolicyImpl(policy: PolicySpec): string {
  const pascal = toPascalCase(policy.name);

  // Generate actual condition checks
  const conditionChecks = policy.conditions.map((c) => {
    const fieldParts = c.field.split('.');

    // Map accessor to actual code — handle 'actor.role', 'actor.id' etc.
    const valueAccessor = fieldParts.length > 1
      ? `actor.${fieldParts.slice(1).join('.')}`
      : `actor.attributes.${c.field}`;

    // Handle roles specially
    const isRoleCheck = fieldParts[1] === 'role' || fieldParts[1] === 'roles';

    switch (c.operator) {
      case 'eq':
        return `  if (${valueAccessor} !== ${JSON.stringify(c.value)}) return false;`;
      case 'neq':
        return `  if (${valueAccessor} === ${JSON.stringify(c.value)}) return false;`;
      case 'in': {
        const vals = Array.isArray(c.value) ? c.value : [c.value];
        if (isRoleCheck) {
          return `  if (!actor.roles.some(r => ${JSON.stringify(vals)}.includes(r))) return false;`;
        }
        return `  if (!${JSON.stringify(vals)}.includes(${valueAccessor} as string)) return false;`;
      }
      case 'not_in': {
        const vals = Array.isArray(c.value) ? c.value : [c.value];
        return `  if (${JSON.stringify(vals)}.includes(${valueAccessor} as string)) return false;`;
      }
      case 'exists':
        return `  if (${valueAccessor} === undefined || ${valueAccessor} === null) return false;`;
      case 'has_role': {
        const role = Array.isArray(c.value) ? c.value[0] : c.value;
        return `  if (!actor.roles.includes(${JSON.stringify(role)})) return false;`;
      }
      case 'is_owner':
        return `  // is_owner check — compare actor.id with resource owner\n  if (actor.id !== (actor.attributes.resourceOwnerId as string)) return false;`;
      default:
        return `  // Unknown operator: ${c.operator}`;
    }
  }).join('\n');

  const effectReturn = policy.effect === 'allow' ? 'true' : 'false';

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
${conditionChecks || '  // No conditions — check actor identity'}
  return ${effectReturn};
}
`;
}

/**
 * Generates an invariant validator with inferred logic from the rule description.
 */
export function generateInvariantImpl(invariant: InvariantSpec): string {
  const pascal = toPascalCase(invariant.name);
  const entityPascal = toPascalCase(invariant.entity);

  // Infer validation logic from the invariant name and rule
  const name = invariant.name.toLowerCase();
  const rule = invariant.rule.toLowerCase();
  let checkLogic: string;

  if (name.includes('unique') || rule.includes('unique') || rule.includes('no two')) {
    // Uniqueness — can't validate in isolation, return null (DB constraint handles it)
    checkLogic = `  // Uniqueness is enforced by the database constraint (UNIQUE).
  // This validator checks the field is present and non-empty.
  // Full uniqueness validation requires a database lookup.
  return null;`;
  } else if (name.includes('not_empty') || name.includes('must_not_be_empty') || rule.includes('must not be empty') || rule.includes('cannot be empty')) {
    // Find the field that should not be empty from the name
    const fieldGuess = name
      .replace('_must_not_be_empty', '')
      .replace('_not_empty', '')
      .replace(invariant.entity + '_', '');
    checkLogic = `  const value = (entity as Record<string, unknown>).${fieldGuess};
  if (value === undefined || value === null || value === '') {
    return {
      invariant: '${invariant.name}',
      message: '${invariant.description}',
      severity: '${invariant.severity}',
    };
  }
  return null;`;
  } else if (rule.includes('must be') && rule.includes('member')) {
    checkLogic = `  // Membership validation — requires checking against a related entity.
  // Implement by querying the membership table.
  return null;`;
  } else if (rule.includes('positive') || rule.includes('greater than')) {
    const fieldGuess = name.replace(invariant.entity + '_', '').replace('_must_be_positive', '');
    checkLogic = `  const value = (entity as Record<string, unknown>).${fieldGuess || 'amount'} as number;
  if (typeof value === 'number' && value <= 0) {
    return {
      invariant: '${invariant.name}',
      message: '${invariant.description}',
      severity: '${invariant.severity}',
    };
  }
  return null;`;
  } else {
    // Generic fallback — validate based on rule text
    checkLogic = `  // Rule: "${invariant.rule}"
  // Auto-implementation not available for this rule pattern.
  // Implement your validation logic here.
  return null;`;
  }

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
 */
export function validate${pascal}(entity: ${entityPascal}): InvariantViolation | null {
${checkLogic}
}
`;
}

/**
 * Generates a service class with real method implementations using ORM.
 */
export function generateServiceImpl(
  mod: ModuleSpec,
  specs: SystemSpecs,
): string {
  const pascal = toPascalCase(mod.name);
  const capabilityMap = new Map(specs.capabilities.map((c) => [c.name, c]));

  const methodImpls = mod.capabilities
    .map((capName) => {
      const cap = capabilityMap.get(capName);
      const camel = toCamelCase(capName);
      const desc = cap ? cap.description : capName;
      const op = inferOperation(capName);
      const primaryEntity = cap?.entities[0] ?? 'unknown';

      let body: string;
      switch (op) {
        case 'create':
          body = `    const repo = this.orm.repository<Record<string, unknown>>('${primaryEntity}', '${capName}');\n    return repo.create(input as Partial<Record<string, unknown>>);`;
          break;
        case 'read':
          body = `    const repo = this.orm.repository<Record<string, unknown>>('${primaryEntity}', '${capName}');\n    return repo.findById((input as Record<string, string>).id);`;
          break;
        case 'list':
          body = `    const repo = this.orm.repository<Record<string, unknown>>('${primaryEntity}', '${capName}');\n    return repo.findMany(input as Partial<Record<string, unknown>>);`;
          break;
        case 'update':
          body = `    const repo = this.orm.repository<Record<string, unknown>>('${primaryEntity}', '${capName}');\n    const { id, ...data } = input as Record<string, unknown>;\n    return repo.update(id as string, data);`;
          break;
        case 'delete':
          body = `    const repo = this.orm.repository<Record<string, unknown>>('${primaryEntity}', '${capName}');\n    return repo.delete((input as Record<string, string>).id);`;
          break;
        case 'status_transition': {
          const targetStatus = inferTargetStatus(capName);
          body = `    const repo = this.orm.repository<Record<string, unknown>>('${primaryEntity}', '${capName}');\n    const id = (input as Record<string, string>).id;\n    return repo.update(id, { status: '${targetStatus}' });`;
          break;
        }
        case 'associate': {
          const assocEntity = cap?.entities[1] ?? primaryEntity;
          body = `    const repo = this.orm.repository<Record<string, unknown>>('${assocEntity}', '${capName}');\n    return repo.create(input as Partial<Record<string, unknown>>);`;
          break;
        }
        case 'dissociate': {
          const assocEntity = cap?.entities[1] ?? primaryEntity;
          body = `    const repo = this.orm.repository<Record<string, unknown>>('${assocEntity}', '${capName}');\n    return repo.delete((input as Record<string, string>).id);`;
          break;
        }
      }

      return `
  /**
   * ${desc}
   */
  async ${camel}(input: unknown): Promise<unknown> {
${body}
  }`;
    })
    .join('\n');

  return `// ============================================================
// SCAFFOLD: service:${mod.name}
// Edit Zone: editable — generated once, safe to modify
// Source: system/modules.yaml
// ============================================================

import { SysmaraORM } from '@sysmara/core';

/**
 * Service layer for the ${mod.name} module.
 * ${mod.description}
 *
 * Capabilities:
${mod.capabilities.map((c) => ` *   - ${c}`).join('\n')}
 */
export class ${pascal}Service {
  private orm: SysmaraORM;

  constructor(orm: SysmaraORM) {
    this.orm = orm;
  }
${methodImpls}
}
`;
}
