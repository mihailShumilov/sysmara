/**
 * @module spec/schemas
 *
 * Zod validation schemas for all Sysmara specification types.
 * Each schema corresponds to a TypeScript interface in `types/index.ts`
 * and is used to validate YAML spec files at parse time.
 */

import { z } from 'zod';

// ── Field Constraint ──

/** Zod schema for validating {@link FieldConstraint} objects. */
export const fieldConstraintSchema = z.object({
  type: z.enum(['min', 'max', 'minLength', 'maxLength', 'pattern', 'enum', 'unique']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  message: z.string().optional(),
});

// ── Entity ──

/** Zod schema for validating {@link EntityField} objects. */
export const entityFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string().optional(),
  constraints: z.array(fieldConstraintSchema).optional(),
});

/** Zod schema for validating {@link EntitySpec} objects. */
export const entitySpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  fields: z.array(entityFieldSchema),
  module: z.string(),
  invariants: z.array(z.string()).optional(),
});

// ── Capability ──

/** Zod schema for validating {@link CapabilityField} objects. */
export const capabilityFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string().optional(),
});

/** Zod schema for validating {@link CapabilitySpec} objects. */
export const capabilitySpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  module: z.string(),
  entities: z.array(z.string()),
  input: z.array(capabilityFieldSchema),
  output: z.array(capabilityFieldSchema),
  policies: z.array(z.string()),
  invariants: z.array(z.string()),
  sideEffects: z.array(z.string()).optional(),
  idempotent: z.boolean().optional(),
});

// ── Policy ──

/** Zod schema for validating {@link PolicyCondition} objects. */
export const policyConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'in', 'not_in', 'exists', 'is_owner', 'has_role']),
  value: z.union([z.string(), z.array(z.string())]),
});

/** Zod schema for validating {@link PolicySpec} objects. */
export const policySpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  actor: z.string(),
  capabilities: z.array(z.string()),
  conditions: z.array(policyConditionSchema),
  effect: z.enum(['allow', 'deny']),
});

// ── Invariant ──

/** Zod schema for validating {@link InvariantSpec} objects. */
export const invariantSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  entity: z.string(),
  rule: z.string(),
  severity: z.enum(['error', 'warning']),
  enforcement: z.enum(['runtime', 'compile', 'both']),
});

// ── Module ──

/** Zod schema for validating {@link ModuleSpec} objects. */
export const moduleSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  entities: z.array(z.string()),
  capabilities: z.array(z.string()),
  allowedDependencies: z.array(z.string()),
  forbiddenDependencies: z.array(z.string()),
  owner: z.string().optional(),
});

// ── Flow ──

/** Zod schema for validating {@link FlowStep} objects. */
export const flowStepSchema = z.object({
  name: z.string(),
  action: z.string(),
  onFailure: z.enum(['abort', 'skip', 'retry', 'compensate']),
  compensation: z.string().optional(),
  condition: z.string().optional(),
});

/** Zod schema for validating {@link FlowSpec} objects. */
export const flowSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.string(),
  steps: z.array(flowStepSchema),
  module: z.string(),
});

// ── Safe Edit Zone ──

/** Zod schema for validating {@link EditZone} values. */
export const editZoneSchema = z.enum(['generated', 'editable', 'protected', 'human-review-only']);

/** Zod schema for validating {@link SafeEditZoneSpec} objects. */
export const safeEditZoneSpecSchema = z.object({
  path: z.string(),
  zone: editZoneSchema,
  owner: z.string().optional(),
  description: z.string().optional(),
});

// ── Glossary ──

/** Zod schema for validating {@link GlossaryTerm} objects. */
export const glossaryTermSchema = z.object({
  term: z.string(),
  definition: z.string(),
  relatedEntities: z.array(z.string()).optional(),
});

// ── System Specs ──

/** Zod schema for validating the complete {@link SystemSpecs} object. */
export const systemSpecsSchema = z.object({
  entities: z.array(entitySpecSchema),
  capabilities: z.array(capabilitySpecSchema),
  policies: z.array(policySpecSchema),
  invariants: z.array(invariantSpecSchema),
  modules: z.array(moduleSpecSchema),
  flows: z.array(flowSpecSchema),
  safeEditZones: z.array(safeEditZoneSpecSchema),
  glossary: z.array(glossaryTermSchema),
});

// ── Diagnostics ──

/** Zod schema for validating {@link DiagnosticSeverity} values. */
export const diagnosticSeveritySchema = z.enum(['error', 'warning', 'info']);

/** Zod schema for validating {@link Diagnostic} objects. */
export const diagnosticSchema = z.object({
  code: z.string(),
  severity: diagnosticSeveritySchema,
  message: z.string(),
  source: z.string(),
  path: z.string().optional(),
  suggestion: z.string().optional(),
});

/** Zod schema for validating {@link DiagnosticsReport} objects. */
export const diagnosticsReportSchema = z.object({
  timestamp: z.string(),
  totalErrors: z.number(),
  totalWarnings: z.number(),
  totalInfo: z.number(),
  diagnostics: z.array(diagnosticSchema),
});

// ── Graph ──

/** Zod schema for validating {@link GraphNodeType} values. */
export const graphNodeTypeSchema = z.enum([
  'entity', 'capability', 'module', 'policy', 'invariant', 'flow', 'route', 'file',
]);

/** Zod schema for validating {@link GraphNode} objects. */
export const graphNodeSchema = z.object({
  id: z.string(),
  type: graphNodeTypeSchema,
  name: z.string(),
  metadata: z.record(z.unknown()),
});

/** Zod schema for validating {@link GraphEdgeType} values. */
export const graphEdgeTypeSchema = z.enum([
  'belongs_to',
  'uses_entity',
  'governed_by',
  'enforces',
  'depends_on',
  'triggers',
  'exposes',
  'owns',
  'protects',
  'step_of',
]);

/** Zod schema for validating {@link GraphEdge} objects. */
export const graphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: graphEdgeTypeSchema,
  metadata: z.record(z.unknown()).optional(),
});

/** Zod schema for validating {@link SystemGraph} objects. */
export const systemGraphSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

/** Zod schema for validating {@link SystemMapModule} objects. */
export const systemMapModuleSchema = z.object({
  name: z.string(),
  entities: z.array(z.string()),
  capabilities: z.array(z.string()),
  dependencies: z.array(z.string()),
});

/** Zod schema for validating {@link SystemMapCapability} objects. */
export const systemMapCapabilitySchema = z.object({
  name: z.string(),
  module: z.string(),
  entities: z.array(z.string()),
  policies: z.array(z.string()),
  invariants: z.array(z.string()),
  routes: z.array(z.string()),
});

/** Zod schema for validating {@link SystemMap} objects. */
export const systemMapSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  modules: z.array(systemMapModuleSchema),
  capabilities: z.array(systemMapCapabilitySchema),
  entities: z.array(z.string()),
  unresolved: z.array(z.string()),
});

// ── Impact Surface ──

/** Zod schema for validating {@link ImpactSurface} objects. */
export const impactSurfaceSchema = z.object({
  target: z.string(),
  targetType: graphNodeTypeSchema,
  affectedModules: z.array(z.string()),
  affectedInvariants: z.array(z.string()),
  affectedPolicies: z.array(z.string()),
  affectedCapabilities: z.array(z.string()),
  affectedRoutes: z.array(z.string()),
  affectedFlows: z.array(z.string()),
  affectedFiles: z.array(z.string()),
  affectedTests: z.array(z.string()),
  generatedArtifacts: z.array(z.string()),
});

// ── Runtime ──

/** Zod schema for validating {@link RouteSpec} objects. */
export const routeSpecSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  capability: z.string(),
  description: z.string().optional(),
});

/** Zod schema for validating {@link ActorContext} objects. */
export const actorContextSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()),
  attributes: z.record(z.unknown()),
});

/** Zod schema for validating {@link HandlerContext} objects. */
export const handlerContextSchema = z.object({
  params: z.record(z.string()),
  query: z.record(z.string()),
  body: z.unknown(),
  actor: actorContextSchema,
  capability: z.string(),
});

/** Zod schema for validating {@link SysmaraConfig} objects. */
export const sysmaraConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  specDir: z.string(),
  appDir: z.string(),
  frameworkDir: z.string(),
  generatedDir: z.string(),
  port: z.number(),
  host: z.string(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});

// ── Generated Manifest ──

/** Zod schema for validating {@link GeneratedFileEntry} objects. */
export const generatedFileEntrySchema = z.object({
  path: z.string(),
  source: z.string(),
  zone: editZoneSchema,
  checksum: z.string(),
  regenerable: z.boolean(),
});

/** Zod schema for validating {@link GeneratedManifest} objects. */
export const generatedManifestSchema = z.object({
  generatedAt: z.string(),
  files: z.array(generatedFileEntrySchema),
});

// ── Collection schemas (for parsing YAML files that contain arrays) ──

/** Zod schema for validating an array of {@link EntitySpec} objects, as found in an entities YAML file. */
export const entitiesFileSchema = z.array(entitySpecSchema);
/** Zod schema for validating an array of {@link CapabilitySpec} objects, as found in a capabilities YAML file. */
export const capabilitiesFileSchema = z.array(capabilitySpecSchema);
/** Zod schema for validating an array of {@link PolicySpec} objects, as found in a policies YAML file. */
export const policiesFileSchema = z.array(policySpecSchema);
/** Zod schema for validating an array of {@link InvariantSpec} objects, as found in an invariants YAML file. */
export const invariantsFileSchema = z.array(invariantSpecSchema);
/** Zod schema for validating an array of {@link ModuleSpec} objects, as found in a modules YAML file. */
export const modulesFileSchema = z.array(moduleSpecSchema);
/** Zod schema for validating an array of {@link FlowSpec} objects, as found in a flows YAML file. */
export const flowsFileSchema = z.array(flowSpecSchema);
/** Zod schema for validating an array of {@link SafeEditZoneSpec} objects, as found in a safe-edit-zones YAML file. */
export const safeEditZonesFileSchema = z.array(safeEditZoneSpecSchema);
/** Zod schema for validating an array of {@link GlossaryTerm} objects, as found in a glossary YAML file. */
export const glossaryFileSchema = z.array(glossaryTermSchema);
