/**
 * @module generators/env
 * Generates environment files (.env.example, .env.local) based on
 * the selected database provider and adapter.
 */

import type { DatabaseProvider } from '../database/adapter.js';

interface GeneratedTextFile {
  path: string;
  content: string;
}

/**
 * Returns the default local development connection string for a database provider.
 */
export function connectionString(provider: DatabaseProvider): string {
  switch (provider) {
    case 'postgresql':
      return 'postgresql://sysmara:sysmara@localhost:5432/sysmara_dev';
    case 'mysql':
      return 'mysql://sysmara:sysmara@localhost:3306/sysmara_dev';
    case 'sqlite':
      return 'file:./data/dev.db';
  }
}

/**
 * Generates .env.example with documented placeholder variables.
 */
export function generateEnvExample(provider: DatabaseProvider): GeneratedTextFile {
  const content = `# SysMARA Environment Variables
# Copy this file to .env.local and fill in real values.

# Database connection string
# ${provider === 'postgresql' ? 'postgresql://user:password@host:5432/dbname' : provider === 'mysql' ? 'mysql://user:password@host:3306/dbname' : 'file:./data/dev.db'}
DATABASE_URL=

# Server
PORT=3000
HOST=0.0.0.0

# Logging: debug | info | warn | error
LOG_LEVEL=info

# Environment: development | production | test
NODE_ENV=development
`;

  return { path: '.env.example', content };
}

/**
 * Generates .env.local with local development defaults.
 * This file is gitignored and contains actual connection credentials.
 */
export function generateEnvLocal(provider: DatabaseProvider): GeneratedTextFile {
  const content = `# Local development environment — DO NOT COMMIT
DATABASE_URL=${connectionString(provider)}
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug
NODE_ENV=development
`;

  return { path: '.env.local', content };
}
