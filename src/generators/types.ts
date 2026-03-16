/**
 * @module generators/types
 * Shared types for file generators.
 */

import type { DatabaseProvider } from '../database/adapter.js';

/**
 * A generated text file with a relative path and string content.
 */
export interface GeneratedTextFile {
  path: string;
  content: string;
}

/**
 * Returns true if the database provider requires a Docker container (PostgreSQL, MySQL).
 * SQLite uses a local file and does not need Docker.
 */
export function requiresDocker(provider: DatabaseProvider): boolean {
  return provider !== 'sqlite';
}
