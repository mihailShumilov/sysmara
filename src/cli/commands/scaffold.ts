/**
 * @module cli/commands/scaffold
 * CLI command that generates starter TypeScript implementation files in app/
 * from YAML specs. Files are in the 'editable' safe-edit zone — scaffold runs
 * once and never overwrites existing user files.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory } from '../../spec/index.js';
import { scaffoldSpecs } from '../../scaffold/index.js';
import type { SysmaraConfig } from '../../types/index.js';
import { header, success, error, info } from '../format.js';

/**
 * Checks whether a file exists at the given path.
 *
 * @param filePath - Absolute path to check.
 * @returns `true` if the file exists, `false` otherwise.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a directory (and any missing parent directories) if it does not already exist.
 *
 * @param dirPath - Absolute path of the directory to create.
 */
async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Result of scaffold execution, used for build integration.
 */
export interface ScaffoldResult {
  written: string[];
  skipped: string[];
}

/**
 * Generates starter implementation files in app/ from YAML specs.
 * Skips files that already exist to avoid overwriting user work.
 *
 * @param cwd - Current working directory (project root).
 * @param config - Resolved SysMARA project configuration.
 * @param jsonMode - When `true`, outputs machine-readable JSON instead of human-friendly text.
 * @returns The list of written and skipped files.
 */
export async function commandScaffold(
  cwd: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<ScaffoldResult> {
  const specDir = path.resolve(cwd, config.specDir);
  const appDir = path.resolve(cwd, config.appDir);

  if (!jsonMode) console.log(header('SysMARA Scaffold'));

  const result = await parseSpecDirectory(specDir);

  if (!result.specs) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, diagnostics: result.diagnostics }, null, 2));
    } else {
      for (const d of result.diagnostics) {
        console.log(`  [${d.severity.toUpperCase()}] ${d.message}`);
      }
      console.error(error('Failed to parse specs. Run "sysmara validate" for details.'));
    }
    process.exit(1);
  }

  const { files } = scaffoldSpecs(result.specs);

  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const absolutePath = path.join(appDir, file.path);
    const exists = await fileExists(absolutePath);

    if (exists) {
      skipped.push(file.path);
      continue;
    }

    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, file.content, 'utf-8');
    written.push(file.path);
  }

  if (jsonMode) {
    console.log(JSON.stringify({ success: true, written, skipped }, null, 2));
    return { written, skipped };
  }

  if (written.length > 0) {
    console.log(info(`\n  Written ${written.length} file(s):`));
    for (const f of written) {
      console.log(`    + ${f}`);
    }
  }

  if (skipped.length > 0) {
    console.log(info(`\n  Skipped ${skipped.length} — already exist:`));
    for (const f of skipped) {
      console.log(`    ~ ${f}`);
    }
  }

  console.log('');
  console.log(success(`Scaffold complete. ${written.length} written, ${skipped.length} skipped.`));

  return { written, skipped };
}
