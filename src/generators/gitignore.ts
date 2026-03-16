/**
 * @module generators/gitignore
 * Generates a comprehensive .gitignore file for SysMARA projects.
 */

import type { GeneratedTextFile } from './types.js';
import type { DatabaseProvider } from '../database/adapter.js';

/**
 * Generates .gitignore with entries for Node.js, SysMARA framework,
 * environment files, and database-specific paths.
 */
export function generateGitignore(provider: DatabaseProvider): GeneratedTextFile {
  const sqliteEntry = provider === 'sqlite' ? '\n# SQLite data\ndata/\n*.db\n' : '';

  const content = `# Dependencies
node_modules/

# Build output
dist/

# SysMARA framework metadata
.framework/

# Environment files — never commit secrets
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/

# TypeScript
*.tsbuildinfo
${sqliteEntry}`;

  return { path: '.gitignore', content };
}
