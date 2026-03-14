/**
 * @module database/adapters/sysmara-orm/schema-generator
 * Generates raw SQL CREATE TABLE statements from SysMARA entity specifications.
 * Maps SysMARA field types to SQL column types, converts field constraints to
 * SQL constraints (UNIQUE, CHECK, NOT NULL), and adapts output for
 * PostgreSQL, MySQL, and SQLite providers.
 */

import type { SystemSpecs, EntitySpec, EntityField, FieldConstraint } from '../../../types/index.js';
import type { DatabaseProvider } from '../../adapter.js';

/**
 * Maps a SysMARA field type to a PostgreSQL column type.
 *
 * @param field - The entity field to map
 * @returns The PostgreSQL column type string
 */
function mapPostgresType(field: EntityField): string {
  if (field.name === 'id') return 'UUID';
  switch (field.type.toLowerCase()) {
    case 'string':
      return 'VARCHAR(255)';
    case 'text':
      return 'TEXT';
    case 'number':
    case 'integer':
      return 'INTEGER';
    case 'float':
      return 'DOUBLE PRECISION';
    case 'decimal':
      return 'DECIMAL(10,2)';
    case 'boolean':
    case 'bool':
      return 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'datetime':
    case 'timestamp':
      return 'TIMESTAMPTZ';
    case 'json':
      return 'JSONB';
    case 'enum':
      return 'VARCHAR(100)';
    case 'uuid':
      return 'UUID';
    case 'bigint':
      return 'BIGINT';
    default:
      return 'VARCHAR(255)';
  }
}

/**
 * Maps a SysMARA field type to a MySQL column type.
 *
 * @param field - The entity field to map
 * @returns The MySQL column type string
 */
function mapMysqlType(field: EntityField): string {
  if (field.name === 'id') return 'CHAR(36)';
  switch (field.type.toLowerCase()) {
    case 'string':
      return 'VARCHAR(255)';
    case 'text':
      return 'TEXT';
    case 'number':
    case 'integer':
      return 'INT';
    case 'float':
      return 'DOUBLE';
    case 'decimal':
      return 'DECIMAL(10,2)';
    case 'boolean':
    case 'bool':
      return 'TINYINT(1)';
    case 'date':
      return 'DATE';
    case 'datetime':
    case 'timestamp':
      return 'DATETIME(3)';
    case 'json':
      return 'JSON';
    case 'enum':
      return 'VARCHAR(100)';
    case 'uuid':
      return 'CHAR(36)';
    case 'bigint':
      return 'BIGINT';
    default:
      return 'VARCHAR(255)';
  }
}

/**
 * Maps a SysMARA field type to a SQLite column type.
 *
 * @param field - The entity field to map
 * @returns The SQLite column type string
 */
function mapSqliteType(field: EntityField): string {
  if (field.name === 'id') return 'TEXT';
  switch (field.type.toLowerCase()) {
    case 'string':
    case 'text':
    case 'enum':
    case 'uuid':
      return 'TEXT';
    case 'number':
    case 'integer':
    case 'bigint':
      return 'INTEGER';
    case 'float':
    case 'decimal':
      return 'REAL';
    case 'boolean':
    case 'bool':
      return 'INTEGER';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'TEXT';
    case 'json':
      return 'TEXT';
    default:
      return 'TEXT';
  }
}

/**
 * Selects the appropriate type mapper for a database provider.
 *
 * @param provider - The target database provider
 * @returns A function that maps EntityField to SQL type string
 */
function getTypeMapper(provider: DatabaseProvider): (field: EntityField) => string {
  switch (provider) {
    case 'mysql':
      return mapMysqlType;
    case 'sqlite':
      return mapSqliteType;
    case 'postgresql':
    default:
      return mapPostgresType;
  }
}

/**
 * Generates SQL CHECK constraint expressions from field constraints.
 *
 * @param tableName - The table name for naming the constraint
 * @param fieldName - The column name the constraint applies to
 * @param constraints - The field constraints to convert
 * @param provider - The target database provider
 * @returns An array of SQL constraint clause strings
 */
function generateCheckConstraints(
  tableName: string,
  fieldName: string,
  constraints: FieldConstraint[],
  provider: DatabaseProvider,
): string[] {
  const clauses: string[] = [];
  for (const c of constraints) {
    switch (c.type) {
      case 'min':
        clauses.push(
          `  CONSTRAINT chk_${tableName}_${fieldName}_min CHECK ("${fieldName}" >= ${c.value})`,
        );
        break;
      case 'max':
        clauses.push(
          `  CONSTRAINT chk_${tableName}_${fieldName}_max CHECK ("${fieldName}" <= ${c.value})`,
        );
        break;
      case 'minLength':
        if (provider === 'sqlite') {
          clauses.push(
            `  CONSTRAINT chk_${tableName}_${fieldName}_minlen CHECK (LENGTH("${fieldName}") >= ${c.value})`,
          );
        } else {
          clauses.push(
            `  CONSTRAINT chk_${tableName}_${fieldName}_minlen CHECK (CHAR_LENGTH("${fieldName}") >= ${c.value})`,
          );
        }
        break;
      case 'maxLength':
        if (provider === 'sqlite') {
          clauses.push(
            `  CONSTRAINT chk_${tableName}_${fieldName}_maxlen CHECK (LENGTH("${fieldName}") <= ${c.value})`,
          );
        } else {
          clauses.push(
            `  CONSTRAINT chk_${tableName}_${fieldName}_maxlen CHECK (CHAR_LENGTH("${fieldName}") <= ${c.value})`,
          );
        }
        break;
      case 'pattern':
        if (provider === 'postgresql') {
          clauses.push(
            `  CONSTRAINT chk_${tableName}_${fieldName}_pattern CHECK ("${fieldName}" ~ '${c.value}')`,
          );
        }
        // MySQL and SQLite don't have native regex CHECK — skip
        break;
      case 'enum':
        if (Array.isArray(c.value)) {
          const values = c.value.map((v) => `'${v}'`).join(', ');
          clauses.push(
            `  CONSTRAINT chk_${tableName}_${fieldName}_enum CHECK ("${fieldName}" IN (${values}))`,
          );
        }
        break;
      // 'unique' is handled as a column modifier, not a CHECK constraint
    }
  }
  return clauses;
}

/**
 * Returns the UUID default expression for a provider.
 *
 * @param provider - The target database provider
 * @returns SQL default expression string
 */
function uuidDefault(provider: DatabaseProvider): string {
  switch (provider) {
    case 'postgresql':
      return 'gen_random_uuid()';
    case 'mysql':
      return '(UUID())';
    case 'sqlite':
      return "(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))";
  }
}

/**
 * Returns the timestamp default expression for a provider.
 *
 * @param provider - The target database provider
 * @returns SQL default expression string
 */
function timestampDefault(provider: DatabaseProvider): string {
  switch (provider) {
    case 'postgresql':
      return 'NOW()';
    case 'mysql':
      return 'CURRENT_TIMESTAMP(3)';
    case 'sqlite':
      return "CURRENT_TIMESTAMP";
  }
}

/**
 * Generates a SQL CREATE TABLE statement for a single entity.
 *
 * @param entity - The entity specification
 * @param allEntities - All entities for resolving foreign key references
 * @param provider - The target database provider
 * @returns The SQL CREATE TABLE statement
 */
function generateCreateTable(
  entity: EntitySpec,
  allEntities: EntitySpec[],
  provider: DatabaseProvider,
): string {
  const mapType = getTypeMapper(provider);
  const entityNames = new Set(allEntities.map((e) => e.name));
  const tableName = entity.name;
  const columns: string[] = [];
  const constraints: string[] = [];
  const foreignKeys: string[] = [];

  for (const field of entity.fields) {
    const colType = mapType(field);
    const parts: string[] = [`  "${field.name}" ${colType}`];

    if (field.name === 'id') {
      parts.push(`DEFAULT ${uuidDefault(provider)}`);
      parts.push('PRIMARY KEY');
    } else if (field.name === 'created_at') {
      parts.push(`DEFAULT ${timestampDefault(provider)}`);
      parts.push('NOT NULL');
    } else if (field.name === 'updated_at') {
      parts.push(`DEFAULT ${timestampDefault(provider)}`);
      parts.push('NOT NULL');
    } else {
      if (field.required) {
        parts.push('NOT NULL');
      }

      const isUnique = field.constraints?.some((c) => c.type === 'unique') ?? false;
      if (isUnique) {
        parts.push('UNIQUE');
      }

      // Foreign key detection: field named <entity>_id where <entity> exists
      const refName = field.name.replace(/_id$/, '');
      if (field.name.endsWith('_id') && entityNames.has(refName)) {
        foreignKeys.push(
          `  CONSTRAINT fk_${tableName}_${refName} FOREIGN KEY ("${field.name}") REFERENCES "${refName}" ("id")`,
        );
      }

      // Generate CHECK constraints from field constraints
      if (field.constraints) {
        const checks = generateCheckConstraints(tableName, field.name, field.constraints, provider);
        constraints.push(...checks);
      }
    }

    columns.push(parts.join(' '));
  }

  const allParts = [...columns, ...constraints, ...foreignKeys];
  const body = allParts.join(',\n');

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${body}\n);`;
}

/**
 * Generates complete SQL schema (CREATE TABLE statements) from system specifications.
 * Produces clean, readable SQL that AI agents can parse and reason about.
 *
 * @param specs - The complete system specifications
 * @param provider - The target database provider
 * @returns The full SQL schema as a string
 */
export function generateSchema(specs: SystemSpecs, provider: DatabaseProvider): string {
  const header = [
    '-- ============================================================',
    '-- GENERATED BY SYSMARA ORM',
    `-- Provider: ${provider}`,
    `-- Generated at: ${new Date().toISOString()}`,
    `-- Entities: ${specs.entities.map((e) => e.name).join(', ')}`,
    '-- DO NOT EDIT — this file will be regenerated',
    '-- ============================================================',
    '',
  ];

  // Enable UUID extension for PostgreSQL
  if (provider === 'postgresql') {
    header.push('-- Enable UUID generation');
    header.push('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    header.push('');
  }

  const tables = specs.entities.map((entity) =>
    generateCreateTable(entity, specs.entities, provider),
  );

  return [...header, ...tables].join('\n\n');
}
