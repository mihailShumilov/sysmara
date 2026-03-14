/**
 * @module database/adapter
 * Core database adapter interface and configuration types.
 * Adapters translate system specs into database-specific schema files,
 * migrations, and repository code for a given ORM/query builder.
 */

import type { SystemSpecs, CapabilitySpec } from '../types/index.js';
import type { GeneratedFile } from '../compiler/index.js';

/** Supported database providers. */
export type DatabaseProvider = 'postgresql' | 'mysql' | 'sqlite';

/** Supported ORM / query-builder adapter names. */
export type AdapterName = 'prisma' | 'drizzle' | 'typeorm' | 'sysmara-orm';

/**
 * Configuration for the database adapter layer, typically defined
 * in the `database` section of `sysmara.config.yaml`.
 *
 * @property adapter - The ORM or query-builder adapter to use
 * @property provider - The target database provider
 * @property outputDir - Optional output directory for generated database files
 * @property connectionString - Optional database connection string
 */
export interface DatabaseAdapterConfig {
  adapter: AdapterName;
  provider: DatabaseProvider;
  outputDir?: string;
  connectionString?: string;
}

/**
 * Interface that all database adapters must implement.
 * Adapters are responsible for translating system specs into
 * ORM-specific schema definitions, migrations, and repository patterns.
 *
 * @property name - The unique adapter name
 */
export interface DatabaseAdapter {
  /** The unique adapter identifier. */
  name: AdapterName;

  /**
   * Generates database schema files from the current system specifications.
   *
   * @param specs - The complete system specifications
   * @returns An array of generated schema files
   */
  generateSchema(specs: SystemSpecs): GeneratedFile[];

  /**
   * Generates migration files by diffing two versions of the system specifications.
   *
   * @param prev - The previous system specifications
   * @param next - The updated system specifications
   * @returns An array of generated migration files
   */
  generateMigration(prev: SystemSpecs, next: SystemSpecs): GeneratedFile[];

  /**
   * Generates repository/data-access files for a specific capability.
   *
   * @param capability - The capability specification to generate repository code for
   * @returns An array of generated repository files
   */
  generateRepository(capability: CapabilitySpec): GeneratedFile[];
}
