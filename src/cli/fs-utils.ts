/**
 * @module cli/fs-utils
 * Shared filesystem utilities for CLI commands.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Creates a directory (and any missing parent directories) if it does not already exist.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Writes a UTF-8 text file, creating any missing parent directories first.
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}
