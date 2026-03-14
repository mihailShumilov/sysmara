/**
 * @module invariants
 *
 * Invariants module for the AI-first framework. Provides validation of invariant
 * specifications against entity definitions, and resolution of invariants by
 * entity name or capability name.
 */

export {
  validateInvariantSpecs,
  resolveInvariantsForEntity,
  resolveInvariantsForCapability,
  type InvariantCheck,
} from './engine.js';
