import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ZodSchema, ZodError } from 'zod';
import type { Diagnostic, SystemSpecs } from '../types/index.js';
import {
  entitiesFileSchema,
  capabilitiesFileSchema,
  policiesFileSchema,
  invariantsFileSchema,
  modulesFileSchema,
  flowsFileSchema,
  safeEditZonesFileSchema,
  glossaryFileSchema,
  entitySpecSchema,
  capabilitySpecSchema,
  policySpecSchema,
  invariantSpecSchema,
  moduleSpecSchema,
  flowSpecSchema,
  safeEditZoneSpecSchema,
  glossaryTermSchema,
} from './schemas.js';

/**
 * Parse a single YAML file and validate against a Zod schema.
 */
export async function parseSpecFile<T>(
  filePath: string,
  schema: ZodSchema<T>,
): Promise<{ data: T | null; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = [];

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      code: 'SPEC_FILE_READ_ERROR',
      severity: 'error',
      message: `Failed to read file: ${message}`,
      source: filePath,
    });
    return { data: null, diagnostics };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      code: 'SPEC_YAML_PARSE_ERROR',
      severity: 'error',
      message: `Invalid YAML: ${message}`,
      source: filePath,
    });
    return { data: null, diagnostics };
  }

  if (parsed === undefined || parsed === null) {
    diagnostics.push({
      code: 'SPEC_EMPTY_FILE',
      severity: 'warning',
      message: 'File is empty or contains no data',
      source: filePath,
    });
    return { data: null, diagnostics };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    for (const issue of (result.error as ZodError).issues) {
      diagnostics.push({
        code: 'SPEC_VALIDATION_ERROR',
        severity: 'error',
        message: issue.message,
        source: filePath,
        path: issue.path.join('.'),
        suggestion: `Check the value at path "${issue.path.join('.')}"`,
      });
    }
    return { data: null, diagnostics };
  }

  return { data: result.data, diagnostics };
}

/**
 * Check if a path is a YAML file.
 */
function isYamlFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return ext === '.yaml' || ext === '.yml';
}

/**
 * Load items from either a single YAML file or a directory of YAML files.
 * For a directory, each file is expected to contain a single item (object) or an array.
 * All results are merged into a single flat array.
 */
async function loadSpecItems<T>(
  specDir: string,
  specName: string,
  schema: ZodSchema<T[]>,
  itemSchema: ZodSchema<T>,
): Promise<{ data: T[]; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = [];
  const items: T[] = [];

  // Possible wrapper keys (e.g. "entities", "safeEditZones" for "safe-edit-zones")
  const wrapperKeys = [specName, specName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())];

  // Try single-file variants first
  for (const ext of ['.yaml', '.yml']) {
    const filePath = join(specDir, `${specName}${ext}`);
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        // First try parsing directly as array
        const result = await parseSpecFile(filePath, schema);
        if (result.data) {
          items.push(...result.data);
          return { data: items, diagnostics };
        }
        // If that fails, try unwrapping from a top-level key
        try {
          const rawContent = await readFile(filePath, 'utf-8');
          const rawParsed = parseYaml(rawContent);
          if (rawParsed && typeof rawParsed === 'object' && !Array.isArray(rawParsed)) {
            const obj = rawParsed as Record<string, unknown>;
            for (const key of wrapperKeys) {
              if (key in obj && Array.isArray(obj[key])) {
                const unwrapped = schema.safeParse(obj[key]);
                if (unwrapped.success) {
                  items.push(...unwrapped.data);
                  return { data: items, diagnostics };
                }
                // Report validation errors on the unwrapped data
                for (const issue of unwrapped.error.issues) {
                  diagnostics.push({
                    code: 'SPEC_VALIDATION_ERROR',
                    severity: 'error',
                    message: issue.message,
                    source: filePath,
                    path: `${key}.${issue.path.join('.')}`,
                  });
                }
                return { data: items, diagnostics };
              }
            }
          }
        } catch {
          // YAML parsing failed in unwrapping attempt — fall through to original errors
        }
        // Neither worked — report original errors
        diagnostics.push(...result.diagnostics);
        return { data: items, diagnostics };
      }
    } catch {
      // File doesn't exist, continue
    }
  }

  // Try directory variant
  const dirPath = join(specDir, specName);
  try {
    const dirStat = await stat(dirPath);
    if (dirStat.isDirectory()) {
      const entries = await readdir(dirPath);
      for (const entry of entries.sort()) {
        const entryPath = join(dirPath, entry);
        const entryStat = await stat(entryPath);
        if (!entryStat.isFile() || !isYamlFile(entry)) {
          continue;
        }

        // Each file in a directory can be a single item or an array
        let raw: string;
        try {
          raw = await readFile(entryPath, 'utf-8');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          diagnostics.push({
            code: 'SPEC_FILE_READ_ERROR',
            severity: 'error',
            message: `Failed to read file: ${message}`,
            source: entryPath,
          });
          continue;
        }

        let parsed: unknown;
        try {
          parsed = parseYaml(raw);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          diagnostics.push({
            code: 'SPEC_YAML_PARSE_ERROR',
            severity: 'error',
            message: `Invalid YAML: ${message}`,
            source: entryPath,
          });
          continue;
        }

        if (parsed === undefined || parsed === null) {
          diagnostics.push({
            code: 'SPEC_EMPTY_FILE',
            severity: 'warning',
            message: `File ${basename(entry)} is empty`,
            source: entryPath,
          });
          continue;
        }

        if (Array.isArray(parsed)) {
          const arrayResult = schema.safeParse(parsed);
          if (arrayResult.success) {
            items.push(...arrayResult.data);
          } else {
            for (const issue of arrayResult.error.issues) {
              diagnostics.push({
                code: 'SPEC_VALIDATION_ERROR',
                severity: 'error',
                message: issue.message,
                source: entryPath,
                path: issue.path.join('.'),
              });
            }
          }
        } else {
          const singleResult = itemSchema.safeParse(parsed);
          if (singleResult.success) {
            items.push(singleResult.data);
          } else {
            for (const issue of singleResult.error.issues) {
              diagnostics.push({
                code: 'SPEC_VALIDATION_ERROR',
                severity: 'error',
                message: issue.message,
                source: entryPath,
                path: issue.path.join('.'),
              });
            }
          }
        }
      }
      return { data: items, diagnostics };
    }
  } catch {
    // Directory doesn't exist, continue
  }

  // Neither file nor directory found — that's okay, return empty
  return { data: items, diagnostics };
}

/**
 * Parse an entire spec directory and return fully validated SystemSpecs
 * or diagnostics describing any problems found.
 */
export async function parseSpecDirectory(
  specDir: string,
): Promise<{ specs: SystemSpecs | null; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = [];

  // Verify the spec directory exists
  try {
    const dirStat = await stat(specDir);
    if (!dirStat.isDirectory()) {
      diagnostics.push({
        code: 'SPEC_DIR_NOT_DIRECTORY',
        severity: 'error',
        message: `Path is not a directory: ${specDir}`,
        source: specDir,
      });
      return { specs: null, diagnostics };
    }
  } catch {
    diagnostics.push({
      code: 'SPEC_DIR_NOT_FOUND',
      severity: 'error',
      message: `Spec directory not found: ${specDir}`,
      source: specDir,
    });
    return { specs: null, diagnostics };
  }

  const [entities, capabilities, policies, invariants, modules, flows, safeEditZones, glossary] =
    await Promise.all([
      loadSpecItems(specDir, 'entities', entitiesFileSchema, entitySpecSchema),
      loadSpecItems(specDir, 'capabilities', capabilitiesFileSchema, capabilitySpecSchema),
      loadSpecItems(specDir, 'policies', policiesFileSchema, policySpecSchema),
      loadSpecItems(specDir, 'invariants', invariantsFileSchema, invariantSpecSchema),
      loadSpecItems(specDir, 'modules', modulesFileSchema, moduleSpecSchema),
      loadSpecItems(specDir, 'flows', flowsFileSchema, flowSpecSchema),
      loadSpecItems(specDir, 'safe-edit-zones', safeEditZonesFileSchema, safeEditZoneSpecSchema),
      loadSpecItems(specDir, 'glossary', glossaryFileSchema, glossaryTermSchema),
    ]);

  diagnostics.push(
    ...entities.diagnostics,
    ...capabilities.diagnostics,
    ...policies.diagnostics,
    ...invariants.diagnostics,
    ...modules.diagnostics,
    ...flows.diagnostics,
    ...safeEditZones.diagnostics,
    ...glossary.diagnostics,
  );

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  if (hasErrors) {
    return { specs: null, diagnostics };
  }

  const specs: SystemSpecs = {
    entities: entities.data,
    capabilities: capabilities.data,
    policies: policies.data,
    invariants: invariants.data,
    modules: modules.data,
    flows: flows.data,
    safeEditZones: safeEditZones.data,
    glossary: glossary.data,
  };

  return { specs, diagnostics };
}
