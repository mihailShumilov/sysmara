/**
 * @module runtime/config
 * Configuration loading and resolution for SysMARA projects.
 * Reads `sysmara.config.yaml` and merges it with sensible defaults.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SysmaraConfig } from '../types/index.js';

/** Default configuration values applied when no config file or overrides are provided. */
const DEFAULT_CONFIG: SysmaraConfig = {
  name: 'sysmara-app',
  version: '0.0.0',
  specDir: './system',
  appDir: './app',
  frameworkDir: './.framework',
  generatedDir: './app/generated',
  port: 3000,
  host: '0.0.0.0',
  logLevel: 'info',
};

/**
 * Merges the provided overrides with the default SysMARA configuration.
 *
 * @param overrides - Partial configuration values that take precedence over defaults.
 * @returns A complete {@link SysmaraConfig} with all fields populated.
 */
export function loadConfig(overrides?: Partial<SysmaraConfig>): SysmaraConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Parse a minimal subset of YAML key-value pairs.
 * Handles simple `key: value` lines (strings, numbers, booleans)
 * and one level of nesting via indentation.
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection: string | null = null;
  let sectionData: Record<string, unknown> = {};

  for (const rawLine of content.split('\n')) {
    const stripped = rawLine.trimEnd();
    if (stripped.trim() === '' || stripped.trim().startsWith('#')) {
      continue;
    }

    const colonIndex = stripped.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const indent = stripped.length - stripped.trimStart().length;
    const key = stripped.slice(0, colonIndex).trim();
    let value: string | number | boolean = stripped.slice(colonIndex + 1).trim();

    // Nested key (indented under a section header)
    if (indent > 0 && currentSection) {
      sectionData[key] = parseYamlValue(value);
      continue;
    }

    // Flush previous section if any
    if (currentSection) {
      result[currentSection] = sectionData;
      currentSection = null;
      sectionData = {};
    }

    // Section header (key with no value)
    if (value === '') {
      currentSection = key;
      sectionData = {};
      continue;
    }

    result[key] = parseYamlValue(value);
  }

  // Flush final section
  if (currentSection) {
    result[currentSection] = sectionData;
  }

  return result;
}

/**
 * Parses a single YAML scalar value string into the appropriate JS type.
 *
 * @param value - The raw string value from the YAML line
 * @returns The parsed value as a string, number, or boolean
 */
function parseYamlValue(value: string): string | number | boolean {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

/**
 * Resolves a complete SysMARA configuration by reading a YAML config file
 * and merging its values with defaults. If the file does not exist or is
 * unreadable, defaults are used silently.
 *
 * @param configPath - Absolute path to `sysmara.config.yaml`. Defaults to `<cwd>/sysmara.config.yaml`.
 * @returns A fully populated {@link SysmaraConfig}.
 */
export function resolveConfig(configPath?: string): SysmaraConfig {
  const filePath = configPath ?? path.join(process.cwd(), 'sysmara.config.yaml');

  let fileOverrides: Partial<SysmaraConfig> = {};

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseSimpleYaml(content);

    // Only pick known config keys
    const knownKeys: Array<keyof SysmaraConfig> = [
      'name', 'version', 'specDir', 'appDir', 'frameworkDir',
      'generatedDir', 'port', 'host', 'logLevel', 'database',
    ];

    for (const key of knownKeys) {
      if (key in parsed) {
        (fileOverrides as Record<string, unknown>)[key] = parsed[key];
      }
    }
  } catch {
    // Config file not found or unreadable — use defaults
  }

  return loadConfig(fileOverrides);
}
