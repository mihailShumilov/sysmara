import { generateDockerCompose, generateDockerfile, generateDockerignore } from '../../src/generators/docker.js';

describe('generateDockerCompose', () => {
  it('includes postgres service for postgresql', () => {
    const result = generateDockerCompose('postgresql');
    expect(result.path).toBe('docker-compose.yml');
    expect(result.content).toContain('postgres:16-alpine');
    expect(result.content).toContain('POSTGRES_USER: sysmara');
    expect(result.content).toContain('5432:5432');
    expect(result.content).toContain('db_data:');
    expect(result.content).toContain('service_healthy');
  });

  it('includes mysql service for mysql', () => {
    const result = generateDockerCompose('mysql');
    expect(result.content).toContain('mysql:8');
    expect(result.content).toContain('MYSQL_USER: sysmara');
    expect(result.content).toContain('3306:3306');
  });

  it('has no db service for sqlite', () => {
    const result = generateDockerCompose('sqlite');
    expect(result.content).not.toContain('postgres');
    expect(result.content).not.toContain('mysql');
    expect(result.content).not.toContain('service_healthy');
    expect(result.content).toContain('app:');
  });

  it('always includes app service', () => {
    for (const db of ['postgresql', 'mysql', 'sqlite'] as const) {
      const result = generateDockerCompose(db);
      expect(result.content).toContain('app:');
      expect(result.content).toContain('.env.local');
    }
  });
});

describe('generateDockerfile', () => {
  it('creates multi-stage production Dockerfile', () => {
    const result = generateDockerfile();
    expect(result.path).toBe('Dockerfile');
    expect(result.content).toContain('FROM node:20-alpine');
    expect(result.content).toContain('AS deps');
    expect(result.content).toContain('AS build');
    expect(result.content).toContain('AS production');
    expect(result.content).toContain('npm ci --omit=dev');
    expect(result.content).toContain('sysmara build');
    expect(result.content).toContain('USER sysmara');
    expect(result.content).toContain('EXPOSE 3000');
  });
});

describe('generateDockerignore', () => {
  it('excludes common files', () => {
    const result = generateDockerignore();
    expect(result.path).toBe('.dockerignore');
    expect(result.content).toContain('node_modules');
    expect(result.content).toContain('.env');
    expect(result.content).toContain('.git');
    expect(result.content).toContain('.framework');
  });
});
