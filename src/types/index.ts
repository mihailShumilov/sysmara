// Entity definition
export interface EntitySpec {
  name: string;
  description: string;
  fields: EntityField[];
  module: string;
  invariants?: string[];
}

export interface EntityField {
  name: string;
  type: string; // string, number, boolean, date, enum, reference
  required: boolean;
  description?: string;
  constraints?: FieldConstraint[];
}

export interface FieldConstraint {
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'enum' | 'unique';
  value: string | number | string[];
  message?: string;
}

// Capability definition
export interface CapabilitySpec {
  name: string;
  description: string;
  module: string;
  entities: string[];
  input: CapabilityField[];
  output: CapabilityField[];
  policies: string[];
  invariants: string[];
  sideEffects?: string[];
  idempotent?: boolean;
}

export interface CapabilityField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// Policy definition
export interface PolicySpec {
  name: string;
  description: string;
  actor: string;
  capabilities: string[];
  conditions: PolicyCondition[];
  effect: 'allow' | 'deny';
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'exists' | 'is_owner' | 'has_role';
  value: string | string[];
}

// Invariant definition
export interface InvariantSpec {
  name: string;
  description: string;
  entity: string;
  rule: string; // human-readable rule description
  severity: 'error' | 'warning';
  enforcement: 'runtime' | 'compile' | 'both';
}

// Module definition
export interface ModuleSpec {
  name: string;
  description: string;
  entities: string[];
  capabilities: string[];
  allowedDependencies: string[];
  forbiddenDependencies: string[];
  owner?: string;
}

// Flow definition
export interface FlowSpec {
  name: string;
  description: string;
  trigger: string; // capability name that triggers the flow
  steps: FlowStep[];
  module: string;
}

export interface FlowStep {
  name: string;
  action: string; // capability or side-effect name
  onFailure: 'abort' | 'skip' | 'retry' | 'compensate';
  compensation?: string;
  condition?: string;
}

// Safe Edit Zone
export type EditZone = 'generated' | 'editable' | 'protected' | 'human-review-only';

export interface SafeEditZoneSpec {
  path: string;
  zone: EditZone;
  owner?: string;
  description?: string;
}

// Glossary term
export interface GlossaryTerm {
  term: string;
  definition: string;
  relatedEntities?: string[];
}

// System specifications (all specs combined)
export interface SystemSpecs {
  entities: EntitySpec[];
  capabilities: CapabilitySpec[];
  policies: PolicySpec[];
  invariants: InvariantSpec[];
  modules: ModuleSpec[];
  flows: FlowSpec[];
  safeEditZones: SafeEditZoneSpec[];
  glossary: GlossaryTerm[];
}

// Diagnostic types
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  source: string; // which file or spec
  path?: string; // JSON path within spec
  suggestion?: string;
}

export interface DiagnosticsReport {
  timestamp: string;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  diagnostics: Diagnostic[];
}

// Graph types
export type GraphNodeType = 'entity' | 'capability' | 'module' | 'policy' | 'invariant' | 'flow' | 'route' | 'file';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  metadata: Record<string, unknown>;
}

export type GraphEdgeType =
  | 'belongs_to'      // entity -> module
  | 'uses_entity'     // capability -> entity
  | 'governed_by'     // capability -> policy
  | 'enforces'        // invariant -> entity
  | 'depends_on'      // module -> module
  | 'triggers'        // capability -> flow
  | 'exposes'         // route -> capability
  | 'owns'            // module -> file
  | 'protects'        // invariant -> capability
  | 'step_of';        // capability -> flow

export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  metadata?: Record<string, unknown>;
}

export interface SystemGraph {
  version: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SystemMap {
  version: string;
  generatedAt: string;
  modules: SystemMapModule[];
  capabilities: SystemMapCapability[];
  entities: string[];
  unresolved: string[];
}

export interface SystemMapModule {
  name: string;
  entities: string[];
  capabilities: string[];
  dependencies: string[];
}

export interface SystemMapCapability {
  name: string;
  module: string;
  entities: string[];
  policies: string[];
  invariants: string[];
  routes: string[];
}

// Impact analysis
export interface ImpactSurface {
  target: string;
  targetType: GraphNodeType;
  affectedModules: string[];
  affectedInvariants: string[];
  affectedPolicies: string[];
  affectedCapabilities: string[];
  affectedRoutes: string[];
  affectedFlows: string[];
  affectedTests: string[];
  generatedArtifacts: string[];
}

// Runtime types
export interface RouteSpec {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  capability: string;
  description?: string;
}

export interface HandlerContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  actor: ActorContext;
  capability: string;
}

export interface ActorContext {
  id: string;
  roles: string[];
  attributes: Record<string, unknown>;
}

export interface SysmaraConfig {
  name: string;
  version: string;
  specDir: string;
  appDir: string;
  frameworkDir: string;
  generatedDir: string;
  port: number;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Change Plan Protocol
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ChangePlan {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  author: string;
  status: 'draft' | 'proposed' | 'approved' | 'rejected' | 'implemented';
  risk: RiskLevel;
  summary: ChangePlanSummary;
  capabilityChanges: CapabilityChange[];
  affectedEntities: AffectedItem[];
  affectedModules: AffectedItem[];
  affectedPolicies: AffectedItem[];
  affectedInvariants: AffectedItem[];
  affectedRoutes: AffectedItem[];
  migrationNotes: string[];
  generatedArtifactsToRefresh: string[];
  testsLikelyAffected: string[];
  specsToUpdate: string[];
  humanReviewFlags: string[];
  rolloutNotes: string[];
  openQuestions: string[];
}

export interface ChangePlanSummary {
  intent: string;
  scope: string;
  estimatedImpactRadius: number; // number of affected nodes
  requiresHumanReview: boolean;
  breakingChanges: boolean;
}

export type ChangeAction = 'add' | 'modify' | 'remove' | 'rename';

export interface CapabilityChange {
  capability: string;
  action: ChangeAction;
  description: string;
  newEntities?: string[];
  newPolicies?: string[];
  newInvariants?: string[];
  breakingChange: boolean;
}

export interface AffectedItem {
  name: string;
  impact: 'direct' | 'indirect';
  description: string;
}

// Generated manifest
export interface GeneratedManifest {
  generatedAt: string;
  files: GeneratedFileEntry[];
}

export interface GeneratedFileEntry {
  path: string;
  source: string; // which spec/capability generated it
  zone: EditZone;
  checksum: string;
  regenerable: boolean;
}
