/**
 * @module runtime
 * Public API barrel for the SysMARA runtime layer. Re-exports the HTTP server,
 * router, configuration utilities, structured error classes, and logger.
 */

export { Router } from './router.js';
export type { Route, Handler } from './router.js';

export { SysmaraServer } from './server.js';
export type { ServerOptions } from './server.js';

export { loadConfig, resolveConfig } from './config.js';

export {
  SysmaraError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  BadRequestError,
} from './errors.js';

export { Logger } from './logger.js';
export type { LogLevel } from './logger.js';
