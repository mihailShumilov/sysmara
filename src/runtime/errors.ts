export class SysmaraError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

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

export class NotFoundError extends SysmaraError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
  }
}

export class ValidationError extends SysmaraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class ForbiddenError extends SysmaraError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class BadRequestError extends SysmaraError {
  constructor(message = 'Bad request') {
    super('BAD_REQUEST', message, 400);
  }
}
