/**
 * @module cli/commands/start
 * CLI command that starts the SysMARA application server.
 * Parses specs, connects to the database, auto-wires capability handlers
 * to HTTP routes, applies schema, and starts the server.
 */

import * as path from 'node:path';
import type { SysmaraConfig, HandlerContext, CapabilitySpec } from '../../types/index.js';
import { parseSpecDirectory } from '../../spec/index.js';
import { SysmaraServer } from '../../runtime/server.js';
import { SysmaraORM } from '../../database/adapters/sysmara-orm/orm.js';
import type { DatabaseAdapterConfig, DatabaseProvider } from '../../database/adapter.js';
import type { AdapterName } from '../../database/adapter.js';
import { header, success, error, info } from '../format.js';

/**
 * Infers the HTTP method and URL path from a capability name and its entities.
 *
 * Convention:
 * - create_<entity>   → POST   /<entities>
 * - get_<entity>      → GET    /<entities>/:id
 * - list_<entity>s    → GET    /<entities>
 * - update_<entity>   → PUT    /<entities>/:id
 * - delete_<entity>   → DELETE /<entities>/:id
 *
 * Falls back to POST /<capability_name> for unrecognized patterns.
 */
function inferRoute(cap: CapabilitySpec): { method: string; path: string } {
  const name = cap.name.toLowerCase();
  const primaryEntity = cap.entities[0] ?? 'resource';

  // Pluralize entity name (simple heuristic)
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

  // Fallback
  return { method: 'POST', path: `/${name.replace(/_/g, '-')}` };
}

/**
 * Infers the CRUD operation from a capability name.
 */
function inferOperation(name: string): 'create' | 'read' | 'list' | 'update' | 'delete' {
  const n = name.toLowerCase();
  if (n.startsWith('create_') || n.startsWith('add_') || n.startsWith('register_')) return 'create';
  if (n.startsWith('list_') || n.startsWith('get_all_') || n.startsWith('search_')) return 'list';
  if (n.startsWith('update_') || n.startsWith('edit_') || n.startsWith('modify_') || n.startsWith('assign_') || n.startsWith('complete_')) return 'update';
  if (n.startsWith('delete_') || n.startsWith('remove_') || n.startsWith('deactivate_')) return 'delete';
  return 'read';
}

/**
 * Creates a generic handler for a capability that routes through the ORM.
 */
function createCapabilityHandler(
  cap: CapabilitySpec,
  orm: SysmaraORM,
): (ctx: HandlerContext) => Promise<unknown> {
  const op = inferOperation(cap.name);
  const primaryEntity = cap.entities[0] ?? 'unknown';

  return async (ctx: HandlerContext): Promise<unknown> => {
    const repo = orm.repository<Record<string, unknown>>(primaryEntity, cap.name);

    switch (op) {
      case 'create': {
        const input = (ctx.body ?? {}) as Record<string, unknown>;
        // Validate required input fields
        for (const field of cap.input) {
          if (field.required && !(field.name in input)) {
            return {
              error: {
                code: 'VALIDATION_ERROR',
                message: `Missing required field: ${field.name}`,
                capability: cap.name,
              },
            };
          }
        }
        const result = await repo.create(input);
        return result;
      }
      case 'read': {
        const id = ctx.params.id;
        if (!id) {
          return { error: { code: 'BAD_REQUEST', message: 'Missing id parameter', capability: cap.name } };
        }
        const result = await repo.findById(id);
        if (!result) {
          return { error: { code: 'NOT_FOUND', message: `${primaryEntity} not found`, capability: cap.name } };
        }
        return result;
      }
      case 'list': {
        const filters = ctx.query as unknown as Record<string, unknown>;
        const results = await repo.findMany(Object.keys(filters).length > 0 ? filters : undefined);
        return { items: results, count: results.length };
      }
      case 'update': {
        const id = ctx.params.id;
        if (!id) {
          return { error: { code: 'BAD_REQUEST', message: 'Missing id parameter', capability: cap.name } };
        }
        const data = (ctx.body ?? {}) as Record<string, unknown>;
        const result = await repo.update(id, data);
        return result;
      }
      case 'delete': {
        const id = ctx.params.id;
        if (!id) {
          return { error: { code: 'BAD_REQUEST', message: 'Missing id parameter', capability: cap.name } };
        }
        await repo.delete(id);
        return { success: true, deleted: id };
      }
    }
  };
}

/**
 * Starts the SysMARA server with auto-wired routes from specs.
 *
 * @param cwd - Current working directory (project root).
 * @param config - Resolved SysMARA project configuration.
 * @param flags - Additional flags (--no-schema, --port, etc.)
 */
export async function commandStart(
  cwd: string,
  config: SysmaraConfig,
  flags: Record<string, string> = {},
): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);
  console.log(header('SysMARA Server'));

  // 1. Parse specs
  console.log('\n  Parsing specs...');
  const result = await parseSpecDirectory(specDir);

  if (!result.specs) {
    console.error(error('Failed to parse specs. Run "sysmara validate" for details.'));
    process.exit(1);
  }

  const specs = result.specs;
  console.log(info(
    `Found ${specs.entities.length} entities, ${specs.capabilities.length} capabilities`
  ));

  // 2. Connect to database
  console.log('\n  Connecting to database...');
  const dbConfig: DatabaseAdapterConfig = {
    adapter: (config.database?.adapter ?? 'sysmara-orm') as AdapterName,
    provider: (config.database?.provider ?? 'sqlite') as DatabaseProvider,
    connectionString: config.database?.connectionString ?? 'sqlite://./data.db',
  };

  const orm = new SysmaraORM(dbConfig, specs);
  await orm.connect();
  console.log(info(`Connected to ${dbConfig.provider} (${dbConfig.adapter})`));

  // 3. Apply schema (create tables)
  const skipSchema = flags['no-schema'] !== undefined;
  if (!skipSchema) {
    console.log('  Applying database schema...');
    await orm.applySchema();
    console.log(info('Schema applied (tables created if not existing)'));
  }

  // 4. Create server
  const port = flags.port ? parseInt(flags.port, 10) : config.port;
  const host = flags.host ?? config.host;
  const server = new SysmaraServer({ port, host });

  // 5. Auto-wire capability routes
  console.log('\n  Registering routes...');
  const registeredRoutes: Array<{ method: string; path: string; capability: string }> = [];

  for (const cap of specs.capabilities) {
    const { method, path: routePath } = inferRoute(cap);
    const handler = createCapabilityHandler(cap, orm);
    server.route(method, routePath, cap.name, handler);
    registeredRoutes.push({ method, path: routePath, capability: cap.name });
    console.log(info(`${method.padEnd(6)} ${routePath.padEnd(25)} → ${cap.name}`));
  }

  // 6. Register shutdown handler
  server.onShutdown(async () => {
    console.log('  Closing database connection...');
    await orm.disconnect();
  });

  // 7. Start server
  console.log('');
  await server.start();
  console.log(success(`Server running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
  console.log(info(`${registeredRoutes.length} capability routes + health/routes endpoints`));
  console.log('');
  console.log('  Routes:');
  console.log(`    GET  /health                → system:health`);
  console.log(`    GET  /_sysmara/routes       → system:routes`);
  for (const r of registeredRoutes) {
    console.log(`    ${r.method.padEnd(6)} ${r.path.padEnd(25)} → ${r.capability}`);
  }
  console.log('');
  console.log('  Press Ctrl+C to stop.');
}
