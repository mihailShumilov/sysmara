import { describe, it, expect } from 'vitest';
import { Router } from '../../src/runtime/router.js';
import type { HandlerContext } from '../../src/types/index.js';

const dummyHandler = async (_ctx: HandlerContext) => ({ ok: true });

describe('Router', () => {
  it('matches a static GET route', () => {
    const router = new Router();
    router.add('GET', '/health', 'health_check', dummyHandler);

    const result = router.match('GET', '/health');
    expect(result).not.toBeNull();
    expect(result!.route.capability).toBe('health_check');
    expect(result!.params).toEqual({});
  });

  it('matches a parameterized route', () => {
    const router = new Router();
    router.add('GET', '/users/:id', 'get_user', dummyHandler);

    const result = router.match('GET', '/users/123');
    expect(result).not.toBeNull();
    expect(result!.route.capability).toBe('get_user');
    expect(result!.params).toEqual({ id: '123' });
  });

  it('matches multiple params', () => {
    const router = new Router();
    router.add('GET', '/users/:userId/posts/:postId', 'get_user_post', dummyHandler);

    const result = router.match('GET', '/users/42/posts/99');
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ userId: '42', postId: '99' });
  });

  it('returns null for non-matching path', () => {
    const router = new Router();
    router.add('GET', '/users', 'list_users', dummyHandler);

    const result = router.match('GET', '/orders');
    expect(result).toBeNull();
  });

  it('returns null for non-matching method', () => {
    const router = new Router();
    router.add('GET', '/users', 'list_users', dummyHandler);

    const result = router.match('POST', '/users');
    expect(result).toBeNull();
  });

  it('strips query string for matching', () => {
    const router = new Router();
    router.add('GET', '/users', 'list_users', dummyHandler);

    const result = router.match('GET', '/users?page=1&limit=10');
    expect(result).not.toBeNull();
    expect(result!.route.capability).toBe('list_users');
  });

  it('is case-insensitive for methods', () => {
    const router = new Router();
    router.add('GET', '/users', 'list_users', dummyHandler);

    const result = router.match('get', '/users');
    expect(result).not.toBeNull();
  });

  it('lists all routes', () => {
    const router = new Router();
    router.add('GET', '/users', 'list_users', dummyHandler);
    router.add('POST', '/users', 'create_user', dummyHandler);

    const routes = router.getRoutes();
    expect(routes).toHaveLength(2);
  });

  it('prefers static routes over parameterized', () => {
    const router = new Router();
    router.add('GET', '/users/:id', 'get_user', dummyHandler);
    router.add('GET', '/users/me', 'get_current_user', dummyHandler);

    const result = router.match('GET', '/users/me');
    expect(result).not.toBeNull();
    expect(result!.route.capability).toBe('get_current_user');
  });
});
