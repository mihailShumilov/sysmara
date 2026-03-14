import type { HandlerContext } from '../types/index.js';

export type Handler = (ctx: HandlerContext) => Promise<unknown>;

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

export class Router {
  private routes: Route[] = [];

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

  getRoutes(): Route[] {
    return [...this.routes];
  }

  private sortRoutes(): void {
    this.routes.sort((a, b) => routeSpecificity(a) - routeSpecificity(b));
  }
}
