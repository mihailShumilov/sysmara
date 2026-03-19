/**
 * End-to-end test: TODO service with real SQLite database (better-sqlite3)
 *
 * Same scenario as e2e-todo-crud.test.ts but using a real SQLite driver
 * instead of the in-memory abstraction. Proves the full stack works:
 *   YAML specs → parse → real DB connection → schema creation → HTTP CRUD
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSpecDirectory } from '../../src/spec/index.js';
import { SysmaraServer } from '../../src/runtime/server.js';
import { SysmaraORM } from '../../src/database/adapters/sysmara-orm/orm.js';
import type { CapabilitySpec, HandlerContext } from '../../src/types/index.js';

// ─── Spec YAML: TODO service ─────────────────────────────────────────

const ENTITIES_YAML = `entities:
  - name: todo
    description: A task item
    module: tasks
    fields:
      - name: id
        type: string
        required: true
        description: Unique identifier
      - name: title
        type: string
        required: true
        description: Task title
      - name: description
        type: string
        required: false
        description: Task description
      - name: status
        type: string
        required: true
        description: pending | in_progress | done
      - name: priority
        type: number
        required: false
        description: Priority level (1-5)
      - name: created_at
        type: date
        required: true
        description: Creation timestamp
`;

const CAPABILITIES_YAML = `capabilities:
  - name: create_todo
    description: Creates a new TODO item
    module: tasks
    entities: [todo]
    input:
      - { name: title, type: string, required: true }
      - { name: description, type: string, required: false }
      - { name: priority, type: number, required: false }
    output:
      - { name: todo, type: reference, required: true }
    policies: []
    invariants: []

  - name: get_todo
    description: Get a single TODO by ID
    module: tasks
    entities: [todo]
    input:
      - { name: id, type: string, required: true }
    output:
      - { name: todo, type: reference, required: true }
    policies: []
    invariants: []
    idempotent: true

  - name: list_todos
    description: List all TODOs
    module: tasks
    entities: [todo]
    input: []
    output:
      - { name: todos, type: reference, required: true }
    policies: []
    invariants: []
    idempotent: true

  - name: update_todo
    description: Update a TODO item
    module: tasks
    entities: [todo]
    input:
      - { name: id, type: string, required: true }
      - { name: title, type: string, required: false }
      - { name: status, type: string, required: false }
      - { name: priority, type: number, required: false }
    output:
      - { name: todo, type: reference, required: true }
    policies: []
    invariants: []

  - name: delete_todo
    description: Delete a TODO item
    module: tasks
    entities: [todo]
    input:
      - { name: id, type: string, required: true }
    output:
      - { name: success, type: boolean, required: true }
    policies: []
    invariants: []
`;

const MODULES_YAML = `modules:
  - name: tasks
    description: Task management
    entities: [todo]
    capabilities: [create_todo, get_todo, list_todos, update_todo, delete_todo]
    allowedDependencies: []
    forbiddenDependencies: []
`;

const POLICIES_YAML = `policies: []`;
const INVARIANTS_YAML = `invariants: []`;
const FLOWS_YAML = `flows: []`;
const SAFE_EDIT_ZONES_YAML = `safeEditZones: []`;
const GLOSSARY_YAML = `glossary:
  - term: todo
    definition: A task in the system
`;

// ─── Route helpers ───────────────────────────────────────────────────

function inferRoute(cap: CapabilitySpec): { method: string; path: string } {
  const name = cap.name.toLowerCase();
  const entity = cap.entities[0] ?? 'resource';
  const base = `/${entity.endsWith('s') ? entity : entity + 's'}`;

  if (name.startsWith('create_')) return { method: 'POST', path: base };
  if (name.startsWith('list_'))   return { method: 'GET', path: base };
  if (name.startsWith('get_'))    return { method: 'GET', path: `${base}/:id` };
  if (name.startsWith('update_')) return { method: 'PUT', path: `${base}/:id` };
  if (name.startsWith('delete_')) return { method: 'DELETE', path: `${base}/:id` };
  return { method: 'POST', path: `/${name.replace(/_/g, '-')}` };
}

function inferOp(name: string): 'create' | 'read' | 'list' | 'update' | 'delete' {
  const n = name.toLowerCase();
  if (n.startsWith('create_')) return 'create';
  if (n.startsWith('list_'))   return 'list';
  if (n.startsWith('update_')) return 'update';
  if (n.startsWith('delete_')) return 'delete';
  return 'read';
}

function makeHandler(cap: CapabilitySpec, orm: SysmaraORM) {
  const op = inferOp(cap.name);
  const entity = cap.entities[0]!;

  return async (ctx: HandlerContext): Promise<unknown> => {
    const repo = orm.repository<Record<string, unknown>>(entity, cap.name);
    switch (op) {
      case 'create': {
        const input = (ctx.body ?? {}) as Record<string, unknown>;
        return repo.create({ ...input, status: input.status ?? 'pending' });
      }
      case 'read': {
        const result = await repo.findById(ctx.params.id!);
        if (!result) return { error: { code: 'NOT_FOUND', message: `${entity} not found` } };
        return result;
      }
      case 'list': {
        const items = await repo.findMany();
        return { items, count: items.length };
      }
      case 'update':
        return repo.update(ctx.params.id!, (ctx.body ?? {}) as Record<string, unknown>);
      case 'delete': {
        await repo.delete(ctx.params.id!);
        return { success: true, deleted: ctx.params.id };
      }
    }
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  return { status: res.status, body: await res.json() as unknown };
}

// ─── Test suite ──────────────────────────────────────────────────────

describe('E2E: TODO service with real SQLite (better-sqlite3)', () => {
  let tmpDir: string;
  let server: SysmaraServer;
  let orm: SysmaraORM;
  let baseUrl: string;

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // 1. Create project directory with spec YAML files
    tmpDir = await mkdtemp(join(tmpdir(), 'sysmara-e2e-sqlite-'));
    const specDir = join(tmpDir, 'system');
    await mkdir(specDir, { recursive: true });

    await writeFile(join(specDir, 'entities.yaml'), ENTITIES_YAML);
    await writeFile(join(specDir, 'capabilities.yaml'), CAPABILITIES_YAML);
    await writeFile(join(specDir, 'policies.yaml'), POLICIES_YAML);
    await writeFile(join(specDir, 'invariants.yaml'), INVARIANTS_YAML);
    await writeFile(join(specDir, 'modules.yaml'), MODULES_YAML);
    await writeFile(join(specDir, 'flows.yaml'), FLOWS_YAML);
    await writeFile(join(specDir, 'safe-edit-zones.yaml'), SAFE_EDIT_ZONES_YAML);
    await writeFile(join(specDir, 'glossary.yaml'), GLOSSARY_YAML);

    // 2. Parse specs
    const result = await parseSpecDirectory(specDir);
    expect(result.specs).toBeTruthy();
    const specs = result.specs!;
    expect(specs.entities).toHaveLength(1);
    expect(specs.capabilities).toHaveLength(5);

    // 3. Create ORM with REAL SQLite driver (:memory: for test isolation)
    const dbPath = join(tmpDir, 'test.db');
    orm = new SysmaraORM(
      { adapter: 'sysmara-orm', provider: 'sqlite', connectionString: dbPath },
      specs,
    );
    await orm.connect();
    expect(orm.isConnected()).toBe(true);

    // 4. Apply schema — creates real SQLite tables
    await orm.applySchema();

    // 5. Start HTTP server with auto-wired routes
    server = new SysmaraServer({ port: 0, host: '127.0.0.1', logLevel: 'error' });
    for (const cap of specs.capabilities) {
      const { method, path } = inferRoute(cap);
      server.route(method, path, cap.name, makeHandler(cap, orm));
    }
    await server.start();

    const addr = server.getAddress();
    expect(addr).toBeTruthy();
    baseUrl = `http://127.0.0.1:${addr!.port}`;
  });

  afterAll(async () => {
    await server?.stop();
    await orm?.disconnect();
    await rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ─── Health & routes ───────────────────────────────────────────

  it('health check works', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/health`);
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).status).toBe('ok');
  });

  it('all 5 capability routes are registered', async () => {
    const { body } = await fetchJson(`${baseUrl}/_sysmara/routes`);
    const routes = body as Array<{ capability: string }>;
    const caps = routes.map(r => r.capability);
    expect(caps).toContain('create_todo');
    expect(caps).toContain('get_todo');
    expect(caps).toContain('list_todos');
    expect(caps).toContain('update_todo');
    expect(caps).toContain('delete_todo');
  });

  // ─── CREATE ────────────────────────────────────────────────────

  let todoId1: string;
  let todoId2: string;

  it('creates first todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Write tests', description: 'E2E with SQLite', priority: 1 }),
    });
    expect(status).toBe(200);
    const todo = body as Record<string, unknown>;
    expect(todo.title).toBe('Write tests');
    expect(todo.description).toBe('E2E with SQLite');
    expect(todo.priority).toBe(1);
    expect(todo.status).toBe('pending');
    expect(todo.id).toBeDefined();
    todoId1 = todo.id as string;
  });

  it('creates second todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Ship feature', priority: 3 }),
    });
    expect(status).toBe(200);
    const todo = body as Record<string, unknown>;
    expect(todo.title).toBe('Ship feature');
    expect(todo.id).toBeDefined();
    todoId2 = todo.id as string;
    expect(todoId2).not.toBe(todoId1); // different IDs
  });

  it('creates third todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Deploy to prod' }),
    });
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).title).toBe('Deploy to prod');
  });

  // ─── READ ──────────────────────────────────────────────────────

  it('reads todo by ID', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/${todoId1}`);
    expect(status).toBe(200);
    const todo = body as Record<string, unknown>;
    expect(todo.id).toBe(todoId1);
    expect(todo.title).toBe('Write tests');
    expect(todo.description).toBe('E2E with SQLite');
  });

  it('returns error for non-existent ID', async () => {
    const { body } = await fetchJson(`${baseUrl}/todos/does-not-exist`);
    expect((body as Record<string, unknown>).error).toBeDefined();
  });

  // ─── LIST ──────────────────────────────────────────────────────

  it('lists all 3 todos', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos`);
    expect(status).toBe(200);
    const result = body as { items: unknown[]; count: number };
    expect(result.items).toHaveLength(3);
    expect(result.count).toBe(3);
  });

  // ─── UPDATE ────────────────────────────────────────────────────

  it('updates todo title and status', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/${todoId1}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Write comprehensive tests', status: 'in_progress' }),
    });
    expect(status).toBe(200);
    const todo = body as Record<string, unknown>;
    expect(todo.title).toBe('Write comprehensive tests');
    expect(todo.status).toBe('in_progress');
  });

  it('verifies update persisted by reading back', async () => {
    const { body } = await fetchJson(`${baseUrl}/todos/${todoId1}`);
    const todo = body as Record<string, unknown>;
    expect(todo.title).toBe('Write comprehensive tests');
    expect(todo.status).toBe('in_progress');
  });

  it('updates priority only', async () => {
    const { body } = await fetchJson(`${baseUrl}/todos/${todoId2}`, {
      method: 'PUT',
      body: JSON.stringify({ priority: 5 }),
    });
    expect((body as Record<string, unknown>).priority).toBe(5);
  });

  // ─── DELETE ────────────────────────────────────────────────────

  it('deletes a todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/${todoId1}`, {
      method: 'DELETE',
    });
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
  });

  it('deleted todo is gone', async () => {
    const { body } = await fetchJson(`${baseUrl}/todos/${todoId1}`);
    expect((body as Record<string, unknown>).error).toBeDefined();
  });

  it('list now shows 2 remaining todos', async () => {
    const { body } = await fetchJson(`${baseUrl}/todos`);
    const result = body as { items: unknown[]; count: number };
    expect(result.items).toHaveLength(2);
    expect(result.count).toBe(2);
  });

  // ─── ORM operation log ─────────────────────────────────────────

  it('ORM recorded all operations in the log', async () => {
    const log = orm.getOperationLog();
    expect(log.length).toBeGreaterThanOrEqual(8);
    // Should have inserts, selects, an update, and a delete
    const ops = log.map(e => e.operation);
    expect(ops).toContain('insert');
    expect(ops).toContain('select');
    expect(ops).toContain('update');
    expect(ops).toContain('delete');
  });

  // ─── Error handling ────────────────────────────────────────────

  it('404 for unknown path', async () => {
    const { status } = await fetchJson(`${baseUrl}/nonexistent`);
    expect(status).toBe(404);
  });

  it('405 for wrong method on existing path', async () => {
    const { status } = await fetchJson(`${baseUrl}/todos`, { method: 'PATCH' });
    expect(status).toBe(405);
  });

  it('400 for malformed JSON', async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{not json',
    });
    expect(res.status).toBe(400);
  });
});
