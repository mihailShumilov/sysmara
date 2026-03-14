import { describe, it, expect } from 'vitest';
import {
  SysmaraError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  BadRequestError,
} from '../../src/runtime/errors.js';

describe('SysmaraError', () => {
  it('has correct properties', () => {
    const err = new SysmaraError('TEST_ERROR', 'Something failed', 500, { detail: 'x' });
    expect(err.code).toBe('TEST_ERROR');
    expect(err.message).toBe('Something failed');
    expect(err.statusCode).toBe(500);
    expect(err.details).toEqual({ detail: 'x' });
    expect(err.name).toBe('SysmaraError');
    expect(err instanceof Error).toBe(true);
  });
});

describe('NotFoundError', () => {
  it('has 404 status', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ValidationError', () => {
  it('has 400 status', () => {
    const err = new ValidationError('Invalid email', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('ForbiddenError', () => {
  it('has 403 status', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('BadRequestError', () => {
  it('has 400 status', () => {
    const err = new BadRequestError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });
});
