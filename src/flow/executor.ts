/**
 * @module flow/executor
 * Core Flow Execution Engine for SysMARA.
 * Executes multi-step flows with saga compensation, retry with exponential backoff,
 * condition evaluation, context threading, and structured execution logging.
 *
 * Design principles:
 * 1. Steps are capabilities — each step.action maps to a CapabilitySpec
 * 2. Context threading — output of step N is available to step N+1 via context.stepOutputs
 * 3. Saga compensation — on failure, compensate completed steps in reverse order
 * 4. Retry with exponential backoff — configurable max retries and base delay
 * 5. Condition evaluation — safe expression evaluation before running a step
 * 6. Structured execution log — every state transition is recorded
 */

import { randomUUID } from 'node:crypto';
import type { SystemSpecs, FlowSpec, CapabilitySpec } from '../types/index.js';
import type {
  FlowContext,
  FlowError,
  FlowStatus,
  StepExecutionRecord,
  FlowExecutionRecord,
  FlowSummary,
  FlowValidationResult,
} from './types.js';
import { evaluateCondition } from './condition-evaluator.js';
import { FlowExecutionLog } from './execution-log.js';

/**
 * A pluggable capability handler function.
 * Allows testing without a real database by providing in-memory handlers.
 *
 * @param capability - The capability name to invoke
 * @param input - The input data for the capability
 * @param context - The current flow context
 * @returns The output of the capability execution
 */
export type CapabilityHandler = (
  capability: string,
  input: Record<string, unknown>,
  context: FlowContext,
) => Promise<unknown>;

/**
 * Configuration options for the FlowExecutor.
 *
 * @property maxRetries - Maximum number of retry attempts for steps with onFailure:"retry" (default: 3)
 * @property retryBaseDelayMs - Base delay in milliseconds for exponential backoff (default: 100)
 * @property capabilityHandler - Pluggable function that executes capabilities
 */
export interface FlowExecutorConfig {
  maxRetries?: number;
  retryBaseDelayMs?: number;
  capabilityHandler?: CapabilityHandler;
}

/**
 * Default capability handler that logs invocations but performs no real operations.
 * Used when no custom handler is provided.
 */
const defaultCapabilityHandler: CapabilityHandler = async (
  capability: string,
  input: Record<string, unknown>,
  _context: FlowContext,
): Promise<unknown> => {
  return { capability, input, status: 'executed' };
};

/**
 * The core Flow Execution Engine. Executes flows defined in SystemSpecs
 * with full saga compensation, retry logic, condition evaluation,
 * and structured execution logging.
 *
 * @example
 * ```ts
 * const executor = new FlowExecutor(specs, {
 *   capabilityHandler: async (cap, input) => {
 *     // Custom capability execution logic
 *     return myService.execute(cap, input);
 *   },
 * });
 *
 * const result = await executor.execute('user_signup', { email: 'alice@example.com' });
 * console.log(result.summary);
 * ```
 */
export class FlowExecutor {
  /** Maximum retry attempts for steps with onFailure:"retry". */
  private maxRetries: number;

  /** Base delay in ms for exponential backoff. */
  private retryBaseDelayMs: number;

  /** The pluggable capability handler. */
  private capabilityHandler: CapabilityHandler;

  /** Map of flow names to their specs for fast lookup. */
  private flowMap: Map<string, FlowSpec>;

  /** Map of capability names to their specs for validation. */
  private capabilityMap: Map<string, CapabilitySpec>;

  /** The execution log instance. */
  private executionLog: FlowExecutionLog;

  /**
   * Creates a new FlowExecutor.
   *
   * @param specs - The complete system specifications
   * @param config - Optional executor configuration
   */
  constructor(
    specs: SystemSpecs,
    config: FlowExecutorConfig = {},
  ) {
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 100;
    this.capabilityHandler = config.capabilityHandler ?? defaultCapabilityHandler;
    this.flowMap = new Map(specs.flows.map((f) => [f.name, f]));
    this.capabilityMap = new Map(specs.capabilities.map((c) => [c.name, c]));
    this.executionLog = new FlowExecutionLog();
  }

  /**
   * Executes a flow by name with the given input and optional actor context.
   * Records the full execution in the execution log.
   *
   * @param flowName - The name of the flow to execute
   * @param input - Initial input data for the flow
   * @param actor - Optional actor context for policy evaluation
   * @returns A complete FlowExecutionRecord with all step details and summary
   * @throws Never — errors are captured in the execution record
   */
  async execute(
    flowName: string,
    input: Record<string, unknown>,
    actor?: Record<string, unknown>,
  ): Promise<FlowExecutionRecord> {
    const flow = this.flowMap.get(flowName);
    if (!flow) {
      const error: FlowError = {
        code: 'FLOW_NOT_FOUND',
        message: `Flow "${flowName}" not found in system specs. Available: [${[...this.flowMap.keys()].join(', ')}]`,
      };
      const record = this.buildRecord(
        flowName,
        'failed',
        input,
        [],
        error,
        new Date(),
      );
      this.executionLog.record(record);
      return record;
    }

    const startTime = new Date();
    const context: FlowContext = {
      flowId: randomUUID(),
      flowName,
      triggeredBy: flow.trigger,
      input,
      output: {},
      stepOutputs: {},
      actor,
      startedAt: startTime.toISOString(),
    };

    const stepRecords: StepExecutionRecord[] = [];
    const completedSteps: Array<{ stepIndex: number; record: StepExecutionRecord }> = [];
    let flowStatus: FlowStatus = 'running';
    let flowError: FlowError | undefined;

    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i]!;

      // Check condition before running
      if (step.condition) {
        let conditionResult: boolean;
        try {
          conditionResult = evaluateCondition(step.condition, context);
        } catch (condErr) {
          const err = condErr instanceof Error ? condErr : new Error(String(condErr));
          conditionResult = false;
          // Condition evaluation failure → skip step with warning
          const stepRecord: StepExecutionRecord = {
            stepName: step.name,
            action: step.action,
            status: 'skipped',
            input: { ...context.input, ...context.stepOutputs },
            error: {
              step: step.name,
              code: 'CONDITION_EVAL_ERROR',
              message: err.message,
              capability: step.action,
            },
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 0,
            retryCount: 0,
            compensationRun: false,
          };
          stepRecords.push(stepRecord);
          continue;
        }

        if (!conditionResult) {
          const stepRecord: StepExecutionRecord = {
            stepName: step.name,
            action: step.action,
            status: 'skipped',
            input: { ...context.input, ...context.stepOutputs },
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 0,
            retryCount: 0,
            compensationRun: false,
          };
          stepRecords.push(stepRecord);
          continue;
        }
      }

      const stepStart = Date.now();
      const stepInput: Record<string, unknown> = { ...context.input, ...context.stepOutputs };
      let stepRecord: StepExecutionRecord = {
        stepName: step.name,
        action: step.action,
        status: 'running',
        input: stepInput,
        startedAt: new Date().toISOString(),
        durationMs: 0,
        retryCount: 0,
        compensationRun: false,
      };

      let success = false;
      let lastError: FlowError | undefined;

      if (step.onFailure === 'retry') {
        // Retry with exponential backoff
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
          try {
            const output = await this.capabilityHandler(step.action, stepInput, context);
            stepRecord.output = output;
            stepRecord.status = 'completed';
            stepRecord.retryCount = attempt;
            context.stepOutputs[step.name] = output;
            success = true;
            break;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            lastError = {
              step: step.name,
              code: 'STEP_FAILED',
              message: error.message,
              capability: step.action,
            };
            stepRecord.retryCount = attempt + 1;
            if (attempt < this.maxRetries) {
              const delay = this.retryBaseDelayMs * Math.pow(2, attempt);
              await this.sleep(delay);
            }
          }
        }

        if (!success) {
          stepRecord.status = 'failed';
          stepRecord.error = lastError;
          flowStatus = 'failed';
          flowError = lastError;
        }
      } else {
        // Single attempt
        try {
          const output = await this.capabilityHandler(step.action, stepInput, context);
          stepRecord.output = output;
          stepRecord.status = 'completed';
          context.stepOutputs[step.name] = output;
          success = true;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          lastError = {
            step: step.name,
            code: 'STEP_FAILED',
            message: error.message,
            capability: step.action,
          };
          stepRecord.error = lastError;
          stepRecord.status = 'failed';
        }
      }

      stepRecord.durationMs = Date.now() - stepStart;
      stepRecord.completedAt = new Date().toISOString();
      stepRecords.push(stepRecord);

      if (success) {
        completedSteps.push({ stepIndex: i, record: stepRecord });
        continue;
      }

      // Handle failure based on onFailure strategy
      switch (step.onFailure) {
        case 'abort':
          flowStatus = 'failed';
          flowError = lastError;
          break;

        case 'skip':
          stepRecord.status = 'skipped';
          stepRecord.error = lastError;
          continue; // proceed to next step

        case 'compensate': {
          flowStatus = 'compensating';
          flowError = lastError;
          const compensationRecords = await this.runCompensation(
            flow,
            completedSteps,
            context,
          );
          stepRecords.push(...compensationRecords);
          const allCompensated = compensationRecords.every(
            (r) => r.status === 'compensated',
          );
          flowStatus = allCompensated ? 'compensated' : 'failed';
          break;
        }

        case 'retry':
          // Already handled above — if we're here, all retries failed
          flowStatus = 'failed';
          flowError = lastError;
          break;
      }

      // If flow is in a terminal state, stop processing steps
      if (flowStatus === 'failed' || flowStatus === 'compensated') {
        break;
      }
    }

    if (flowStatus === 'running') {
      flowStatus = 'completed';
      context.output = context.stepOutputs;
    }

    const record = this.buildRecord(
      flowName,
      flowStatus,
      input,
      stepRecords,
      flowError,
      startTime,
      flowStatus === 'completed' ? context.output : undefined,
      context.flowId,
    );

    this.executionLog.record(record);
    return record;
  }

  /**
   * Validates a flow spec before execution.
   * Checks that all step actions map to existing capabilities and
   * all compensation actions exist.
   *
   * @param flowName - The name of the flow to validate
   * @returns A validation result with errors, warnings, and required capabilities
   */
  validate(flowName: string): FlowValidationResult {
    const flow = this.flowMap.get(flowName);
    if (!flow) {
      return {
        valid: false,
        errors: [`Flow "${flowName}" not found in system specs`],
        warnings: [],
        stepCount: 0,
        capabilitiesRequired: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const capabilitiesRequired: string[] = [];

    for (const step of flow.steps) {
      capabilitiesRequired.push(step.action);

      if (!this.capabilityMap.has(step.action)) {
        errors.push(
          `Step "${step.name}" references unknown capability "${step.action}"`,
        );
      }

      if (step.onFailure === 'compensate' && step.compensation) {
        capabilitiesRequired.push(step.compensation);
        if (!this.capabilityMap.has(step.compensation)) {
          errors.push(
            `Step "${step.name}" compensation references unknown capability "${step.compensation}"`,
          );
        }
      }

      if (step.onFailure === 'compensate' && !step.compensation) {
        warnings.push(
          `Step "${step.name}" has onFailure:"compensate" but no compensation capability defined`,
        );
      }
    }

    // Check trigger capability exists
    if (!this.capabilityMap.has(flow.trigger)) {
      warnings.push(
        `Flow trigger capability "${flow.trigger}" not found in system specs`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stepCount: flow.steps.length,
      capabilitiesRequired: [...new Set(capabilitiesRequired)],
    };
  }

  /**
   * Returns all registered flow specs.
   *
   * @returns Array of all FlowSpec definitions
   */
  listFlows(): FlowSpec[] {
    return [...this.flowMap.values()];
  }

  /**
   * Returns the execution log instance for querying past executions.
   *
   * @returns The FlowExecutionLog instance
   */
  getExecutionLog(): FlowExecutionLog {
    return this.executionLog;
  }

  /**
   * Runs saga compensation for all previously completed steps in reverse order.
   * For each completed step that has a compensation capability, invokes the
   * compensation handler.
   */
  private async runCompensation(
    flow: FlowSpec,
    completedSteps: Array<{ stepIndex: number; record: StepExecutionRecord }>,
    context: FlowContext,
  ): Promise<StepExecutionRecord[]> {
    const compensationRecords: StepExecutionRecord[] = [];

    // Process in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const { stepIndex } = completedSteps[i]!;
      const step = flow.steps[stepIndex]!;

      if (!step.compensation) {
        continue;
      }

      const compStart = Date.now();
      const compInput: Record<string, unknown> = {
        ...context.input,
        originalOutput: completedSteps[i]!.record.output,
      };

      const compRecord: StepExecutionRecord = {
        stepName: `compensate:${step.name}`,
        action: step.compensation,
        status: 'compensating',
        input: compInput,
        startedAt: new Date().toISOString(),
        durationMs: 0,
        retryCount: 0,
        compensationRun: true,
      };

      try {
        const output = await this.capabilityHandler(step.compensation, compInput, context);
        compRecord.output = output;
        compRecord.status = 'compensated';
        // Mark original step as compensated too
        completedSteps[i]!.record.compensationRun = true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        compRecord.status = 'failed';
        compRecord.error = {
          step: `compensate:${step.name}`,
          code: 'COMPENSATION_FAILED',
          message: error.message,
          capability: step.compensation,
        };
      }

      compRecord.durationMs = Date.now() - compStart;
      compRecord.completedAt = new Date().toISOString();
      compensationRecords.push(compRecord);
    }

    return compensationRecords;
  }

  /**
   * Builds a complete FlowExecutionRecord with summary.
   */
  private buildRecord(
    flowName: string,
    status: FlowStatus,
    input: Record<string, unknown>,
    steps: StepExecutionRecord[],
    error: FlowError | undefined,
    startTime: Date,
    output?: Record<string, unknown>,
    flowId?: string,
  ): FlowExecutionRecord {
    const now = new Date();
    const totalDurationMs = now.getTime() - startTime.getTime();

    // Build summary
    const summary = this.buildSummary(flowName, steps);

    return {
      id: flowId ?? randomUUID(),
      flowName,
      status,
      triggeredBy: this.flowMap.get(flowName)?.trigger ?? 'unknown',
      input,
      output,
      steps,
      error,
      startedAt: startTime.toISOString(),
      completedAt: now.toISOString(),
      totalDurationMs,
      summary,
    };
  }

  /**
   * Builds an AI-readable summary from step execution records.
   */
  private buildSummary(_flowName: string, steps: StepExecutionRecord[]): FlowSummary {
    const capabilitiesInvoked = [...new Set(steps.map((s) => s.action))];

    // Resolve entities affected by the invoked capabilities
    const entitiesAffected = new Set<string>();
    for (const capName of capabilitiesInvoked) {
      const cap = this.capabilityMap.get(capName);
      if (cap) {
        for (const entity of cap.entities) {
          entitiesAffected.add(entity);
        }
      }
    }

    return {
      stepsTotal: steps.length,
      stepsCompleted: steps.filter((s) => s.status === 'completed').length,
      stepsSkipped: steps.filter((s) => s.status === 'skipped').length,
      stepsFailed: steps.filter((s) => s.status === 'failed').length,
      compensationsRun: steps.filter((s) => s.compensationRun).length,
      capabilitiesInvoked,
      entitiesAffected: [...entitiesAffected].sort(),
    };
  }

  /**
   * Sleeps for the given number of milliseconds.
   * Extracted for testability.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
