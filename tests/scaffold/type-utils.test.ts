import { toPascalCase, toCamelCase, mapFieldType } from '../../src/scaffold/type-utils.js';

describe('toPascalCase', () => {
  it('converts hyphen-delimited strings', () => {
    expect(toPascalCase('create-user')).toBe('CreateUser');
  });

  it('converts underscore-delimited strings', () => {
    expect(toPascalCase('create_user')).toBe('CreateUser');
  });

  it('handles multi-segment names', () => {
    expect(toPascalCase('create-user-account')).toBe('CreateUserAccount');
  });

  it('handles single word', () => {
    expect(toPascalCase('user')).toBe('User');
  });
});

describe('toCamelCase', () => {
  it('converts to camelCase', () => {
    expect(toCamelCase('create-user')).toBe('createUser');
  });

  it('handles underscore-delimited strings', () => {
    expect(toCamelCase('get_user_profile')).toBe('getUserProfile');
  });

  it('handles single word', () => {
    expect(toCamelCase('user')).toBe('user');
  });
});

describe('mapFieldType', () => {
  it('maps basic types', () => {
    expect(mapFieldType('string')).toBe('string');
    expect(mapFieldType('number')).toBe('number');
    expect(mapFieldType('boolean')).toBe('boolean');
  });

  it('maps aliases', () => {
    expect(mapFieldType('integer')).toBe('number');
    expect(mapFieldType('float')).toBe('number');
    expect(mapFieldType('decimal')).toBe('number');
    expect(mapFieldType('bool')).toBe('boolean');
  });

  it('maps date types', () => {
    expect(mapFieldType('date')).toBe('Date');
    expect(mapFieldType('datetime')).toBe('Date');
    expect(mapFieldType('timestamp')).toBe('Date');
  });

  it('maps array types', () => {
    expect(mapFieldType('string[]')).toBe('string[]');
    expect(mapFieldType('number[]')).toBe('number[]');
    expect(mapFieldType('boolean[]')).toBe('boolean[]');
  });

  it('maps object types', () => {
    expect(mapFieldType('object')).toBe('Record<string, unknown>');
    expect(mapFieldType('json')).toBe('Record<string, unknown>');
  });

  it('maps enum and reference to string', () => {
    expect(mapFieldType('enum')).toBe('string');
    expect(mapFieldType('reference')).toBe('string');
  });

  it('returns unknown for unrecognized types', () => {
    expect(mapFieldType('foobar')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(mapFieldType('String')).toBe('string');
    expect(mapFieldType('NUMBER')).toBe('number');
    expect(mapFieldType('Boolean')).toBe('boolean');
  });
});
