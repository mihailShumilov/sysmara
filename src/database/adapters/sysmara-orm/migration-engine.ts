/**
 * @module database/adapters/sysmara-orm/migration-engine
 * Impact-aware migration engine for SysMARA ORM.
 * Diffs two versions of SystemSpecs and produces migration plans with
 * risk analysis, affected capability tracking, and SQL generation.
 *
 * Unlike traditional migration tools, the SysMARA migration engine
 * understands the system graph — it knows which capabilities, invariants,
 * and policies are affected by every schema change.
 */

import type { SystemSpecs, EntitySpec, EntityField, ImpactSurface } from '../../../types/index.js';
import type { DatabaseProvider } from '../../adapter.js';

/**
 * A single step in a migration plan.
 *
 * @property action - The migration operation to perform
 * @property entity - The entity name affected
 * @property field - The field name affected (for column-level operations)
 * @property details - Human-readable description of the change
 * @property sql - The SQL statement for this step
 */
export interface MigrationStep {
  action:
    | 'create_table'
    | 'drop_table'
    | 'add_column'
    | 'drop_column'
    | 'alter_column'
    | 'rename_table'
    | 'rename_column';
  entity: string;
  field?: string;
  details: string;
  sql: string;
}

/**
 * A complete migration plan produced by diffing two SystemSpecs versions.
 *
 * @property steps - Ordered list of migration steps
 * @property affectedCapabilities - Capabilities that use affected entities
 * @property affectedInvariants - Invariants on affected entities
 * @property riskLevel - Computed risk level based on the nature of changes
 * @property requiresReview - Whether this migration needs human review before applying
 */
export interface MigrationPlan {
  steps: MigrationStep[];
  affectedCapabilities: string[];
  affectedInvariants: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresReview: boolean;
}

/**
 * Computes the risk level for a migration plan based on the nature of changes.
 *
 * @param steps - The migration steps to assess
 * @returns The computed risk level
 */
function computeRiskLevel(steps: MigrationStep[]): MigrationPlan['riskLevel'] {
  const hasDropTable = steps.some((s) => s.action === 'drop_table');
  const hasDropColumn = steps.some((s) => s.action === 'drop_column');
  const hasAlterColumn = steps.some((s) => s.action === 'alter_column');
  const hasAddColumn = steps.some((s) => s.action === 'add_column');
  const hasCreateTable = steps.some((s) => s.action === 'create_table');

  if (hasDropTable) return 'critical';
  if (hasDropColumn) return 'high';
  if (hasAlterColumn) return 'medium';
  if (hasAddColumn || hasCreateTable) return 'low';
  return 'low';
}

/**
 * Finds all capabilities that reference any of the given entity names.
 *
 * @param specs - The system specs to search
 * @param entityNames - The entity names to match
 * @returns Capability names that reference the entities
 */
function findAffectedCapabilities(specs: SystemSpecs, entityNames: Set<string>): string[] {
  return specs.capabilities
    .filter((cap) => cap.entities.some((e) => entityNames.has(e)))
    .map((cap) => cap.name)
    .sort();
}

/**
 * Finds all invariants that apply to any of the given entity names.
 *
 * @param specs - The system specs to search
 * @param entityNames - The entity names to match
 * @returns Invariant names that apply to the entities
 */
function findAffectedInvariants(specs: SystemSpecs, entityNames: Set<string>): string[] {
  return specs.invariants
    .filter((inv) => entityNames.has(inv.entity))
    .map((inv) => inv.name)
    .sort();
}

/**
 * Builds an entity lookup map keyed by entity name.
 *
 * @param specs - The system specs containing entities
 * @returns A Map of entity name to EntitySpec
 */
function buildEntityMap(specs: SystemSpecs): Map<string, EntitySpec> {
  const map = new Map<string, EntitySpec>();
  for (const entity of specs.entities) {
    map.set(entity.name, entity);
  }
  return map;
}

/**
 * Builds a field lookup map keyed by field name for a given entity.
 *
 * @param entity - The entity to build the field map for
 * @returns A Map of field name to EntityField
 */
function buildFieldMap(entity: EntitySpec): Map<string, EntityField> {
  const map = new Map<string, EntityField>();
  for (const field of entity.fields) {
    map.set(field.name, field);
  }
  return map;
}

/**
 * Impact-aware migration engine for SysMARA ORM.
 * Produces migration plans by diffing SystemSpecs versions,
 * tracks affected capabilities and invariants, and generates SQL.
 */
export class MigrationEngine {
  /**
   * Creates a new MigrationEngine.
   *
   * @param provider - The target database provider for SQL generation
   */
  constructor(private provider: DatabaseProvider) {}

  /**
   * Diffs two versions of SystemSpecs and produces a migration plan.
   * Detects added, removed, and modified entities and their fields.
   *
   * @param prev - The previous system specifications
   * @param next - The updated system specifications
   * @returns A migration plan with steps, affected capabilities, and risk analysis
   */
  diff(prev: SystemSpecs, next: SystemSpecs): MigrationPlan {
    const prevEntities = buildEntityMap(prev);
    const nextEntities = buildEntityMap(next);
    const steps: MigrationStep[] = [];
    const affectedEntityNames = new Set<string>();

    // Detect new entities (present in next but not prev)
    for (const [name, entity] of nextEntities) {
      if (!prevEntities.has(name)) {
        affectedEntityNames.add(name);
        const columns = entity.fields
          .map((f) => `"${f.name}" /* ${f.type}${f.required ? ', NOT NULL' : ''} */`)
          .join(', ');
        steps.push({
          action: 'create_table',
          entity: name,
          details: `Create new table "${name}" with fields: ${entity.fields.map((f) => f.name).join(', ')}`,
          sql: `-- CREATE TABLE "${name}" (${columns}); -- See full schema for complete DDL`,
        });
      }
    }

    // Detect removed entities (present in prev but not next)
    for (const [name] of prevEntities) {
      if (!nextEntities.has(name)) {
        affectedEntityNames.add(name);
        steps.push({
          action: 'drop_table',
          entity: name,
          details: `Drop table "${name}" — entity removed from specs`,
          sql: `DROP TABLE IF EXISTS "${name}" CASCADE;`,
        });
      }
    }

    // Detect modified entities (present in both, fields changed)
    for (const [name, nextEntity] of nextEntities) {
      const prevEntity = prevEntities.get(name);
      if (!prevEntity) continue;

      const prevFields = buildFieldMap(prevEntity);
      const nextFields = buildFieldMap(nextEntity);

      // New fields
      for (const [fieldName, field] of nextFields) {
        if (!prevFields.has(fieldName)) {
          affectedEntityNames.add(name);
          const nullable = field.required ? ' NOT NULL' : '';
          steps.push({
            action: 'add_column',
            entity: name,
            field: fieldName,
            details: `Add column "${fieldName}" (${field.type}${nullable}) to "${name}"`,
            sql: `ALTER TABLE "${name}" ADD COLUMN "${fieldName}" /* ${field.type} */${nullable};`,
          });
        }
      }

      // Removed fields
      for (const [fieldName] of prevFields) {
        if (!nextFields.has(fieldName)) {
          affectedEntityNames.add(name);
          steps.push({
            action: 'drop_column',
            entity: name,
            field: fieldName,
            details: `Drop column "${fieldName}" from "${name}"`,
            sql: `ALTER TABLE "${name}" DROP COLUMN "${fieldName}";`,
          });
        }
      }

      // Altered fields (type or required changed)
      for (const [fieldName, nextField] of nextFields) {
        const prevField = prevFields.get(fieldName);
        if (!prevField) continue;

        const typeChanged = prevField.type !== nextField.type;
        const requiredChanged = prevField.required !== nextField.required;

        if (typeChanged || requiredChanged) {
          affectedEntityNames.add(name);
          const changes: string[] = [];
          if (typeChanged) changes.push(`type: ${prevField.type} → ${nextField.type}`);
          if (requiredChanged) changes.push(`required: ${prevField.required} → ${nextField.required}`);

          steps.push({
            action: 'alter_column',
            entity: name,
            field: fieldName,
            details: `Alter column "${fieldName}" on "${name}": ${changes.join(', ')}`,
            sql: `-- ALTER TABLE "${name}" ALTER COLUMN "${fieldName}" — ${changes.join(', ')};`,
          });
        }
      }
    }

    const riskLevel = computeRiskLevel(steps);

    return {
      steps,
      affectedCapabilities: findAffectedCapabilities(next, affectedEntityNames),
      affectedInvariants: findAffectedInvariants(next, affectedEntityNames),
      riskLevel,
      requiresReview: riskLevel === 'high' || riskLevel === 'critical',
    };
  }

  /**
   * Generates a complete SQL migration script from a migration plan.
   *
   * @param plan - The migration plan to generate SQL for
   * @returns The SQL migration script as a string
   */
  generateSQL(plan: MigrationPlan): string {
    const header = [
      '-- ============================================================',
      '-- SYSMARA ORM MIGRATION',
      `-- Provider: ${this.provider}`,
      `-- Generated at: ${new Date().toISOString()}`,
      `-- Risk level: ${plan.riskLevel}`,
      `-- Requires review: ${plan.requiresReview}`,
      `-- Steps: ${plan.steps.length}`,
      `-- Affected capabilities: ${plan.affectedCapabilities.join(', ') || 'none'}`,
      `-- Affected invariants: ${plan.affectedInvariants.join(', ') || 'none'}`,
      '-- ============================================================',
      '',
      'BEGIN;',
      '',
    ];

    const body = plan.steps.map((step, i) => {
      return [
        `-- Step ${i + 1}: ${step.details}`,
        step.sql,
        '',
      ].join('\n');
    });

    const footer = ['COMMIT;', ''];

    return [...header, ...body, ...footer].join('\n');
  }

  /**
   * Analyzes the impact of a migration plan on the system.
   * Returns an ImpactSurface describing all affected capabilities,
   * invariants, modules, policies, and generated artifacts.
   *
   * @param plan - The migration plan to analyze
   * @param specs - The system specs to resolve references against
   * @returns An ImpactSurface describing the blast radius
   */
  analyzeImpact(plan: MigrationPlan, specs: SystemSpecs): ImpactSurface {
    const affectedEntityNames = new Set(plan.steps.map((s) => s.entity));

    // Find affected modules (modules that own affected entities)
    const affectedModules = specs.modules
      .filter((m) => m.entities.some((e) => affectedEntityNames.has(e)))
      .map((m) => m.name)
      .sort();

    // Find affected policies (policies governing affected capabilities)
    const affectedCapSet = new Set(plan.affectedCapabilities);
    const affectedPolicies = specs.policies
      .filter((p) => p.capabilities.some((c) => affectedCapSet.has(c)))
      .map((p) => p.name)
      .sort();

    // Find affected flows (flows triggered by affected capabilities)
    const affectedFlows = specs.flows
      .filter((f) => affectedCapSet.has(f.trigger))
      .map((f) => f.name)
      .sort();

    // Estimate affected tests and artifacts
    const affectedTests = plan.affectedCapabilities.map((c) => `tests/${c}.test.ts`).sort();
    const generatedArtifacts = [
      ...plan.affectedCapabilities.map((c) => `routes/${c}.ts`),
      ...plan.affectedCapabilities.map((c) => `metadata/${c}.json`),
      ...[...affectedEntityNames].map((e) => `sysmara-orm/schema/${e}.sql`),
    ].sort();

    return {
      target: 'database:migration',
      targetType: 'entity',
      affectedModules,
      affectedInvariants: plan.affectedInvariants,
      affectedPolicies,
      affectedCapabilities: plan.affectedCapabilities,
      affectedRoutes: [],
      affectedFlows,
      affectedFiles: [],
      affectedTests,
      generatedArtifacts,
    };
  }
}
