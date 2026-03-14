import { compileCapabilities } from '../../src/compiler/capability-compiler.js';
import type { SystemSpecs } from '../../src/types/index.js';

function makeSpecs(overrides: Partial<SystemSpecs> = {}): SystemSpecs {
  return {
    entities: [],
    capabilities: [],
    policies: [],
    invariants: [],
    modules: [],
    flows: [],
    safeEditZones: [],
    glossary: [],
    ...overrides,
  };
}

describe('compileCapabilities', () => {
  const outputDir = '/tmp/sysmara-test';

  it('should produce route handler, test scaffold, and metadata files', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: [],
          input: [{ name: 'email', type: 'string', required: true }],
          output: [{ name: 'id', type: 'string', required: true }],
          policies: [],
          invariants: [],
        },
      ],
    });

    const result = compileCapabilities(specs, outputDir);
    expect(result.files).toHaveLength(3);

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain(`${outputDir}/routes/create-user.ts`);
    expect(paths).toContain(`${outputDir}/tests/create-user.test.ts`);
    expect(paths).toContain(`${outputDir}/metadata/create-user.json`);
  });

  it('should generate route handler with correct capability name, description, input/output types', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a new user account',
          module: 'auth',
          entities: [],
          input: [
            { name: 'email', type: 'string', required: true, description: 'User email' },
            { name: 'age', type: 'number', required: false },
          ],
          output: [
            { name: 'id', type: 'string', required: true },
            { name: 'createdAt', type: 'date', required: true },
          ],
          policies: ['admin-only'],
          invariants: ['email-unique'],
        },
      ],
    });

    const result = compileCapabilities(specs, outputDir);
    const routeFile = result.files.find((f) => f.path.endsWith('create-user.ts') && f.path.includes('/routes/'));
    expect(routeFile).toBeDefined();

    const content = routeFile!.content;
    expect(content).toContain('capability:create-user');
    expect(content).toContain('Creates a new user account');
    expect(content).toContain('Module: auth');
    expect(content).toContain('Policies: admin-only');
    expect(content).toContain('Invariants: email-unique');
    expect(content).toContain('interface CreateUserInput');
    expect(content).toContain('interface CreateUserOutput');
    expect(content).toContain('email: string;');
    expect(content).toContain('age?: number;');
    expect(content).toContain('id: string;');
    expect(content).toContain('createdAt: Date;');
  });

  it('should generate test scaffold with describe block and policy/invariant tests', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: [],
          input: [],
          output: [],
          policies: ['admin-only', 'rate-limit'],
          invariants: ['email-unique'],
        },
      ],
    });

    const result = compileCapabilities(specs, outputDir);
    const testFile = result.files.find((f) => f.path.endsWith('.test.ts'));
    expect(testFile).toBeDefined();

    const content = testFile!.content;
    expect(content).toContain("describe('create-user'");
    expect(content).toContain("should enforce policy: admin-only");
    expect(content).toContain("should enforce policy: rate-limit");
    expect(content).toContain("should maintain invariant: email-unique");
  });

  it('should generate metadata JSON with correct linkages', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'User', description: 'A user', fields: [], module: 'auth' },
      ],
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: ['User'],
          input: [{ name: 'email', type: 'string', required: true }],
          output: [{ name: 'id', type: 'string', required: true }],
          policies: ['admin-only'],
          invariants: ['email-unique'],
        },
      ],
      policies: [
        {
          name: 'admin-only',
          description: 'Only admins allowed',
          actor: 'admin',
          capabilities: ['create-user'],
          conditions: [],
          effect: 'allow',
        },
      ],
      invariants: [
        {
          name: 'email-unique',
          description: 'Email must be unique',
          entity: 'User',
          rule: 'email is unique across all users',
          severity: 'error',
          enforcement: 'runtime',
        },
      ],
    });

    const result = compileCapabilities(specs, outputDir);
    const metadataFile = result.files.find((f) => f.path.endsWith('.json'));
    expect(metadataFile).toBeDefined();

    const metadata = JSON.parse(metadataFile!.content);
    expect(metadata.name).toBe('create-user');
    expect(metadata.module).toBe('auth');
    expect(metadata.entities).toHaveLength(1);
    expect(metadata.entities[0].name).toBe('User');
    expect(metadata.policies).toHaveLength(1);
    expect(metadata.policies[0].name).toBe('admin-only');
    expect(metadata.policies[0].effect).toBe('allow');
    expect(metadata.invariants).toHaveLength(1);
    expect(metadata.invariants[0].name).toBe('email-unique');
    expect(metadata.invariants[0].severity).toBe('error');
    expect(metadata.sideEffects).toEqual([]);
    expect(metadata.idempotent).toBe(false);
  });

  it('should track all generated files with checksums in manifest', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: [],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
    });

    const result = compileCapabilities(specs, outputDir);
    expect(result.manifest.files).toHaveLength(3);
    expect(result.manifest.generatedAt).toBeDefined();

    for (const entry of result.manifest.files) {
      expect(entry.path).toBeDefined();
      expect(entry.source).toBe('capability:create-user');
      expect(entry.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
      expect(typeof entry.regenerable).toBe('boolean');
    }

    // Route handler is generated zone (regenerable), test scaffold is editable (not regenerable)
    const routeEntry = result.manifest.files.find((f) => f.path.includes('/routes/'));
    expect(routeEntry!.zone).toBe('generated');
    expect(routeEntry!.regenerable).toBe(true);

    const testEntry = result.manifest.files.find((f) => f.path.includes('/tests/'));
    expect(testEntry!.zone).toBe('editable');
    expect(testEntry!.regenerable).toBe(false);
  });

  it('should produce multiple file sets for multiple capabilities', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: [],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
        {
          name: 'delete-user',
          description: 'Deletes a user',
          module: 'auth',
          entities: [],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
    });

    const result = compileCapabilities(specs, outputDir);
    // 3 files per capability * 2 capabilities = 6
    expect(result.files).toHaveLength(6);
    expect(result.manifest.files).toHaveLength(6);

    const routeFiles = result.files.filter((f) => f.path.includes('/routes/'));
    expect(routeFiles).toHaveLength(2);
  });

  it('should convert capability names to PascalCase correctly', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user-account',
          description: 'Creates a user account',
          module: 'auth',
          entities: [],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
    });

    const result = compileCapabilities(specs, outputDir);
    const routeFile = result.files.find((f) => f.path.includes('/routes/'));
    expect(routeFile!.content).toContain('CreateUserAccountInput');
    expect(routeFile!.content).toContain('CreateUserAccountOutput');
  });

  it('should report diagnostics for undefined entity references', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'create-user',
          description: 'Creates a user',
          module: 'auth',
          entities: ['NonExistent'],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
    });

    const result = compileCapabilities(specs, outputDir);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.code).toBe('CAP_UNDEFINED_ENTITY');
  });
});
