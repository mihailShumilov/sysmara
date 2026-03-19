/**
 * @module runtime/config
 * Configuration loading and resolution for SysMARA projects.
 * Reads `sysmara.config.yaml` and merges it with sensible defaults.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
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
    const parsed = parseYaml(content) as Record<string, unknown> | null;

    if (parsed && typeof parsed === 'object') {
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
    }
  } catch {
    // Config file not found or unreadable — use defaults
  }

  return loadConfig(fileOverrides);
}
