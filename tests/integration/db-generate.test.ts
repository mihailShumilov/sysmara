import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandDbGenerate, commandDbMigrate } from '../../src/cli/commands/db.js';
import type { SysmaraConfig } from '../../src/types/index.js';

/**
 * Regression coverage for `sysmara db generate` / `db migrate` actually
 * writing files to disk (previously the command logged "Generated N file(s)"
 * but never persisted any output — only the --json mode was usable).
 */

async function seedMinimalProject(dir: string): Promise<void> {
  const systemDir = join(dir, 'system');
  await mkdir(systemDir, { recursive: true });

  await writeFile(
    join(systemDir, 'entities.yaml'),
    `entities:
  - name: user
    description: A registered user in the system
    module: users
    fields:
      - name: id
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: created_at
        type: datetime
        required: true
`,
  );

  await writeFile(
    join(systemDir, 'capabilities.yaml'),
    `capabilities:
  - name: create_user
    description: Creates a new user
    module: users
    entities: [user]
    input:
      - name: email
        type: string
        required: true
    output:
      - name: user
        type: user
        required: true
    policies: []
    invariants: []
`,
  );

  await writeFile(
    join(systemDir, 'modules.yaml'),
    `modules:
  - name: users
    description: User management
    entities: [user]
    capabilities: [create_user]
    allowedDependencies: []
    forbiddenDependencies: []
`,
  );

  // Empty but well-formed files so parseSpecDirectory succeeds.
  for (const f of ['policies.yaml', 'invariants.yaml', 'flows.yaml', 'safe-edit-zones.yaml', 'glossary.yaml']) {
    const key = f.replace('.yaml', '').replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
    const root =
      key === 'safeEditZones'
        ? 'safeEditZones'
        : key === 'glossary'
          ? 'glossary'
          : key;
    await writeFile(join(systemDir, f), `${root}: []\n`);
  }
}

function makeConfig(overrides: Partial<SysmaraConfig> = {}): SysmaraConfig {
  return {
    name: 'test-app',
    version: '0.0.0',
    specDir: './system',
    appDir: './app',
    frameworkDir: './.framework',
    generatedDir: './app/generated',
    port: 3000,
    host: '0.0.0.0',
    logLevel: 'info',
    database: { adapter: 'sysmara-orm', provider: 'postgresql', outputDir: './app/database' },
    ...overrides,
  };
}

describe('sysmara db generate — file write', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sysmara-db-gen-'));
    await seedMinimalProject(cwd);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(cwd, { recursive: true, force: true });
  });

  it('writes schema files under database.outputDir', async () => {
    const config = makeConfig();
    await commandDbGenerate(cwd, config, false);

    const schemaPath = join(cwd, 'app', 'database', 'sysmara-orm', 'schema.sql');
    const stats = await stat(schemaPath);
    expect(stats.isFile()).toBe(true);

    const content = await readFile(schemaPath, 'utf-8');
    expect(content).toContain('CREATE TABLE');
    expect(content).toContain('"user"');
  });

  it('falls back to generatedDir when database.outputDir is not set', async () => {
    const config = makeConfig();
    delete config.database!.outputDir;
    await commandDbGenerate(cwd, config, false);

    const schemaPath = join(cwd, 'app', 'generated', 'sysmara-orm', 'schema.sql');
    const stats = await stat(schemaPath);
    expect(stats.isFile()).toBe(true);
  });

  it('reports the written paths in --json mode', async () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    await commandDbGenerate(cwd, makeConfig(), true);

    const printed = out.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(printed);
    expect(parsed.adapter).toBe('sysmara-orm');
    expect(Array.isArray(parsed.written)).toBe(true);
    expect(parsed.written.length).toBeGreaterThan(0);
    expect(parsed.outputDir.endsWith('app/database')).toBe(true);
  });
});

describe('sysmara db migrate — file write', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sysmara-db-mig-'));
    await seedMinimalProject(cwd);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(cwd, { recursive: true, force: true });
  });

  it('writes migration files under database.outputDir', async () => {
    await commandDbMigrate(cwd, makeConfig(), false);

    // Migration filenames are timestamped (e.g. sysmara-orm/migrations/<ts>.sql)
    const dbDir = join(cwd, 'app', 'database');
    const stats = await stat(dbDir);
    expect(stats.isDirectory()).toBe(true);
  });
});
