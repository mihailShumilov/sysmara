/**
 * End-to-end test: TODO service from scratch
 *
 * Simulates the "one prompt" workflow:
 * 1. Create a fresh project directory
 * 2. Write YAML specs for a TODO service (entities, capabilities, policies, etc.)
 * 3. Parse specs, connect to in-memory DB, create tables, wire routes
 * 4. Make real HTTP requests and verify CRUD operations work
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSpecDirectory } from '../../src/spec/index.js';
import { SysmaraServer } from '../../src/runtime/server.js';
import { SysmaraORM } from '../../src/database/adapters/sysmara-orm/orm.js';
import { createInMemoryDriver } from '../../src/database/adapters/sysmara-orm/driver.js';
import type { CapabilitySpec, HandlerContext } from '../../src/types/index.js';

// ─── Spec YAML: a simple TODO service ────────────────────────────────

const ENTITIES_YAML = `entities:
  - name: todo
    description: A task that can be created, completed, and deleted
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
        description: Optional task description
      - name: status
        type: string
        required: true
        description: Task status (pending, in_progress, done)
      - name: created_at
        type: date
        required: true
        description: Creation timestamp
`;

const CAPABILITIES_YAML = `capabilities:
  - name: create_todo
    description: Creates a new TODO item
    module: tasks
    entities:
      - todo
    input:
      - name: title
        type: string
        required: true
      - name: description
        type: string
        required: false
    output:
      - name: todo
        type: reference
        required: true
    policies: []
    invariants: []
    idempotent: false

  - name: get_todo
    description: Retrieves a TODO item by ID
    module: tasks
    entities:
      - todo
    input:
      - name: id
        type: string
        required: true
    output:
      - name: todo
        type: reference
        required: true
    policies: []
    invariants: []
    idempotent: true

  - name: list_todos
    description: Lists all TODO items
    module: tasks
    entities:
      - todo
    input: []
    output:
      - name: todos
        type: reference
        required: true
    policies: []
    invariants: []
    idempotent: true

  - name: update_todo
    description: Updates a TODO item
    module: tasks
    entities:
      - todo
    input:
      - name: id
        type: string
        required: true
      - name: title
        type: string
        required: false
      - name: status
        type: string
        required: false
    output:
      - name: todo
        type: reference
        required: true
    policies: []
    invariants: []
    idempotent: true

  - name: delete_todo
    description: Deletes a TODO item
    module: tasks
    entities:
      - todo
    input:
      - name: id
        type: string
        required: true
    output:
      - name: success
        type: boolean
        required: true
    policies: []
    invariants: []
    idempotent: true
`;

const POLICIES_YAML = `policies: []`;
const INVARIANTS_YAML = `invariants: []`;
const MODULES_YAML = `modules:
  - name: tasks
    description: Task management module
    entities:
      - todo
    capabilities:
      - create_todo
      - get_todo
      - list_todos
      - update_todo
      - delete_todo
    allowedDependencies: []
    forbiddenDependencies: []
`;
const FLOWS_YAML = `flows: []`;
const SAFE_EDIT_ZONES_YAML = `safeEditZones: []`;
const GLOSSARY_YAML = `glossary:
  - term: todo
    definition: A task item in the system
`;

// ─── Route inference (same logic as start.ts) ────────────────────────

function inferRoute(cap: CapabilitySpec): { method: string; path: string } {
  const name = cap.name.toLowerCase();
  const primaryEntity = cap.entities[0] ?? 'resource';
  const plural = primaryEntity.endsWith('s') ? primaryEntity : primaryEntity + 's';
  const basePath = `/${plural}`;

  if (name.startsWith('create_') || name.startsWith('add_')) return { method: 'POST', path: basePath };
  if (name.startsWith('list_') || name.startsWith('get_all_') || name.startsWith('search_')) return { method: 'GET', path: basePath };
  if (name.startsWith('get_') || name.startsWith('find_')) return { method: 'GET', path: `${basePath}/:id` };
  if (name.startsWith('update_') || name.startsWith('edit_')) return { method: 'PUT', path: `${basePath}/:id` };
  if (name.startsWith('delete_') || name.startsWith('remove_')) return { method: 'DELETE', path: `${basePath}/:id` };
  return { method: 'POST', path: `/${name.replace(/_/g, '-')}` };
}

function inferOperation(name: string): 'create' | 'read' | 'list' | 'update' | 'delete' {
  const n = name.toLowerCase();
  if (n.startsWith('create_') || n.startsWith('add_')) return 'create';
  if (n.startsWith('list_') || n.startsWith('get_all_')) return 'list';
  if (n.startsWith('update_') || n.startsWith('edit_')) return 'update';
  if (n.startsWith('delete_') || n.startsWith('remove_')) return 'delete';
  return 'read';
}

function createHandler(cap: CapabilitySpec, orm: SysmaraORM) {
  const op = inferOperation(cap.name);
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
        if (!result) return { error: { code: 'NOT_FOUND', message: 'todo not found' } };
        return result;
      }
      case 'list':
        return { items: await repo.findMany(), count: (await repo.findMany()).length };
      case 'update': {
        return repo.update(ctx.params.id!, (ctx.body ?? {}) as Record<string, unknown>);
      }
      case 'delete': {
        await repo.delete(ctx.params.id!);
        return { success: true, deleted: ctx.params.id };
      }
    }
  };
}

// ─── Helper ──────────────────────────────────────────────────────────

async function fetchJson(url: string, options?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ─── Test ────────────────────────────────────────────────────────────

describe('E2E: TODO service from one prompt', () => {
  let tmpDir: string;
  let server: SysmaraServer;
  let orm: SysmaraORM;
  let baseUrl: string;

  beforeAll(async () => {
    // Suppress console noise from server/ORM
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // 1. Create project directory + write specs
    tmpDir = await mkdtemp(join(tmpdir(), 'sysmara-e2e-todo-'));
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

    // 3. Create ORM with in-memory driver, apply schema
    orm = new SysmaraORM(
      { adapter: 'sysmara-orm', provider: 'sqlite' },
      specs,
    );
    const driver = createInMemoryDriver('sqlite');
    await driver.connect();
    orm.setDriver(driver);
    await orm.applySchema();

    // 4. Create server, wire routes
    server = new SysmaraServer({ port: 0, host: '127.0.0.1', logLevel: 'error' });

    for (const cap of specs.capabilities) {
      const { method, path } = inferRoute(cap);
      server.route(method, path, cap.name, createHandler(cap, orm));
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

  // ─── Health check ──────────────────────────────────────────────

  it('responds to health check', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/health`);
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).status).toBe('ok');
  });

  // ─── Route listing ─────────────────────────────────────────────

  it('lists all registered routes', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/_sysmara/routes`);
    expect(status).toBe(200);
    const routes = body as Array<{ method: string; path: string; capability: string }>;
    expect(routes.length).toBeGreaterThanOrEqual(5);

    const caps = routes.map(r => r.capability);
    expect(caps).toContain('create_todo');
    expect(caps).toContain('get_todo');
    expect(caps).toContain('list_todos');
    expect(caps).toContain('update_todo');
    expect(caps).toContain('delete_todo');
  });

  // ─── CREATE ────────────────────────────────────────────────────

  let createdId: string;

  it('POST /todos — creates a todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Buy groceries', description: 'Milk, eggs, bread' }),
    });

    expect(status).toBe(200);
    const todo = body as Record<string, unknown>;
    expect(todo.title).toBe('Buy groceries');
    expect(todo.description).toBe('Milk, eggs, bread');
    expect(todo.status).toBe('pending');
    expect(todo.id).toBeDefined();
    createdId = todo.id as string;
  });

  it('POST /todos — creates a second todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Clean house' }),
    });

    expect(status).toBe(200);
    expect((body as Record<string, unknown>).title).toBe('Clean house');
  });

  // ─── READ ──────────────────────────────────────────────────────

  it('GET /todos/:id — reads a single todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/${createdId}`);

    expect(status).toBe(200);
    const todo = body as Record<string, unknown>;
    expect(todo.id).toBe(createdId);
    expect(todo.title).toBe('Buy groceries');
  });

  it('GET /todos/:id — returns error for non-existent todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/nonexistent-id-999`);

    expect(status).toBe(200); // Handler returns error in body, not 404
    const result = body as Record<string, unknown>;
    expect(result.error).toBeDefined();
  });

  // ─── LIST ──────────────────────────────────────────────────────

  it('GET /todos — lists all todos', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos`);

    expect(status).toBe(200);
    const result = body as { items: unknown[]; count: number };
    expect(result.items).toBeDefined();
    expect(result.items.length).toBe(2);
    expect(result.count).toBe(2);
  });

  // ─── UPDATE ────────────────────────────────────────────────────

  it('PUT /todos/:id — updates a todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/${createdId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Buy organic groceries', status: 'in_progress' }),
    });

    expect(status).toBe(200);
    const todo = body as Record<string, unknown>;
    expect(todo.title).toBe('Buy organic groceries');
    expect(todo.status).toBe('in_progress');
  });

  it('GET /todos/:id — confirms update persisted', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/${createdId}`);

    expect(status).toBe(200);
    const todo = body as Record<string, unknown>;
    expect(todo.title).toBe('Buy organic groceries');
    expect(todo.status).toBe('in_progress');
  });

  // ─── DELETE ────────────────────────────────────────────────────

  it('DELETE /todos/:id — deletes a todo', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/${createdId}`, {
      method: 'DELETE',
    });

    expect(status).toBe(200);
    const result = body as { success: boolean; deleted: string };
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(createdId);
  });

  it('GET /todos — confirms deletion, only one left', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos`);

    expect(status).toBe(200);
    const result = body as { items: unknown[]; count: number };
    expect(result.items.length).toBe(1);
    expect(result.count).toBe(1);
  });

  it('GET /todos/:id — deleted todo is gone', async () => {
    const { status, body } = await fetchJson(`${baseUrl}/todos/${createdId}`);

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    expect(result.error).toBeDefined();
  });

  // ─── Error cases ───────────────────────────────────────────────

  it('returns 404 for unknown routes', async () => {
    const { status } = await fetchJson(`${baseUrl}/nonexistent`);
    expect(status).toBe(404);
  });

  it('returns 405 for wrong method', async () => {
    const { status } = await fetchJson(`${baseUrl}/todos`, { method: 'PATCH' });
    expect(status).toBe(405);
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).code).toBe('BAD_REQUEST');
  });
});
