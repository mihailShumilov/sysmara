/**
 * @module database/adapters/drizzle
 * Drizzle adapter for the SysMARA database layer.
 * Converts entity specifications into Drizzle ORM table definitions,
 * migration placeholders, and typed repository classes.
 */

import type { DatabaseAdapter } from '../adapter.js';
import type { GeneratedFile } from '../../compiler/capability-compiler.js';
import type { SystemSpecs, EntitySpec, EntityField, CapabilitySpec } from '../../types/index.js';

/**
 * Converts a snake_case or kebab-case name to PascalCase.
 *
 * @param name - The input name
 * @returns PascalCase string
 */
function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Converts a snake_case or kebab-case name to camelCase.
 *
 * @param name - The input name
 * @returns camelCase string
 */
function toCamelCase(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Maps a SysMARA field type to a Drizzle column builder call for PostgreSQL.
 *
 * @param field - The entity field to map
 * @returns The Drizzle column builder function call string
 */
function mapDrizzlePgColumn(field: EntityField): string {
  const colName = `'${field.name}'`;
  switch (field.type.toLowerCase()) {
    case 'string':
      return `varchar(${colName}, { length: 255 })`;
    case 'number':
    case 'integer':
      return `integer(${colName})`;
    case 'float':
    case 'decimal':
      return `real(${colName})`;
    case 'boolean':
    case 'bool':
      return `boolean(${colName})`;
    case 'date':
    case 'datetime':
    case 'timestamp':
      return `timestamp(${colName})`;
    case 'json':
      return `json(${colName})`;
    default:
      return `varchar(${colName}, { length: 255 })`;
  }
}

/**
 * Maps a SysMARA field type to a Drizzle column builder call for MySQL.
 *
 * @param field - The entity field to map
 * @returns The Drizzle column builder function call string
 */
function mapDrizzleMysqlColumn(field: EntityField): string {
  const colName = `'${field.name}'`;
  switch (field.type.toLowerCase()) {
    case 'string':
      return `varchar(${colName}, { length: 255 })`;
    case 'number':
    case 'integer':
      return `int(${colName})`;
    case 'float':
    case 'decimal':
      return `float(${colName})`;
    case 'boolean':
    case 'bool':
      return `boolean(${colName})`;
    case 'date':
    case 'datetime':
    case 'timestamp':
      return `timestamp(${colName})`;
    case 'json':
      return `json(${colName})`;
    default:
      return `varchar(${colName}, { length: 255 })`;
  }
}

/**
 * Maps a SysMARA field type to a Drizzle column builder call for SQLite.
 *
 * @param field - The entity field to map
 * @returns The Drizzle column builder function call string
 */
function mapDrizzleSqliteColumn(field: EntityField): string {
  const colName = `'${field.name}'`;
  switch (field.type.toLowerCase()) {
    case 'string':
      return `text(${colName})`;
    case 'number':
    case 'integer':
      return `integer(${colName})`;
    case 'float':
    case 'decimal':
      return `real(${colName})`;
    case 'boolean':
    case 'bool':
      return `integer(${colName}, { mode: 'boolean' })`;
    case 'date':
    case 'datetime':
    case 'timestamp':
      return `text(${colName})`;
    case 'json':
      return `text(${colName})`;
    default:
      return `text(${colName})`;
  }
}

/** Provider-specific configuration for Drizzle code generation. */
interface DrizzleProviderConfig {
  tableFactory: string;
  importFrom: string;
  columnMapper: (field: EntityField) => string;
  columnImports: string[];
}

/**
 * Returns the Drizzle provider config for the given database provider.
 *
 * @param provider - The database provider string
 * @returns Provider-specific Drizzle configuration
 */
function getProviderConfig(provider: string): DrizzleProviderConfig {
  switch (provider) {
    case 'mysql':
      return {
        tableFactory: 'mysqlTable',
        importFrom: 'drizzle-orm/mysql-core',
        columnMapper: mapDrizzleMysqlColumn,
        columnImports: ['mysqlTable', 'varchar', 'int', 'float', 'boolean', 'timestamp', 'json'],
      };
    case 'sqlite':
      return {
        tableFactory: 'sqliteTable',
        importFrom: 'drizzle-orm/sqlite-core',
        columnMapper: mapDrizzleSqliteColumn,
        columnImports: ['sqliteTable', 'text', 'integer', 'real'],
      };
    default:
      return {
        tableFactory: 'pgTable',
        importFrom: 'drizzle-orm/pg-core',
        columnMapper: mapDrizzlePgColumn,
        columnImports: ['pgTable', 'varchar', 'integer', 'real', 'boolean', 'timestamp', 'json', 'uuid'],
      };
  }
}

/**
 * Checks whether a field has a "unique" constraint.
 *
 * @param field - The entity field to inspect
 * @returns True if the field has a unique constraint
 */
function isUnique(field: EntityField): boolean {
  return field.constraints?.some((c) => c.type === 'unique') ?? false;
}

/**
 * Generates a Drizzle table definition for a single entity.
 *
 * @param entity - The entity specification
 * @param config - Provider-specific Drizzle configuration
 * @returns The Drizzle table definition source
 */
function generateDrizzleTable(entity: EntitySpec, config: DrizzleProviderConfig): string {
  const tableName = entity.name;
  const varName = toCamelCase(entity.name);
  const lines: string[] = [];

  lines.push(`/** ${entity.description} */`);
  lines.push(`export const ${varName} = ${config.tableFactory}('${tableName}', {`);

  for (const field of entity.fields) {
    const colCall = config.columnMapper(field);
    const modifiers: string[] = [];

    if (field.name === 'id') {
      modifiers.push('.primaryKey()');
      if (config.tableFactory === 'pgTable') {
        // For PG, use uuid with default
        lines.push(`  ${toCamelCase(field.name)}: uuid('${field.name}').defaultRandom().primaryKey(),`);
        continue;
      }
    }

    if (!field.required) {
      // nullable by default in Drizzle
    } else {
      modifiers.push('.notNull()');
    }

    if (isUnique(field)) {
      modifiers.push('.unique()');
    }

    if (field.name === 'created_at') {
      modifiers.push('.defaultNow()');
    }

    lines.push(`  ${toCamelCase(field.name)}: ${colCall}${modifiers.join('')},`);
  }

  lines.push('});');
  return lines.join('\n');
}

/**
 * Generates the complete Drizzle schema.ts file from system specs.
 *
 * @param specs - The complete system specifications
 * @param provider - The database provider
 * @returns The full schema.ts content
 */
function generateDrizzleSchema(specs: SystemSpecs, provider: string): string {
  const config = getProviderConfig(provider);

  const header = `// ============================================================
// GENERATED BY SYSMARA DATABASE ADAPTER (Drizzle)
// DO NOT EDIT — this file will be regenerated
// ============================================================

import { ${config.columnImports.join(', ')} } from '${config.importFrom}';
`;

  const tables = specs.entities
    .map((entity) => generateDrizzleTable(entity, config))
    .join('\n\n');

  return header + '\n' + tables + '\n';
}

/**
 * Drizzle ORM database adapter implementation.
 * Converts SysMARA entity specifications into Drizzle table definitions,
 * migration placeholders, and typed repository classes.
 */
export const drizzleAdapter: DatabaseAdapter = {
  name: 'drizzle',

  generateSchema(specs: SystemSpecs): GeneratedFile[] {
    // Default to postgresql; provider can be configured via DatabaseAdapterConfig
    const schemaContent = generateDrizzleSchema(specs, 'postgresql');
    return [
      {
        path: 'drizzle/schema.ts',
        content: schemaContent,
        source: 'database:drizzle',
        zone: 'generated',
      },
    ];
  },

  generateMigration(_prev: SystemSpecs, next: SystemSpecs): GeneratedFile[] {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const entityNames = next.entities.map((e) => toPascalCase(e.name));

    const content = `-- ============================================================
-- GENERATED BY SYSMARA DATABASE ADAPTER (Drizzle)
-- Migration: ${timestamp}
-- DO NOT EDIT — this file will be regenerated
-- ============================================================
-- Tables: ${entityNames.join(', ')}
--
-- This is a placeholder migration file.
-- Run \`npx drizzle-kit generate\` to produce the actual SQL migration.
--
`;

    return [
      {
        path: `drizzle/migrations/${timestamp}_migration.sql`,
        content,
        source: 'database:drizzle',
        zone: 'generated',
      },
    ];
  },

  generateRepository(capability: CapabilitySpec): GeneratedFile[] {
    const repoContent = generateDrizzleRepository(capability);
    return [
      {
        path: `generated/repositories/${capability.name}.repository.ts`,
        content: repoContent,
        source: `capability:${capability.name}`,
        zone: 'generated',
      },
    ];
  },
};

/**
 * Generates a Drizzle repository file from a capability.
 *
 * @param capability - The capability specification
 * @returns The TypeScript repository source
 */
function generateDrizzleRepository(capability: CapabilitySpec): string {
  const repoMethods: string[] = [];
  const schemaImports: string[] = [];

  for (const entityName of capability.entities) {
    const camelName = toCamelCase(entityName);
    const pascalName = toPascalCase(entityName);
    schemaImports.push(camelName);

    repoMethods.push(`
  /** Find a ${entityName} by ID. */
  async find${pascalName}ById(id: string) {
    return this.db.select().from(schema.${camelName}).where(eq(schema.${camelName}.id, id));
  }

  /** Find all ${entityName} records. */
  async findMany${pascalName}() {
    return this.db.select().from(schema.${camelName});
  }

  /** Create a new ${entityName}. */
  async create${pascalName}(data: Record<string, unknown>) {
    return this.db.insert(schema.${camelName}).values(data);
  }

  /** Update a ${entityName} by ID. */
  async update${pascalName}(id: string, data: Record<string, unknown>) {
    return this.db.update(schema.${camelName}).set(data).where(eq(schema.${camelName}.id, id));
  }

  /** Delete a ${entityName} by ID. */
  async delete${pascalName}(id: string) {
    return this.db.delete(schema.${camelName}).where(eq(schema.${camelName}.id, id));
  }`);
  }

  const capPascal = toPascalCase(capability.name);

  return `// ============================================================
// GENERATED BY SYSMARA DATABASE ADAPTER (Drizzle)
// Source: capability:${capability.name}
// Edit Zone: generated
// DO NOT EDIT — this file will be regenerated
// ============================================================

import { eq } from 'drizzle-orm';
import * as schema from '../../drizzle/schema.js';

/**
 * Repository for the "${capability.name}" capability.
 * Provides typed data-access methods for: ${capability.entities.join(', ')}.
 */
export class ${capPascal}Repository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }
${repoMethods.join('\n')}
}
`;
}
