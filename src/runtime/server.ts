/**
 * @module runtime/server
 * HTTP server for the SysMARA runtime. Provides a capability-aware request
 * pipeline that extracts actors, routes requests, parses JSON bodies, and
 * returns structured error responses.
 */

import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ActorContext, HandlerContext, RouteSpec } from '../types/index.js';
import { Router } from './router.js';
import type { Handler } from './router.js';
import { SysmaraError } from './errors.js';
import { Logger } from './logger.js';
import type { LogLevel } from './logger.js';

/**
 * Configuration options for creating a {@link SysmaraServer}.
 *
 * @property port - TCP port to listen on. Defaults to `3000`.
 * @property host - Network interface to bind to. Defaults to `'0.0.0.0'`.
 * @property logLevel - Minimum log severity level. Defaults to `'info'`.
 * @property actorExtractor - Async function that extracts an {@link ActorContext} from each incoming request. Defaults to returning an anonymous actor.
 */
export interface ServerOptions {
  port?: number;
  host?: string;
  logLevel?: LogLevel;
  actorExtractor?: (req: IncomingMessage) => Promise<ActorContext>;
}

/** Internal type that makes all {@link ServerOptions} properties required, used after defaults are applied. */
type RequiredServerOptions = Required<ServerOptions>;

const DEFAULT_ACTOR: ActorContext = {
  id: 'anonymous',
  roles: [],
  attributes: {},
};

/**
 * Default actor extractor that returns a shallow copy of the anonymous actor
 * context (id `'anonymous'`, no roles, no attributes) for every request.
 *
 * @param _req - The incoming HTTP request (unused).
 * @returns A promise resolving to a default anonymous {@link ActorContext}.
 */
function defaultActorExtractor(_req: IncomingMessage): Promise<ActorContext> {
  return Promise.resolve({ ...DEFAULT_ACTOR });
}

/**
 * Parses a URL query string into a key-value record. Keys and values are
 * URI-decoded. Pairs without an `=` sign are treated as keys with an empty
 * string value. An empty input string returns an empty record.
 *
 * @param qs - The raw query string (without the leading `?`).
 * @returns A record mapping each decoded key to its decoded value.
 */
function parseQueryString(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (qs === '') {
    return result;
  }
  for (const pair of qs.split('&')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      result[decodeURIComponent(pair)] = '';
    } else {
      const key = decodeURIComponent(pair.slice(0, eqIndex));
      const value = decodeURIComponent(pair.slice(eqIndex + 1));
      result[key] = value;
    }
  }
  return result;
}

/**
 * Reads the full request body from an incoming HTTP message and returns it
 * as a UTF-8 string. Collects data chunks and concatenates them once the
 * stream ends. Rejects the promise if a stream error occurs.
 *
 * @param req - The incoming HTTP request to read the body from.
 * @returns A promise that resolves to the complete request body as a string.
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', reject);
  });
}

/**
 * Sends a JSON response by serializing the given data, setting the
 * `Content-Type` to `application/json` and `Content-Length` headers,
 * and ending the response stream.
 *
 * @param res - The server response object to write to.
 * @param statusCode - The HTTP status code to send.
 * @param data - The value to JSON-serialize as the response body.
 */
function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * The SysMARA HTTP server. Wraps Node.js `http.Server` with capability-based
 * routing, actor extraction, JSON body parsing, and structured error handling.
 *
 * Built-in routes:
 * - `GET /health` — Returns server health status and uptime.
 * - `GET /_sysmara/routes` — Lists all registered routes.
 *
 * @example
 * ```ts
 * const server = new SysmaraServer({ port: 8080 });
 * server.get('/users/:id', 'user:read', async (ctx) => {
 *   return { id: ctx.params.id };
 * });
 * await server.start();
 * ```
 */
export class SysmaraServer {
  private server: http.Server | null = null;
  private readonly router: Router;
  private readonly options: RequiredServerOptions;
  private readonly shutdownHandlers: Array<() => Promise<void>> = [];
  private readonly logger: Logger;
  private readonly startTime: number;

  /**
   * Creates a new SysmaraServer instance with the given options.
   *
   * @param options - Server configuration. All fields are optional and have sensible defaults.
   */
  constructor(options?: ServerOptions) {
    this.options = {
      port: options?.port ?? 3000,
      host: options?.host ?? '0.0.0.0',
      logLevel: options?.logLevel ?? 'info',
      actorExtractor: options?.actorExtractor ?? defaultActorExtractor,
    };
    this.router = new Router();
    this.logger = new Logger(this.options.logLevel);
    this.startTime = Date.now();

    this.registerBuiltinRoutes();
  }

  /**
   * Registers a route for the given HTTP method and path pattern.
   *
   * @param method - HTTP method (e.g. `'GET'`, `'POST'`).
   * @param path - URL path pattern, supporting `:param` segments.
   * @param capability - SysMARA capability identifier associated with this route.
   * @param handler - Async handler invoked when the route matches.
   * @returns `this` for method chaining.
   */
  route(method: string, path: string, capability: string, handler: Handler): this {
    this.router.add(method, path, capability, handler);
    return this;
  }

  /**
   * Registers a GET route. Shorthand for `route('GET', ...)`.
   *
   * @param path - URL path pattern.
   * @param capability - SysMARA capability identifier.
   * @param handler - Async request handler.
   * @returns `this` for method chaining.
   */
  get(path: string, capability: string, handler: Handler): this {
    return this.route('GET', path, capability, handler);
  }

  /**
   * Registers a POST route. Shorthand for `route('POST', ...)`.
   *
   * @param path - URL path pattern.
   * @param capability - SysMARA capability identifier.
   * @param handler - Async request handler.
   * @returns `this` for method chaining.
   */
  post(path: string, capability: string, handler: Handler): this {
    return this.route('POST', path, capability, handler);
  }

  /**
   * Registers a PUT route. Shorthand for `route('PUT', ...)`.
   *
   * @param path - URL path pattern.
   * @param capability - SysMARA capability identifier.
   * @param handler - Async request handler.
   * @returns `this` for method chaining.
   */
  put(path: string, capability: string, handler: Handler): this {
    return this.route('PUT', path, capability, handler);
  }

  /**
   * Registers a PATCH route. Shorthand for `route('PATCH', ...)`.
   *
   * @param path - URL path pattern.
   * @param capability - SysMARA capability identifier.
   * @param handler - Async request handler.
   * @returns `this` for method chaining.
   */
  patch(path: string, capability: string, handler: Handler): this {
    return this.route('PATCH', path, capability, handler);
  }

  /**
   * Registers a DELETE route. Shorthand for `route('DELETE', ...)`.
   *
   * @param path - URL path pattern.
   * @param capability - SysMARA capability identifier.
   * @param handler - Async request handler.
   * @returns `this` for method chaining.
   */
  delete(path: string, capability: string, handler: Handler): this {
    return this.route('DELETE', path, capability, handler);
  }

  /**
   * Registers an async callback to be invoked during graceful server shutdown.
   * Shutdown handlers run in registration order. Errors in individual handlers
   * are logged but do not prevent subsequent handlers from executing.
   *
   * @param handler - Async cleanup function (e.g. close database connections).
   * @returns `this` for method chaining.
   */
  onShutdown(handler: () => Promise<void>): this {
    this.shutdownHandlers.push(handler);
    return this;
  }

  /**
   * Starts the HTTP server and begins accepting connections.
   * Registers SIGINT and SIGTERM handlers for graceful shutdown.
   *
   * @returns A promise that resolves once the server is listening.
   */
  async start(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.server = http.createServer((req, res) => {
        void this.handleRequest(req, res);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        this.logger.info('SysMARA server started', {
          port: this.options.port,
          host: this.options.host,
        });
        resolve();
      });

      const shutdown = (): void => {
        void this.stop();
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
  }

  /**
   * Gracefully stops the server. Runs all registered shutdown handlers,
   * then closes the underlying HTTP server.
   *
   * @returns A promise that resolves once the server is fully stopped.
   */
  async stop(): Promise<void> {
    this.logger.info('Shutting down SysMARA server...');

    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error('Shutdown handler error', { error: message });
      }
    }

    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      this.server = null;
    }

    this.logger.info('SysMARA server stopped');
  }

  /**
   * Returns route specifications for all registered routes, suitable for
   * introspection or API documentation generation.
   *
   * @returns An array of {@link RouteSpec} objects (method, path, capability).
   */
  getRouteSpecs(): RouteSpec[] {
    return this.router.getRoutes().map((route) => ({
      method: route.method as RouteSpec['method'],
      path: route.path,
      capability: route.capability,
    }));
  }

  private registerBuiltinRoutes(): void {
    this.router.add('GET', '/health', 'system:health', async () => {
      return {
        status: 'ok',
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      };
    });

    this.router.add('GET', '/_sysmara/routes', 'system:routes', async () => {
      return this.router.getRoutes().map((r) => ({
        method: r.method,
        path: r.path,
        capability: r.capability,
      }));
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method ?? 'GET').toUpperCase();
    const rawUrl = req.url ?? '/';

    // Parse URL and query string
    const questionIndex = rawUrl.indexOf('?');
    const pathname = questionIndex === -1 ? rawUrl : rawUrl.slice(0, questionIndex);
    const queryString = questionIndex === -1 ? '' : rawUrl.slice(questionIndex + 1);
    const query = parseQueryString(queryString);

    this.logger.debug('Incoming request', { method, path: pathname });

    // Match route
    const result = this.router.match(method, pathname);

    if (!result) {
      // Check if any route matches the path with a different method
      const allMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      const allowedMethods = allMethods.filter((m) => this.router.match(m, pathname) !== null);

      if (allowedMethods.length > 0) {
        sendJson(res, 405, {
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed. Allowed: ${allowedMethods.join(', ')}`,
            capability: null,
          },
        });
      } else {
        sendJson(res, 404, {
          error: {
            code: 'NOT_FOUND',
            message: 'Route not found',
            capability: null,
          },
        });
      }
      return;
    }

    const { route, params } = result;

    try {
      // Parse body for methods that have one
      let body: unknown = null;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        const rawBody = await readBody(req);
        if (rawBody.length > 0) {
          try {
            body = JSON.parse(rawBody);
          } catch {
            sendJson(res, 400, {
              error: {
                code: 'BAD_REQUEST',
                message: 'Invalid JSON body',
                capability: route.capability,
              },
            });
            return;
          }
        }
      }

      // Extract actor
      const actor = await this.options.actorExtractor(req);

      // Build handler context
      const ctx: HandlerContext = {
        params,
        query,
        body,
        actor,
        capability: route.capability,
      };

      // Call handler
      const responseData = await route.handler(ctx);

      sendJson(res, 200, responseData);
    } catch (err) {
      if (err instanceof SysmaraError) {
        sendJson(res, err.statusCode, {
          error: {
            code: err.code,
            message: err.message,
            capability: route.capability,
            ...(err.details ? { details: err.details } : {}),
          },
        });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error('Unhandled error', {
          error: message,
          method,
          path: pathname,
          capability: route.capability,
        });
        sendJson(res, 500, {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            capability: route.capability,
          },
        });
      }
    }
  }
}
