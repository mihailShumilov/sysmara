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
  // Status transitions: publish, archive, approve, reject, submit, moderate, flag, suspend, activate, close, reopen, cancel, verify, ban, unban, lock, unlock, pin, unpin, feature, unfeature, hide, unhide
  const statusVerbs = ['publish_', 'archive_', 'approve_', 'reject_', 'submit_', 'moderate_', 'flag_', 'suspend_', 'activate_', 'close_', 'reopen_', 'cancel_', 'verify_', 'ban_', 'unban_', 'lock_', 'unlock_', 'pin_', 'unpin_', 'feature_', 'unfeature_', 'hide_', 'unhide_'];
  if (statusVerbs.some((v) => name.startsWith(v))) {
    const verb = name.split('_')[0];
    return { method: 'PATCH', path: `${basePath}/:id/${verb}` };
  }
  // Association operations: tag, untag, link, unlink, invite, kick, assign, unassign
  const assocVerbs = ['tag_', 'untag_', 'link_', 'unlink_', 'invite_', 'kick_'];
  if (assocVerbs.some((v) => name.startsWith(v))) {
    const verb = name.split('_')[0];
    return { method: 'POST', path: `${basePath}/:id/${verb}` };
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

import { SysmaraServer, SysmaraORM, resolveConfig, parseSpecDirectory } from '@sysmara/core';
import type { DatabaseAdapterConfig, ActorContext } from '@sysmara/core';
import type { IncomingMessage } from 'node:http';
import * as path from 'node:path';

// Import capability handlers
${capImports}

/**
 * Extract actor identity from HTTP headers.
 * Send X-Actor-Id and X-Actor-Roles headers to authenticate.
 * Without these headers, requests are treated as anonymous.
 */
function headerActorExtractor(req: IncomingMessage): Promise<ActorContext> {
  const id = (req.headers['x-actor-id'] as string) ?? 'anonymous';
  const rolesHeader = (req.headers['x-actor-roles'] as string) ?? '';
  const roles = rolesHeader ? rolesHeader.split(',').map(r => r.trim()) : [];
  return Promise.resolve({ id, roles, attributes: {} });
}

async function main(): Promise<void> {
  // Load config
  const config = resolveConfig();

  // Parse specs to pass to ORM for schema generation
  const specDir = path.resolve(process.cwd(), config.specDir ?? 'system');
  const parsed = await parseSpecDirectory(specDir);
  if (!parsed.specs) {
    console.error('Failed to parse specs. Run "sysmara validate" for details.');
    process.exit(1);
  }
  const specs = parsed.specs;

  // Database configuration
  const dbConfig: DatabaseAdapterConfig = config.database ?? {
    adapter: '${orm}',
    provider: '${db}',
    connectionString: '${connStr}',
  };

  // Initialize ORM with real specs
  const orm = new SysmaraORM(dbConfig, specs);
  await orm.connect();
  await orm.applySchema();

  // Inject ORM into capability handlers
${ormSetters}

  // Create server with header-based actor extraction
  const port = config.port ?? ${port};
  const host = config.host ?? '0.0.0.0';
  const server = new SysmaraServer({ port, host, actorExtractor: headerActorExtractor });

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
