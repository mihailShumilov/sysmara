/**
 * @module types
 *
 * Core type definitions for the Sysmara specification system.
 * Defines all interfaces and types used to represent entities, capabilities,
 * policies, invariants, modules, flows, diagnostics, graph structures,
 * impact analysis, runtime contexts, change plans, and generated manifests.
 */

/**
 * Defines a domain entity with its fields, module ownership, and optional invariants.
 *
 * @property name - Unique identifier for the entity
 * @property description - Human-readable description of the entity's purpose
 * @property fields - List of fields that compose the entity
 * @property module - Name of the module this entity belongs to
 * @property invariants - Optional list of invariant names that apply to this entity
 */
export interface EntitySpec {
  name: string;
  description: string;
  fields: EntityField[];
  module: string;
  invariants?: string[];
}

/**
 * Describes a single field within an entity definition.
 *
 * @property name - The field name
 * @property type - The field data type (e.g., "string", "number", "boolean", "date", "enum", "reference")
 * @property required - Whether this field must be present
 * @property description - Optional human-readable description of the field
 * @property constraints - Optional validation constraints applied to this field
 */
export interface EntityField {
  name: string;
  type: string; // string, number, boolean, date, enum, reference
  required: boolean;
  description?: string;
  constraints?: FieldConstraint[];
}

/**
 * A validation constraint applied to an entity field.
 *
 * @property type - The constraint type (numeric bounds, string length, pattern, enum values, or uniqueness)
 * @property value - The constraint value: a number for min/max/minLength/maxLength, a string for pattern, or a string array for enum
 * @property message - Optional custom error message when the constraint is violated
 */
export interface FieldConstraint {
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'enum' | 'unique';
  value: string | number | string[];
  message?: string;
}

/**
 * Defines a system capability (a unit of business logic) with its inputs, outputs,
 * associated entities, governing policies, and enforced invariants.
 *
 * @property name - Unique identifier for the capability
 * @property description - Human-readable description of what the capability does
 * @property module - Name of the module this capability belongs to
 * @property entities - Names of entities this capability operates on
 * @property input - List of input fields accepted by this capability
 * @property output - List of output fields produced by this capability
 * @property policies - Names of policies that govern access to this capability
 * @property invariants - Names of invariants enforced during execution
 * @property sideEffects - Optional list of side-effect descriptions (e.g., sending email)
 * @property idempotent - Whether repeated invocations produce the same result
 */
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

/**
 * Describes a single input or output field of a capability.
 *
 * @property name - The field name
 * @property type - The field data type
 * @property required - Whether this field is mandatory
 * @property description - Optional human-readable description
 */
export interface CapabilityField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

/**
 * Defines an access control policy that governs which actors can invoke
 * specific capabilities under certain conditions.
 *
 * @property name - Unique identifier for the policy
 * @property description - Human-readable description of the policy's intent
 * @property actor - The actor role or identity this policy applies to
 * @property capabilities - Names of capabilities this policy governs
 * @property conditions - Conditions that must be met for the policy to apply
 * @property effect - Whether the policy allows or denies access when conditions are met
 */
export interface PolicySpec {
  name: string;
  description: string;
  actor: string;
  capabilities: string[];
  conditions: PolicyCondition[];
  effect: 'allow' | 'deny';
}

/**
 * A condition within a policy that must evaluate to true for the policy to apply.
 *
 * @property field - The field or attribute to evaluate
 * @property operator - The comparison operator to use
 * @property value - The value to compare against (a single string or array of strings)
 */
export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'exists' | 'is_owner' | 'has_role';
  value: string | string[];
}

/**
 * Defines a business invariant (a rule that must always hold true) for an entity.
 *
 * @property name - Unique identifier for the invariant
 * @property description - Human-readable explanation of the invariant
 * @property entity - Name of the entity this invariant applies to
 * @property rule - Human-readable rule description
 * @property severity - Whether a violation is treated as an error or a warning
 * @property enforcement - When the invariant is checked: at runtime, compile time, or both
 */
export interface InvariantSpec {
  name: string;
  description: string;
  entity: string;
  rule: string; // human-readable rule description
  severity: 'error' | 'warning';
  enforcement: 'runtime' | 'compile' | 'both';
}

/**
 * Defines a module that groups related entities and capabilities,
 * with explicit dependency boundaries.
 *
 * @property name - Unique identifier for the module
 * @property description - Human-readable description of the module's responsibility
 * @property entities - Names of entities owned by this module
 * @property capabilities - Names of capabilities provided by this module
 * @property allowedDependencies - Module names this module is permitted to depend on
 * @property forbiddenDependencies - Module names this module must not depend on
 * @property owner - Optional owner or team responsible for this module
 */
export interface ModuleSpec {
  name: string;
  description: string;
  entities: string[];
  capabilities: string[];
  allowedDependencies: string[];
  forbiddenDependencies: string[];
  owner?: string;
}

/**
 * Defines a multi-step workflow triggered by a capability, consisting of
 * ordered steps with failure handling strategies.
 *
 * @property name - Unique identifier for the flow
 * @property description - Human-readable description of the flow's purpose
 * @property trigger - Name of the capability that initiates this flow
 * @property steps - Ordered list of steps in the flow
 * @property module - Name of the module this flow belongs to
 */
export interface FlowSpec {
  name: string;
  description: string;
  trigger: string; // capability name that triggers the flow
  steps: FlowStep[];
  module: string;
}

/**
 * A single step within a flow, representing an action to execute with
 * a defined failure-handling strategy.
 *
 * @property name - The step name
 * @property action - The capability or side-effect name to execute
 * @property onFailure - Strategy when this step fails: abort the flow, skip the step, retry, or run compensation
 * @property compensation - Optional capability name to run as compensation when onFailure is "compensate"
 * @property condition - Optional condition expression that must be true for this step to execute
 */
export interface FlowStep {
  name: string;
  action: string; // capability or side-effect name
  onFailure: 'abort' | 'skip' | 'retry' | 'compensate';
  compensation?: string;
  condition?: string;
}

/**
 * Classification of a file path's edit permissions.
 * - `generated` - Fully generated; will be overwritten on regeneration
 * - `editable` - Safe for human or AI editing
 * - `protected` - Must not be modified without explicit authorization
 * - `human-review-only` - Changes require human review before merging
 */
export type EditZone = 'generated' | 'editable' | 'protected' | 'human-review-only';

/**
 * Maps a file path to its edit zone classification, controlling
 * what kind of modifications are permitted.
 *
 * @property path - The file path (glob or exact) this zone applies to
 * @property zone - The edit permission level for files matching this path
 * @property owner - Optional owner or team responsible for this zone
 * @property description - Optional explanation of the zone's purpose
 */
export interface SafeEditZoneSpec {
  path: string;
  zone: EditZone;
  owner?: string;
  description?: string;
}

/**
 * A domain glossary entry that defines a term and optionally links it to entities.
 *
 * @property term - The glossary term
 * @property definition - The term's definition in the domain context
 * @property relatedEntities - Optional entity names related to this term
 */
export interface GlossaryTerm {
  term: string;
  definition: string;
  relatedEntities?: string[];
}

/**
 * The complete set of system specifications, aggregating all entity, capability,
 * policy, invariant, module, flow, safe-edit-zone, and glossary definitions.
 *
 * @property entities - All entity definitions
 * @property capabilities - All capability definitions
 * @property policies - All policy definitions
 * @property invariants - All invariant definitions
 * @property modules - All module definitions
 * @property flows - All flow definitions
 * @property safeEditZones - All safe edit zone mappings
 * @property glossary - All glossary term definitions
 */
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

/**
 * Severity level for a diagnostic message.
 * - `error` - A problem that prevents valid spec processing
 * - `warning` - A potential issue that does not block processing
 * - `info` - Informational message
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * A single diagnostic message produced during spec parsing or validation.
 *
 * @property code - Machine-readable diagnostic code (e.g., "UNRESOLVED_ENTITY_REF")
 * @property severity - The severity level of this diagnostic
 * @property message - Human-readable description of the issue
 * @property source - The file path or spec identifier where the issue was found
 * @property path - Optional JSON/dot path within the spec pinpointing the issue
 * @property suggestion - Optional suggested fix for the issue
 */
export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  source: string; // which file or spec
  path?: string; // JSON path within spec
  suggestion?: string;
}

/**
 * An aggregated report of all diagnostics produced during spec processing.
 *
 * @property timestamp - ISO 8601 timestamp when the report was generated
 * @property totalErrors - Count of error-level diagnostics
 * @property totalWarnings - Count of warning-level diagnostics
 * @property totalInfo - Count of info-level diagnostics
 * @property diagnostics - The full list of diagnostic messages
 */
export interface DiagnosticsReport {
  timestamp: string;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  diagnostics: Diagnostic[];
}

/**
 * The type of a node in the system dependency graph.
 */
export type GraphNodeType = 'entity' | 'capability' | 'module' | 'policy' | 'invariant' | 'flow' | 'route' | 'file';

/**
 * A node in the system dependency graph, representing a spec element
 * (entity, capability, module, policy, invariant, flow, route, or file).
 *
 * @property id - Unique node identifier in the format "type:name" (e.g., "entity:User")
 * @property type - The kind of spec element this node represents
 * @property name - The human-readable name of the node
 * @property metadata - Additional type-specific data (e.g., module ownership, trigger info)
 */
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  metadata: Record<string, unknown>;
}

/**
 * The type of a directed edge in the system dependency graph.
 *
 * - `belongs_to` - entity -> module (entity is owned by module)
 * - `uses_entity` - capability -> entity (capability operates on entity)
 * - `governed_by` - capability -> policy (capability is governed by policy)
 * - `enforces` - invariant -> entity (invariant constrains entity)
 * - `depends_on` - module -> module (module depends on another module)
 * - `triggers` - capability -> flow (capability initiates flow)
 * - `exposes` - route -> capability (HTTP route exposes capability)
 * - `owns` - module -> file (module owns a generated file)
 * - `protects` - invariant -> capability (invariant guards capability execution)
 * - `step_of` - capability -> flow (capability is a step within flow)
 */
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

/**
 * A directed edge in the system dependency graph connecting two nodes.
 *
 * @property source - The ID of the source node
 * @property target - The ID of the target node
 * @property type - The relationship type this edge represents
 * @property metadata - Optional additional data about the relationship
 */
export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  metadata?: Record<string, unknown>;
}

/**
 * The complete system dependency graph containing all nodes and edges.
 *
 * @property version - The schema version of the graph format
 * @property generatedAt - ISO 8601 timestamp when the graph was generated
 * @property nodes - All nodes in the graph, sorted by ID
 * @property edges - All directed edges in the graph, sorted by source then target
 */
export interface SystemGraph {
  version: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * A high-level summary map of the entire system, organizing modules,
 * capabilities, entities, and tracking unresolved references.
 *
 * @property version - The schema version of the map format
 * @property generatedAt - ISO 8601 timestamp when the map was generated
 * @property modules - Summary of each module's contents and dependencies
 * @property capabilities - Summary of each capability's relationships
 * @property entities - Sorted list of all entity names in the system
 * @property unresolved - Sorted list of unresolved references (formatted as "type:name")
 */
export interface SystemMap {
  version: string;
  generatedAt: string;
  modules: SystemMapModule[];
  capabilities: SystemMapCapability[];
  entities: string[];
  unresolved: string[];
}

/**
 * A module entry within the system map, summarizing its owned entities,
 * capabilities, and module dependencies.
 *
 * @property name - The module name
 * @property entities - Sorted list of entity names owned by this module
 * @property capabilities - Sorted list of capability names provided by this module
 * @property dependencies - Sorted list of allowed dependency module names
 */
export interface SystemMapModule {
  name: string;
  entities: string[];
  capabilities: string[];
  dependencies: string[];
}

/**
 * A capability entry within the system map, summarizing its relationships
 * to entities, policies, invariants, and HTTP routes.
 *
 * @property name - The capability name
 * @property module - The module this capability belongs to
 * @property entities - Sorted list of entity names this capability uses
 * @property policies - Sorted list of policy names governing this capability
 * @property invariants - Sorted list of invariant names enforced by this capability
 * @property routes - Sorted list of HTTP route strings (e.g., "GET /users") exposing this capability
 */
export interface SystemMapCapability {
  name: string;
  module: string;
  entities: string[];
  policies: string[];
  invariants: string[];
  routes: string[];
}

/**
 * Describes the blast radius of a change to a specific node in the system graph,
 * listing all affected modules, policies, invariants, capabilities, routes, flows,
 * tests, and generated artifacts.
 *
 * @property target - The identifier of the changed node
 * @property targetType - The type of the changed node
 * @property affectedModules - Module names impacted by the change
 * @property affectedInvariants - Invariant names impacted by the change
 * @property affectedPolicies - Policy names impacted by the change
 * @property affectedCapabilities - Capability names impacted by the change
 * @property affectedRoutes - Route identifiers impacted by the change
 * @property affectedFlows - Flow names impacted by the change
 * @property affectedTests - Test identifiers likely impacted by the change
 * @property generatedArtifacts - Generated file paths that may need regeneration
 */
export interface ImpactSurface {
  target: string;
  targetType: GraphNodeType;
  affectedModules: string[];
  affectedInvariants: string[];
  affectedPolicies: string[];
  affectedCapabilities: string[];
  affectedRoutes: string[];
  affectedFlows: string[];
  affectedFiles: string[];
  affectedTests: string[];
  generatedArtifacts: string[];
}

/**
 * Defines an HTTP route that exposes a capability via a REST endpoint.
 *
 * @property method - The HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @property path - The URL path pattern (e.g., "/users/:id")
 * @property capability - The name of the capability this route invokes
 * @property description - Optional description of the route's purpose
 */
export interface RouteSpec {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  capability: string;
  description?: string;
}

/**
 * The runtime context passed to a capability handler when invoked via an HTTP route.
 *
 * @property params - URL path parameters (e.g., `{ id: "123" }`)
 * @property query - URL query string parameters
 * @property body - The parsed request body
 * @property actor - Information about the authenticated actor making the request
 * @property capability - The name of the capability being invoked
 */
export interface HandlerContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  actor: ActorContext;
  capability: string;
}

/**
 * Identity and authorization context for the actor performing a request.
 *
 * @property id - Unique identifier for the actor
 * @property roles - List of roles assigned to this actor
 * @property attributes - Additional actor attributes used for policy evaluation
 */
export interface ActorContext {
  id: string;
  roles: string[];
  attributes: Record<string, unknown>;
}

/**
 * Top-level configuration for a Sysmara project, defining paths, server settings,
 * and logging behavior.
 *
 * @property name - The project name
 * @property version - The project version string
 * @property specDir - Path to the directory containing spec YAML files
 * @property appDir - Path to the application source directory
 * @property frameworkDir - Path to the framework directory
 * @property generatedDir - Path to the directory for generated artifacts
 * @property port - The HTTP server port number
 * @property host - The HTTP server host address
 * @property logLevel - Minimum log level to output
 * @property database - Optional database adapter configuration
 */
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
  database?: DatabaseConfig;
}

/**
 * Database configuration section within `sysmara.config.yaml`.
 *
 * @property adapter - The ORM or query-builder adapter to use
 * @property provider - The target database provider
 * @property outputDir - Optional output directory for generated database files
 * @property connectionString - Optional database connection string
 */
export interface DatabaseConfig {
  adapter: string;
  provider: string;
  outputDir?: string;
  connectionString?: string;
}

/**
 * Risk level classification for a change plan.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * A structured change plan describing a proposed modification to the system,
 * including its scope, risk, affected artifacts, and rollout considerations.
 *
 * @property id - Unique identifier for the change plan
 * @property title - Short title summarizing the change
 * @property description - Detailed description of the change
 * @property createdAt - ISO 8601 timestamp when the plan was created
 * @property author - The author of the change plan
 * @property status - Current lifecycle status of the plan
 * @property risk - Assessed risk level of the change
 * @property summary - High-level summary including intent, scope, and impact
 * @property capabilityChanges - List of capability-level changes
 * @property affectedEntities - Entities affected by the change
 * @property affectedModules - Modules affected by the change
 * @property affectedPolicies - Policies affected by the change
 * @property affectedInvariants - Invariants affected by the change
 * @property affectedRoutes - Routes affected by the change
 * @property migrationNotes - Notes about data or schema migrations needed
 * @property generatedArtifactsToRefresh - Paths of generated files needing regeneration
 * @property testsLikelyAffected - Tests that may need updating or re-running
 * @property specsToUpdate - Spec files that need modification
 * @property humanReviewFlags - Items flagged for mandatory human review
 * @property rolloutNotes - Notes for safe rollout/deployment
 * @property openQuestions - Unresolved questions about the change
 */
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

/**
 * High-level summary of a change plan's intent, scope, and impact.
 *
 * @property intent - What the change aims to achieve
 * @property scope - Description of the change's scope (e.g., which modules/entities are involved)
 * @property estimatedImpactRadius - Estimated number of graph nodes affected by the change
 * @property requiresHumanReview - Whether the change requires explicit human review
 * @property breakingChanges - Whether the change introduces breaking changes
 */
export interface ChangePlanSummary {
  intent: string;
  scope: string;
  estimatedImpactRadius: number; // number of affected nodes
  requiresHumanReview: boolean;
  breakingChanges: boolean;
}

/**
 * The type of action being performed on a capability in a change plan.
 */
export type ChangeAction = 'add' | 'modify' | 'remove' | 'rename';

/**
 * Describes a specific change to a capability within a change plan.
 *
 * @property capability - The name of the capability being changed
 * @property action - The type of change (add, modify, remove, rename)
 * @property description - Human-readable description of the change
 * @property newEntities - Optional new entity references introduced by this change
 * @property newPolicies - Optional new policy references introduced by this change
 * @property newInvariants - Optional new invariant references introduced by this change
 * @property breakingChange - Whether this specific change is breaking
 */
export interface CapabilityChange {
  capability: string;
  action: ChangeAction;
  description: string;
  newEntities?: string[];
  newPolicies?: string[];
  newInvariants?: string[];
  breakingChange: boolean;
}

/**
 * An item affected by a change plan, classified as directly or indirectly impacted.
 *
 * @property name - The name of the affected item
 * @property impact - Whether the impact is direct (changed item) or indirect (transitive dependency)
 * @property description - Explanation of how this item is affected
 */
export interface AffectedItem {
  name: string;
  impact: 'direct' | 'indirect';
  description: string;
}

/**
 * A manifest tracking all files generated by the Sysmara code generation process.
 *
 * @property generatedAt - ISO 8601 timestamp when the manifest was created
 * @property files - List of all generated file entries
 */
export interface GeneratedManifest {
  generatedAt: string;
  files: GeneratedFileEntry[];
}

/**
 * Metadata for a single generated file, tracking its origin, edit zone, and integrity.
 *
 * @property path - The file path of the generated artifact
 * @property source - The spec or capability that generated this file
 * @property zone - The edit zone classification for this file
 * @property checksum - A checksum for detecting manual modifications
 * @property regenerable - Whether this file can be safely regenerated from specs
 */
export interface GeneratedFileEntry {
  path: string;
  source: string; // which spec/capability generated it
  zone: EditZone;
  checksum: string;
  regenerable: boolean;
}
