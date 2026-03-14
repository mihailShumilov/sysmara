/**
 * @module database/adapters/sysmara-orm/query-builder
 * Builds SQL queries from capability specifications rather than arbitrary chains.
 * Every query maps to a declared capability and is validated against the
 * capability's entity and field contracts before execution.
 *
 * Unlike traditional query builders that allow arbitrary SQL construction,
 * the SysMARA query builder constrains queries to declared capability boundaries.
 */

import type { CapabilitySpec, EntitySpec, SystemSpecs } from '../../../types/index.js';

/** The type of SQL operation to build. */
export type QueryOperation = 'select' | 'insert' | 'update' | 'delete';

/**
 * A built SQL query with its parameterized template and metadata.
 *
 * @property sql - The parameterized SQL string (uses $1, $2... placeholders)
 * @property params - The parameter values in order
 * @property operation - The SQL operation type
 * @property entity - The target entity name
 * @property capability - The capability this query belongs to
 * @property affected_fields - Field names involved in the query
 */
export interface BuiltQuery {
  sql: string;
  params: unknown[];
  operation: QueryOperation;
  entity: string;
  capability: string;
  affected_fields: string[];
}

/**
 * Validates that an entity name is declared in a capability's entity list.
 *
 * @param capability - The capability spec to validate against
 * @param entityName - The entity name to check
 * @throws Error if the entity is not declared in the capability
 */
function validateEntityAccess(capability: CapabilitySpec, entityName: string): void {
  if (!capability.entities.includes(entityName)) {
    throw new Error(
      `Capability "${capability.name}" does not declare access to entity "${entityName}". ` +
        `Declared entities: [${capability.entities.join(', ')}]`,
    );
  }
}

/**
 * Validates that all fields in a data object are defined on the target entity.
 *
 * @param entity - The entity spec to validate against
 * @param fields - The field names to check
 * @throws Error if any field is not declared on the entity
 */
function validateFieldAccess(entity: EntitySpec, fields: string[]): void {
  const entityFields = new Set(entity.fields.map((f) => f.name));
  const invalid = fields.filter((f) => !entityFields.has(f));
  if (invalid.length > 0) {
    throw new Error(
      `Fields [${invalid.join(', ')}] are not defined on entity "${entity.name}". ` +
        `Valid fields: [${[...entityFields].join(', ')}]`,
    );
  }
}

/**
 * Resolves an entity spec by name from the system specs.
 *
 * @param specs - The complete system specifications
 * @param entityName - The entity name to resolve
 * @returns The resolved EntitySpec
 * @throws Error if the entity is not found in the specs
 */
function resolveEntity(specs: SystemSpecs, entityName: string): EntitySpec {
  const entity = specs.entities.find((e) => e.name === entityName);
  if (!entity) {
    throw new Error(`Entity "${entityName}" not found in system specs.`);
  }
  return entity;
}

/**
 * Capability-scoped SQL query builder. Every query is constrained to the
 * entities and fields declared by a capability — no arbitrary queries allowed.
 *
 * Generates parameterized SQL templates for AI-readable operation logging.
 */
export class CapabilityQueryBuilder {
  /**
   * Creates a new CapabilityQueryBuilder.
   *
   * @param specs - The complete system specifications for entity resolution
   */
  constructor(private specs: SystemSpecs) {}

  /**
   * Builds a SELECT query scoped to a capability's declared entities.
   *
   * @param capability - The capability authorizing this query
   * @param entityName - The entity to query
   * @param options - Optional filters and field selection
   * @returns The built query with parameterized SQL
   */
  select(
    capability: CapabilitySpec,
    entityName: string,
    options: {
      fields?: string[];
      where?: Record<string, unknown>;
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDir?: 'ASC' | 'DESC';
    } = {},
  ): BuiltQuery {
    validateEntityAccess(capability, entityName);
    const entity = resolveEntity(this.specs, entityName);

    const selectedFields = options.fields ?? entity.fields.map((f) => f.name);
    if (options.fields) {
      validateFieldAccess(entity, options.fields);
    }

    const columns = selectedFields.map((f) => `"${f}"`).join(', ');
    const parts: string[] = [`SELECT ${columns} FROM "${entityName}"`];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (options.where && Object.keys(options.where).length > 0) {
      validateFieldAccess(entity, Object.keys(options.where));
      const conditions = Object.entries(options.where).map(([key, value]) => {
        params.push(value);
        return `"${key}" = $${paramIdx++}`;
      });
      parts.push(`WHERE ${conditions.join(' AND ')}`);
    }

    if (options.orderBy) {
      validateFieldAccess(entity, [options.orderBy]);
      parts.push(`ORDER BY "${options.orderBy}" ${options.orderDir ?? 'ASC'}`);
    }

    if (options.limit !== undefined) {
      parts.push(`LIMIT $${paramIdx++}`);
      params.push(options.limit);
    }

    if (options.offset !== undefined) {
      parts.push(`OFFSET $${paramIdx++}`);
      params.push(options.offset);
    }

    return {
      sql: parts.join(' '),
      params,
      operation: 'select',
      entity: entityName,
      capability: capability.name,
      affected_fields: selectedFields,
    };
  }

  /**
   * Builds a SELECT query that returns a single row by ID.
   *
   * @param capability - The capability authorizing this query
   * @param entityName - The entity to query
   * @param id - The row ID to find
   * @returns The built query with parameterized SQL
   */
  selectById(capability: CapabilitySpec, entityName: string, id: string): BuiltQuery {
    validateEntityAccess(capability, entityName);
    const entity = resolveEntity(this.specs, entityName);
    const fields = entity.fields.map((f) => f.name);
    const columns = fields.map((f) => `"${f}"`).join(', ');

    return {
      sql: `SELECT ${columns} FROM "${entityName}" WHERE "id" = $1 LIMIT 1`,
      params: [id],
      operation: 'select',
      entity: entityName,
      capability: capability.name,
      affected_fields: fields,
    };
  }

  /**
   * Builds an INSERT query scoped to a capability's declared entities.
   *
   * @param capability - The capability authorizing this query
   * @param entityName - The entity to insert into
   * @param data - The column-value pairs to insert
   * @returns The built query with parameterized SQL
   */
  insert(
    capability: CapabilitySpec,
    entityName: string,
    data: Record<string, unknown>,
  ): BuiltQuery {
    validateEntityAccess(capability, entityName);
    const entity = resolveEntity(this.specs, entityName);
    const fields = Object.keys(data);
    validateFieldAccess(entity, fields);

    const columns = fields.map((f) => `"${f}"`).join(', ');
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const params = fields.map((f) => data[f]);

    return {
      sql: `INSERT INTO "${entityName}" (${columns}) VALUES (${placeholders}) RETURNING *`,
      params,
      operation: 'insert',
      entity: entityName,
      capability: capability.name,
      affected_fields: fields,
    };
  }

  /**
   * Builds an UPDATE query scoped to a capability's declared entities.
   *
   * @param capability - The capability authorizing this query
   * @param entityName - The entity to update
   * @param id - The row ID to update
   * @param data - The column-value pairs to set
   * @returns The built query with parameterized SQL
   */
  update(
    capability: CapabilitySpec,
    entityName: string,
    id: string,
    data: Record<string, unknown>,
  ): BuiltQuery {
    validateEntityAccess(capability, entityName);
    const entity = resolveEntity(this.specs, entityName);
    const fields = Object.keys(data);
    validateFieldAccess(entity, fields);

    let paramIdx = 1;
    const setClauses = fields.map((f) => `"${f}" = $${paramIdx++}`);
    const params: unknown[] = fields.map((f) => data[f]);
    params.push(id);

    return {
      sql: `UPDATE "${entityName}" SET ${setClauses.join(', ')} WHERE "id" = $${paramIdx} RETURNING *`,
      params,
      operation: 'update',
      entity: entityName,
      capability: capability.name,
      affected_fields: [...fields, 'id'],
    };
  }

  /**
   * Builds a DELETE query scoped to a capability's declared entities.
   *
   * @param capability - The capability authorizing this query
   * @param entityName - The entity to delete from
   * @param id - The row ID to delete
   * @returns The built query with parameterized SQL
   */
  delete(capability: CapabilitySpec, entityName: string, id: string): BuiltQuery {
    validateEntityAccess(capability, entityName);

    return {
      sql: `DELETE FROM "${entityName}" WHERE "id" = $1`,
      params: [id],
      operation: 'delete',
      entity: entityName,
      capability: capability.name,
      affected_fields: ['id'],
    };
  }
}
