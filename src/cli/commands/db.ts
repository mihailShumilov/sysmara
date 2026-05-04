/**
 * @module cli/commands/db
 * CLI handlers for the `sysmara db` subcommands: generate, migrate, and status.
 * These commands delegate to the database adapter registry to produce schema
 * files, migrations, and status reports.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SysmaraConfig } from '../../types/index.js';
import { parseSpecDirectory } from '../../spec/index.js';
import { getAdapter, listAdapters } from '../../database/index.js';
import type { AdapterName } from '../../database/index.js';
import { header, success, error, info, bullet, section } from '../format.js';

/**
 * Resolves where generated database files should be written.
 *
 * Resolution order:
 *  1. `database.outputDir` in `sysmara.config.yaml` (explicit, preferred).
 *  2. `generatedDir` from the project config (default for compiler artifacts).
 *
 * The path is always resolved relative to `cwd`.
 *
 * @param cwd - Current working directory
 * @param config - Resolved project configuration
 * @returns Absolute path to the database output directory
 */
function resolveDbOutputDir(cwd: string, config: SysmaraConfig): string {
  const target = config.database?.outputDir ?? config.generatedDir;
  return path.resolve(cwd, target);
}

/**
 * Writes a generated file to disk under the given root, creating any
 * missing parent directories.
 *
 * @param rootDir - Absolute base directory the file path is relative to
 * @param relPath - Path of the file relative to `rootDir`
 * @param content - File contents (UTF-8)
 * @returns The absolute path the file was written to
 */
async function writeGeneratedFile(rootDir: string, relPath: string, content: string): Promise<string> {
  const filePath = path.join(rootDir, relPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

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

  // Materialise generated schema to disk under database.outputDir (preferred)
  // or generatedDir as a fallback. This is what users expect from a
  // command named `db generate` — JSON-mode previously returned the content
  // but no files were ever written.
  const outputDir = resolveDbOutputDir(cwd, config);
  const writtenPaths: string[] = [];
  if (files.length > 0) {
    await fs.mkdir(outputDir, { recursive: true });
    for (const file of files) {
      const written = await writeGeneratedFile(outputDir, file.path, file.content);
      writtenPaths.push(written);
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify({
      adapter: adapter.name,
      outputDir,
      written: writtenPaths,
      files,
    }, null, 2));
    return;
  }

  console.log(header('Database Schema Generation'));
  console.log(info(`Adapter:    ${adapter.name}`));
  console.log(info(`Provider:   ${dbConfig.provider}`));
  console.log(info(`Output dir: ${path.relative(cwd, outputDir) || '.'}`));
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

  const outputDir = resolveDbOutputDir(cwd, config);
  const writtenPaths: string[] = [];
  if (files.length > 0) {
    await fs.mkdir(outputDir, { recursive: true });
    for (const file of files) {
      const written = await writeGeneratedFile(outputDir, file.path, file.content);
      writtenPaths.push(written);
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify({
      adapter: adapter.name,
      outputDir,
      written: writtenPaths,
      files,
    }, null, 2));
    return;
  }

  console.log(header('Database Migration'));
  console.log(info(`Adapter:    ${adapter.name}`));
  console.log(info(`Output dir: ${path.relative(cwd, outputDir) || '.'}`));
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
