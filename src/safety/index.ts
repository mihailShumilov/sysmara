/**
 * @module safety
 *
 * Safety module for the AI-first framework. Provides edit zone validation to ensure
 * generated files respect their declared permissions, and module boundary checking
 * to detect forbidden dependencies, cross-module entity access violations, and
 * circular dependency cycles.
 */

export {
  validateEditZones,
  checkBoundaryViolations,
  type ZoneViolation,
} from './zone-validator.js';
