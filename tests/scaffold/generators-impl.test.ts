import {
  generateEntityImpl,
  generateCapabilityImpl,
  generatePolicyImpl,
  generateInvariantImpl,
  generateServiceImpl,
} from '../../src/scaffold/generators-impl.js';
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

describe('generateEntityImpl', () => {
  it('generates type-checked validation with constraint logic', () => {
    const entity = {
      name: 'user',
      description: 'A user',
      module: 'auth',
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'role', type: 'string', required: true, constraints: [{ type: 'enum' as const, value: ['admin', 'member'] }] },
        { name: 'age', type: 'number', required: false },
      ],
    };

    const content = generateEntityImpl(entity);
    expect(content).toContain('export interface User');
    expect(content).toContain("typeof obj.email !== 'string'");
    expect(content).toContain("'admin', 'member'");
    expect(content).not.toContain('TODO');
  });
});

describe('generateCapabilityImpl', () => {
  it('generates ORM-based create handler for create_ capability', () => {
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

    const content = generateCapabilityImpl(cap, specs);
    expect(content).toContain('SysmaraORM');
    expect(content).toContain('repo.create');
    expect(content).toContain('enforceAdminPolicy');
    expect(content).toContain('validateEmailUnique');
    expect(content).not.toContain('throw new Error(\'Not implemented');
  });

  it('generates findById for get_ capability', () => {
    const specs = makeSpecs();
    const cap = {
      name: 'get_user',
      description: 'Gets a user',
      module: 'auth',
      entities: ['user'],
      input: [],
      output: [],
      policies: [],
      invariants: [],
    };

    const content = generateCapabilityImpl(cap, specs);
    expect(content).toContain('repo.findById');
  });

  it('generates findMany for list_ capability', () => {
    const specs = makeSpecs();
    const cap = {
      name: 'list_users',
      description: 'Lists users',
      module: 'auth',
      entities: ['user'],
      input: [],
      output: [],
      policies: [],
      invariants: [],
    };

    const content = generateCapabilityImpl(cap, specs);
    expect(content).toContain('repo.findMany');
  });

  it('generates delete for delete_ capability', () => {
    const specs = makeSpecs();
    const cap = {
      name: 'delete_user',
      description: 'Deletes a user',
      module: 'auth',
      entities: ['user'],
      input: [],
      output: [],
      policies: [],
      invariants: [],
    };

    const content = generateCapabilityImpl(cap, specs);
    expect(content).toContain('repo.delete');
  });
});

describe('generatePolicyImpl', () => {
  it('generates real condition checks for role-based policies', () => {
    const policy = {
      name: 'admin_policy',
      description: 'Only admins',
      actor: 'authenticated_user',
      capabilities: ['create_user'],
      conditions: [
        { field: 'actor.role', operator: 'in' as const, value: ['admin'] },
      ],
      effect: 'allow' as const,
    };

    const content = generatePolicyImpl(policy);
    expect(content).toContain('actor.roles.some');
    expect(content).toContain('return true');
    expect(content).not.toContain('void actor');
    expect(content).not.toContain('TODO');
  });
});

describe('generateInvariantImpl', () => {
  it('generates uniqueness comment for unique invariants', () => {
    const invariant = {
      name: 'email_unique',
      description: 'Email must be unique',
      entity: 'user',
      rule: 'No two users may share the same email',
      severity: 'error' as const,
      enforcement: 'runtime' as const,
    };

    const content = generateInvariantImpl(invariant);
    expect(content).toContain('Uniqueness is enforced by the database constraint');
    expect(content).not.toContain('void entity');
  });

  it('generates field check for not_empty invariants', () => {
    const invariant = {
      name: 'title_must_not_be_empty',
      description: 'Task title cannot be empty',
      entity: 'task',
      rule: 'Title must not be empty',
      severity: 'error' as const,
      enforcement: 'runtime' as const,
    };

    const content = generateInvariantImpl(invariant);
    expect(content).toContain("=== ''");
    expect(content).toContain('InvariantViolation');
  });
});

describe('generateServiceImpl', () => {
  it('generates ORM-based service methods', () => {
    const specs = makeSpecs({
      capabilities: [
        { name: 'create_user', description: 'Creates a user', module: 'auth', entities: ['user'], input: [], output: [], policies: [], invariants: [] },
        { name: 'get_user', description: 'Gets a user', module: 'auth', entities: ['user'], input: [], output: [], policies: [], invariants: [] },
      ],
    });
    const mod = {
      name: 'auth',
      description: 'Auth module',
      entities: ['user'],
      capabilities: ['create_user', 'get_user'],
      allowedDependencies: [],
      forbiddenDependencies: [],
    };

    const content = generateServiceImpl(mod, specs);
    expect(content).toContain('SysmaraORM');
    expect(content).toContain('this.orm');
    expect(content).toContain('repo.create');
    expect(content).toContain('repo.findById');
    expect(content).not.toContain('throw new Error(\'Not implemented');
  });
});
