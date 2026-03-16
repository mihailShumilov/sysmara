import { scaffoldSpecs } from '../../src/scaffold/scaffolder.js';
import {
  generateEntityStub,
  generateCapabilityStub,
  generatePolicyStub,
  generateInvariantStub,
  generateServiceStub,
} from '../../src/scaffold/generators.js';
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

describe('scaffoldSpecs', () => {
  it('generates files for all spec types', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'user', description: 'A user', fields: [{ name: 'id', type: 'string', required: true }], module: 'auth' },
      ],
      capabilities: [
        { name: 'create_user', description: 'Creates a user', module: 'auth', entities: ['user'], input: [], output: [], policies: ['admin_policy'], invariants: ['email_unique'] },
      ],
      policies: [
        { name: 'admin_policy', description: 'Admins only', actor: 'admin', capabilities: ['create_user'], conditions: [], effect: 'allow' },
      ],
      invariants: [
        { name: 'email_unique', description: 'Email is unique', entity: 'user', rule: 'No duplicate emails', severity: 'error', enforcement: 'runtime' },
      ],
      modules: [
        { name: 'auth', description: 'Auth module', entities: ['user'], capabilities: ['create_user'], allowedDependencies: [], forbiddenDependencies: [] },
      ],
    });

    const result = scaffoldSpecs(specs);
    expect(result.files).toHaveLength(5);

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('entities/user.ts');
    expect(paths).toContain('capabilities/create_user.ts');
    expect(paths).toContain('policies/admin_policy.ts');
    expect(paths).toContain('invariants/email_unique.ts');
    expect(paths).toContain('services/auth.ts');
  });

  it('returns empty files array for empty specs', () => {
    const result = scaffoldSpecs(makeSpecs());
    expect(result.files).toHaveLength(0);
  });

  it('sets correct source identifiers', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'task', description: 'A task', fields: [], module: 'tasks' },
      ],
    });

    const result = scaffoldSpecs(specs);
    expect(result.files[0]!.source).toBe('entity:task');
  });
});

describe('generateEntityStub', () => {
  it('generates an interface with typed fields', () => {
    const entity = {
      name: 'user',
      description: 'A registered user',
      module: 'auth',
      fields: [
        { name: 'id', type: 'string', required: true, description: 'Unique ID' },
        { name: 'email', type: 'string', required: true },
        { name: 'age', type: 'number', required: false },
        { name: 'created_at', type: 'date', required: true },
      ],
    };

    const content = generateEntityStub(entity);
    expect(content).toContain('export interface User');
    expect(content).toContain('id: string;');
    expect(content).toContain('email: string;');
    expect(content).toContain('age?: number;');
    expect(content).toContain('created_at: Date;');
    expect(content).toContain('/** Unique ID */');
    expect(content).toContain('validateUser');
    expect(content).toContain('entity:user');
  });

  it('generates required field checks in validator', () => {
    const entity = {
      name: 'item',
      description: 'An item',
      module: 'store',
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'label', type: 'string', required: false },
      ],
    };

    const content = generateEntityStub(entity);
    expect(content).toContain('if (obj.id === undefined) return false;');
    expect(content).not.toContain('if (obj.label === undefined)');
  });
});

describe('generateCapabilityStub', () => {
  it('generates a handler with policy and invariant TODOs', () => {
    const specs = makeSpecs();
    const cap = {
      name: 'create_user',
      description: 'Creates a user',
      module: 'auth',
      entities: ['user'],
      input: [],
      output: [],
      policies: ['admin_policy'],
      invariants: ['email_unique'],
    };

    const content = generateCapabilityStub(cap, specs);
    expect(content).toContain('handleCreateUser');
    expect(content).toContain('CreateUserInput');
    expect(content).toContain('CreateUserOutput');
    expect(content).toContain('Enforce policy: admin_policy');
    expect(content).toContain('Validate invariant: email_unique');
    expect(content).toContain('Load entity: user');
    expect(content).toContain("import type { CreateUserInput, CreateUserOutput } from '../generated/routes/create_user.js'");
  });
});

describe('generatePolicyStub', () => {
  it('generates an enforce function with conditions', () => {
    const policy = {
      name: 'admin_policy',
      description: 'Only admins allowed',
      actor: 'authenticated_user',
      capabilities: ['create_user'],
      conditions: [
        { field: 'actor.role', operator: 'in' as const, value: ['admin'] },
      ],
      effect: 'allow' as const,
    };

    const content = generatePolicyStub(policy);
    expect(content).toContain('enforceAdminPolicy');
    expect(content).toContain('ActorContext');
    expect(content).toContain('actor.role in [admin]');
    expect(content).toContain('Effect: allow');
  });
});

describe('generateInvariantStub', () => {
  it('generates a validate function referencing the entity', () => {
    const invariant = {
      name: 'email_unique',
      description: 'Email must be unique',
      entity: 'user',
      rule: 'No two users may share the same email',
      severity: 'error' as const,
      enforcement: 'runtime' as const,
    };

    const content = generateInvariantStub(invariant);
    expect(content).toContain('validateEmailUnique');
    expect(content).toContain('entity: User');
    expect(content).toContain("import type { User } from '../entities/user.js'");
    expect(content).toContain('No two users may share the same email');
    expect(content).toContain('InvariantViolation');
  });
});

describe('generateServiceStub', () => {
  it('generates a service class with method stubs per capability', () => {
    const specs = makeSpecs({
      capabilities: [
        { name: 'create_user', description: 'Creates a user', module: 'auth', entities: [], input: [], output: [], policies: [], invariants: [] },
        { name: 'get_user', description: 'Gets a user', module: 'auth', entities: [], input: [], output: [], policies: [], invariants: [] },
      ],
    });
    const mod = {
      name: 'auth',
      description: 'Authentication module',
      entities: ['user'],
      capabilities: ['create_user', 'get_user'],
      allowedDependencies: [],
      forbiddenDependencies: [],
    };

    const content = generateServiceStub(mod, specs);
    expect(content).toContain('class AuthService');
    expect(content).toContain('async createUser(');
    expect(content).toContain('async getUser(');
    expect(content).toContain('Creates a user');
    expect(content).toContain('Gets a user');
  });
});
