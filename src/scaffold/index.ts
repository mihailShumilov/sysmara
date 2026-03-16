/**
 * @module scaffold
 * Spec-driven scaffold generator that produces starter TypeScript
 * implementation files from YAML system specifications.
 */

export { scaffoldSpecs } from './scaffolder.js';
export type { ScaffoldOutput, ScaffoldFile, ScaffoldOptions } from './scaffolder.js';
export { toPascalCase, toCamelCase, mapFieldType } from './type-utils.js';
