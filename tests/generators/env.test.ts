import { generateEnvExample, generateEnvLocal, connectionString } from '../../src/generators/env.js';

describe('connectionString', () => {
  it('returns postgresql connection string', () => {
    expect(connectionString('postgresql')).toContain('postgresql://');
    expect(connectionString('postgresql')).toContain('5432');
  });

  it('returns mysql connection string', () => {
    expect(connectionString('mysql')).toContain('mysql://');
    expect(connectionString('mysql')).toContain('3306');
  });

  it('returns sqlite file path', () => {
    expect(connectionString('sqlite')).toContain('file:');
    expect(connectionString('sqlite')).toContain('.db');
  });
});

describe('generateEnvExample', () => {
  it('contains documented variables', () => {
    const result = generateEnvExample('postgresql');
    expect(result.path).toBe('.env.example');
    expect(result.content).toContain('DATABASE_URL=');
    expect(result.content).toContain('PORT=3000');
    expect(result.content).toContain('LOG_LEVEL=');
    expect(result.content).toContain('NODE_ENV=');
  });

  it('includes provider-specific comment', () => {
    expect(generateEnvExample('postgresql').content).toContain('postgresql://');
    expect(generateEnvExample('mysql').content).toContain('mysql://');
    expect(generateEnvExample('sqlite').content).toContain('file:');
  });
});

describe('generateEnvLocal', () => {
  it('contains actual connection string', () => {
    const result = generateEnvLocal('postgresql');
    expect(result.path).toBe('.env.local');
    expect(result.content).toContain('postgresql://sysmara:sysmara@localhost:5432/sysmara_dev');
    expect(result.content).toContain('DO NOT COMMIT');
  });

  it('uses correct provider connection string', () => {
    expect(generateEnvLocal('mysql').content).toContain('mysql://sysmara:sysmara@localhost:3306');
    expect(generateEnvLocal('sqlite').content).toContain('file:./data/dev.db');
  });
});
