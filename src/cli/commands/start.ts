/**
 * @module cli/commands/start
 * CLI command that starts the SysMARA application server.
 * Parses specs, connects to the database, auto-wires capability handlers
 * to HTTP routes, applies schema, and starts the server.
 */

import * as path from 'node:path';
import type { IncomingMessage } from 'node:http';
import type { SysmaraConfig, HandlerContext, CapabilitySpec, SystemSpecs, EntitySpec, ActorContext } from '../../types/index.js';
import { parseSpecDirectory } from '../../spec/index.js';
import { SysmaraServer } from '../../runtime/server.js';
import { SysmaraORM } from '../../database/adapters/sysmara-orm/orm.js';
import type { DatabaseAdapterConfig, DatabaseProvider } from '../../database/adapter.js';
import type { AdapterName } from '../../database/adapter.js';
import { header, success, error, info } from '../format.js';

/**
 * Extract actor identity from HTTP headers.
 * Reads X-Actor-Id and X-Actor-Roles from the request.
 */
function headerActorExtractor(req: IncomingMessage): Promise<ActorContext> {
  const id = (req.headers['x-actor-id'] as string) ?? 'anonymous';
  const rolesHeader = (req.headers['x-actor-roles'] as string) ?? '';
  const roles = rolesHeader ? rolesHeader.split(',').map(r => r.trim()) : [];
  return Promise.resolve({ id, roles, attributes: {} });
}

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
 * Infers the operation type from a capability name.
 */
type OperationType = 'create' | 'read' | 'list' | 'update' | 'delete' | 'status_transition' | 'associate' | 'dissociate';

function inferOperation(name: string): OperationType {
  const n = name.toLowerCase();
  if (n.startsWith('create_') || n.startsWith('add_') || n.startsWith('register_')) return 'create';
  if (n.startsWith('list_') || n.startsWith('get_all_') || n.startsWith('search_')) return 'list';
  if (n.startsWith('update_') || n.startsWith('edit_') || n.startsWith('modify_')) return 'update';
  if (n.startsWith('delete_') || n.startsWith('remove_') || n.startsWith('deactivate_')) return 'delete';
  if (n.startsWith('get_') || n.startsWith('find_') || n.startsWith('fetch_')) return 'read';

  // Status transition operations
  if (n.startsWith('publish_') || n.startsWith('archive_') || n.startsWith('activate_')
    || n.startsWith('suspend_') || n.startsWith('close_') || n.startsWith('reopen_')
    || n.startsWith('approve_') || n.startsWith('reject_') || n.startsWith('cancel_')
    || n.startsWith('complete_') || n.startsWith('assign_')
    || n.startsWith('submit_') || n.startsWith('moderate_') || n.startsWith('flag_')
    || n.startsWith('unflag_') || n.startsWith('verify_') || n.startsWith('block_')
    || n.startsWith('unblock_')) return 'status_transition';

  // Association operations
  if (n.startsWith('tag_') || n.startsWith('link_') || n.startsWith('invite_')) return 'associate';
  if (n.startsWith('untag_') || n.startsWith('unlink_') || n.startsWith('kick_')) return 'dissociate';

  return 'read';
}

/**
 * Infers the target status from a capability name.
 */
function inferTargetStatus(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith('publish_')) return 'published';
  if (n.startsWith('archive_')) return 'archived';
  if (n.startsWith('activate_')) return 'active';
  if (n.startsWith('suspend_')) return 'suspended';
  if (n.startsWith('close_')) return 'closed';
  if (n.startsWith('reopen_')) return 'open';
  if (n.startsWith('approve_')) return 'approved';
  if (n.startsWith('reject_')) return 'rejected';
  if (n.startsWith('cancel_')) return 'cancelled';
  if (n.startsWith('complete_')) return 'completed';
  if (n.startsWith('flag_')) return 'flagged';
  if (n.startsWith('unflag_')) return 'approved';
  if (n.startsWith('verify_')) return 'verified';
  if (n.startsWith('block_')) return 'blocked';
  if (n.startsWith('unblock_')) return 'active';
  if (n.includes('_for_review')) return 'in_review';
  if (n.startsWith('submit_')) return 'submitted';
  if (n.startsWith('moderate_')) return 'moderated';
  if (n.startsWith('assign_')) return 'assigned';
  return 'updated';
}

/**
 * Returns a sensible default value for an entity field.
 * Used to populate required entity fields that the capability input doesn't provide.
 * Inspects field name, type, description, and constraints for hints.
 */
function defaultForField(field: { name: string; type: string; description?: string; constraints?: Array<{ type: string; value: unknown }> }): unknown {
  // Check for enum constraint — use first enum value
  if (field.constraints) {
    const enumConstraint = field.constraints.find(c => c.type === 'enum');
    if (enumConstraint && Array.isArray(enumConstraint.value) && enumConstraint.value.length > 0) {
      return enumConstraint.value[0];
    }
  }

  // Check description for pipe-separated values (e.g., "pending | in_progress | done")
  if (field.description) {
    const pipeMatch = field.description.match(/^(\w+)\s*\|/);
    if (pipeMatch) {
      return pipeMatch[1];
    }
  }

  // Common field name heuristics
  const name = field.name.toLowerCase();
  if (name === 'status') return 'pending';
  if (name === 'role') return 'user';
  if (name === 'type' || name === 'kind') return 'default';

  switch (field.type.toLowerCase()) {
    case 'string':
    case 'text':
    case 'enum':
      return '';
    case 'number':
    case 'integer':
    case 'float':
    case 'decimal':
    case 'bigint':
      return 0;
    case 'boolean':
    case 'bool':
      return false;
    default:
      return '';
  }
}

/**
 * Creates a generic handler for a capability that routes through the ORM.
 */
function createCapabilityHandler(
  cap: CapabilitySpec,
  orm: SysmaraORM,
  specs: SystemSpecs,
): (ctx: HandlerContext) => Promise<unknown> {
  const op = inferOperation(cap.name);
  const primaryEntity = cap.entities[0] ?? 'unknown';
  const entity = specs.entities.find((e: EntitySpec) => e.name === primaryEntity);

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
        // Auto-fill required entity fields not in input (e.g., status defaults)
        if (entity) {
          const inputFieldNames = new Set(cap.input.map(f => f.name));
          for (const field of entity.fields) {
            if (field.required && !(field.name in input) && !inputFieldNames.has(field.name)
                && field.name !== 'id' && field.name !== 'created_at' && field.name !== 'updated_at') {
              input[field.name] = defaultForField(field);
            }
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
        const { limit: limitStr, offset: offsetStr, order_by, order_dir, ...filterParams } = ctx.query as Record<string, string>;
        const limit = limitStr ? parseInt(limitStr, 10) : 50;
        const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
        const results = await repo.findMany(
          Object.keys(filterParams).length > 0 ? filterParams : undefined,
          { limit, offset, orderBy: order_by, orderDir: order_dir as 'ASC' | 'DESC' | undefined },
        );
        return { items: results, count: results.length, limit, offset };
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
      case 'status_transition': {
        const id = ctx.params.id ?? ((ctx.body as Record<string, unknown>)?.id as string);
        if (!id) {
          return { error: { code: 'BAD_REQUEST', message: 'Missing id parameter', capability: cap.name } };
        }
        const existing = await repo.findById(id);
        if (!existing) {
          return { error: { code: 'NOT_FOUND', message: `${primaryEntity} not found`, capability: cap.name } };
        }
        const targetStatus = inferTargetStatus(cap.name);
        const extraData = (ctx.body ?? {}) as Record<string, unknown>;
        delete extraData.id;
        const result = await repo.update(id, { ...extraData, status: targetStatus });
        return result;
      }
      case 'associate': {
        const assocEntity = (cap.entities.length > 1 ? cap.entities[1] : primaryEntity) as string;
        const assocRepo = orm.repository<Record<string, unknown>>(assocEntity, cap.name);
        const input = (ctx.body ?? {}) as Record<string, unknown>;
        const result = await assocRepo.create(input);
        return result;
      }
      case 'dissociate': {
        const assocEntity = (cap.entities.length > 1 ? cap.entities[1] : primaryEntity) as string;
        const assocRepo = orm.repository<Record<string, unknown>>(assocEntity, cap.name);
        const id = ctx.params.id ?? ((ctx.body as Record<string, unknown>)?.id as string);
        if (!id) {
          return { error: { code: 'BAD_REQUEST', message: 'Missing id parameter', capability: cap.name } };
        }
        await assocRepo.delete(id);
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
  const server = new SysmaraServer({ port, host, actorExtractor: headerActorExtractor });

  // 5. Auto-wire capability routes
  console.log('\n  Registering routes...');
  const registeredRoutes: Array<{ method: string; path: string; capability: string }> = [];

  for (const cap of specs.capabilities) {
    const { method, path: routePath } = inferRoute(cap);
    const handler = createCapabilityHandler(cap, orm, specs);
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
