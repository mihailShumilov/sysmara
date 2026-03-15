/**
 * @module cli/commands/flow
 * CLI handlers for the `sysmara flow` subcommands: list, validate, run, and log.
 */

import * as path from 'node:path';
import type { SysmaraConfig } from '../../types/index.js';
import { parseSpecDirectory } from '../../spec/index.js';
import { FlowExecutor } from '../../flow/index.js';
import { header, success, error, info, warning, table, section, bullet } from '../format.js';

/**
 * Handles `sysmara flow list` — lists all flows with step counts.
 *
 * @param cwd - Current working directory
 * @param config - Resolved project configuration
 * @param jsonMode - Whether to output JSON
 */
export async function commandFlowList(
  cwd: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);
  const result = await parseSpecDirectory(specDir);
  if (!result.specs) {
    console.error(error('Failed to parse specs. Run "sysmara validate" for details.'));
    process.exit(1);
  }

  const executor = new FlowExecutor(result.specs);
  const flows = executor.listFlows();

  if (jsonMode) {
    console.log(JSON.stringify(flows.map((f) => ({
      name: f.name,
      description: f.description,
      trigger: f.trigger,
      module: f.module,
      stepCount: f.steps.length,
    })), null, 2));
    return;
  }

  console.log(header('Flows'));

  if (flows.length === 0) {
    console.log(info('No flows defined.'));
    return;
  }

  const rows = flows.map((f) => [
    f.name,
    f.module,
    f.trigger,
    String(f.steps.length),
    f.description,
  ]);

  console.log(table(['Name', 'Module', 'Trigger', 'Steps', 'Description'], rows));
  console.log(`\n${success(`${flows.length} flow(s) found.`)}`);
}

/**
 * Handles `sysmara flow validate <name>` — validates a flow spec.
 *
 * @param cwd - Current working directory
 * @param flowName - Name of the flow to validate
 * @param config - Resolved project configuration
 * @param jsonMode - Whether to output JSON
 */
export async function commandFlowValidate(
  cwd: string,
  flowName: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);
  const result = await parseSpecDirectory(specDir);
  if (!result.specs) {
    console.error(error('Failed to parse specs. Run "sysmara validate" for details.'));
    process.exit(1);
  }

  const executor = new FlowExecutor(result.specs);
  const validation = executor.validate(flowName);

  if (jsonMode) {
    console.log(JSON.stringify(validation, null, 2));
    return;
  }

  console.log(header(`Flow Validation: ${flowName}`));

  if (validation.valid) {
    console.log(success('Flow is valid.'));
  } else {
    console.log(error('Flow has validation errors.'));
  }

  console.log(info(`Steps: ${validation.stepCount}`));
  console.log(info(`Capabilities required: ${validation.capabilitiesRequired.join(', ')}`));

  if (validation.errors.length > 0) {
    console.log(section('Errors'));
    console.log(bullet(validation.errors));
  }

  if (validation.warnings.length > 0) {
    console.log(section('Warnings'));
    console.log(bullet(validation.warnings));
  }
}

/**
 * Handles `sysmara flow run <name> --input <json>` — executes a flow.
 * Uses a default logging capability handler.
 *
 * @param cwd - Current working directory
 * @param flowName - Name of the flow to execute
 * @param inputJson - JSON string of input data
 * @param config - Resolved project configuration
 * @param jsonMode - Whether to output JSON
 */
export async function commandFlowRun(
  cwd: string,
  flowName: string,
  inputJson: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);
  const result = await parseSpecDirectory(specDir);
  if (!result.specs) {
    console.error(error('Failed to parse specs. Run "sysmara validate" for details.'));
    process.exit(1);
  }

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(inputJson) as Record<string, unknown>;
  } catch {
    console.error(error(`Invalid JSON input: ${inputJson}`));
    process.exit(1);
  }

  const executor = new FlowExecutor(result.specs);
  const record = await executor.execute(flowName, input);

  if (jsonMode) {
    console.log(JSON.stringify(record, null, 2));
    return;
  }

  console.log(header(`Flow Execution: ${flowName}`));
  console.log(info(`ID: ${record.id}`));
  console.log(info(`Status: ${record.status}`));
  console.log(info(`Duration: ${record.totalDurationMs}ms`));

  console.log(section('Steps'));
  const stepRows = record.steps.map((s) => [
    s.stepName,
    s.action,
    s.status,
    `${s.durationMs}ms`,
    s.retryCount > 0 ? `${s.retryCount} retries` : '',
  ]);
  console.log(table(['Step', 'Action', 'Status', 'Duration', 'Retries'], stepRows));

  console.log(section('Summary'));
  console.log(info(`Steps completed: ${record.summary.stepsCompleted}/${record.summary.stepsTotal}`));
  console.log(info(`Steps skipped: ${record.summary.stepsSkipped}`));
  console.log(info(`Steps failed: ${record.summary.stepsFailed}`));
  console.log(info(`Compensations: ${record.summary.compensationsRun}`));
  console.log(info(`Capabilities invoked: ${record.summary.capabilitiesInvoked.join(', ')}`));

  if (record.error) {
    console.log(section('Error'));
    console.log(error(`[${record.error.code}] ${record.error.message}`));
  }

  if (record.status === 'completed') {
    console.log(`\n${success('Flow completed successfully.')}`);
  } else {
    console.log(`\n${warning(`Flow ended with status: ${record.status}`)}`);
  }
}

/**
 * Handles `sysmara flow log` — shows execution log summary.
 *
 * @param _cwd - Current working directory
 * @param _config - Resolved project configuration
 * @param jsonMode - Whether to output JSON
 */
export async function commandFlowLog(
  _cwd: string,
  _config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  // The execution log is in-memory so a fresh CLI invocation has no history.
  // This command demonstrates the structure for when persistent storage is added.
  const summary = {
    totalExecutions: 0,
    successRate: 0,
    averageDurationMs: 0,
    mostFrequentFlows: [],
    recentFailures: [],
  };

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(header('Flow Execution Log'));
  console.log(info('No executions recorded in this session.'));
  console.log(info('The execution log is currently in-memory and resets per CLI invocation.'));
  console.log(info('Use the FlowExecutor API for persistent execution tracking.'));
}
