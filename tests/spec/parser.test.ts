import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSpecFile, parseSpecDirectory } from '../../src/spec/parser.js';
import { entitySpecSchema, entitiesFileSchema } from '../../src/spec/schemas.js';

// ── Helpers ──

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'sysmara-test-'));
}

async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

function entityYaml(name: string = 'User') {
  return `
name: ${name}
description: A ${name.toLowerCase()} entity
fields:
  - name: id
    type: string
    required: true
  - name: email
    type: string
    required: true
module: auth
`.trim();
}

function capabilityYaml() {
  return `
- name: CreateUser
  description: Creates a new user
  module: auth
  entities:
    - User
  input:
    - name: email
      type: string
      required: true
  output:
    - name: id
      type: string
      required: true
  policies:
    - AdminOnly
  invariants:
    - UniqueEmail
`.trim();
}

function policyYaml() {
  return `
- name: AdminOnly
  description: Only admins
  actor: admin
  capabilities:
    - CreateUser
  conditions:
    - field: role
      operator: has_role
      value: admin
  effect: allow
`.trim();
}

function invariantYaml() {
  return `
- name: UniqueEmail
  description: Email must be unique
  entity: User
  rule: No two users share the same email
  severity: error
  enforcement: runtime
`.trim();
}

function moduleYaml() {
  return `
- name: auth
  description: Authentication module
  entities:
    - User
  capabilities:
    - CreateUser
  allowedDependencies: []
  forbiddenDependencies: []
`.trim();
}

function flowYaml() {
  return `
- name: Registration
  description: User registration flow
  trigger: CreateUser
  steps:
    - name: validate
      action: CreateUser
      onFailure: abort
  module: auth
`.trim();
}

function safeEditZonesYaml() {
  return `
- path: src/generated
  zone: generated
`.trim();
}

function glossaryYaml() {
  return `
- term: User
  definition: A person who uses the system
`.trim();
}

// ── parseSpecFile ──

describe('parseSpecFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('parses a valid YAML file against a schema', async () => {
    const filePath = join(tempDir, 'entity.yaml');
    await writeFile(filePath, entityYaml());

    const { data, diagnostics } = await parseSpecFile(filePath, entitySpecSchema);
    expect(diagnostics).toHaveLength(0);
    expect(data).not.toBeNull();
    expect(data!.name).toBe('User');
    expect(data!.fields).toHaveLength(2);
  });

  it('returns error diagnostic for nonexistent file', async () => {
    const filePath = join(tempDir, 'nonexistent.yaml');
    const { data, diagnostics } = await parseSpecFile(filePath, entitySpecSchema);

    expect(data).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('SPEC_FILE_READ_ERROR');
    expect(diagnostics[0]!.severity).toBe('error');
  });

  it('returns error diagnostic for invalid YAML syntax', async () => {
    const filePath = join(tempDir, 'bad.yaml');
    await writeFile(filePath, '  invalid:\nyaml: [unclosed');

    const { data, diagnostics } = await parseSpecFile(filePath, entitySpecSchema);
    expect(data).toBeNull();
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    // Depending on how yaml lib handles it, it could be a parse error or validation error
    const hasDiagnostic = diagnostics.some(
      (d) => d.code === 'SPEC_YAML_PARSE_ERROR' || d.code === 'SPEC_VALIDATION_ERROR',
    );
    expect(hasDiagnostic).toBe(true);
  });

  it('returns warning diagnostic for empty file', async () => {
    const filePath = join(tempDir, 'empty.yaml');
    await writeFile(filePath, '');

    const { data, diagnostics } = await parseSpecFile(filePath, entitySpecSchema);
    expect(data).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('SPEC_EMPTY_FILE');
    expect(diagnostics[0]!.severity).toBe('warning');
  });

  it('returns validation error for YAML that does not match schema', async () => {
    const filePath = join(tempDir, 'wrong.yaml');
    await writeFile(filePath, 'name: User\ndescription: A user\n');

    const { data, diagnostics } = await parseSpecFile(filePath, entitySpecSchema);
    expect(data).toBeNull();
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]!.code).toBe('SPEC_VALIDATION_ERROR');
    expect(diagnostics[0]!.severity).toBe('error');
  });

  it('includes path info in validation error diagnostics', async () => {
    const filePath = join(tempDir, 'partial.yaml');
    // Missing required fields
    await writeFile(filePath, 'name: 123\ndescription: test\nfields: []\nmodule: auth\n');

    const { data, diagnostics } = await parseSpecFile(filePath, entitySpecSchema);
    expect(data).toBeNull();
    expect(diagnostics.some((d) => d.code === 'SPEC_VALIDATION_ERROR')).toBe(true);
    // The path should reference the field with the issue
    expect(diagnostics.some((d) => d.path !== undefined)).toBe(true);
  });
});

// ── parseSpecDirectory ──

describe('parseSpecDirectory', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('parses a complete spec directory with all spec types', async () => {
    // Create all spec files as single YAML files (arrays)
    await writeFile(join(tempDir, 'entities.yaml'), `- ${entityYaml().replace(/\n/g, '\n  ')}`);
    await writeFile(join(tempDir, 'capabilities.yaml'), capabilityYaml());
    await writeFile(join(tempDir, 'policies.yaml'), policyYaml());
    await writeFile(join(tempDir, 'invariants.yaml'), invariantYaml());
    await writeFile(join(tempDir, 'modules.yaml'), moduleYaml());
    await writeFile(join(tempDir, 'flows.yaml'), flowYaml());
    await writeFile(join(tempDir, 'safe-edit-zones.yaml'), safeEditZonesYaml());
    await writeFile(join(tempDir, 'glossary.yaml'), glossaryYaml());

    const { specs, diagnostics } = await parseSpecDirectory(tempDir);

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(specs).not.toBeNull();
    expect(specs!.entities).toHaveLength(1);
    expect(specs!.capabilities).toHaveLength(1);
    expect(specs!.policies).toHaveLength(1);
    expect(specs!.invariants).toHaveLength(1);
    expect(specs!.modules).toHaveLength(1);
    expect(specs!.flows).toHaveLength(1);
    expect(specs!.safeEditZones).toHaveLength(1);
    expect(specs!.glossary).toHaveLength(1);
  });

  it('handles missing spec files gracefully (returns empty arrays)', async () => {
    // Empty directory - no spec files
    const { specs, diagnostics } = await parseSpecDirectory(tempDir);

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(specs).not.toBeNull();
    expect(specs!.entities).toHaveLength(0);
    expect(specs!.capabilities).toHaveLength(0);
    expect(specs!.policies).toHaveLength(0);
    expect(specs!.invariants).toHaveLength(0);
    expect(specs!.modules).toHaveLength(0);
    expect(specs!.flows).toHaveLength(0);
    expect(specs!.safeEditZones).toHaveLength(0);
    expect(specs!.glossary).toHaveLength(0);
  });

  it('returns error when spec directory does not exist', async () => {
    const { specs, diagnostics } = await parseSpecDirectory(join(tempDir, 'nonexistent'));

    expect(specs).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('SPEC_DIR_NOT_FOUND');
  });

  it('returns error when path is a file not a directory', async () => {
    const filePath = join(tempDir, 'notadir');
    await writeFile(filePath, 'content');

    const { specs, diagnostics } = await parseSpecDirectory(filePath);

    expect(specs).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('SPEC_DIR_NOT_DIRECTORY');
  });

  it('returns null specs when a spec file has invalid YAML', async () => {
    await writeFile(join(tempDir, 'entities.yaml'), '  bad:\nyaml: [unclosed');

    const { specs, diagnostics } = await parseSpecDirectory(tempDir);

    expect(specs).toBeNull();
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns null specs when YAML does not match schema', async () => {
    // entities.yaml with wrong shape (missing required fields)
    await writeFile(join(tempDir, 'entities.yaml'), '- name: 123\n  wrong: field\n');

    const { specs, diagnostics } = await parseSpecDirectory(tempDir);

    expect(specs).toBeNull();
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((d) => d.code === 'SPEC_VALIDATION_ERROR')).toBe(true);
  });

  it('loads specs from a directory of individual YAML files', async () => {
    // Create entities as a directory with individual files
    const entitiesDir = join(tempDir, 'entities');
    await mkdir(entitiesDir);
    await writeFile(join(entitiesDir, 'user.yaml'), entityYaml('User'));
    await writeFile(join(entitiesDir, 'account.yaml'), entityYaml('Account'));

    const { specs, diagnostics } = await parseSpecDirectory(tempDir);

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(specs).not.toBeNull();
    expect(specs!.entities).toHaveLength(2);
    expect(specs!.entities.map((e) => e.name).sort()).toEqual(['Account', 'User']);
  });

  it('skips non-YAML files in spec directories', async () => {
    const entitiesDir = join(tempDir, 'entities');
    await mkdir(entitiesDir);
    await writeFile(join(entitiesDir, 'user.yaml'), entityYaml('User'));
    await writeFile(join(entitiesDir, 'readme.md'), '# Entities');
    await writeFile(join(entitiesDir, 'notes.txt'), 'just notes');

    const { specs, diagnostics } = await parseSpecDirectory(tempDir);

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(specs).not.toBeNull();
    expect(specs!.entities).toHaveLength(1);
  });

  it('prefers single file over directory when both exist', async () => {
    // Create entities.yaml file
    await writeFile(join(tempDir, 'entities.yaml'), `- ${entityYaml('FromFile').replace(/\n/g, '\n  ')}`);
    // Also create entities/ directory
    const entitiesDir = join(tempDir, 'entities');
    await mkdir(entitiesDir);
    await writeFile(join(entitiesDir, 'user.yaml'), entityYaml('FromDir'));

    const { specs, diagnostics } = await parseSpecDirectory(tempDir);

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(specs).not.toBeNull();
    // Single file should be preferred
    expect(specs!.entities).toHaveLength(1);
    expect(specs!.entities[0]!.name).toBe('FromFile');
  });

  it('supports .yml extension', async () => {
    await writeFile(join(tempDir, 'entities.yml'), `- ${entityYaml().replace(/\n/g, '\n  ')}`);

    const { specs, diagnostics } = await parseSpecDirectory(tempDir);

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(specs).not.toBeNull();
    expect(specs!.entities).toHaveLength(1);
  });
});
