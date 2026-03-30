/**
 * @module database/adapters/sysmara-orm/orm
 * Core SysMARA ORM class — the AI-first database layer.
 *
 * Unlike traditional ORMs built for humans, SysmaraORM is designed for AI agents:
 * - Schema IS the system graph — no separate schema file, reads SystemSpecs
 * - Every query is a capability — no arbitrary queries, only declared capabilities
 * - Invariants = DB constraints — enforced at the database level
 * - Machine-readable query log — every operation logged as structured JSON
 * - Impact-aware migrations — runs impact analysis before migrating
 */

import type { SystemSpecs, CapabilitySpec } from '../../../types/index.js';
import type { DatabaseAdapterConfig } from '../../adapter.js';
import { SysmaraRepository } from './repository.js';
import { CapabilityQueryBuilder } from './query-builder.js';
import { OperationLog } from './operation-log.js';
import type { OperationLogEntry } from './operation-log.js';
import { generateSchema } from './schema-generator.js';
import { MigrationEngine } from './migration-engine.js';
import type { MigrationPlan } from './migration-engine.js';
import type { DatabaseDriver } from './driver.js';
import { createDriver, createInMemoryDriver } from './driver.js';

/**
 * The AI-first ORM for SysMARA. Every database operation is scoped to
 * a declared capability, validated against entity contracts, and logged
 * as machine-readable structured JSON.
 *
 * @example
 * ```typescript
 * const orm = new SysmaraORM(config, specs);
 * await orm.connect(); // connects to the database
 *
 * // Execute a capability as a database operation
 * const result = await orm.capability('create-user', { name: 'Alice', email: 'alice@example.com' });
 *
 * // Get a typed repository scoped to a capability
 * const repo = orm.repository<User>('user', 'create-user');
 * const user = await repo.findById('abc-123');
 *
 * // Generate SQL schema from system specs
 * const sql = orm.generateSchema();
 *
 * // Review all operations for AI audit
 * const log = orm.getOperationLog();
 *
 * await orm.disconnect(); // close the connection
 * ```
 */
export class SysmaraORM {
  /** The shared operation log for all repositories and queries. */
  private operationLog: OperationLog;

  /** The query builder scoped to the system specs. */
  private queryBuilder: CapabilityQueryBuilder;

  /** The migration engine for this ORM instance. */
  private migrationEngine: MigrationEngine;

  /** Cache of resolved capability specs by name. */
  private capabilityMap: Map<string, CapabilitySpec>;

  /** The database driver for executing queries. */
  private driver: DatabaseDriver | null = null;

  /**
   * Creates a new SysmaraORM instance.
   *
   * @param config - Database adapter configuration (provider, connection string, etc.)
   * @param specs - The complete system specifications defining entities, capabilities, and invariants
   */
  constructor(
    private config: DatabaseAdapterConfig,
    private specs: SystemSpecs,
  ) {
    this.operationLog = new OperationLog();
    this.queryBuilder = new CapabilityQueryBuilder(specs);
    this.migrationEngine = new MigrationEngine(config.provider);
    this.capabilityMap = new Map(specs.capabilities.map((c) => [c.name, c]));
  }

  /**
   * Connects to the database. If a connection string is provided in the config,
   * uses the appropriate driver (pg, mysql2, better-sqlite3). Otherwise falls back
   * to an in-memory driver.
   */
  async connect(): Promise<void> {
    if (this.driver?.isConnected()) return;

    if (this.config.connectionString) {
      this.driver = createDriver(this.config.provider, this.config.connectionString);
    } else {
      this.driver = createInMemoryDriver(this.config.provider);
    }

    await this.driver.connect();
  }

  /**
   * Closes the database connection.
   */
  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.disconnect();
      this.driver = null;
    }
  }

  /**
   * Returns the database driver instance.
   * Throws if not connected.
   */
  getDriver(): DatabaseDriver {
    if (!this.driver) {
      throw new Error('ORM not connected. Call orm.connect() first.');
    }
    return this.driver;
  }

  /**
   * Sets an external database driver (useful for testing or custom drivers).
   */
  setDriver(driver: DatabaseDriver): void {
    this.driver = driver;
  }

  /**
   * Returns true if the ORM is connected to a database.
   */
  isConnected(): boolean {
    return this.driver?.isConnected() ?? false;
  }

  /**
   * Creates all tables defined in the system specs.
   * Safe to call multiple times (uses IF NOT EXISTS).
   */
  async applySchema(): Promise<void> {
    if (!this.driver) {
      throw new Error('ORM not connected. Call orm.connect() first.');
    }
    const schema = this.generateSchema();
    await this.driver.exec(schema);
  }

  /**
   * Executes a capability as a database operation. Resolves the capability
   * from specs, validates the input against the capability contract, and
   * routes to the appropriate entity operation.
   *
   * @param name - The capability name to execute
   * @param input - The input data matching the capability's input contract
   * @returns The operation result
   * @throws Error if the capability is not found in the system specs
   */
  async capability(name: string, input: Record<string, unknown>): Promise<unknown> {
    const cap = this.resolveCapability(name);
    const start = Date.now();

    // Validate that all required input fields are present
    for (const field of cap.input) {
      if (field.required && !(field.name in input)) {
        throw new Error(
          `Capability "${name}" requires input field "${field.name}" but it was not provided.`,
        );
      }
    }

    // Route to the correct entity operation
    const primaryEntity = cap.entities[0];
    if (!primaryEntity) {
      throw new Error(`Capability "${name}" has no entities defined.`);
    }

    const op = inferOperation(name);
    const repo = this.repository<Record<string, unknown>>(primaryEntity, name);
    let result: unknown;

    switch (op) {
      case 'insert': {
        result = await repo.create(input);
        break;
      }
      case 'select': {
        if (input.id) {
          result = await repo.findById(input.id as string);
        } else {
          result = await repo.findMany(input);
        }
        break;
      }
      case 'update': {
        const { id, ...data } = input;
        result = await repo.update(id as string, data);
        break;
      }
      case 'delete': {
        await repo.delete(input.id as string);
        result = { success: true };
        break;
      }
    }

    // Log the operation
    for (const entityName of cap.entities) {
      this.operationLog.record({
        capability: name,
        entity: entityName,
        operation: op,
        invariants_checked: cap.invariants,
        affected_fields: cap.input.map((f) => f.name),
        duration_ms: Date.now() - start,
        affected_rows: result ? 1 : 0,
        sql_template: `-- capability: ${name} → entity: ${entityName}`,
      });
    }

    return result;
  }

  /**
   * Returns a typed repository scoped to an entity within a capability's boundaries.
   * All operations through the repository are validated against the capability contract
   * and logged to the operation log.
   *
   * @typeParam T - The entity type
   * @param entityName - The entity name to create a repository for
   * @param capabilityName - The capability name authorizing access (defaults to first capability using the entity)
   * @returns A typed SysmaraRepository
   * @throws Error if the entity or capability is not found
   */
  repository<T>(entityName: string, capabilityName?: string): SysmaraRepository<T> {
    if (!this.driver) {
      throw new Error(
        'ORM not connected. Call await orm.connect() before creating repositories. ' +
          'If no database is configured, connect() will use an in-memory driver automatically.',
      );
    }

    let cap: CapabilitySpec;

    if (capabilityName) {
      cap = this.resolveCapability(capabilityName);
    } else {
      // Find the first capability that uses this entity
      const found = this.specs.capabilities.find((c) => c.entities.includes(entityName));
      if (!found) {
        throw new Error(
          `No capability found that declares access to entity "${entityName}". ` +
            `Every repository must be scoped to a capability.`,
        );
      }
      cap = found;
    }

    return new SysmaraRepository<T>(
      entityName,
      cap,
      this.specs,
      this.operationLog,
      this.driver,
    );
  }

  /**
   * Generates the complete SQL schema from system specifications.
   * Produces clean, readable CREATE TABLE statements with constraints,
   * foreign keys, and provider-specific type mappings.
   *
   * @returns The full SQL schema as a string
   */
  generateSchema(): string {
    return generateSchema(this.specs, this.config.provider);
  }

  /**
   * Returns the machine-readable operation log containing all operations
   * performed through this ORM instance. Designed for AI agent consumption.
   *
   * @returns An array of structured operation log entries
   */
  getOperationLog(): OperationLogEntry[] {
    return this.operationLog.getAll();
  }

  /**
   * Diffs the current specs against a previous version and produces
   * an impact-aware migration plan.
   *
   * @param prevSpecs - The previous system specifications
   * @returns A migration plan with steps, risk analysis, and affected capabilities
   */
  planMigration(prevSpecs: SystemSpecs): MigrationPlan {
    return this.migrationEngine.diff(prevSpecs, this.specs);
  }

  /**
   * Returns the query builder for constructing capability-scoped queries.
   *
   * @returns The CapabilityQueryBuilder instance
   */
  getQueryBuilder(): CapabilityQueryBuilder {
    return this.queryBuilder;
  }

  /**
   * Returns the migration engine for generating migrations.
   *
   * @returns The MigrationEngine instance
   */
  getMigrationEngine(): MigrationEngine {
    return this.migrationEngine;
  }

  /**
   * Returns the underlying operation log instance.
   *
   * @returns The OperationLog instance
   */
  getOperationLogInstance(): OperationLog {
    return this.operationLog;
  }

  /**
   * Resolves a capability by name from the system specs.
   *
   * @param name - The capability name to resolve
   * @returns The resolved CapabilitySpec
   * @throws Error if the capability is not found
   */
  private resolveCapability(name: string): CapabilitySpec {
    const cap = this.capabilityMap.get(name);
    if (!cap) {
      throw new Error(
        `Capability "${name}" not found in system specs. ` +
          `Available capabilities: [${[...this.capabilityMap.keys()].join(', ')}]`,
      );
    }
    return cap;
  }
}

/**
 * Infers the SQL operation type from a capability name using naming conventions.
 *
 * @param capabilityName - The capability name to analyze
 * @returns The inferred SQL operation type
 */
function inferOperation(capabilityName: string): OperationLogEntry['operation'] {
  const lower = capabilityName.toLowerCase();
  if (lower.startsWith('create') || lower.startsWith('add') || lower.startsWith('register')) {
    return 'insert';
  }
  if (lower.startsWith('update') || lower.startsWith('edit') || lower.startsWith('modify')) {
    return 'update';
  }
  if (lower.startsWith('delete') || lower.startsWith('remove') || lower.startsWith('deactivate')) {
    return 'delete';
  }
  return 'select';
}
