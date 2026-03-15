import { FlowExecutor } from '../../src/flow/executor.js';
import { FlowExecutionLog } from '../../src/flow/execution-log.js';
import { evaluateCondition } from '../../src/flow/condition-evaluator.js';
import type { SystemSpecs } from '../../src/types/index.js';
import type { CapabilityHandler } from '../../src/flow/executor.js';
import type { FlowContext } from '../../src/flow/types.js';

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

function makeTestSpecs(): SystemSpecs {
  return makeSpecs({
    entities: [
      { name: 'user', description: 'A user', fields: [], module: 'auth', invariants: [] },
      { name: 'profile', description: 'A profile', fields: [], module: 'auth', invariants: [] },
    ],
    capabilities: [
      {
        name: 'create_user', description: 'Creates a user', module: 'auth',
        entities: ['user'], input: [], output: [], policies: [], invariants: [],
      },
      {
        name: 'create_profile', description: 'Creates a profile', module: 'auth',
        entities: ['profile'], input: [], output: [], policies: [], invariants: [],
      },
      {
        name: 'send_welcome_email', description: 'Sends welcome email', module: 'auth',
        entities: [], input: [], output: [], policies: [], invariants: [],
        sideEffects: ['email'],
      },
      {
        name: 'delete_user', description: 'Deletes a user', module: 'auth',
        entities: ['user'], input: [], output: [], policies: [], invariants: [],
      },
      {
        name: 'delete_profile', description: 'Deletes a profile', module: 'auth',
        entities: ['profile'], input: [], output: [], policies: [], invariants: [],
      },
      {
        name: 'user_signup', description: 'Triggers signup flow', module: 'auth',
        entities: ['user'], input: [], output: [], policies: [], invariants: [],
      },
    ],
    flows: [
      {
        name: 'user_signup_flow',
        description: 'Full user signup process',
        trigger: 'user_signup',
        module: 'auth',
        steps: [
          { name: 'create_user_step', action: 'create_user', onFailure: 'abort' },
          { name: 'create_profile_step', action: 'create_profile', onFailure: 'abort' },
          { name: 'send_email_step', action: 'send_welcome_email', onFailure: 'skip' },
        ],
      },
      {
        name: 'compensating_flow',
        description: 'Flow with compensation',
        trigger: 'user_signup',
        module: 'auth',
        steps: [
          { name: 'step1', action: 'create_user', onFailure: 'compensate', compensation: 'delete_user' },
          { name: 'step2', action: 'create_profile', onFailure: 'compensate', compensation: 'delete_profile' },
          { name: 'step3', action: 'send_welcome_email', onFailure: 'compensate' },
        ],
      },
      {
        name: 'retry_flow',
        description: 'Flow with retry',
        trigger: 'user_signup',
        module: 'auth',
        steps: [
          { name: 'retry_step', action: 'create_user', onFailure: 'retry' },
        ],
      },
      {
        name: 'conditional_flow',
        description: 'Flow with conditions',
        trigger: 'user_signup',
        module: 'auth',
        steps: [
          { name: 'always_step', action: 'create_user', onFailure: 'abort' },
          {
            name: 'admin_only_step',
            action: 'create_profile',
            onFailure: 'abort',
            condition: 'context.input.role === "admin"',
          },
          { name: 'final_step', action: 'send_welcome_email', onFailure: 'abort' },
        ],
      },
    ],
  });
}

// --- Test Suite ---

describe('FlowExecutor', () => {
  describe('happy path', () => {
    it('should execute all steps successfully and return completed status', async () => {
      const specs = makeTestSpecs();
      const outputs: Record<string, unknown> = {
        create_user: { id: 'user-1', email: 'alice@example.com' },
        create_profile: { id: 'profile-1', userId: 'user-1' },
        send_welcome_email: { sent: true },
      };

      const handler: CapabilityHandler = async (cap) => {
        return outputs[cap] ?? {};
      };

      const executor = new FlowExecutor(specs, { capabilityHandler: handler });
      const result = await executor.execute('user_signup_flow', { email: 'alice@example.com' });

      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(3);
      expect(result.steps.every((s) => s.status === 'completed')).toBe(true);
      expect(result.summary.stepsCompleted).toBe(3);
      expect(result.summary.stepsTotal).toBe(3);
      expect(result.summary.stepsFailed).toBe(0);
      expect(result.summary.stepsSkipped).toBe(0);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });
  });

  describe('onFailure: abort', () => {
    it('should stop execution and record error when a step fails', async () => {
      const specs = makeTestSpecs();
      let callCount = 0;
      const handler: CapabilityHandler = async (cap) => {
        callCount++;
        if (cap === 'create_profile') {
          throw new Error('Profile creation failed');
        }
        return { id: 'user-1' };
      };

      const executor = new FlowExecutor(specs, { capabilityHandler: handler });
      const result = await executor.execute('user_signup_flow', { email: 'test@example.com' });

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('STEP_FAILED');
      expect(result.error!.message).toBe('Profile creation failed');
      expect(result.error!.step).toBe('create_profile_step');
      // Should have stopped after step 2 — step 3 never runs
      expect(callCount).toBe(2);
      expect(result.steps[0]!.status).toBe('completed');
      expect(result.steps[1]!.status).toBe('failed');
      expect(result.steps).toHaveLength(2);
    });
  });

  describe('onFailure: skip', () => {
    it('should skip failed step and continue flow execution', async () => {
      const specs = makeTestSpecs();
      const handler: CapabilityHandler = async (cap) => {
        if (cap === 'send_welcome_email') {
          throw new Error('Email service down');
        }
        return { id: 'ok' };
      };

      const executor = new FlowExecutor(specs, { capabilityHandler: handler });
      const result = await executor.execute('user_signup_flow', { email: 'test@example.com' });

      // Flow still completes because send_welcome_email has onFailure: skip
      expect(result.status).toBe('completed');
      expect(result.steps[0]!.status).toBe('completed');
      expect(result.steps[1]!.status).toBe('completed');
      expect(result.steps[2]!.status).toBe('skipped');
      expect(result.summary.stepsSkipped).toBe(1);
    });
  });

  describe('onFailure: compensate', () => {
    it('should run compensation in reverse order for completed steps', async () => {
      const specs = makeTestSpecs();
      const callOrder: string[] = [];

      const handler: CapabilityHandler = async (cap) => {
        callOrder.push(cap);
        if (cap === 'send_welcome_email') {
          throw new Error('Email failed');
        }
        return { id: `${cap}-result` };
      };

      const executor = new FlowExecutor(specs, { capabilityHandler: handler });
      const result = await executor.execute('compensating_flow', { email: 'test@example.com' });

      expect(result.status).toBe('compensated');

      // Verify compensation ran in reverse order:
      // Forward: create_user, create_profile, send_welcome_email (fail)
      // Compensation: delete_profile (comp for step2), delete_user (comp for step1)
      expect(callOrder).toEqual([
        'create_user',
        'create_profile',
        'send_welcome_email',
        'delete_profile',
        'delete_user',
      ]);

      // Verify compensation step records
      const compSteps = result.steps.filter((s) => s.compensationRun);
      expect(compSteps.length).toBeGreaterThanOrEqual(2);
    });

    it('should report failed status if compensation itself fails', async () => {
      const specs = makeTestSpecs();
      const handler: CapabilityHandler = async (cap) => {
        if (cap === 'send_welcome_email') {
          throw new Error('Email failed');
        }
        if (cap === 'delete_user') {
          throw new Error('Cannot delete user');
        }
        return { ok: true };
      };

      const executor = new FlowExecutor(specs, { capabilityHandler: handler });
      const result = await executor.execute('compensating_flow', {});

      expect(result.status).toBe('failed');
    });
  });

  describe('onFailure: retry', () => {
    it('should retry with exponential backoff and succeed on later attempt', async () => {
      const specs = makeTestSpecs();
      let attempts = 0;

      const handler: CapabilityHandler = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient failure');
        }
        return { id: 'success' };
      };

      const executor = new FlowExecutor(specs, {
        capabilityHandler: handler,
        maxRetries: 3,
        retryBaseDelayMs: 10, // fast for tests
      });
      const result = await executor.execute('retry_flow', {});

      expect(result.status).toBe('completed');
      expect(attempts).toBe(3);
      expect(result.steps[0]!.retryCount).toBe(2); // 0-indexed attempt where it succeeded
    });

    it('should fail after exhausting all retries', async () => {
      const specs = makeTestSpecs();

      const handler: CapabilityHandler = async () => {
        throw new Error('Persistent failure');
      };

      const executor = new FlowExecutor(specs, {
        capabilityHandler: handler,
        maxRetries: 2,
        retryBaseDelayMs: 10,
      });
      const result = await executor.execute('retry_flow', {});

      expect(result.status).toBe('failed');
      expect(result.steps[0]!.retryCount).toBe(3); // maxRetries + 1 attempts total
      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe('Persistent failure');
    });
  });

  describe('condition evaluation', () => {
    it('should skip step when condition is false', async () => {
      const specs = makeTestSpecs();
      const handler: CapabilityHandler = async (cap) => ({ cap, ok: true });

      const executor = new FlowExecutor(specs, { capabilityHandler: handler });
      const result = await executor.execute('conditional_flow', { role: 'member' });

      expect(result.status).toBe('completed');
      // Step 'admin_only_step' should be skipped because role !== "admin"
      const adminStep = result.steps.find((s) => s.stepName === 'admin_only_step');
      expect(adminStep).toBeDefined();
      expect(adminStep!.status).toBe('skipped');

      // Other steps should complete
      expect(result.steps.find((s) => s.stepName === 'always_step')!.status).toBe('completed');
      expect(result.steps.find((s) => s.stepName === 'final_step')!.status).toBe('completed');
    });

    it('should execute step when condition is true', async () => {
      const specs = makeTestSpecs();
      const handler: CapabilityHandler = async (cap) => ({ cap, ok: true });

      const executor = new FlowExecutor(specs, { capabilityHandler: handler });
      const result = await executor.execute('conditional_flow', { role: 'admin' });

      expect(result.status).toBe('completed');
      expect(result.steps.every((s) => s.status === 'completed')).toBe(true);
    });
  });

  describe('context threading', () => {
    it('should make step output available to subsequent steps', async () => {
      const specs = makeTestSpecs();
      const receivedInputs: Record<string, Record<string, unknown>> = {};

      const handler: CapabilityHandler = async (cap, input) => {
        receivedInputs[cap] = { ...input };
        if (cap === 'create_user') {
          return { id: 'user-42', email: 'alice@example.com' };
        }
        if (cap === 'create_profile') {
          return { profileId: 'profile-7' };
        }
        return { sent: true };
      };

      const executor = new FlowExecutor(specs, { capabilityHandler: handler });
      const result = await executor.execute('user_signup_flow', { email: 'alice@example.com' });

      expect(result.status).toBe('completed');

      // Step 2 should receive step 1's output in its input via stepOutputs
      expect(receivedInputs['create_profile']!['create_user_step']).toEqual({
        id: 'user-42',
        email: 'alice@example.com',
      });

      // Step 3 should receive both step 1 and 2 outputs
      expect(receivedInputs['send_welcome_email']!['create_user_step']).toEqual({
        id: 'user-42',
        email: 'alice@example.com',
      });
      expect(receivedInputs['send_welcome_email']!['create_profile_step']).toEqual({
        profileId: 'profile-7',
      });
    });
  });

  describe('flow not found', () => {
    it('should return failed record with FLOW_NOT_FOUND error', async () => {
      const specs = makeTestSpecs();
      const executor = new FlowExecutor(specs);
      const result = await executor.execute('nonexistent_flow', {});

      expect(result.status).toBe('failed');
      expect(result.error!.code).toBe('FLOW_NOT_FOUND');
    });
  });

  describe('validate', () => {
    it('should return valid for a well-defined flow', () => {
      const specs = makeTestSpecs();
      const executor = new FlowExecutor(specs);
      const result = executor.validate('user_signup_flow');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stepCount).toBe(3);
      expect(result.capabilitiesRequired).toContain('create_user');
    });

    it('should return errors for undefined capabilities', () => {
      const specs = makeSpecs({
        flows: [{
          name: 'broken_flow',
          description: 'A broken flow',
          trigger: 'unknown_trigger',
          module: 'auth',
          steps: [
            { name: 'step1', action: 'nonexistent_cap', onFailure: 'abort' },
          ],
        }],
      });

      const executor = new FlowExecutor(specs);
      const result = executor.validate('broken_flow');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('nonexistent_cap');
    });
  });

  describe('listFlows', () => {
    it('should return all registered flows', () => {
      const specs = makeTestSpecs();
      const executor = new FlowExecutor(specs);
      const flows = executor.listFlows();

      expect(flows.length).toBe(4);
      expect(flows.map((f) => f.name)).toContain('user_signup_flow');
    });
  });
});

describe('FlowExecutionLog', () => {
  describe('summarize', () => {
    it('should return correct stats for recorded executions', () => {
      const log = new FlowExecutionLog();

      // Record 3 executions: 2 completed, 1 failed
      log.record({
        id: 'exec-1', flowName: 'flow_a', status: 'completed',
        triggeredBy: 'cap_a', input: {}, steps: [], startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T00:00:01Z', totalDurationMs: 100,
        summary: { stepsTotal: 2, stepsCompleted: 2, stepsSkipped: 0, stepsFailed: 0, compensationsRun: 0, capabilitiesInvoked: [], entitiesAffected: [] },
      });
      log.record({
        id: 'exec-2', flowName: 'flow_a', status: 'completed',
        triggeredBy: 'cap_a', input: {}, steps: [], startedAt: '2026-01-01T00:00:02Z',
        completedAt: '2026-01-01T00:00:03Z', totalDurationMs: 200,
        summary: { stepsTotal: 2, stepsCompleted: 2, stepsSkipped: 0, stepsFailed: 0, compensationsRun: 0, capabilitiesInvoked: [], entitiesAffected: [] },
      });
      log.record({
        id: 'exec-3', flowName: 'flow_b', status: 'failed',
        triggeredBy: 'cap_b', input: {},
        error: { code: 'STEP_FAILED', message: 'Something broke' },
        steps: [], startedAt: '2026-01-01T00:00:04Z',
        completedAt: '2026-01-01T00:00:05Z', totalDurationMs: 300,
        summary: { stepsTotal: 3, stepsCompleted: 1, stepsSkipped: 0, stepsFailed: 1, compensationsRun: 0, capabilitiesInvoked: [], entitiesAffected: [] },
      });

      const summary = log.summarize();

      expect(summary.totalExecutions).toBe(3);
      expect(summary.successRate).toBeCloseTo(2 / 3);
      expect(summary.averageDurationMs).toBe(200); // (100+200+300)/3
      expect(summary.mostFrequentFlows[0]!.name).toBe('flow_a');
      expect(summary.mostFrequentFlows[0]!.count).toBe(2);
      expect(summary.recentFailures).toHaveLength(1);
      expect(summary.recentFailures[0]!.flowName).toBe('flow_b');
    });

    it('should return empty summary when no executions recorded', () => {
      const log = new FlowExecutionLog();
      const summary = log.summarize();

      expect(summary.totalExecutions).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.averageDurationMs).toBe(0);
      expect(summary.mostFrequentFlows).toHaveLength(0);
      expect(summary.recentFailures).toHaveLength(0);
    });
  });
});

describe('evaluateCondition', () => {
  function makeContext(overrides: Partial<FlowContext> = {}): FlowContext {
    return {
      flowId: 'test-id',
      flowName: 'test-flow',
      triggeredBy: 'test-trigger',
      input: {},
      output: {},
      stepOutputs: {},
      startedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('should evaluate string equality', () => {
    const ctx = makeContext({ input: { role: 'admin' } });
    expect(evaluateCondition('context.input.role === "admin"', ctx)).toBe(true);
    expect(evaluateCondition('context.input.role === "member"', ctx)).toBe(false);
  });

  it('should evaluate inequality', () => {
    const ctx = makeContext({ input: { role: 'admin' } });
    expect(evaluateCondition('context.input.role !== "member"', ctx)).toBe(true);
  });

  it('should evaluate numeric comparisons', () => {
    const ctx = makeContext({ input: { amount: 1500 } });
    expect(evaluateCondition('context.input.amount > 1000', ctx)).toBe(true);
    expect(evaluateCondition('context.input.amount < 1000', ctx)).toBe(false);
    expect(evaluateCondition('context.input.amount >= 1500', ctx)).toBe(true);
  });

  it('should evaluate null checks', () => {
    const ctx = makeContext({ stepOutputs: { create_user: { id: 'abc' } } });
    expect(evaluateCondition('context.stepOutputs.create_user.id !== null', ctx)).toBe(true);
  });

  it('should evaluate boolean literals', () => {
    const ctx = makeContext({ input: { active: true } });
    expect(evaluateCondition('context.input.active === true', ctx)).toBe(true);
  });

  it('should return true for empty condition', () => {
    const ctx = makeContext();
    expect(evaluateCondition('', ctx)).toBe(true);
  });

  it('should handle logical AND', () => {
    const ctx = makeContext({ input: { role: 'admin', active: true } });
    expect(evaluateCondition('context.input.role === "admin" && context.input.active === true', ctx)).toBe(true);
    expect(evaluateCondition('context.input.role === "member" && context.input.active === true', ctx)).toBe(false);
  });

  it('should handle logical OR', () => {
    const ctx = makeContext({ input: { role: 'member' } });
    expect(evaluateCondition('context.input.role === "admin" || context.input.role === "member"', ctx)).toBe(true);
  });
});
