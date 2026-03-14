/**
 * @module cli/commands/db
 * CLI handlers for the `sysmara db` subcommands: generate, migrate, and status.
 * These commands delegate to the database adapter registry to produce schema
 * files, migrations, and status reports.
 */

import * as path from 'node:path';
import type { SysmaraConfig } from '../../types/index.js';
import { parseSpecDirectory } from '../../spec/index.js';
import { getAdapter, listAdapters } from '../../database/index.js';
import type { AdapterName } from '../../database/index.js';
import { header, success, error, info, bullet, section } from '../format.js';

/**
 * Handles `sysmara db generate` — generates database schema files
 * using the configured adapter.
 *
 * @param cwd - Current working directory
 * @param config - Resolved project configuration
 * @param jsonMode - Whether to output JSON instead of terminal formatting
 */
export async function commandDbGenerate(
  cwd: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const dbConfig = config.database;
  if (!dbConfig) {
    console.error(error('No database configuration found in sysmara.config.yaml'));
    console.error(info('Add a "database" section with adapter and provider fields.'));
    process.exit(1);
  }

  const adapter = getAdapter(dbConfig.adapter as AdapterName);
  if (!adapter) {
    const available = listAdapters();
    console.error(error(`Database adapter "${dbConfig.adapter}" is not registered.`));
    if (available.length > 0) {
      console.error(info(`Available adapters: ${available.join(', ')}`));
    } else {
      console.error(info('No adapters are currently registered. Install an adapter package first.'));
    }
    process.exit(1);
  }

  const specDir = path.resolve(cwd, config.specDir);
  const result = await parseSpecDirectory(specDir);
  if (!result.specs) {
    console.error(error('Failed to parse specs. Run "sysmara validate" for details.'));
    process.exit(1);
  }
  const files = adapter.generateSchema(result.specs);

  if (jsonMode) {
    console.log(JSON.stringify({ adapter: adapter.name, files }, null, 2));
    return;
  }

  console.log(header('Database Schema Generation'));
  console.log(info(`Adapter: ${adapter.name}`));
  console.log(info(`Provider: ${dbConfig.provider}`));
  console.log(section('Generated Files'));

  if (files.length === 0) {
    console.log(info('No schema files generated.'));
  } else {
    console.log(bullet(files.map((f) => f.path)));
  }

  console.log(success(`Generated ${files.length} schema file(s).`));
}

/**
 * Handles `sysmara db migrate` — generates migration files by comparing
 * previous and current system specifications.
 *
 * @param cwd - Current working directory
 * @param config - Resolved project configuration
 * @param jsonMode - Whether to output JSON instead of terminal formatting
 */
export async function commandDbMigrate(
  cwd: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const dbConfig = config.database;
  if (!dbConfig) {
    console.error(error('No database configuration found in sysmara.config.yaml'));
    process.exit(1);
  }

  const adapter = getAdapter(dbConfig.adapter as AdapterName);
  if (!adapter) {
    console.error(error(`Database adapter "${dbConfig.adapter}" is not registered.`));
    process.exit(1);
  }

  const specDir = path.resolve(cwd, config.specDir);
  const result = await parseSpecDirectory(specDir);
  if (!result.specs) {
    console.error(error('Failed to parse specs. Run "sysmara validate" for details.'));
    process.exit(1);
  }
  const specs = result.specs;

  // Phase 1: generate migration from empty specs to current
  const emptySpecs = {
    entities: [],
    capabilities: [],
    policies: [],
    invariants: [],
    modules: [],
    flows: [],
    safeEditZones: [],
    glossary: [],
  };

  const files = adapter.generateMigration(emptySpecs, specs);

  if (jsonMode) {
    console.log(JSON.stringify({ adapter: adapter.name, files }, null, 2));
    return;
  }

  console.log(header('Database Migration'));
  console.log(info(`Adapter: ${adapter.name}`));
  console.log(section('Migration Files'));

  if (files.length === 0) {
    console.log(info('No migration files generated.'));
  } else {
    console.log(bullet(files.map((f) => f.path)));
  }

  console.log(success(`Generated ${files.length} migration file(s).`));
}

/**
 * Handles `sysmara db status` — displays the current database adapter
 * configuration and registered adapters.
 *
 * @param cwd - Current working directory
 * @param config - Resolved project configuration
 * @param jsonMode - Whether to output JSON instead of terminal formatting
 */
export async function commandDbStatus(
  _cwd: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const dbConfig = config.database;
  const available = listAdapters();

  const status = {
    configured: !!dbConfig,
    adapter: dbConfig?.adapter ?? null,
    provider: dbConfig?.provider ?? null,
    outputDir: dbConfig?.outputDir ?? null,
    registeredAdapters: available,
  };

  if (jsonMode) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(header('Database Status'));

  if (!dbConfig) {
    console.log(info('No database configuration found in sysmara.config.yaml'));
  } else {
    console.log(info(`Adapter: ${dbConfig.adapter}`));
    console.log(info(`Provider: ${dbConfig.provider}`));
    if (dbConfig.outputDir) {
      console.log(info(`Output Dir: ${dbConfig.outputDir}`));
    }

    const adapter = getAdapter(dbConfig.adapter as AdapterName);
    if (adapter) {
      console.log(success(`Adapter "${dbConfig.adapter}" is registered and ready.`));
    } else {
      console.log(error(`Adapter "${dbConfig.adapter}" is configured but not registered.`));
    }
  }

  console.log(section('Registered Adapters'));
  if (available.length === 0) {
    console.log(info('No adapters registered.'));
  } else {
    console.log(bullet(available));
  }
}
