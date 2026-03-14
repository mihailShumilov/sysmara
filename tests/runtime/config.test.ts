import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/runtime/config.js';

describe('loadConfig', () => {
  it('returns defaults with no overrides', () => {
    const config = loadConfig();
    expect(config.name).toBe('sysmara-app');
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.logLevel).toBe('info');
    expect(config.specDir).toBe('./system');
    expect(config.appDir).toBe('./app');
    expect(config.frameworkDir).toBe('./.framework');
    expect(config.generatedDir).toBe('./app/generated');
  });

  it('merges overrides', () => {
    const config = loadConfig({ name: 'my-app', port: 8080 });
    expect(config.name).toBe('my-app');
    expect(config.port).toBe(8080);
    // Other values remain default
    expect(config.host).toBe('0.0.0.0');
  });
});
