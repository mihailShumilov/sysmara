/**
 * @module generators/server-entry
 * Generates a runnable server.ts entry point that auto-wires
 * all capability handlers to HTTP routes.
 */

import type { SystemSpecs, CapabilitySpec } from '../types/index.js';
import type { DatabaseProvider } from '../database/adapter.js';
import type { AdapterName } from '../database/adapter.js';

/** A generated text file with a relative path and string content. */
interface GeneratedTextFile {
  path: string;
  content: string;
}

/**
 * Infers the HTTP method and URL path from a capability name.
 */
function inferRoute(cap: CapabilitySpec): { method: string; path: string } {
  const name = cap.name.toLowerCase();
  const primaryEntity = cap.entities[0] ?? 'resource';
  const plural = primaryEntity.endsWith('s') ? primaryEntity : primaryEntity + 's';
  const basePath = `/${plural}`;

  if (name.startsWith('create_') || name.startsWith('add_') || name.startsWith('register_')) {
    return { method: 'POST', path: basePath };
  }
  if (name.startsWith('list_') || name.startsWith('get_all_') || name.startsWith('search_')) {
    return { method: 'GET', path: basePath };
  }
  if (name.startsWith('get_') || name.startsWith('find_') || name.startsWith('fetch_')) {
    return { method: 'GET', path: `${basePath}/:id` };
  }
  if (name.startsWith('update_') || name.startsWith('edit_') || name.startsWith('modify_')) {
    return { method: 'PUT', path: `${basePath}/:id` };
  }
  if (name.startsWith('assign_') || name.startsWith('complete_')) {
    return { method: 'PATCH', path: `${basePath}/:id` };
  }
  if (name.startsWith('delete_') || name.startsWith('remove_') || name.startsWith('deactivate_')) {
    return { method: 'DELETE', path: `${basePath}/:id` };
  }

  return { method: 'POST', path: `/${name.replace(/_/g, '-')}` };
}

function toPascalCase(name: string): string {
  return name
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Generates a server.ts entry point that imports all scaffolded capability
 * handlers and registers them as routes on SysmaraServer.
 */
export function generateServerEntry(
  specs: SystemSpecs,
  options: {
    db?: DatabaseProvider;
    orm?: AdapterName;
    connectionString?: string;
    port?: number;
  } = {},
): GeneratedTextFile {
  const db = options.db ?? 'sqlite';
  const orm = options.orm ?? 'sysmara-orm';
  const port = options.port ?? 3000;
  const connStr = options.connectionString ?? (db === 'sqlite' ? 'sqlite://./data.db' : '');

  // Generate imports for each capability handler
  const capImports = specs.capabilities
    .map((cap) => {
      const pascal = toPascalCase(cap.name);
      return `import { handle${pascal}, setOrm as setOrm${pascal} } from './capabilities/${cap.name}.js';`;
    })
    .join('\n');

  // Generate ORM setter calls
  const ormSetters = specs.capabilities
    .map((cap) => {
      const pascal = toPascalCase(cap.name);
      return `  setOrm${pascal}(orm);`;
    })
    .join('\n');

  // Generate route registrations
  const routeRegistrations = specs.capabilities
    .map((cap) => {
      const { method, path } = inferRoute(cap);
      const pascal = toPascalCase(cap.name);
      const methodLower = method.toLowerCase();
      return `  server.${methodLower}('${path}', '${cap.name}', handle${pascal});`;
    })
    .join('\n');

  const content = `// ============================================================
// GENERATED SERVER ENTRY POINT
// Edit Zone: editable — generated once, safe to modify
// Re-generate with: sysmara build
// ============================================================

import { SysmaraServer, SysmaraORM, resolveConfig } from '@sysmara/core';
import type { DatabaseAdapterConfig } from '@sysmara/core';

// Import capability handlers
${capImports}

async function main(): Promise<void> {
  // Load config
  const config = resolveConfig();

  // Database configuration
  const dbConfig: DatabaseAdapterConfig = config.database ?? {
    adapter: '${orm}',
    provider: '${db}',
    connectionString: '${connStr}',
  };

  // Initialize ORM
  const orm = new SysmaraORM(dbConfig, {
    entities: [], capabilities: [], policies: [], invariants: [],
    modules: [], flows: [], safeEditZones: [], glossary: [],
  });
  await orm.connect();
  await orm.applySchema();

  // Inject ORM into capability handlers
${ormSetters}

  // Create server
  const port = config.port ?? ${port};
  const host = config.host ?? '0.0.0.0';
  const server = new SysmaraServer({ port, host });

  // Register routes
${routeRegistrations}

  // Graceful shutdown
  server.onShutdown(async () => {
    await orm.disconnect();
  });

  // Start
  await server.start();
  console.log(\`SysMARA server running at http://\${host === '0.0.0.0' ? 'localhost' : host}:\${port}\`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
`;

  return { path: 'server.ts', content };
}
