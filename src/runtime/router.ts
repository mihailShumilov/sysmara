/**
 * @module runtime/router
 * HTTP request router for the SysMARA runtime. Supports parameterized path
 * segments (e.g. `/users/:id`) and capability-based route metadata.
 * Routes are automatically sorted so that static paths match before dynamic ones.
 */

import type { HandlerContext } from '../types/index.js';

/**
 * An async function that handles a matched HTTP request.
 * Receives a {@link HandlerContext} and returns a JSON-serializable response body.
 *
 * @param ctx - The handler context containing params, query, body, actor, and capability.
 * @returns A JSON-serializable value sent as the response body.
 */
export type Handler = (ctx: HandlerContext) => Promise<unknown>;

/**
 * A registered route entry in the router.
 *
 * @property method - Uppercase HTTP method (e.g. `'GET'`, `'POST'`).
 * @property path - The original path pattern (e.g. `'/users/:id'`).
 * @property pattern - Compiled RegExp used for URL matching.
 * @property paramNames - Ordered list of path parameter names extracted from the pattern.
 * @property capability - The SysMARA capability identifier required for this route.
 * @property handler - The function invoked when the route matches.
 */
export interface Route {
  method: string;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  capability: string;
  handler: Handler;
}

function parsePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const segments = path.split('/');

  const regexParts = segments.map((segment) => {
    if (segment.startsWith(':')) {
      paramNames.push(segment.slice(1));
      return '([^\\/]+)';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  const pattern = new RegExp(`^${regexParts.join('\\/')}$`);
  return { pattern, paramNames };
}

function routeSpecificity(route: Route): number {
  // Static routes (no params) are most specific.
  // Among dynamic routes, more segments = more specific.
  if (route.paramNames.length === 0) {
    return 0;
  }
  return route.paramNames.length;
}

/**
 * HTTP router that matches incoming requests against registered route patterns.
 * Supports parameterized path segments (`:param`) and sorts routes so that
 * static paths are matched before dynamic ones for deterministic resolution.
 */
export class Router {
  private routes: Route[] = [];

  /**
   * Registers a new route in the router.
   *
   * @param method - HTTP method (case-insensitive; stored uppercase).
   * @param path - URL path pattern, e.g. `'/users/:id'`. Segments prefixed with `:` become named parameters.
   * @param capability - The SysMARA capability identifier associated with this route.
   * @param handler - Async handler function invoked when the route matches.
   */
  add(method: string, path: string, capability: string, handler: Handler): void {
    const { pattern, paramNames } = parsePath(path);
    const route: Route = {
      method: method.toUpperCase(),
      path,
      pattern,
      paramNames,
      capability,
      handler,
    };
    this.routes.push(route);
    this.sortRoutes();
  }

  /**
   * Finds the first route matching the given HTTP method and URL path.
   * Query strings are stripped before matching. Path parameters are extracted and URI-decoded.
   *
   * @param method - HTTP method (case-insensitive).
   * @param url - Request URL path, optionally including a query string.
   * @returns The matched route and extracted path parameters, or `null` if no route matches.
   */
  match(method: string, url: string): { route: Route; params: Record<string, string> } | null {
    const upperMethod = method.toUpperCase();
    // Strip query string for matching
    const pathPart = url.split('?')[0] ?? url;

    for (const route of this.routes) {
      if (route.method !== upperMethod) {
        continue;
      }

      const m = route.pattern.exec(pathPart);
      if (m) {
        const params: Record<string, string> = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          const name = route.paramNames[i];
          const value = m[i + 1];
          if (name !== undefined && value !== undefined) {
            params[name] = decodeURIComponent(value);
          }
        }
        return { route, params };
      }
    }

    return null;
  }

  /**
   * Returns a shallow copy of all registered routes.
   *
   * @returns An array of all registered {@link Route} entries.
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  private sortRoutes(): void {
    this.routes.sort((a, b) => routeSpecificity(a) - routeSpecificity(b));
  }
}
