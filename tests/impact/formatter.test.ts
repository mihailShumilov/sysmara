import { describe, it, expect } from 'vitest';
import { formatImpactTerminal, formatImpactJSON } from '../../src/impact/formatter.js';
import type { ImpactSurface } from '../../src/types/index.js';

function makeImpact(overrides: Partial<ImpactSurface> = {}): ImpactSurface {
  return {
    target: 'capability:create_user',
    targetType: 'capability',
    affectedModules: ['users'],
    affectedInvariants: ['email_unique'],
    affectedPolicies: ['admin_policy'],
    affectedCapabilities: [],
    affectedRoutes: ['POST /users'],
    affectedFlows: ['user_registration'],
    affectedTests: ['tests/capabilities/create_user.test.ts'],
    generatedArtifacts: ['generated/capability/create_user.ts'],
    ...overrides,
  };
}

describe('formatImpactTerminal', () => {
  it('includes target info', () => {
    const output = formatImpactTerminal(makeImpact());
    expect(output).toContain('capability:create_user');
    expect(output).toContain('capability');
  });

  it('lists affected modules', () => {
    const output = formatImpactTerminal(makeImpact());
    expect(output).toContain('Affected Modules');
    expect(output).toContain('users');
  });

  it('lists affected invariants', () => {
    const output = formatImpactTerminal(makeImpact());
    expect(output).toContain('email_unique');
  });

  it('shows "none" for empty sections', () => {
    const output = formatImpactTerminal(makeImpact({ affectedCapabilities: [] }));
    expect(output).toContain('Affected Capabilities: none');
  });

  it('shows total impact radius', () => {
    const output = formatImpactTerminal(makeImpact());
    expect(output).toContain('Total Impact Radius');
  });
});

describe('formatImpactJSON', () => {
  it('produces valid JSON', () => {
    const json = formatImpactJSON(makeImpact());
    const parsed = JSON.parse(json);
    expect(parsed.target).toBe('capability:create_user');
    expect(parsed.affectedModules).toEqual(['users']);
  });
});
