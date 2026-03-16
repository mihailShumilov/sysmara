import { generatePackageJson } from '../../src/generators/package-json.js';
import { generateReadme } from '../../src/generators/readme.js';

describe('generatePackageJson', () => {
  it('includes sysmara scripts', () => {
    const result = generatePackageJson('my-app', 'postgresql');
    const pkg = JSON.parse(result.content);
    expect(pkg.scripts.build).toBe('sysmara build');
    expect(pkg.scripts.validate).toBe('sysmara validate');
    expect(pkg.scripts['sysmara:doctor']).toBe('sysmara doctor');
    expect(pkg.scripts['sysmara:compile']).toBe('sysmara compile');
  });

  it('includes dev and start commands', () => {
    const result = generatePackageJson('my-app', 'postgresql');
    const pkg = JSON.parse(result.content);
    expect(pkg.scripts.dev).toContain('docker compose up -d');
    expect(pkg.scripts.dev).toContain('node --watch');
    expect(pkg.scripts.start).toContain('NODE_ENV=production');
  });

  it('includes db commands for postgresql', () => {
    const result = generatePackageJson('my-app', 'postgresql');
    const pkg = JSON.parse(result.content);
    expect(pkg.scripts['db:start']).toBe('docker compose up -d');
    expect(pkg.scripts['db:stop']).toBe('docker compose down');
  });

  it('omits db commands for sqlite', () => {
    const result = generatePackageJson('my-app', 'sqlite');
    const pkg = JSON.parse(result.content);
    expect(pkg.scripts['db:start']).toBeUndefined();
    expect(pkg.scripts['db:stop']).toBeUndefined();
    expect(pkg.scripts.dev).not.toContain('docker compose');
  });

  it('includes sysmara/core dependency', () => {
    const result = generatePackageJson('my-app', 'postgresql');
    const pkg = JSON.parse(result.content);
    expect(pkg.dependencies['@sysmara/core']).toBeDefined();
  });
});

describe('generateReadme', () => {
  it('includes project name and framework reference', () => {
    const result = generateReadme('my-api', 'postgresql', 'sysmara-orm');
    expect(result.path).toBe('README.md');
    expect(result.content).toContain('# my-api');
    expect(result.content).toContain('SysMARA');
  });

  it('includes Docker instructions for postgresql', () => {
    const result = generateReadme('my-api', 'postgresql', 'sysmara-orm');
    expect(result.content).toContain('docker compose up -d');
    expect(result.content).toContain('PostgreSQL');
    expect(result.content).toContain('db:start');
  });

  it('omits Docker db instructions for sqlite', () => {
    const result = generateReadme('my-api', 'sqlite', 'sysmara-orm');
    expect(result.content).not.toContain('docker compose up -d');
    expect(result.content).not.toContain('db:start');
  });

  it('includes project structure section', () => {
    const result = generateReadme('my-api', 'postgresql', 'sysmara-orm');
    expect(result.content).toContain('Project Structure');
    expect(result.content).toContain('system/');
    expect(result.content).toContain('app/');
  });

  it('includes available commands table', () => {
    const result = generateReadme('my-api', 'postgresql', 'sysmara-orm');
    expect(result.content).toContain('npm run dev');
    expect(result.content).toContain('npm start');
    expect(result.content).toContain('npm run build');
  });
});
