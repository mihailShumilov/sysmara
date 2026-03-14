import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ActorContext, HandlerContext, RouteSpec } from '../types/index.js';
import { Router } from './router.js';
import type { Handler } from './router.js';
import { SysmaraError } from './errors.js';
import { Logger } from './logger.js';
import type { LogLevel } from './logger.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  logLevel?: LogLevel;
  actorExtractor?: (req: IncomingMessage) => Promise<ActorContext>;
}

type RequiredServerOptions = Required<ServerOptions>;

const DEFAULT_ACTOR: ActorContext = {
  id: 'anonymous',
  roles: [],
  attributes: {},
};

function defaultActorExtractor(_req: IncomingMessage): Promise<ActorContext> {
  return Promise.resolve({ ...DEFAULT_ACTOR });
}

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

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export class SysmaraServer {
  private server: http.Server | null = null;
  private readonly router: Router;
  private readonly options: RequiredServerOptions;
  private readonly shutdownHandlers: Array<() => Promise<void>> = [];
  private readonly logger: Logger;
  private readonly startTime: number;

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

  route(method: string, path: string, capability: string, handler: Handler): this {
    this.router.add(method, path, capability, handler);
    return this;
  }

  get(path: string, capability: string, handler: Handler): this {
    return this.route('GET', path, capability, handler);
  }

  post(path: string, capability: string, handler: Handler): this {
    return this.route('POST', path, capability, handler);
  }

  put(path: string, capability: string, handler: Handler): this {
    return this.route('PUT', path, capability, handler);
  }

  patch(path: string, capability: string, handler: Handler): this {
    return this.route('PATCH', path, capability, handler);
  }

  delete(path: string, capability: string, handler: Handler): this {
    return this.route('DELETE', path, capability, handler);
  }

  onShutdown(handler: () => Promise<void>): this {
    this.shutdownHandlers.push(handler);
    return this;
  }

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
