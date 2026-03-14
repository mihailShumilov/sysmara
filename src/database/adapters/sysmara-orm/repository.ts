/**
 * @module database/adapters/sysmara-orm/repository
 * Typed repository for SysMARA entities. Each repository is scoped to a
 * single entity and a capability, ensuring all data access is within
 * declared capability boundaries.
 *
 * Operations are logged to the operation log for AI-readable audit trails.
 */

import type { CapabilitySpec, SystemSpecs, EntitySpec } from '../../../types/index.js';
import { CapabilityQueryBuilder } from './query-builder.js';
import { OperationLog } from './operation-log.js';
import type { OperationLogEntry } from './operation-log.js';

/**
 * A typed repository scoped to a single entity within a capability's boundaries.
 * All operations are validated against the capability contract and logged
 * to the machine-readable operation log.
 *
 * @typeParam T - The entity type this repository operates on
 */
export class SysmaraRepository<T> {
  /** The resolved entity specification. */
  private entity: EntitySpec;

  /** The query builder for generating parameterized SQL. */
  private queryBuilder: CapabilityQueryBuilder;

  /**
   * Creates a new SysmaraRepository.
   *
   * @param entityName - The entity name this repository manages
   * @param capability - The capability authorizing data access
   * @param specs - The complete system specifications
   * @param operationLog - The shared operation log for recording operations
   */
  constructor(
    private entityName: string,
    private capability: CapabilitySpec,
    private specs: SystemSpecs,
    private operationLog: OperationLog,
  ) {
    const found = specs.entities.find((e) => e.name === entityName);
    if (!found) {
      throw new Error(`Entity "${entityName}" not found in system specs.`);
    }
    this.entity = found;
    this.queryBuilder = new CapabilityQueryBuilder(specs);
  }

  /**
   * Finds a single entity record by its ID.
   *
   * @param id - The record ID to find
   * @returns The found record or null
   */
  async findById(id: string): Promise<T | null> {
    const query = this.queryBuilder.selectById(this.capability, this.entityName, id);
    const start = Date.now();

    // TODO: implement with actual DB driver
    const result: T | null = null;

    this.logOperation(query.operation, query.affected_fields, query.sql, Date.now() - start, result ? 1 : 0);
    return result;
  }

  /**
   * Finds a single entity record matching the given filters.
   *
   * @param filters - Partial entity fields to match
   * @returns The first matching record or null
   */
  async findOne(filters: Partial<T>): Promise<T | null> {
    const query = this.queryBuilder.select(this.capability, this.entityName, {
      where: filters as Record<string, unknown>,
      limit: 1,
    });
    const start = Date.now();

    // TODO: implement with actual DB driver
    const result: T | null = null;

    this.logOperation(query.operation, query.affected_fields, query.sql, Date.now() - start, result ? 1 : 0);
    return result;
  }

  /**
   * Finds all entity records matching the given filters.
   *
   * @param filters - Optional partial entity fields to match
   * @returns An array of matching records
   */
  async findMany(filters?: Partial<T>): Promise<T[]> {
    const query = this.queryBuilder.select(this.capability, this.entityName, {
      where: filters as Record<string, unknown> | undefined,
    });
    const start = Date.now();

    // TODO: implement with actual DB driver
    const results: T[] = [];

    this.logOperation(query.operation, query.affected_fields, query.sql, Date.now() - start, results.length);
    return results;
  }

  /**
   * Creates a new entity record.
   *
   * @param data - The fields to set on the new record
   * @returns The created record
   */
  async create(data: Partial<T>): Promise<T> {
    const query = this.queryBuilder.insert(
      this.capability,
      this.entityName,
      data as Record<string, unknown>,
    );
    const start = Date.now();

    // TODO: implement with actual DB driver
    const result = data as T;

    this.logOperation(query.operation, query.affected_fields, query.sql, Date.now() - start, 1);
    return result;
  }

  /**
   * Updates an existing entity record by ID.
   *
   * @param id - The record ID to update
   * @param data - The fields to update
   * @returns The updated record
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const query = this.queryBuilder.update(
      this.capability,
      this.entityName,
      id,
      data as Record<string, unknown>,
    );
    const start = Date.now();

    // TODO: implement with actual DB driver
    const result = { id, ...data } as T;

    this.logOperation(query.operation, query.affected_fields, query.sql, Date.now() - start, 1);
    return result;
  }

  /**
   * Deletes an entity record by ID.
   *
   * @param id - The record ID to delete
   */
  async delete(id: string): Promise<void> {
    const query = this.queryBuilder.delete(this.capability, this.entityName, id);
    const start = Date.now();

    // TODO: implement with actual DB driver

    this.logOperation(query.operation, query.affected_fields, query.sql, Date.now() - start, 1);
  }

  /**
   * Returns the entity specification this repository operates on.
   *
   * @returns The EntitySpec for the managed entity
   */
  getEntitySpec(): EntitySpec {
    return this.entity;
  }

  /**
   * Records an operation to the machine-readable log.
   *
   * @param operation - The SQL operation type
   * @param affectedFields - Fields involved in the operation
   * @param sqlTemplate - The parameterized SQL template
   * @param durationMs - Operation duration in milliseconds
   * @param affectedRows - Number of affected rows
   */
  private logOperation(
    operation: OperationLogEntry['operation'],
    affectedFields: string[],
    sqlTemplate: string,
    durationMs: number,
    affectedRows: number,
  ): void {
    // Resolve invariant names from the capability
    const invariantsChecked = this.capability.invariants.filter((invName) => {
      const inv = this.specs.invariants.find((i) => i.name === invName);
      return inv && inv.entity === this.entityName;
    });

    this.operationLog.record({
      capability: this.capability.name,
      entity: this.entityName,
      operation,
      invariants_checked: invariantsChecked,
      affected_fields: affectedFields,
      duration_ms: durationMs,
      affected_rows: affectedRows,
      sql_template: sqlTemplate,
    });
  }
}
