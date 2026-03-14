import { z } from 'zod';

// ── Field Constraint ──

export const fieldConstraintSchema = z.object({
  type: z.enum(['min', 'max', 'minLength', 'maxLength', 'pattern', 'enum', 'unique']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  message: z.string().optional(),
});

// ── Entity ──

export const entityFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string().optional(),
  constraints: z.array(fieldConstraintSchema).optional(),
});

export const entitySpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  fields: z.array(entityFieldSchema),
  module: z.string(),
  invariants: z.array(z.string()).optional(),
});

// ── Capability ──

export const capabilityFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string().optional(),
});

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

export const policyConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'in', 'not_in', 'exists', 'is_owner', 'has_role']),
  value: z.union([z.string(), z.array(z.string())]),
});

export const policySpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  actor: z.string(),
  capabilities: z.array(z.string()),
  conditions: z.array(policyConditionSchema),
  effect: z.enum(['allow', 'deny']),
});

// ── Invariant ──

export const invariantSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  entity: z.string(),
  rule: z.string(),
  severity: z.enum(['error', 'warning']),
  enforcement: z.enum(['runtime', 'compile', 'both']),
});

// ── Module ──

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

export const flowStepSchema = z.object({
  name: z.string(),
  action: z.string(),
  onFailure: z.enum(['abort', 'skip', 'retry', 'compensate']),
  compensation: z.string().optional(),
  condition: z.string().optional(),
});

export const flowSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.string(),
  steps: z.array(flowStepSchema),
  module: z.string(),
});

// ── Safe Edit Zone ──

export const editZoneSchema = z.enum(['generated', 'editable', 'protected', 'human-review-only']);

export const safeEditZoneSpecSchema = z.object({
  path: z.string(),
  zone: editZoneSchema,
  owner: z.string().optional(),
  description: z.string().optional(),
});

// ── Glossary ──

export const glossaryTermSchema = z.object({
  term: z.string(),
  definition: z.string(),
  relatedEntities: z.array(z.string()).optional(),
});

// ── System Specs ──

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

export const diagnosticSeveritySchema = z.enum(['error', 'warning', 'info']);

export const diagnosticSchema = z.object({
  code: z.string(),
  severity: diagnosticSeveritySchema,
  message: z.string(),
  source: z.string(),
  path: z.string().optional(),
  suggestion: z.string().optional(),
});

export const diagnosticsReportSchema = z.object({
  timestamp: z.string(),
  totalErrors: z.number(),
  totalWarnings: z.number(),
  totalInfo: z.number(),
  diagnostics: z.array(diagnosticSchema),
});

// ── Graph ──

export const graphNodeTypeSchema = z.enum([
  'entity', 'capability', 'module', 'policy', 'invariant', 'flow', 'route', 'file',
]);

export const graphNodeSchema = z.object({
  id: z.string(),
  type: graphNodeTypeSchema,
  name: z.string(),
  metadata: z.record(z.unknown()),
});

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

export const graphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: graphEdgeTypeSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const systemGraphSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export const systemMapModuleSchema = z.object({
  name: z.string(),
  entities: z.array(z.string()),
  capabilities: z.array(z.string()),
  dependencies: z.array(z.string()),
});

export const systemMapCapabilitySchema = z.object({
  name: z.string(),
  module: z.string(),
  entities: z.array(z.string()),
  policies: z.array(z.string()),
  invariants: z.array(z.string()),
  routes: z.array(z.string()),
});

export const systemMapSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  modules: z.array(systemMapModuleSchema),
  capabilities: z.array(systemMapCapabilitySchema),
  entities: z.array(z.string()),
  unresolved: z.array(z.string()),
});

// ── Impact Surface ──

export const impactSurfaceSchema = z.object({
  target: z.string(),
  targetType: graphNodeTypeSchema,
  affectedModules: z.array(z.string()),
  affectedInvariants: z.array(z.string()),
  affectedPolicies: z.array(z.string()),
  affectedCapabilities: z.array(z.string()),
  affectedRoutes: z.array(z.string()),
  affectedFlows: z.array(z.string()),
  affectedTests: z.array(z.string()),
  generatedArtifacts: z.array(z.string()),
});

// ── Runtime ──

export const routeSpecSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  capability: z.string(),
  description: z.string().optional(),
});

export const actorContextSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()),
  attributes: z.record(z.unknown()),
});

export const handlerContextSchema = z.object({
  params: z.record(z.string()),
  query: z.record(z.string()),
  body: z.unknown(),
  actor: actorContextSchema,
  capability: z.string(),
});

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

export const generatedFileEntrySchema = z.object({
  path: z.string(),
  source: z.string(),
  zone: editZoneSchema,
  checksum: z.string(),
  regenerable: z.boolean(),
});

export const generatedManifestSchema = z.object({
  generatedAt: z.string(),
  files: z.array(generatedFileEntrySchema),
});

// ── Collection schemas (for parsing YAML files that contain arrays) ──

export const entitiesFileSchema = z.array(entitySpecSchema);
export const capabilitiesFileSchema = z.array(capabilitySpecSchema);
export const policiesFileSchema = z.array(policySpecSchema);
export const invariantsFileSchema = z.array(invariantSpecSchema);
export const modulesFileSchema = z.array(moduleSpecSchema);
export const flowsFileSchema = z.array(flowSpecSchema);
export const safeEditZonesFileSchema = z.array(safeEditZoneSpecSchema);
export const glossaryFileSchema = z.array(glossaryTermSchema);
