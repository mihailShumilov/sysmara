/**
 * @module database/adapters/sysmara-orm/operation-log
 * Machine-readable operation log for AI consumption.
 * Every database operation executed through the SysMARA ORM is recorded
 * as a structured JSON entry, enabling AI agents to audit, debug, and
 * reason about system behavior.
 */

/**
 * A single entry in the machine-readable operation log.
 * Each entry captures the full context of a database operation,
 * including which capability triggered it, what invariants were checked,
 * and the parameterized SQL template (never raw values).
 *
 * @property id - Unique identifier for this log entry
 * @property capability - The capability name that triggered this operation
 * @property entity - The entity name this operation targets
 * @property operation - The SQL operation type performed
 * @property invariants_checked - Invariant names validated before execution
 * @property affected_fields - Field names read or written by the operation
 * @property timestamp - ISO 8601 timestamp of the operation
 * @property duration_ms - Execution duration in milliseconds
 * @property affected_rows - Number of rows affected by the operation
 * @property sql_template - Parameterized SQL template (no raw values)
 */
export interface OperationLogEntry {
  id: string;
  capability: string;
  entity: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  invariants_checked: string[];
  affected_fields: string[];
  timestamp: string;
  duration_ms: number;
  affected_rows: number;
  sql_template: string;
}

/**
 * Machine-readable operation log that records all database operations
 * performed through the SysMARA ORM. Designed for AI agent consumption —
 * every entry is structured JSON with deterministic field ordering.
 */
export class OperationLog {
  /** Internal storage of log entries. */
  private entries: OperationLogEntry[] = [];

  /** Auto-incrementing counter for generating unique entry IDs. */
  private counter = 0;

  /**
   * Records a new operation in the log.
   *
   * @param entry - Partial entry; `id` and `timestamp` are auto-generated if omitted
   * @returns The complete log entry with all fields populated
   */
  record(entry: Omit<OperationLogEntry, 'id' | 'timestamp'>): OperationLogEntry {
    const full: OperationLogEntry = {
      id: `op_${++this.counter}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.entries.push(full);
    return full;
  }

  /**
   * Returns all recorded log entries in chronological order.
   *
   * @returns A copy of the log entries array
   */
  getAll(): OperationLogEntry[] {
    return [...this.entries];
  }

  /**
   * Returns log entries filtered by capability name.
   *
   * @param capability - The capability name to filter by
   * @returns Matching log entries
   */
  getByCapability(capability: string): OperationLogEntry[] {
    return this.entries.filter((e) => e.capability === capability);
  }

  /**
   * Returns log entries filtered by entity name.
   *
   * @param entity - The entity name to filter by
   * @returns Matching log entries
   */
  getByEntity(entity: string): OperationLogEntry[] {
    return this.entries.filter((e) => e.entity === entity);
  }

  /**
   * Returns log entries filtered by operation type.
   *
   * @param operation - The operation type to filter by
   * @returns Matching log entries
   */
  getByOperation(operation: OperationLogEntry['operation']): OperationLogEntry[] {
    return this.entries.filter((e) => e.operation === operation);
  }

  /**
   * Returns the total number of recorded operations.
   *
   * @returns The entry count
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Clears all recorded log entries.
   */
  clear(): void {
    this.entries = [];
    this.counter = 0;
  }
}
