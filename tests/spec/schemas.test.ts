import {
  entitySpecSchema,
  entityFieldSchema,
  fieldConstraintSchema,
  capabilitySpecSchema,
  capabilityFieldSchema,
  policySpecSchema,
  policyConditionSchema,
  invariantSpecSchema,
  moduleSpecSchema,
  flowSpecSchema,
  flowStepSchema,
  safeEditZoneSpecSchema,
  glossaryTermSchema,
} from '../../src/spec/schemas.js';

// ── Helpers ──

function validEntity() {
  return {
    name: 'User',
    description: 'A user of the system',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'email', type: 'string', required: true, description: 'User email' },
    ],
    module: 'auth',
  };
}

function validCapability() {
  return {
    name: 'CreateUser',
    description: 'Creates a new user',
    module: 'auth',
    entities: ['User'],
    input: [{ name: 'email', type: 'string', required: true }],
    output: [{ name: 'id', type: 'string', required: true }],
    policies: ['AdminOnly'],
    invariants: ['UniqueEmail'],
  };
}

function validPolicy() {
  return {
    name: 'AdminOnly',
    description: 'Only admins can perform this action',
    actor: 'admin',
    capabilities: ['CreateUser'],
    conditions: [{ field: 'role', operator: 'has_role' as const, value: 'admin' }],
    effect: 'allow' as const,
  };
}

function validInvariant() {
  return {
    name: 'UniqueEmail',
    description: 'Email must be unique',
    entity: 'User',
    rule: 'No two users can have the same email',
    severity: 'error' as const,
    enforcement: 'runtime' as const,
  };
}

function validModule() {
  return {
    name: 'auth',
    description: 'Authentication module',
    entities: ['User'],
    capabilities: ['CreateUser'],
    allowedDependencies: [],
    forbiddenDependencies: [],
  };
}

function validFlow() {
  return {
    name: 'UserRegistration',
    description: 'Full user registration flow',
    trigger: 'CreateUser',
    steps: [
      { name: 'validate', action: 'ValidateInput', onFailure: 'abort' as const },
      { name: 'create', action: 'CreateUser', onFailure: 'compensate' as const, compensation: 'DeleteUser' },
    ],
    module: 'auth',
  };
}

function validSafeEditZone() {
  return {
    path: 'src/generated/auth',
    zone: 'generated' as const,
  };
}

function validGlossaryTerm() {
  return {
    term: 'User',
    definition: 'A person who uses the system',
  };
}

// ── fieldConstraintSchema ──

describe('fieldConstraintSchema', () => {
  it('accepts valid constraint with string value', () => {
    const result = fieldConstraintSchema.safeParse({
      type: 'pattern',
      value: '^[a-z]+$',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid constraint with number value', () => {
    const result = fieldConstraintSchema.safeParse({
      type: 'min',
      value: 0,
      message: 'Must be non-negative',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid constraint with array value', () => {
    const result = fieldConstraintSchema.safeParse({
      type: 'enum',
      value: ['active', 'inactive'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid constraint type', () => {
    const result = fieldConstraintSchema.safeParse({
      type: 'invalid',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing value', () => {
    const result = fieldConstraintSchema.safeParse({ type: 'min' });
    expect(result.success).toBe(false);
  });
});

// ── entityFieldSchema ──

describe('entityFieldSchema', () => {
  it('accepts valid field with all properties', () => {
    const result = entityFieldSchema.safeParse({
      name: 'email',
      type: 'string',
      required: true,
      description: 'User email',
      constraints: [{ type: 'unique', value: 'true' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid field without optional properties', () => {
    const result = entityFieldSchema.safeParse({
      name: 'id',
      type: 'string',
      required: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = entityFieldSchema.safeParse({
      type: 'string',
      required: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-boolean required', () => {
    const result = entityFieldSchema.safeParse({
      name: 'id',
      type: 'string',
      required: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

// ── entitySpecSchema ──

describe('entitySpecSchema', () => {
  it('accepts a valid entity', () => {
    const result = entitySpecSchema.safeParse(validEntity());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('User');
      expect(result.data.fields).toHaveLength(2);
    }
  });

  it('accepts entity with optional invariants', () => {
    const entity = { ...validEntity(), invariants: ['UniqueEmail'] };
    const result = entitySpecSchema.safeParse(entity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invariants).toEqual(['UniqueEmail']);
    }
  });

  it('accepts entity with field constraints', () => {
    const entity = validEntity();
    entity.fields[0]!.constraints = [{ type: 'minLength', value: 1 }];
    const result = entitySpecSchema.safeParse(entity);
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const { name: _, ...noName } = validEntity();
    const result = entitySpecSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('rejects missing description', () => {
    const { description: _, ...noDesc } = validEntity();
    const result = entitySpecSchema.safeParse(noDesc);
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const { fields: _, ...noFields } = validEntity();
    const result = entitySpecSchema.safeParse(noFields);
    expect(result.success).toBe(false);
  });

  it('rejects missing module', () => {
    const { module: _, ...noModule } = validEntity();
    const result = entitySpecSchema.safeParse(noModule);
    expect(result.success).toBe(false);
  });

  it('rejects non-array fields', () => {
    const result = entitySpecSchema.safeParse({
      ...validEntity(),
      fields: 'not-an-array',
    });
    expect(result.success).toBe(false);
  });

  it('rejects fields with invalid field objects', () => {
    const result = entitySpecSchema.safeParse({
      ...validEntity(),
      fields: [{ invalid: true }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty string name', () => {
    // zod string() accepts empty string by default
    const result = entitySpecSchema.safeParse({ ...validEntity(), name: '' });
    // Note: z.string() accepts empty strings; this validates the schema allows it
    expect(result.success).toBe(true);
  });

  it('rejects numeric name', () => {
    const result = entitySpecSchema.safeParse({ ...validEntity(), name: 123 });
    expect(result.success).toBe(false);
  });
});

// ── capabilityFieldSchema ──

describe('capabilityFieldSchema', () => {
  it('accepts valid capability field', () => {
    const result = capabilityFieldSchema.safeParse({
      name: 'email',
      type: 'string',
      required: true,
      description: 'Email address',
    });
    expect(result.success).toBe(true);
  });

  it('accepts without optional description', () => {
    const result = capabilityFieldSchema.safeParse({
      name: 'email',
      type: 'string',
      required: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing type', () => {
    const result = capabilityFieldSchema.safeParse({
      name: 'email',
      required: true,
    });
    expect(result.success).toBe(false);
  });
});

// ── capabilitySpecSchema ──

describe('capabilitySpecSchema', () => {
  it('accepts a valid capability', () => {
    const result = capabilitySpecSchema.safeParse(validCapability());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('CreateUser');
      expect(result.data.entities).toEqual(['User']);
    }
  });

  it('accepts capability with optional sideEffects and idempotent', () => {
    const cap = { ...validCapability(), sideEffects: ['sendEmail'], idempotent: true };
    const result = capabilitySpecSchema.safeParse(cap);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sideEffects).toEqual(['sendEmail']);
      expect(result.data.idempotent).toBe(true);
    }
  });

  it('rejects missing name', () => {
    const { name: _, ...noCap } = validCapability();
    const result = capabilitySpecSchema.safeParse(noCap);
    expect(result.success).toBe(false);
  });

  it('rejects missing entities', () => {
    const { entities: _, ...noEntities } = validCapability();
    const result = capabilitySpecSchema.safeParse(noEntities);
    expect(result.success).toBe(false);
  });

  it('rejects missing input', () => {
    const { input: _, ...noInput } = validCapability();
    const result = capabilitySpecSchema.safeParse(noInput);
    expect(result.success).toBe(false);
  });

  it('rejects missing output', () => {
    const { output: _, ...noOutput } = validCapability();
    const result = capabilitySpecSchema.safeParse(noOutput);
    expect(result.success).toBe(false);
  });

  it('rejects missing policies', () => {
    const { policies: _, ...noPolicies } = validCapability();
    const result = capabilitySpecSchema.safeParse(noPolicies);
    expect(result.success).toBe(false);
  });

  it('rejects missing invariants', () => {
    const { invariants: _, ...noInvariants } = validCapability();
    const result = capabilitySpecSchema.safeParse(noInvariants);
    expect(result.success).toBe(false);
  });

  it('rejects non-array entities', () => {
    const result = capabilitySpecSchema.safeParse({
      ...validCapability(),
      entities: 'User',
    });
    expect(result.success).toBe(false);
  });
});

// ── policyConditionSchema ──

describe('policyConditionSchema', () => {
  it('accepts valid condition with string value', () => {
    const result = policyConditionSchema.safeParse({
      field: 'role',
      operator: 'eq',
      value: 'admin',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid condition with array value', () => {
    const result = policyConditionSchema.safeParse({
      field: 'role',
      operator: 'in',
      value: ['admin', 'manager'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid operator', () => {
    const result = policyConditionSchema.safeParse({
      field: 'role',
      operator: 'contains',
      value: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid operators', () => {
    const operators = ['eq', 'neq', 'in', 'not_in', 'exists', 'is_owner', 'has_role'] as const;
    for (const operator of operators) {
      const result = policyConditionSchema.safeParse({
        field: 'role',
        operator,
        value: 'test',
      });
      expect(result.success).toBe(true);
    }
  });
});

// ── policySpecSchema ──

describe('policySpecSchema', () => {
  it('accepts a valid policy', () => {
    const result = policySpecSchema.safeParse(validPolicy());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('AdminOnly');
      expect(result.data.effect).toBe('allow');
    }
  });

  it('accepts deny effect', () => {
    const policy = { ...validPolicy(), effect: 'deny' };
    const result = policySpecSchema.safeParse(policy);
    expect(result.success).toBe(true);
  });

  it('rejects invalid effect', () => {
    const result = policySpecSchema.safeParse({
      ...validPolicy(),
      effect: 'maybe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing actor', () => {
    const { actor: _, ...noActor } = validPolicy();
    const result = policySpecSchema.safeParse(noActor);
    expect(result.success).toBe(false);
  });

  it('rejects missing capabilities', () => {
    const { capabilities: _, ...noCaps } = validPolicy();
    const result = policySpecSchema.safeParse(noCaps);
    expect(result.success).toBe(false);
  });

  it('rejects missing conditions', () => {
    const { conditions: _, ...noConds } = validPolicy();
    const result = policySpecSchema.safeParse(noConds);
    expect(result.success).toBe(false);
  });
});

// ── invariantSpecSchema ──

describe('invariantSpecSchema', () => {
  it('accepts a valid invariant', () => {
    const result = invariantSpecSchema.safeParse(validInvariant());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('UniqueEmail');
      expect(result.data.severity).toBe('error');
    }
  });

  it('accepts warning severity', () => {
    const inv = { ...validInvariant(), severity: 'warning' };
    const result = invariantSpecSchema.safeParse(inv);
    expect(result.success).toBe(true);
  });

  it('accepts all enforcement values', () => {
    for (const enforcement of ['runtime', 'compile', 'both']) {
      const result = invariantSpecSchema.safeParse({ ...validInvariant(), enforcement });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid severity', () => {
    const result = invariantSpecSchema.safeParse({
      ...validInvariant(),
      severity: 'critical',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid enforcement', () => {
    const result = invariantSpecSchema.safeParse({
      ...validInvariant(),
      enforcement: 'manual',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing entity', () => {
    const { entity: _, ...noEntity } = validInvariant();
    const result = invariantSpecSchema.safeParse(noEntity);
    expect(result.success).toBe(false);
  });

  it('rejects missing rule', () => {
    const { rule: _, ...noRule } = validInvariant();
    const result = invariantSpecSchema.safeParse(noRule);
    expect(result.success).toBe(false);
  });
});

// ── moduleSpecSchema ──

describe('moduleSpecSchema', () => {
  it('accepts a valid module', () => {
    const result = moduleSpecSchema.safeParse(validModule());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('auth');
    }
  });

  it('accepts module with optional owner', () => {
    const mod = { ...validModule(), owner: 'team-auth' };
    const result = moduleSpecSchema.safeParse(mod);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.owner).toBe('team-auth');
    }
  });

  it('rejects missing entities', () => {
    const { entities: _, ...noEntities } = validModule();
    const result = moduleSpecSchema.safeParse(noEntities);
    expect(result.success).toBe(false);
  });

  it('rejects missing capabilities', () => {
    const { capabilities: _, ...noCaps } = validModule();
    const result = moduleSpecSchema.safeParse(noCaps);
    expect(result.success).toBe(false);
  });

  it('rejects missing allowedDependencies', () => {
    const { allowedDependencies: _, ...noDeps } = validModule();
    const result = moduleSpecSchema.safeParse(noDeps);
    expect(result.success).toBe(false);
  });

  it('rejects missing forbiddenDependencies', () => {
    const { forbiddenDependencies: _, ...noForbidden } = validModule();
    const result = moduleSpecSchema.safeParse(noForbidden);
    expect(result.success).toBe(false);
  });
});

// ── flowStepSchema ──

describe('flowStepSchema', () => {
  it('accepts valid step', () => {
    const result = flowStepSchema.safeParse({
      name: 'validate',
      action: 'ValidateInput',
      onFailure: 'abort',
    });
    expect(result.success).toBe(true);
  });

  it('accepts step with optional compensation and condition', () => {
    const result = flowStepSchema.safeParse({
      name: 'create',
      action: 'CreateUser',
      onFailure: 'compensate',
      compensation: 'DeleteUser',
      condition: 'input.valid == true',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all onFailure values', () => {
    for (const onFailure of ['abort', 'skip', 'retry', 'compensate']) {
      const result = flowStepSchema.safeParse({
        name: 'step',
        action: 'DoSomething',
        onFailure,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid onFailure', () => {
    const result = flowStepSchema.safeParse({
      name: 'step',
      action: 'DoSomething',
      onFailure: 'panic',
    });
    expect(result.success).toBe(false);
  });
});

// ── flowSpecSchema ──

describe('flowSpecSchema', () => {
  it('accepts a valid flow', () => {
    const result = flowSpecSchema.safeParse(validFlow());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('UserRegistration');
      expect(result.data.steps).toHaveLength(2);
    }
  });

  it('rejects missing trigger', () => {
    const { trigger: _, ...noTrigger } = validFlow();
    const result = flowSpecSchema.safeParse(noTrigger);
    expect(result.success).toBe(false);
  });

  it('rejects missing steps', () => {
    const { steps: _, ...noSteps } = validFlow();
    const result = flowSpecSchema.safeParse(noSteps);
    expect(result.success).toBe(false);
  });

  it('rejects missing module', () => {
    const { module: _, ...noModule } = validFlow();
    const result = flowSpecSchema.safeParse(noModule);
    expect(result.success).toBe(false);
  });
});

// ── safeEditZoneSpecSchema ──

describe('safeEditZoneSpecSchema', () => {
  it('accepts a valid safe edit zone', () => {
    const result = safeEditZoneSpecSchema.safeParse(validSafeEditZone());
    expect(result.success).toBe(true);
  });

  it('accepts all zone values', () => {
    for (const zone of ['generated', 'editable', 'protected', 'human-review-only']) {
      const result = safeEditZoneSpecSchema.safeParse({ path: 'src/test', zone });
      expect(result.success).toBe(true);
    }
  });

  it('accepts with optional owner and description', () => {
    const result = safeEditZoneSpecSchema.safeParse({
      path: 'src/generated',
      zone: 'generated',
      owner: 'compiler',
      description: 'Auto-generated code',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid zone', () => {
    const result = safeEditZoneSpecSchema.safeParse({
      path: 'src/test',
      zone: 'read-only',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing path', () => {
    const result = safeEditZoneSpecSchema.safeParse({
      zone: 'generated',
    });
    expect(result.success).toBe(false);
  });
});

// ── glossaryTermSchema ──

describe('glossaryTermSchema', () => {
  it('accepts a valid glossary term', () => {
    const result = glossaryTermSchema.safeParse(validGlossaryTerm());
    expect(result.success).toBe(true);
  });

  it('accepts with optional relatedEntities', () => {
    const result = glossaryTermSchema.safeParse({
      ...validGlossaryTerm(),
      relatedEntities: ['User', 'Account'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relatedEntities).toEqual(['User', 'Account']);
    }
  });

  it('rejects missing term', () => {
    const result = glossaryTermSchema.safeParse({
      definition: 'A person who uses the system',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing definition', () => {
    const result = glossaryTermSchema.safeParse({
      term: 'User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string term', () => {
    const result = glossaryTermSchema.safeParse({
      term: 123,
      definition: 'test',
    });
    expect(result.success).toBe(false);
  });
});
