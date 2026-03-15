/**
 * @module flow/types
 * Type definitions for the Flow Execution Engine.
 * All types are machine-readable and designed for AI agent consumption.
 */

/** Status of an entire flow execution. */
export type FlowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';

/** Status of a single step within a flow execution. */
export type StepStatus = 'pending' | 'skipped' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';

/**
 * Runtime context threaded through a flow execution.
 * Carries input, accumulated step outputs, and actor information.
 *
 * @property flowId - Unique execution ID (uuid)
 * @property flowName - The spec name of the flow being executed
 * @property triggeredBy - The capability name that triggered this flow
 * @property input - Initial input data passed to the flow
 * @property output - Final output data after flow completion
 * @property stepOutputs - Map of step name to its output value
 * @property actor - Optional actor context for policy evaluation
 * @property startedAt - ISO 8601 timestamp when execution started
 * @property completedAt - ISO 8601 timestamp when execution completed
 */
export interface FlowContext {
  flowId: string;
  flowName: string;
  triggeredBy: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
  actor?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

/**
 * A structured error produced during flow or step execution.
 *
 * @property step - The step name where the error occurred
 * @property code - Machine-readable error code
 * @property message - Human-readable error description
 * @property capability - The capability that was being invoked when the error occurred
 */
export interface FlowError {
  step?: string;
  code: string;
  message: string;
  capability?: string;
}

/**
 * Record of a single step's execution within a flow.
 *
 * @property stepName - The step name from the flow spec
 * @property action - The capability name invoked by this step
 * @property status - Current execution status of this step
 * @property input - Input data passed to the step's capability
 * @property output - Output data returned by the step's capability
 * @property error - Error details if the step failed
 * @property startedAt - ISO 8601 timestamp when the step started
 * @property completedAt - ISO 8601 timestamp when the step completed
 * @property durationMs - Execution duration in milliseconds
 * @property retryCount - Number of retry attempts made
 * @property compensationRun - Whether this step's compensation was executed
 */
export interface StepExecutionRecord {
  stepName: string;
  action: string;
  status: StepStatus;
  input: Record<string, unknown>;
  output?: unknown;
  error?: FlowError;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  retryCount: number;
  compensationRun: boolean;
}

/**
 * AI-readable summary of a flow execution's outcomes.
 *
 * @property stepsTotal - Total number of steps in the flow
 * @property stepsCompleted - Number of steps that completed successfully
 * @property stepsSkipped - Number of steps that were skipped
 * @property stepsFailed - Number of steps that failed
 * @property compensationsRun - Number of compensation steps executed
 * @property capabilitiesInvoked - List of capability names that were invoked
 * @property entitiesAffected - List of entity names affected by the flow
 */
export interface FlowSummary {
  stepsTotal: number;
  stepsCompleted: number;
  stepsSkipped: number;
  stepsFailed: number;
  compensationsRun: number;
  capabilitiesInvoked: string[];
  entitiesAffected: string[];
}

/**
 * Complete record of a flow execution, including all step records
 * and an AI-readable summary.
 *
 * @property id - Unique execution ID
 * @property flowName - The spec name of the flow
 * @property status - Final execution status
 * @property triggeredBy - The capability that triggered this flow
 * @property input - Initial input data
 * @property output - Final output data
 * @property steps - Ordered list of step execution records
 * @property error - Error details if the flow failed
 * @property startedAt - ISO 8601 timestamp when execution started
 * @property completedAt - ISO 8601 timestamp when execution completed
 * @property totalDurationMs - Total execution duration in milliseconds
 * @property summary - AI-readable execution summary
 */
export interface FlowExecutionRecord {
  id: string;
  flowName: string;
  status: FlowStatus;
  triggeredBy: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  steps: StepExecutionRecord[];
  error?: FlowError;
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;
  summary: FlowSummary;
}

/**
 * Result of validating a flow spec before execution.
 *
 * @property valid - Whether the flow spec is valid
 * @property errors - List of validation error messages
 * @property warnings - List of validation warning messages
 * @property stepCount - Number of steps in the flow
 * @property capabilitiesRequired - List of capability names required by the flow
 */
export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stepCount: number;
  capabilitiesRequired: string[];
}

/**
 * Summary of the execution log for AI consumption.
 *
 * @property totalExecutions - Total number of flow executions
 * @property successRate - Ratio of successful executions (0-1)
 * @property averageDurationMs - Average execution duration in milliseconds
 * @property mostFrequentFlows - Flows ordered by execution frequency
 * @property recentFailures - Most recent failed executions
 */
export interface FlowLogSummary {
  totalExecutions: number;
  successRate: number;
  averageDurationMs: number;
  mostFrequentFlows: Array<{ name: string; count: number }>;
  recentFailures: Array<{ flowId: string; flowName: string; error: FlowError; timestamp: string }>;
}
