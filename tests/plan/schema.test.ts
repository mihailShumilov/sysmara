import { describe, it, expect } from 'vitest';
import { changePlanSchema, capabilityChangeSchema, affectedItemSchema, riskLevelSchema } from '../../src/plan/schema.js';

describe('riskLevelSchema', () => {
  it('accepts valid risk levels', () => {
    expect(riskLevelSchema.parse('low')).toBe('low');
    expect(riskLevelSchema.parse('medium')).toBe('medium');
    expect(riskLevelSchema.parse('high')).toBe('high');
    expect(riskLevelSchema.parse('critical')).toBe('critical');
  });

  it('rejects invalid risk levels', () => {
    expect(() => riskLevelSchema.parse('extreme')).toThrow();
  });
});

describe('affectedItemSchema', () => {
  it('accepts valid affected item', () => {
    const result = affectedItemSchema.parse({
      name: 'user',
      impact: 'direct',
      description: 'Modified entity',
    });
    expect(result.name).toBe('user');
    expect(result.impact).toBe('direct');
  });

  it('rejects missing name', () => {
    expect(() =>
      affectedItemSchema.parse({ impact: 'direct', description: 'test' }),
    ).toThrow();
  });
});

describe('capabilityChangeSchema', () => {
  it('accepts valid capability change', () => {
    const result = capabilityChangeSchema.parse({
      capability: 'create_user',
      action: 'add',
      description: 'Add user creation',
      breakingChange: false,
    });
    expect(result.capability).toBe('create_user');
    expect(result.action).toBe('add');
  });

  it('accepts with optional fields', () => {
    const result = capabilityChangeSchema.parse({
      capability: 'create_team',
      action: 'add',
      description: 'Add team creation',
      newEntities: ['team'],
      newPolicies: ['team_policy'],
      newInvariants: ['team_invariant'],
      breakingChange: true,
    });
    expect(result.newEntities).toEqual(['team']);
    expect(result.breakingChange).toBe(true);
  });

  it('rejects invalid action', () => {
    expect(() =>
      capabilityChangeSchema.parse({
        capability: 'test',
        action: 'destroy',
        description: 'test',
        breakingChange: false,
      }),
    ).toThrow();
  });
});

describe('changePlanSchema', () => {
  const validPlan = {
    id: 'plan-abc123',
    title: 'Add team billing',
    description: 'Add team billing capabilities',
    createdAt: '2025-03-14T00:00:00Z',
    author: 'architect',
    status: 'draft' as const,
    risk: 'medium' as const,
    summary: {
      intent: 'Enable team billing',
      scope: 'billing',
      estimatedImpactRadius: 5,
      requiresHumanReview: true,
      breakingChanges: false,
    },
    capabilityChanges: [
      {
        capability: 'create_team_subscription',
        action: 'add' as const,
        description: 'Create team subscription',
        breakingChange: false,
      },
    ],
    affectedEntities: [{ name: 'subscription', impact: 'direct' as const, description: 'Modified' }],
    affectedModules: [{ name: 'billing', impact: 'direct' as const, description: 'Primary module' }],
    affectedPolicies: [],
    affectedInvariants: [],
    affectedRoutes: [],
    migrationNotes: ['Add team_subscription table'],
    generatedArtifactsToRefresh: ['generated/routes/create_team_subscription.ts'],
    testsLikelyAffected: ['tests/capabilities/create_subscription.test.ts'],
    specsToUpdate: ['system/capabilities.yaml'],
    humanReviewFlags: ['New billing capability needs review'],
    rolloutNotes: ['Deploy in stages'],
    openQuestions: ['How to handle mixed billing cycles?'],
  };

  it('accepts a valid change plan', () => {
    const result = changePlanSchema.parse(validPlan);
    expect(result.id).toBe('plan-abc123');
    expect(result.title).toBe('Add team billing');
    expect(result.risk).toBe('medium');
    expect(result.capabilityChanges).toHaveLength(1);
  });

  it('rejects missing required fields', () => {
    const { title: _, ...noTitle } = validPlan;
    expect(() => changePlanSchema.parse(noTitle)).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() =>
      changePlanSchema.parse({ ...validPlan, status: 'pending' }),
    ).toThrow();
  });
});
