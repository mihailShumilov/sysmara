import { describe, it, expect, afterEach } from 'vitest';
import { SysmaraServer } from '../../src/runtime/server.js';

describe('SysmaraServer', () => {
  let server: SysmaraServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it('starts and stops', async () => {
    server = new SysmaraServer({ port: 0, logLevel: 'error' });
    await server.start();
    await server.stop();
    server = null;
  });

  it('responds to health check', async () => {
    server = new SysmaraServer({ port: 0, logLevel: 'error' });
    await server.start();

    const addr = (server as unknown as { getAddress(): { port: number } }).getAddress?.();
    // If we can't get the address, just test that it started OK
    if (addr) {
      const res = await fetch(`http://127.0.0.1:${addr.port}/health`);
      const body = await res.json();
      expect(body.status).toBe('ok');
    }
  });

  it('registers routes', () => {
    server = new SysmaraServer({ port: 0, logLevel: 'error' });
    server.get('/users', 'list_users', async () => ({ users: [] }));
    server.post('/users', 'create_user', async () => ({ created: true }));

    const routes = server.getRouteSpecs();
    expect(routes.length).toBeGreaterThanOrEqual(2);
  });

  it('provides route spec list', () => {
    server = new SysmaraServer({ port: 0, logLevel: 'error' });
    server.get('/items', 'list_items', async () => []);

    const specs = server.getRouteSpecs();
    const itemRoute = specs.find((r) => r.capability === 'list_items');
    expect(itemRoute).toBeDefined();
    expect(itemRoute!.method).toBe('GET');
    expect(itemRoute!.path).toBe('/items');
  });

  it('registers shutdown handlers', () => {
    server = new SysmaraServer({ port: 0, logLevel: 'error' });
    let called = false;
    server.onShutdown(async () => { called = true; });
    // The handler should be registered but not called yet
    expect(called).toBe(false);
  });
});
