/**
 * @module @sysmara/core
 * Root barrel export for the SysMARA core library. Re-exports all public APIs
 * including types, spec parsing, graph generation, capability compilation,
 * diagnostics, impact analysis, change plans, runtime server components,
 * safety validation, invariant resolution, and module boundary checking.
 */

// Core types
export * from './types/index.js';

// Spec system — parsing and validation
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

// Graph — system dependency graph and module map generation
export { buildSystemGraph, buildSystemMap } from './graph/index.js';

// Compiler — capability-to-TypeScript code generation
export { compileCapabilities } from './compiler/index.js';
export type { CompilerOutput, GeneratedFile } from './compiler/index.js';

// Scaffold — spec-driven implementation stub generator
export { scaffoldSpecs } from './scaffold/index.js';
export type { ScaffoldOutput, ScaffoldFile } from './scaffold/index.js';

// Diagnostics — system-wide health reporting
export { runDiagnostics, formatDiagnosticsTerminal, formatDiagnosticsJSON } from './diagnostics/index.js';

// Impact — dependency-aware change impact analysis
export { analyzeImpact } from './impact/index.js';
export { formatImpactTerminal, formatImpactJSON } from './impact/index.js';

// Change Plan Protocol — structured change planning
export { generateChangePlan, createEmptyPlan } from './plan/index.js';
export { renderChangePlanMarkdown, renderChangePlanJSON, renderChangePlanTerminal } from './plan/index.js';
export { changePlanSchema } from './plan/index.js';
export type { PlanRequest } from './plan/index.js';

// Runtime — HTTP server, router, config, errors, and logger
export { SysmaraServer } from './runtime/index.js';
export { Router } from './runtime/index.js';
export { loadConfig, resolveConfig } from './runtime/index.js';
export { SysmaraError, NotFoundError, ValidationError, ForbiddenError, BadRequestError } from './runtime/index.js';
export { Logger } from './runtime/index.js';

// Safety — edit zone validation and boundary enforcement
export { validateEditZones, checkBoundaryViolations } from './safety/index.js';

// Invariants — spec validation and resolution for entities and capabilities
export { validateInvariantSpecs, resolveInvariantsForEntity, resolveInvariantsForCapability } from './invariants/index.js';

// Boundaries — module dependency rules, capability scope, and cycle detection
export { validateModuleBoundaries, validateCapabilityBoundaries, detectModuleCycles } from './boundaries/index.js';

// Database — adapter interface, registry, and shared types
export { registerAdapter, getAdapter, listAdapters } from './database/index.js';
export type {
  DatabaseProvider,
  AdapterName,
  DatabaseAdapterConfig,
  DatabaseAdapter,
  ColumnType,
  ConstraintType,
  ConstraintDefinition,
  ColumnDefinition,
  TableDefinition,
  IndexDefinition,
  MigrationAction,
  MigrationStep,
  DatabaseStatus,
} from './database/index.js';

// Flow Execution Engine — saga compensation, retry, and AI-readable execution log
export {
  FlowExecutor,
  FlowExecutionLog,
  evaluateCondition,
} from './flow/index.js';
export type {
  CapabilityHandler,
  FlowExecutorConfig,
  FlowStatus,
  StepStatus,
  FlowContext,
  FlowError,
  StepExecutionRecord,
  FlowExecutionRecord,
  FlowSummary,
  FlowValidationResult,
  FlowLogSummary,
} from './flow/index.js';

// SysMARA ORM — AI-first database layer
export {
  SysmaraORM,
  SysmaraRepository,
  CapabilityQueryBuilder,
  OperationLog,
  MigrationEngine,
  generateSysmaraSchema,
  sysmaraOrmAdapter,
  createSysmaraOrmAdapter,
} from './database/index.js';
export type {
  OperationLogEntry,
  BuiltQuery,
  QueryOperation,
  SysmaraMigrationStep,
  MigrationPlan,
} from './database/index.js';
