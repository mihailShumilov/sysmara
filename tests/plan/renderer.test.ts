import { describe, it, expect } from 'vitest';
import {
  renderChangePlanMarkdown,
  renderChangePlanJSON,
  renderChangePlanTerminal,
} from '../../src/plan/renderer.js';
import type { ChangePlan } from '../../src/types/index.js';

function makePlan(overrides: Partial<ChangePlan> = {}): ChangePlan {
  return {
    id: 'plan-test123',
    title: 'Test Plan',
    description: 'A test change plan',
    createdAt: '2025-03-14T00:00:00Z',
    author: 'test-author',
    status: 'draft',
    risk: 'medium',
    summary: {
      intent: 'Test intent',
      scope: 'users',
      estimatedImpactRadius: 5,
      requiresHumanReview: true,
      breakingChanges: false,
    },
    capabilityChanges: [
      {
        capability: 'create_user',
        action: 'modify',
        description: 'Update user creation',
        breakingChange: false,
      },
    ],
    affectedEntities: [
      { name: 'user', impact: 'direct', description: 'Modified entity' },
    ],
    affectedModules: [
      { name: 'users', impact: 'direct', description: 'Primary module' },
    ],
    affectedPolicies: [],
    affectedInvariants: [
      { name: 'email_unique', impact: 'direct', description: 'Must verify' },
    ],
    affectedRoutes: [],
    migrationNotes: ['Add new column'],
    generatedArtifactsToRefresh: ['generated/routes/create_user.ts'],
    testsLikelyAffected: ['tests/capabilities/create_user.test.ts'],
    specsToUpdate: ['system/capabilities.yaml'],
    humanReviewFlags: ['Affects invariants'],
    rolloutNotes: ['Deploy in stages'],
    openQuestions: ['How to handle edge case?'],
    ...overrides,
  };
}

describe('renderChangePlanMarkdown', () => {
  it('renders title and metadata', () => {
    const md = renderChangePlanMarkdown(makePlan());
    expect(md).toContain('# Change Plan: Test Plan');
    expect(md).toContain('plan-test123');
    expect(md).toContain('draft');
    expect(md).toContain('[MEDIUM]');
    expect(md).toContain('test-author');
  });

  it('renders capability changes', () => {
    const md = renderChangePlanMarkdown(makePlan());
    expect(md).toContain('`create_user`');
    expect(md).toContain('modify');
    expect(md).toContain('Update user creation');
  });

  it('renders affected entities', () => {
    const md = renderChangePlanMarkdown(makePlan());
    expect(md).toContain('**user**');
    expect(md).toContain('direct');
  });

  it('renders all sections', () => {
    const md = renderChangePlanMarkdown(makePlan());
    expect(md).toContain('Affected Entities');
    expect(md).toContain('Affected Modules');
    expect(md).toContain('Affected Invariants');
    expect(md).toContain('Migration Notes');
    expect(md).toContain('Human Review Flags');
    expect(md).toContain('Open Questions');
  });

  it('omits empty sections', () => {
    const md = renderChangePlanMarkdown(makePlan({ affectedPolicies: [], affectedRoutes: [] }));
    expect(md).not.toContain('Affected Policies');
    expect(md).not.toContain('Affected Routes');
  });

  it('marks breaking changes', () => {
    const md = renderChangePlanMarkdown(
      makePlan({
        capabilityChanges: [
          {
            capability: 'delete_user',
            action: 'remove',
            description: 'Remove',
            breakingChange: true,
          },
        ],
      }),
    );
    expect(md).toContain('[BREAKING]');
  });
});

describe('renderChangePlanJSON', () => {
  it('produces valid JSON', () => {
    const json = renderChangePlanJSON(makePlan());
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe('plan-test123');
    expect(parsed.title).toBe('Test Plan');
  });

  it('is pretty-printed', () => {
    const json = renderChangePlanJSON(makePlan());
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

describe('renderChangePlanTerminal', () => {
  it('renders with section headers', () => {
    const output = renderChangePlanTerminal(makePlan());
    expect(output).toContain('CHANGE PLAN: Test Plan');
    expect(output).toContain('CAPABILITY CHANGES');
    expect(output).toContain('AFFECTED ENTITIES');
    expect(output).toContain('AFFECTED MODULES');
  });

  it('renders risk level', () => {
    const output = renderChangePlanTerminal(makePlan());
    expect(output).toContain('[MEDIUM]');
  });

  it('renders breaking change indicator', () => {
    const output = renderChangePlanTerminal(
      makePlan({
        capabilityChanges: [
          {
            capability: 'x',
            action: 'remove',
            description: 'test',
            breakingChange: true,
          },
        ],
      }),
    );
    expect(output).toContain('[BREAKING]');
  });
});
