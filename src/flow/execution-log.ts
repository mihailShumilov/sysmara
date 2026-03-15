/**
 * @module flow/execution-log
 * In-memory execution log for flow executions.
 * Stores all flow execution records and provides AI-readable summaries.
 */

import type { FlowExecutionRecord, FlowLogSummary } from './types.js';

/**
 * In-memory store for flow execution records.
 * Records every flow execution and provides query and summarization APIs
 * designed for AI agent consumption.
 */
export class FlowExecutionLog {
  /** Internal storage of execution records keyed by flow execution ID. */
  private records: Map<string, FlowExecutionRecord> = new Map();

  /**
   * Records a flow execution in the log.
   *
   * @param execution - The flow execution record to store
   */
  record(execution: FlowExecutionRecord): void {
    this.records.set(execution.id, execution);
  }

  /**
   * Retrieves a flow execution record by its unique ID.
   *
   * @param flowId - The flow execution ID
   * @returns The execution record, or undefined if not found
   */
  get(flowId: string): FlowExecutionRecord | undefined {
    return this.records.get(flowId);
  }

  /**
   * Returns all stored flow execution records in insertion order.
   *
   * @returns Array of all execution records
   */
  list(): FlowExecutionRecord[] {
    return [...this.records.values()];
  }

  /**
   * Generates an AI-readable summary of all recorded flow executions.
   * Includes success rate, average duration, most frequent flows,
   * and recent failures.
   *
   * @returns A structured summary of the execution log
   */
  summarize(): FlowLogSummary {
    const all = this.list();
    const total = all.length;

    if (total === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDurationMs: 0,
        mostFrequentFlows: [],
        recentFailures: [],
      };
    }

    const completed = all.filter((r) => r.status === 'completed').length;
    const successRate = completed / total;

    const totalDuration = all.reduce((sum, r) => sum + r.totalDurationMs, 0);
    const averageDurationMs = Math.round(totalDuration / total);

    // Count flow frequencies
    const frequencyMap = new Map<string, number>();
    for (const record of all) {
      frequencyMap.set(record.flowName, (frequencyMap.get(record.flowName) ?? 0) + 1);
    }
    const mostFrequentFlows = [...frequencyMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Collect recent failures (last 10)
    const failures = all.filter((r) => r.status === 'failed' || r.status === 'compensated');
    const recentFailures = failures
      .slice(-10)
      .reverse()
      .map((r) => ({
        flowId: r.id,
        flowName: r.flowName,
        error: r.error ?? { code: 'UNKNOWN', message: 'No error details recorded' },
        timestamp: r.startedAt,
      }));

    return {
      totalExecutions: total,
      successRate,
      averageDurationMs,
      mostFrequentFlows,
      recentFailures,
    };
  }

  /**
   * Clears all recorded execution records.
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Returns the total number of recorded executions.
   *
   * @returns The record count
   */
  size(): number {
    return this.records.size;
  }
}
