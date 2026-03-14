/**
 * @module runtime/errors
 * Structured error classes for the SysMARA runtime. Each error maps to an HTTP
 * status code and machine-readable error code, enabling consistent API error
 * responses across all capabilities.
 */

/**
 * Base error class for all SysMARA application errors.
 * Carries an HTTP status code and a machine-readable error code so that the
 * server can translate domain errors into structured JSON responses.
 *
 * @example
 * ```ts
 * throw new SysmaraError('QUOTA_EXCEEDED', 'Storage quota exceeded', 429, { limit: 100 });
 * ```
 */
export class SysmaraError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  /**
   * Creates a new SysmaraError.
   *
   * @param code - Machine-readable error code (e.g. `'NOT_FOUND'`, `'VALIDATION_ERROR'`).
   * @param message - Human-readable error description.
   * @param statusCode - HTTP status code to return in API responses. Defaults to `500`.
   * @param details - Optional additional context about the error (e.g. field-level validation failures).
   */
  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SysmaraError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Error indicating that a requested resource was not found.
 * Maps to HTTP 404 with error code `NOT_FOUND`.
 */
export class NotFoundError extends SysmaraError {
  /**
   * @param message - Description of what was not found. Defaults to `'Not found'`.
   */
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
  }
}

/**
 * Error indicating that input validation failed.
 * Maps to HTTP 400 with error code `VALIDATION_ERROR`.
 */
export class ValidationError extends SysmaraError {
  /**
   * @param message - Description of the validation failure.
   * @param details - Optional field-level or rule-level validation details.
   */
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

/**
 * Error indicating that the actor lacks permission for the requested operation.
 * Maps to HTTP 403 with error code `FORBIDDEN`.
 */
export class ForbiddenError extends SysmaraError {
  /**
   * @param message - Description of the authorization failure. Defaults to `'Forbidden'`.
   */
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

/**
 * Error indicating a malformed or invalid request.
 * Maps to HTTP 400 with error code `BAD_REQUEST`.
 */
export class BadRequestError extends SysmaraError {
  /**
   * @param message - Description of what is wrong with the request. Defaults to `'Bad request'`.
   */
  constructor(message = 'Bad request') {
    super('BAD_REQUEST', message, 400);
  }
}
