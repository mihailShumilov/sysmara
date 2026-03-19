/**
 * @module cli/commands/build
 * Full build pipeline for a SysMARA project: parses specs, cross-validates,
 * generates the system graph and map, compiles capabilities, and runs diagnostics.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory, crossValidate } from '../../spec/index.js';
import { buildSystemGraph, buildSystemMap } from '../../graph/index.js';
import { compileCapabilities } from '../../compiler/index.js';
import { runDiagnostics, formatDiagnosticsTerminal } from '../../diagnostics/index.js';
import type { SysmaraConfig } from '../../types/index.js';
import { scaffoldSpecs } from '../../scaffold/index.js';
import { getAdapter } from '../../database/index.js';
import type { AdapterName } from '../../database/index.js';
import { header, success, error, info } from '../format.js';
import { generateServerEntry } from '../../generators/server-entry.js';
import type { DatabaseProvider } from '../../database/adapter.js';

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
 * Executes the full SysMARA build pipeline:
 * 1. Parse all YAML spec files
 * 2. Cross-validate references between specs
 * 3. Generate `system-graph.json` and `system-map.json`
 * 4. Compile capabilities into generated TypeScript files
 * 5. Run diagnostics and produce a report
 *
 * Outputs are written to `frameworkDir` and `generatedDir` as configured.
 *
 * @param cwd - Current working directory (project root).
 * @param config - Resolved SysMARA project configuration.
 * @param jsonMode - When `true`, outputs machine-readable JSON instead of human-friendly text.
 * @throws Exits the process with code 1 if parsing fails or diagnostics contain errors.
 */
export async function commandBuild(cwd: string, config: SysmaraConfig, jsonMode: boolean, options?: { implement?: boolean }): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);
  const frameworkDir = path.resolve(cwd, config.frameworkDir);
  const generatedDir = path.resolve(cwd, config.generatedDir);

  if (!jsonMode) {
    console.log(header('SysMARA Build'));
  }

  // 1. Parse specs
  if (!jsonMode) console.log('\n  Parsing specs...');
  const result = await parseSpecDirectory(specDir);

  if (result.diagnostics.length > 0 && !jsonMode) {
    for (const d of result.diagnostics) {
      console.log(`    [${d.severity.toUpperCase()}] ${d.message}`);
    }
  }

  if (!result.specs) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, stage: 'parse', diagnostics: result.diagnostics }, null, 2));
    } else {
      console.error(error('Failed to parse specs. Fix the errors above and try again.'));
    }
    process.exit(1);
  }

  const specs = result.specs;
  if (!jsonMode) {
    console.log(info(
      `Found ${specs.entities.length} entities, ${specs.capabilities.length} capabilities, ` +
      `${specs.policies.length} policies, ${specs.invariants.length} invariants, ` +
      `${specs.modules.length} modules, ${specs.flows.length} flows`
    ));
  }

  // 2. Cross-validate
  if (!jsonMode) console.log('\n  Cross-validating...');
  const validationDiags = crossValidate(specs);
  if (validationDiags.length > 0 && !jsonMode) {
    console.log(`    ${validationDiags.length} validation issue(s):`);
    for (const d of validationDiags) {
      console.log(`      [${d.severity.toUpperCase()}] ${d.message}`);
    }
  } else if (!jsonMode) {
    console.log(info('No cross-validation issues.'));
  }

  // 3. Build system graph + map
  if (!jsonMode) console.log('\n  Building system graph...');
  const graph = buildSystemGraph(specs);
  await ensureDir(frameworkDir);
  await writeFile(
    path.join(frameworkDir, 'system-graph.json'),
    JSON.stringify(graph, null, 2),
  );
  if (!jsonMode) console.log(info(`system-graph.json (${graph.nodes.length} nodes, ${graph.edges.length} edges)`));

  if (!jsonMode) console.log('  Building system map...');
  const map = buildSystemMap(specs);
  await writeFile(
    path.join(frameworkDir, 'system-map.json'),
    JSON.stringify(map, null, 2),
  );
  if (!jsonMode) console.log(info(`system-map.json (${map.modules.length} modules)`));

  // 4. Compile capabilities
  if (!jsonMode) console.log('\n  Compiling capabilities...');
  const compiled = compileCapabilities(specs);
  if (!jsonMode) console.log(info(`Generated ${compiled.files.length} file(s)`));

  await ensureDir(generatedDir);
  for (const file of compiled.files) {
    const filePath = path.join(generatedDir, file.path);
    await writeFile(filePath, file.content);
  }

  await writeFile(
    path.join(frameworkDir, 'generated-manifest.json'),
    JSON.stringify(compiled.manifest, null, 2),
  );

  // 5. Scaffold app/ implementation stubs (skip existing files)
  if (!jsonMode) console.log('\n  Scaffolding app/ stubs...');
  const appDir = path.resolve(cwd, config.appDir);
  const implement = options?.implement ?? true;
  const scaffold = scaffoldSpecs(specs, { implement });
  let scaffoldWritten = 0;
  let scaffoldSkipped = 0;

  for (const file of scaffold.files) {
    const absolutePath = path.join(appDir, file.path);
    let exists = false;
    try {
      await fs.stat(absolutePath);
      exists = true;
    } catch {
      // file does not exist — will be created
    }

    if (exists) {
      scaffoldSkipped++;
      continue;
    }

    await writeFile(absolutePath, file.content);
    scaffoldWritten++;
  }

  if (!jsonMode) {
    console.log(info(`Scaffold: ${scaffoldWritten} written, ${scaffoldSkipped} skipped (already exist)`));
  }

  // 6. Generate server entry point (skip if exists)
  if (!jsonMode) console.log('\n  Generating server entry point...');
  const serverEntryPath = path.join(appDir, 'server.ts');
  let serverEntryExists = false;
  try {
    await fs.stat(serverEntryPath);
    serverEntryExists = true;
  } catch {
    // file does not exist
  }

  if (!serverEntryExists) {
    const dbProvider = (config.database?.provider ?? 'sqlite') as DatabaseProvider;
    const serverEntry = generateServerEntry(specs, {
      db: dbProvider,
      orm: config.database?.adapter as 'sysmara-orm' | 'prisma' | 'drizzle' | 'typeorm' | undefined,
      connectionString: config.database?.connectionString,
      port: config.port,
    });
    await writeFile(serverEntryPath, serverEntry.content);
    if (!jsonMode) console.log(info('Generated app/server.ts (entry point)'));
  } else if (!jsonMode) {
    console.log(info('app/server.ts already exists — skipped'));
  }

  // Database schema generation (if database is configured)
  if (config.database) {
    if (!jsonMode) console.log('\n  Generating database schema...');
    const adapter = getAdapter(config.database.adapter as AdapterName);
    if (adapter) {
      const dbOutputDir = path.resolve(cwd, config.database.outputDir ?? './app/database');
      const schemaFiles = adapter.generateSchema(specs);
      for (const file of schemaFiles) {
        await writeFile(path.join(dbOutputDir, file.path), file.content);
      }
      if (!jsonMode) console.log(info(`Database schema: ${schemaFiles.length} file(s) generated`));
    } else if (!jsonMode) {
      console.log(info(`Database adapter "${config.database.adapter}" not found — skipping schema generation`));
    }
  }

  // 7. Run diagnostics
  if (!jsonMode) console.log('\n  Running diagnostics...');
  const report = runDiagnostics(specs, compiled.manifest);

  await writeFile(
    path.join(frameworkDir, 'diagnostics.json'),
    JSON.stringify(report, null, 2),
  );

  const hasErrors = report.diagnostics.some((d) => d.severity === 'error');

  if (jsonMode) {
    console.log(JSON.stringify({
      success: !hasErrors,
      specs: {
        entities: specs.entities.length,
        capabilities: specs.capabilities.length,
        policies: specs.policies.length,
        invariants: specs.invariants.length,
        modules: specs.modules.length,
        flows: specs.flows.length,
      },
      graph: { nodes: graph.nodes.length, edges: graph.edges.length },
      compiled: { files: compiled.files.length },
      diagnostics: report,
      validationIssues: validationDiags,
    }, null, 2));
  } else {
    const formatted = formatDiagnosticsTerminal(report);
    console.log(formatted);

    if (hasErrors) {
      console.log('');
      console.log(error('Build completed with errors.'));
    } else {
      console.log('');
      console.log(success('Build completed successfully.'));
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
}
