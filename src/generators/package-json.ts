/**
 * @module generators/package-json
 * Generates package.json with SysMARA npm scripts for the initialized project.
 */

import type { GeneratedTextFile } from './types.js';
import type { DatabaseProvider } from '../database/adapter.js';
import { requiresDocker } from './types.js';

/**
 * Generates a project package.json with SysMARA scripts, dev/prod commands,
 * and the @sysmara/core dependency.
 */
export function generatePackageJson(
  projectName: string,
  provider: DatabaseProvider,
): GeneratedTextFile {
  const dbUp = requiresDocker(provider) ? 'docker compose up -d && ' : '';

  const content = JSON.stringify({
    name: projectName,
    version: '0.0.1',
    type: 'module',
    private: true,
    scripts: {
      // SysMARA commands
      'sysmara:build': 'sysmara build',
      'sysmara:validate': 'sysmara validate',
      'sysmara:compile': 'sysmara compile',
      'sysmara:scaffold': 'sysmara scaffold',
      'sysmara:doctor': 'sysmara doctor',
      'sysmara:graph': 'sysmara graph',
      'sysmara:db:generate': 'sysmara db generate',
      'sysmara:db:migrate': 'sysmara db migrate',
      'sysmara:db:status': 'sysmara db status',
      // Shortcuts
      build: 'sysmara build',
      validate: 'sysmara validate',
      // Dev and prod
      dev: `${dbUp}sysmara build && node --watch app/server.js`,
      start: 'NODE_ENV=production node app/server.js',
      ...(requiresDocker(provider) ? {
        'db:start': 'docker compose up -d',
        'db:stop': 'docker compose down',
        'db:logs': 'docker compose logs -f db',
      } : {}),
    },
    dependencies: {
      '@sysmara/core': '^0.6.0',
    },
  }, null, 2) + '\n';

  return { path: 'package.json', content };
}
