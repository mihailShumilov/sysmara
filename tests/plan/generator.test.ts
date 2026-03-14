import { describe, it, expect } from 'vitest';
import { generateChangePlan, createEmptyPlan } from '../../src/plan/generator.js';
import { buildSystemGraph } from '../../src/graph/builder.js';
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

describe('createEmptyPlan', () => {
  it('creates a plan with correct title and description', () => {
    const plan = createEmptyPlan('Add feature X', 'Description of feature X');
    expect(plan.title).toBe('Add feature X');
    expect(plan.description).toBe('Description of feature X');
    expect(plan.status).toBe('draft');
    expect(plan.risk).toBe('low');
    expect(plan.author).toBe('ai-agent');
  });

  it('uses custom author', () => {
    const plan = createEmptyPlan('Test', 'Test', 'human-architect');
    expect(plan.author).toBe('human-architect');
  });

  it('generates unique IDs', () => {
    const plan1 = createEmptyPlan('Plan A', 'A');
    const plan2 = createEmptyPlan('Plan B', 'B');
    expect(plan1.id).not.toBe(plan2.id);
  });

  it('has all required arrays empty', () => {
    const plan = createEmptyPlan('Test', 'Test');
    expect(plan.capabilityChanges).toEqual([]);
    expect(plan.affectedEntities).toEqual([]);
    expect(plan.affectedModules).toEqual([]);
    expect(plan.migrationNotes).toEqual([]);
    expect(plan.openQuestions).toEqual([]);
  });
});

describe('generateChangePlan', () => {
  it('generates plan from specs with existing capabilities', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'user', description: 'User', fields: [], module: 'users' },
      ],
      capabilities: [
        {
          name: 'create_user',
          description: 'Create user',
          module: 'users',
          entities: ['user'],
          input: [{ name: 'email', type: 'string', required: true }],
          output: [{ name: 'user', type: 'reference', required: true }],
          policies: ['admin_policy'],
          invariants: ['email_unique'],
        },
      ],
      policies: [
        {
          name: 'admin_policy',
          description: 'Admin access',
          actor: 'admin',
          capabilities: ['create_user'],
          conditions: [],
          effect: 'allow',
        },
      ],
      invariants: [
        {
          name: 'email_unique',
          description: 'Unique emails',
          entity: 'user',
          rule: 'Email must be unique',
          severity: 'error',
          enforcement: 'runtime',
        },
      ],
      modules: [
        {
          name: 'users',
          description: 'Users module',
          entities: ['user'],
          capabilities: ['create_user'],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });

    const graph = buildSystemGraph(specs);

    const plan = generateChangePlan(
      {
        title: 'Modify user creation',
        description: 'Update create_user to support teams',
        capabilityChanges: [
          {
            capability: 'create_user',
            action: 'modify',
            description: 'Add team support',
            newEntities: ['team'],
          },
        ],
      },
      specs,
      graph,
    );

    expect(plan.title).toBe('Modify user creation');
    expect(plan.status).toBe('draft');
    expect(plan.capabilityChanges).toHaveLength(1);
    expect(plan.capabilityChanges[0]!.capability).toBe('create_user');
    expect(plan.affectedEntities.length).toBeGreaterThan(0);
    expect(plan.specsToUpdate.length).toBeGreaterThan(0);
    expect(plan.specsToUpdate).toContain('system/capabilities.yaml');
    expect(plan.specsToUpdate).toContain('system/entities.yaml');
  });

  it('classifies risk as high for breaking changes', () => {
    const specs = makeSpecs({
      capabilities: [
        {
          name: 'delete_user',
          description: 'Delete user',
          module: 'users',
          entities: ['user'],
          input: [],
          output: [],
          policies: [],
          invariants: [],
        },
      ],
      modules: [
        {
          name: 'users',
          description: 'Users',
          entities: ['user'],
          capabilities: ['delete_user'],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });
    const graph = buildSystemGraph(specs);

    const plan = generateChangePlan(
      {
        title: 'Remove delete_user',
        description: 'Remove capability',
        capabilityChanges: [
          {
            capability: 'delete_user',
            action: 'remove',
            description: 'Remove dangerous capability',
            breakingChange: true,
          },
        ],
      },
      specs,
      graph,
    );

    expect(plan.risk).toBe('critical');
    expect(plan.summary.breakingChanges).toBe(true);
    expect(plan.humanReviewFlags.length).toBeGreaterThan(0);
  });

  it('populates human review flags for invariant-affecting changes', () => {
    const specs = makeSpecs({
      entities: [
        { name: 'user', description: 'User', fields: [], module: 'users' },
      ],
      capabilities: [
        {
          name: 'create_user',
          description: 'Create user',
          module: 'users',
          entities: ['user'],
          input: [],
          output: [],
          policies: [],
          invariants: ['email_unique'],
        },
      ],
      invariants: [
        {
          name: 'email_unique',
          description: 'Unique emails',
          entity: 'user',
          rule: 'Email must be unique',
          severity: 'error',
          enforcement: 'runtime',
        },
      ],
      modules: [
        {
          name: 'users',
          description: 'Users',
          entities: ['user'],
          capabilities: ['create_user'],
          allowedDependencies: [],
          forbiddenDependencies: [],
        },
      ],
    });
    const graph = buildSystemGraph(specs);

    const plan = generateChangePlan(
      {
        title: 'Modify user creation',
        description: 'Change user creation',
        capabilityChanges: [
          {
            capability: 'create_user',
            action: 'modify',
            description: 'Update',
          },
        ],
      },
      specs,
      graph,
    );

    // Should have human review flag about invariants
    const hasInvariantFlag = plan.humanReviewFlags.some((f) =>
      f.includes('invariant'),
    );
    expect(hasInvariantFlag).toBe(true);
  });

  it('handles capabilities not in the graph', () => {
    const specs = makeSpecs();
    const graph = buildSystemGraph(specs);

    const plan = generateChangePlan(
      {
        title: 'Add new capability',
        description: 'Brand new capability',
        capabilityChanges: [
          {
            capability: 'new_capability',
            action: 'add',
            description: 'New thing',
          },
        ],
      },
      specs,
      graph,
    );

    expect(plan.risk).toBe('low');
    expect(plan.capabilityChanges).toHaveLength(1);
  });
});
