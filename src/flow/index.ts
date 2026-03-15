/**
 * @module flow
 * Flow Execution Engine for SysMARA.
 * Provides multi-step flow execution with saga compensation, retry,
 * condition evaluation, and AI-readable execution logging.
 */

export { FlowExecutor } from './executor.js';
export type { CapabilityHandler, FlowExecutorConfig } from './executor.js';
export { FlowExecutionLog } from './execution-log.js';
export { evaluateCondition } from './condition-evaluator.js';
export type {
  FlowStatus,
  StepStatus,
  FlowContext,
  FlowError,
  StepExecutionRecord,
  FlowExecutionRecord,
  FlowSummary,
  FlowValidationResult,
  FlowLogSummary,
} from './types.js';
