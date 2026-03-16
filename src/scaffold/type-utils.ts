/**
 * @module scaffold/type-utils
 * Shared type-mapping utilities used by both the capability compiler
 * and the scaffold generator to convert spec types to TypeScript.
 */

/**
 * Converts a hyphen- or underscore-delimited string to PascalCase.
 *
 * @param str - The input string (e.g., `"create-order"` or `"create_order"`).
 * @returns The PascalCase version of the string (e.g., `"CreateOrder"`).
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Converts a hyphen- or underscore-delimited string to camelCase.
 *
 * @param str - The input string (e.g., `"create-order"` or `"create_order"`).
 * @returns The camelCase version of the string (e.g., `"createOrder"`).
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Maps a specification-level type name to its TypeScript equivalent.
 *
 * Handles common aliases such as `"integer"`, `"float"`, `"decimal"` (all map to
 * `number`), `"bool"` (maps to `boolean`), and temporal types like `"date"`,
 * `"datetime"`, `"timestamp"` (all map to `Date`). Array types (`"string[]"`,
 * `"number[]"`, `"boolean[]"`) and object types (`"object"`, `"json"`) are also
 * supported. Unrecognized types fall back to `"unknown"`.
 *
 * @param specType - The type string from the capability specification (case-insensitive).
 * @returns The corresponding TypeScript type as a string.
 */
export function mapFieldType(specType: string): string {
  switch (specType.toLowerCase()) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
    case 'float':
    case 'decimal':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'Date';
    case 'string[]':
      return 'string[]';
    case 'number[]':
      return 'number[]';
    case 'boolean[]':
      return 'boolean[]';
    case 'object':
    case 'json':
      return 'Record<string, unknown>';
    case 'enum':
      return 'string';
    case 'reference':
      return 'string';
    default:
      return 'unknown';
  }
}
