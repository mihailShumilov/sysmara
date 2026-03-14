/**
 * @module runtime/logger
 * Structured, level-filtered logger used by the SysMARA runtime.
 * Outputs timestamped JSON-annotated log lines to stdout/stderr.
 */

/**
 * Supported log severity levels, ordered from least to most severe.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** @internal Priority mapping used to filter log messages below the configured threshold. */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * A structured logger that filters messages by severity level.
 * Messages below the configured level are silently discarded.
 * Each emitted line is prefixed with `[LEVEL] [ISO-timestamp]` and optional JSON data.
 *
 * @example
 * ```ts
 * const logger = new Logger('warn');
 * logger.info('skipped');   // not printed (below threshold)
 * logger.warn('attention'); // printed
 * ```
 */
export class Logger {
  private readonly levelPriority: number;

  /**
   * Creates a new Logger instance.
   *
   * @param level - Minimum severity level to emit. Defaults to `'info'`.
   */
  constructor(private readonly level: LogLevel = 'info') {
    this.levelPriority = LOG_LEVEL_PRIORITY[this.level];
  }

  /**
   * Logs a debug-level message. Only emitted when the logger level is `'debug'`.
   *
   * @param message - Log message text.
   * @param data - Optional structured data appended as JSON.
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * Logs an info-level message.
   *
   * @param message - Log message text.
   * @param data - Optional structured data appended as JSON.
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Logs a warning-level message. Output goes to `console.warn`.
   *
   * @param message - Log message text.
   * @param data - Optional structured data appended as JSON.
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Logs an error-level message. Output goes to `console.error`.
   *
   * @param message - Log message text.
   * @param data - Optional structured data appended as JSON.
   */
  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < this.levelPriority) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${level.toUpperCase()}] [${timestamp}]`;

    if (data !== undefined && Object.keys(data).length > 0) {
      const jsonData = JSON.stringify(data);
      const line = `${prefix} ${message} ${jsonData}`;
      if (level === 'error') {
        console.error(line);
      } else if (level === 'warn') {
        console.warn(line);
      } else {
        console.log(line);
      }
    } else {
      const line = `${prefix} ${message}`;
      if (level === 'error') {
        console.error(line);
      } else if (level === 'warn') {
        console.warn(line);
      } else {
        console.log(line);
      }
    }
  }
}
