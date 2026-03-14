/**
 * @module database/adapters
 * Re-exports all database adapter implementations and registers them
 * in the adapter registry on module load.
 */

import { registerAdapter } from '../registry.js';
import { prismaAdapter } from './prisma.js';
import { drizzleAdapter } from './drizzle.js';
import { typeormAdapter } from './typeorm.js';
import { sysmaraOrmAdapter } from './sysmara-orm/index.js';

export { prismaAdapter } from './prisma.js';
export { drizzleAdapter } from './drizzle.js';
export { typeormAdapter } from './typeorm.js';
export { sysmaraOrmAdapter } from './sysmara-orm/index.js';
export {
  SysmaraORM,
  SysmaraRepository,
  CapabilityQueryBuilder,
  OperationLog,
  MigrationEngine,
  generateSchema as generateSysmaraSchema,
  createSysmaraOrmAdapter,
} from './sysmara-orm/index.js';
export type {
  OperationLogEntry,
  BuiltQuery,
  QueryOperation,
  MigrationStep as SysmaraMigrationStep,
  MigrationPlan,
} from './sysmara-orm/index.js';

// Auto-register all adapters
registerAdapter(prismaAdapter);
registerAdapter(drizzleAdapter);
registerAdapter(typeormAdapter);
registerAdapter(sysmaraOrmAdapter);
