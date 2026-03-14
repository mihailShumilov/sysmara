// Core types
export * from './types/index.js';

// Spec system
export { parseSpecDirectory, crossValidate } from './spec/index.js';
export {
  entitySpecSchema,
  capabilitySpecSchema,
  policySpecSchema,
  invariantSpecSchema,
  moduleSpecSchema,
  flowSpecSchema,
  safeEditZoneSpecSchema,
  glossaryTermSchema,
} from './spec/index.js';

// Graph
export { buildSystemGraph, buildSystemMap } from './graph/index.js';

// Compiler
export { compileCapabilities } from './compiler/index.js';
export type { CompilerOutput, GeneratedFile } from './compiler/index.js';

// Diagnostics
export { runDiagnostics, formatDiagnosticsTerminal, formatDiagnosticsJSON } from './diagnostics/index.js';

// Impact
export { analyzeImpact } from './impact/index.js';
export { formatImpactTerminal, formatImpactJSON } from './impact/index.js';

// Change Plan Protocol
export { generateChangePlan, createEmptyPlan } from './plan/index.js';
export { renderChangePlanMarkdown, renderChangePlanJSON, renderChangePlanTerminal } from './plan/index.js';
export { changePlanSchema } from './plan/index.js';
export type { PlanRequest } from './plan/index.js';

// Runtime
export { SysmaraServer } from './runtime/index.js';
export { Router } from './runtime/index.js';
export { loadConfig, resolveConfig } from './runtime/index.js';
export { SysmaraError, NotFoundError, ValidationError, ForbiddenError, BadRequestError } from './runtime/index.js';
export { Logger } from './runtime/index.js';

// Safety
export { validateEditZones, checkBoundaryViolations } from './safety/index.js';

// Invariants
export { validateInvariantSpecs, resolveInvariantsForEntity, resolveInvariantsForCapability } from './invariants/index.js';

// Boundaries
export { validateModuleBoundaries, validateCapabilityBoundaries, detectModuleCycles } from './boundaries/index.js';
