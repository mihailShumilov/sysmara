import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SysmaraConfig } from '../types/index.js';

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

export function loadConfig(overrides?: Partial<SysmaraConfig>): SysmaraConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Parse a minimal subset of YAML key-value pairs.
 * Handles simple `key: value` lines (strings, numbers, booleans).
 * Does not handle nested objects, arrays, or multi-line values.
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value: string | number | boolean = line.slice(colonIndex + 1).trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else if (value === 'true') {
      result[key] = true;
      continue;
    } else if (value === 'false') {
      result[key] = false;
      continue;
    } else if (value !== '' && !Number.isNaN(Number(value))) {
      result[key] = Number(value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

export function resolveConfig(configPath?: string): SysmaraConfig {
  const filePath = configPath ?? path.join(process.cwd(), 'sysmara.config.yaml');

  let fileOverrides: Partial<SysmaraConfig> = {};

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseSimpleYaml(content);

    // Only pick known config keys
    const knownKeys: Array<keyof SysmaraConfig> = [
      'name', 'version', 'specDir', 'appDir', 'frameworkDir',
      'generatedDir', 'port', 'host', 'logLevel',
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
