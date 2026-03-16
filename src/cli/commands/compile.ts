/**
 * @module cli/commands/compile
 * CLI command that compiles capability specifications into generated TypeScript
 * source files and a manifest, writing them to the configured output directories.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory } from '../../spec/index.js';
import { compileCapabilities } from '../../compiler/index.js';
import type { SysmaraConfig } from '../../types/index.js';
import { header, success, error, info } from '../format.js';

/**
 * Creates a directory (and any missing parent directories) if it does not already exist.
 *
 * @param dirPath - Absolute path of the directory to create.
 */
async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Writes a UTF-8 text file, creating any missing parent directories first.
 *
 * @param filePath - Absolute path of the file to write.
 * @param content - String content to write to the file.
 */
async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Parses all specs and runs the capability compiler, writing generated TypeScript
 * files to `generatedDir` and a manifest to `frameworkDir`.
 *
 * @param cwd - Current working directory (project root).
 * @param config - Resolved SysMARA project configuration.
 * @param jsonMode - When `true`, outputs machine-readable JSON instead of human-friendly text.
 * @throws Exits the process with code 1 if spec parsing fails.
 */
export async function commandCompile(cwd: string, config: SysmaraConfig, jsonMode: boolean): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);
  const generatedDir = path.resolve(cwd, config.generatedDir);
  const frameworkDir = path.resolve(cwd, config.frameworkDir);

  if (!jsonMode) console.log(header('Capability Compiler'));

  const result = await parseSpecDirectory(specDir);

  if (result.diagnostics.length > 0 && !jsonMode) {
    for (const d of result.diagnostics) {
      console.log(`  [${d.severity.toUpperCase()}] ${d.message}`);
    }
  }

  if (!result.specs) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, diagnostics: result.diagnostics }, null, 2));
    } else {
      console.error(error('Failed to parse specs. Fix the errors above and try again.'));
    }
    process.exit(1);
  }

  const specs = result.specs;
  const compiled = compileCapabilities(specs);

  await ensureDir(generatedDir);
  for (const file of compiled.files) {
    const filePath = path.join(generatedDir, file.path);
    await writeFile(filePath, file.content);
  }

  await ensureDir(frameworkDir);
  await writeFile(
    path.join(frameworkDir, 'generated-manifest.json'),
    JSON.stringify(compiled.manifest, null, 2),
  );

  if (jsonMode) {
    console.log(JSON.stringify({
      success: true,
      files: compiled.files.map((f) => f.path),
      diagnostics: compiled.diagnostics,
      manifest: compiled.manifest,
    }, null, 2));
  } else {
    console.log('');
    console.log(info(`Generated ${compiled.files.length} file(s):`));
    for (const file of compiled.files) {
      console.log(`    ${file.path}`);
    }

    if (compiled.diagnostics.length > 0) {
      console.log('');
      for (const d of compiled.diagnostics) {
        console.log(`  [${d.severity.toUpperCase()}] ${d.message}`);
      }
    }

    console.log('');
    console.log(success(`Files written to ${config.generatedDir}/`));
  }
}
