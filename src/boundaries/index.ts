/**
 * @module boundaries
 *
 * Public API for the Sysmara module boundary validation subsystem. Re-exports
 * functions for validating module dependency rules ({@link validateModuleBoundaries}),
 * checking capability cross-boundary entity access ({@link validateCapabilityBoundaries}),
 * and detecting circular module dependencies ({@link detectModuleCycles}).
 */

export {
  validateModuleBoundaries,
  validateCapabilityBoundaries,
  detectModuleCycles,
} from './engine.js';
