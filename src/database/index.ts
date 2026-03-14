/**
 * @module database
 * Public API for the database adapter layer. Re-exports adapter interfaces,
 * configuration types, the adapter registry, and shared database types.
 */

export type {
  DatabaseProvider,
  AdapterName,
  DatabaseAdapterConfig,
  DatabaseAdapter,
} from './adapter.js';

export {
  registerAdapter,
  getAdapter,
  listAdapters,
} from './registry.js';

export type {
  ColumnType,
  ConstraintType,
  ConstraintDefinition,
  ColumnDefinition,
  TableDefinition,
  IndexDefinition,
  MigrationAction,
  MigrationStep,
  DatabaseStatus,
} from './types.js';

export { prismaAdapter, drizzleAdapter, typeormAdapter, sysmaraOrmAdapter } from './adapters/index.js';
export {
  SysmaraORM,
  SysmaraRepository,
  CapabilityQueryBuilder,
  OperationLog,
  MigrationEngine,
  generateSysmaraSchema,
  createSysmaraOrmAdapter,
} from './adapters/index.js';
export type {
  OperationLogEntry,
  BuiltQuery,
  QueryOperation,
  SysmaraMigrationStep,
  MigrationPlan,
} from './adapters/index.js';
