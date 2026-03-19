/**
 * @module database/adapters/sysmara-orm
 * AI-first ORM for SysMARA. Re-exports all public APIs from the SysMARA ORM module.
 *
 * Key exports:
 * - {@link SysmaraORM} — Core ORM class
 * - {@link SysmaraRepository} — Typed entity repository
 * - {@link CapabilityQueryBuilder} — Capability-scoped query builder
 * - {@link MigrationEngine} — Impact-aware migration engine
 * - {@link OperationLog} — Machine-readable operation log
 * - {@link generateSchema} — SQL schema generator
 * - {@link sysmaraOrmAdapter} — DatabaseAdapter implementation
 */

// Core ORM
export { SysmaraORM } from './orm.js';

// Repository
export { SysmaraRepository } from './repository.js';

// Query builder
export { CapabilityQueryBuilder } from './query-builder.js';
export type { BuiltQuery, QueryOperation } from './query-builder.js';

// Operation log
export { OperationLog } from './operation-log.js';
export type { OperationLogEntry } from './operation-log.js';

// Schema generator
export { generateSchema } from './schema-generator.js';

// Migration engine
export { MigrationEngine } from './migration-engine.js';
export type { MigrationStep, MigrationPlan } from './migration-engine.js';

// Database driver
export { createDriver, createInMemoryDriver } from './driver.js';
export type { DatabaseDriver, QueryResult, Row } from './driver.js';

// Adapter (DatabaseAdapter implementation)
export { sysmaraOrmAdapter, createSysmaraOrmAdapter } from './adapter.js';
