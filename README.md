# SysMARA

**Model / Architecture / Runtime Abstraction for AI-native backends**

> An AI-native backend framework where architecture is machine-readable, constraint-aware, and safe for AI-driven change.

## Build from One Prompt

Write a single product description. An AI agent reads [BOOTSTRAP.md](./BOOTSTRAP.md) and generates a fully working SysMARA project — specs, compiled routes, tests, running server.

```
Human: "Build a task manager with workspaces, tasks, and user roles"

AI Agent:
  → npx @sysmara/core init
  → Generates entities, capabilities, policies, invariants, modules, flows
  → sysmara build (validates + compiles)
  → Implements capability handlers
  → Server running on :3000
```

Three complete examples in [examples/ai-prompts/](./examples/ai-prompts/):
- **saas-task-manager** — workspaces, tasks, assignments, roles
- **ecommerce-api** — products, orders, inventory, checkout flow
- **blog-platform** — posts, authors, tags, moderation

See [docs/one-prompt-workflow.md](./docs/one-prompt-workflow.md) for the full step-by-step protocol with AI prompts.

## What is SysMARA?

Traditional backend frameworks assume that a human developer understands the hidden architecture of the system: which modules depend on which, what constraints apply to each field, how a change in one entity ripples through capabilities, policies, and invariants. This implicit knowledge lives in documentation, tribal memory, and convention. It works when humans are the primary implementors, but it breaks down the moment an AI agent is tasked with making changes.

SysMARA takes a different approach. Every architectural decision — entity definitions, capability contracts, policy rules, invariant constraints, module boundaries — is expressed as a machine-readable YAML spec. These specs form a **system graph**: a formal, queryable representation of the entire backend. AI agents read the graph, understand the constraints, and generate code that is provably consistent with the system's rules.

In a SysMARA project, humans define the boundaries — what entities exist, what operations are allowed, what invariants must hold. AI agents are the primary implementors, working within those boundaries to generate route handlers, service logic, and test scaffolds. The framework enforces safety through edit zones, boundary validation, and impact analysis, ensuring that no change — human or AI-driven — violates the system's formal truth.

## Core Concepts

### AI System Graph

The system graph is a directed graph where every entity, capability, policy, invariant, module, flow, route, and generated file is a node, and every relationship between them is a typed edge. It is built automatically from your YAML specs and written to `.framework/system-graph.json`. AI agents consume this graph to understand the full topology of your system before making any change.

**Node types:** `entity`, `capability`, `module`, `policy`, `invariant`, `flow`, `route`, `file`

**Edge types:** `belongs_to`, `uses_entity`, `governed_by`, `enforces`, `protects`, `depends_on`, `triggers`, `exposes`, `step_of`, `owns`

The `file` nodes represent generated artifacts (route handlers, test scaffolds, metadata) for each capability. The `owns` edge connects a module to the files generated for its capabilities, enabling impact analysis to show exactly which files are affected by a change.

The companion **system map** (`.framework/system-map.json`) is a higher-level index designed specifically for AI consumption: it lists modules with their capabilities, entities, and dependencies in a flat, scannable format.

### Capability Compiler

Capabilities are the unit of work in SysMARA. Each capability (e.g., `create_user`, `get_user`) is a named operation with defined inputs, outputs, policies, and invariants. The capability compiler reads these specs and generates:

- **Route handlers** with typed request/response signatures
- **Test scaffolds** with cases derived from the spec
- **Validation logic** based on field constraints

Generated code is written to the `app/generated/` directory. The **scaffold** step then generates starter implementation files in `app/` — entity interfaces in `app/entities/`, capability handlers in `app/capabilities/`, policy enforcers in `app/policies/`, invariant validators in `app/invariants/`, and service classes in `app/services/`. Scaffold files are written once and never overwritten, so developers (human or AI) can safely edit them.

### Change Protocol

Every change to a SysMARA system follows a formal model:

1. **Spec change** — The YAML specs are updated to reflect the desired state
2. **Validation** — Cross-reference validation ensures consistency (e.g., a capability references an entity that exists)
3. **Impact analysis** — The framework computes which parts of the system are affected
4. **Compilation** — The capability compiler regenerates affected artifacts
5. **Diagnostics** — The diagnostics engine verifies the system is healthy

This protocol ensures that changes are never made in isolation. Every modification is understood in the context of the full system.

## How SysMARA Differs

| Feature | Express/NestJS | SysMARA |
|---------|---------------|-------|
| Architecture | Implicit/convention | Machine-readable graph |
| Primary developer | Human | AI agent |
| Constraints | Documentation | Enforced invariants |
| Changes | File edits | Capability-level modeling |
| Dependencies | npm/import | Module boundary enforcement |
| Safety | Linting | Edit zone enforcement |
| Validation | Runtime checks | Spec-time cross-validation |
| Impact analysis | Manual review | Automated graph traversal |

## Quick Start

### Initialize a new project

```bash
npx @sysmara/core init --db postgresql --orm sysmara-orm
```

This creates the full project structure: YAML specs, database config, Docker environment (`docker-compose.yml`, `Dockerfile`), environment files (`.env.example`, `.env.local`), and `.gitignore`.

Options: `--db` (postgresql/mysql/sqlite), `--orm` (sysmara-orm/prisma/drizzle/typeorm).

### Build and start

```bash
docker compose up -d    # Start local database (PostgreSQL/MySQL only)
sysmara build           # Full build pipeline
sysmara start           # Start the server with auto-wired routes
```

That's it. `sysmara start` parses your YAML specs, connects to the database, creates tables, auto-wires every capability to an HTTP route, and starts the server. No manual route registration, no entry point boilerplate.

```
SysMARA Server
  Parsing specs...
  Connecting to database...
  ✓ Connected to postgresql (sysmara-orm)
  Applying database schema...
  ✓ Schema applied

  Registering routes...
  ✓ POST   /users                    → create_user
  ✓ GET    /users/:id                → get_user

  ✓ Server running at http://localhost:3000
```

### Alternative: Build generates a server entry point

`sysmara build` also generates `app/server.ts` — a standalone entry point that imports all scaffolded capability handlers and registers them as routes. You can customize this file and run it directly with `node` or `tsx` for production deployments.

### Run diagnostics

```bash
sysmara doctor
```

Runs 20+ validation checks and outputs a detailed report of errors, warnings, and suggestions.

### Generate the system graph

```bash
sysmara graph
```

Builds `system-graph.json` and `system-map.json` in the `.framework/` directory.

## Flow Execution Engine

SysMARA v0.4.0 includes a production-ready Flow Execution Engine that makes flows actually execute — not just validate. Flows are multi-step workflows triggered by capabilities, with full saga compensation, retry logic, and AI-readable execution logs.

### Core Features

- **Steps are capabilities** — each step maps to a declared CapabilitySpec
- **Context threading** — output of step N is available as input to step N+1
- **Saga compensation** — on failure, compensation runs in reverse order for completed steps
- **Retry with exponential backoff** — configurable max retries and base delay
- **Condition evaluation** — safe expression evaluation (no eval) for step conditions
- **AI-readable execution log** — every state transition recorded as structured JSON

### Usage

```typescript
import { FlowExecutor } from '@sysmara/core';

const executor = new FlowExecutor(specs, {
  capabilityHandler: async (capability, input, context) => {
    // Execute the capability — plug in your own DB/service logic
    return myService.run(capability, input);
  },
});

// Execute a flow
const result = await executor.execute('user_signup_flow', {
  email: 'alice@example.com',
  role: 'member',
});

console.log(result.status);           // "completed" | "failed" | "compensated"
console.log(result.summary);          // AI-readable summary
console.log(result.steps);            // Detailed step records

// Validate a flow before execution
const validation = executor.validate('user_signup_flow');

// Query execution history
const log = executor.getExecutionLog();
console.log(log.summarize());         // Success rate, avg duration, recent failures
```

### Flow Spec Example

```yaml
flows:
  - name: user_signup_flow
    description: Full user signup with compensation
    trigger: user_signup
    module: auth
    steps:
      - name: create_user
        action: create_user
        onFailure: compensate
        compensation: delete_user
      - name: create_profile
        action: create_profile
        onFailure: compensate
        compensation: delete_profile
      - name: send_email
        action: send_welcome_email
        onFailure: skip
      - name: admin_setup
        action: setup_admin
        onFailure: abort
        condition: 'context.input.role === "admin"'
```

## Database Layer

SysMARA ships a pluggable database adapter system with real database drivers. Configure in `sysmara.config.yaml`:

```yaml
database:
  adapter: sysmara-orm   # sysmara-orm | prisma | drizzle | typeorm
  provider: postgresql   # postgresql | mysql | sqlite
  connectionString: "postgresql://user:pass@localhost:5432/mydb"
```

### Supported Database Drivers

| Provider | Package | Install |
|----------|---------|---------|
| PostgreSQL | `pg` | `npm install pg` |
| MySQL | `mysql2` | `npm install mysql2` |
| SQLite | `better-sqlite3` | `npm install better-sqlite3` |

Drivers are optional peer dependencies — install only the one you need. When no driver is installed, the ORM falls back to an in-memory store (useful for testing).

### Supported Adapters

| Adapter | Type | Best for |
|---------|------|----------|
| `sysmara-orm` | Native | AI-agent workflows, zero-config CRUD |
| `prisma` | Third-party | Teams already using Prisma |
| `drizzle` | Third-party | Edge/serverless, TypeScript-first |
| `typeorm` | Third-party | NestJS/Java-style projects |

### CLI

```bash
sysmara db generate    # generate schema from entity specs
sysmara db migrate     # create migration file
sysmara db status      # show migration status
```

## SysMARA ORM

SysMARA ORM is an AI-native ORM built from the ground up for agent workflows — not adapted from human tooling.

### Core principles

**Schema IS the System Graph.** The ORM has no separate schema file. It reads `system-graph.json` directly. There is one source of truth.

**Every query is a capability.** There are no arbitrary queries. Every database operation maps to a declared capability in your specs. AI agents cannot make unauthorized queries.

**Invariants are database constraints.** Invariants declared in `invariants.yaml` are enforced at the database level — not just in runtime validation. The ORM knows your constraints because it reads the spec.

**Machine-readable operation log.** Every query is logged as structured JSON:

```json
{
  "capability": "create_user",
  "entity": "user",
  "operation": "insert",
  "invariants_checked": ["email_must_be_unique"],
  "affected_fields": ["email", "role"],
  "duration_ms": 12,
  "affected_rows": 1,
  "sql_template": "INSERT INTO users (email, role) VALUES ($1, $2)"
}
```

AI agents can read this log to understand what the system is doing — not guess from opaque ORM internals.

**Impact-aware migrations.** Before applying a migration, the engine runs impact analysis and shows which capabilities and invariants are affected:

```bash
sysmara db migrate
# → Impact analysis: changing users.role affects:
#     capability: create_user (input validation)
#     policy: user_creation_policy (role check)
#     invariant: role_must_be_valid
#   Risk: medium
# Proceed? [y/N]
```

### Usage

```typescript
import { SysmaraORM } from "@sysmara/core";

const orm = new SysmaraORM(dbConfig, specs);
await orm.connect();        // connects to the database
await orm.applySchema();    // creates tables (IF NOT EXISTS)

// Execute a declared capability
const user = await orm.capability("create_user", { email: "alice@example.com", role: "admin" });

// Typed repository
const repo = orm.repository("user");
const found = await repo.findOne({ email: "alice@example.com" });
const users = await repo.findMany({ role: "admin" });
await repo.update(found.id, { role: "member" });
await repo.delete(found.id);

// Read operation log
const log = orm.getOperationLog();

await orm.disconnect();     // close connection
```

## Project Structure

```
my-app/
  sysmara.config.yaml          # Project configuration
  system/                    # System specs (YAML)
    entities.yaml
    capabilities.yaml
    policies.yaml
    invariants.yaml
    modules.yaml
    flows.yaml
    safe-edit-zones.yaml
    glossary.yaml
  app/                       # Application code
    entities/                # Entity type definitions
    capabilities/            # Capability implementations
    policies/                # Policy enforcement logic
    invariants/              # Invariant check implementations
    modules/                 # Module bootstrap and wiring
    flows/                   # Flow orchestration
    routes/                  # HTTP route definitions
    services/                # Business logic services
    adapters/                # External system adapters
    generated/               # Framework-generated code (do not edit)
    protected/               # Protected framework internals
    tests/                   # Test files
  .framework/                # Generated framework artifacts
    system-graph.json
    system-map.json
```

### Application Directory (`app/`)

| Directory | Purpose |
|-----------|---------|
| `entities/` | TypeScript type definitions for domain entities |
| `capabilities/` | Implementation files for each capability |
| `policies/` | Policy enforcement functions |
| `invariants/` | Invariant check implementations |
| `modules/` | Module initialization and dependency wiring |
| `flows/` | Multi-step flow orchestration logic |
| `routes/` | HTTP route handler definitions |
| `services/` | Shared business logic services |
| `adapters/` | Adapters for databases, APIs, and external systems |
| `generated/` | Auto-generated code from the capability compiler |
| `protected/` | Framework-managed files with protected regions |
| `tests/` | Test files for capabilities, policies, and invariants |

### System Specs (`system/`)

| File | Purpose |
|------|---------|
| `entities.yaml` | Entity definitions with typed fields and constraints |
| `capabilities.yaml` | Capability contracts (inputs, outputs, policies, invariants) |
| `policies.yaml` | Access control policies with conditions and effects |
| `invariants.yaml` | Data integrity constraints (uniqueness, format, range) |
| `modules.yaml` | Module boundaries, exports, and dependencies |
| `flows.yaml` | Multi-step business workflows |
| `safe-edit-zones.yaml` | File ownership and protected region declarations |
| `glossary.yaml` | Domain term definitions for AI context |

### Framework Output (`.framework/`)

| File | Purpose |
|------|---------|
| `system-graph.json` | Full system graph with nodes and typed edges |
| `system-map.json` | AI-facing index of modules, capabilities, and entities |

## Spec Format

### Entity

```yaml
entities:
  - name: user
    description: A registered user in the system
    module: users
    fields:
      - name: email
        type: string
        required: true
        constraints:
          format: email
      - name: role
        type: string
        required: true
        constraints:
          enum: [admin, member, guest]
```

### Capability

```yaml
capabilities:
  - name: create_user
    description: Creates a new user account
    module: users
    type: command
    entity: user
    input_fields:
      - name: email
        type: string
        required: true
    output_entity: user
    policies:
      - user_creation_policy
    invariants:
      - email_must_be_unique
    steps:
      - Validate input
      - Create user record
```

### Policy

```yaml
policies:
  - name: user_creation_policy
    description: Only admins can create users
    module: users
    capabilities:
      - create_user
    conditions:
      - field: actor.role
        operator: in
        value: [admin]
    effect: allow
```

### Invariant

```yaml
invariants:
  - name: email_must_be_unique
    description: Email addresses must be unique
    module: users
    entity: user
    field: email
    type: unique
    severity: error
    message: A user with this email already exists
```

## v0.8.0 Status

### Production-Ready

- Spec parsing and validation with Zod schemas
- Cross-reference validation engine
- System graph generation (nodes + typed edges)
- System map generation (AI-facing module index)
- Diagnostics engine with 20+ validation checks
- Capability compiler with route handler and test scaffold generation
- **Scaffold generator** — starter entity/capability/policy/invariant/service files from specs (with proper status-transition and association logic)
- Module boundary enforcement
- Invariant resolution engine
- Safe edit zone validation
- HTTP runtime with typed handlers and **header-based actor extraction** (`X-Actor-Id`, `X-Actor-Roles`)
- Change Plan Protocol with risk classification and impact analysis
- CLI commands: init, add, build, graph, compile, scaffold, start, doctor, explain, impact, plan, check boundaries, db, flow
- **`sysmara start`** — auto-wires all capabilities to HTTP routes, connects to DB, applies schema, starts server
- **Real database drivers** — PostgreSQL (`pg`), MySQL (`mysql2`), SQLite (`better-sqlite3`), in-memory fallback
- **Server entry point generation** — `sysmara build` generates `app/server.ts` with all routes wired
- **Proper error mapping** — policy violations return 403, not found returns 404, validation returns 400
- Database adapter interface and registry
- Prisma adapter (schema + repository generation)
- Drizzle adapter (TypeScript-first schema)
- TypeORM adapter (@Entity classes)
- SysMARA ORM (AI-first ORM with real DB execution, capability-based queries, operation log, migration engine)
- Flow Execution Engine (saga compensation, retry with backoff, condition evaluation, AI-readable execution log)

### Experimental

- Impact analysis (graph traversal for change surface computation)
- Generated artifact management

### Planned for Later

- Full codegen pipeline (API clients, migration scripts)
- Multi-agent coordination (lock-free concurrent spec editing)
- Plugin system (custom diagnostics, compilers, and validators)
- API client generation (TypeScript, Python, Go)

## Installation

```bash
npm install @sysmara/core
```

Requires Node.js 20 or later.

## CLI

```bash
# Initialize a new project with example specs
sysmara init

# Add a spec (entity, capability, policy, invariant, module, flow)
sysmara add <type> <name>

# Parse, validate, build graph, compile, and diagnose
sysmara build

# Build system-graph.json and system-map.json
sysmara graph

# Run diagnostics and output report
sysmara diagnose

# Run the capability compiler
sysmara compile

# Comprehensive system health check
sysmara doctor

# Check module boundary violations
sysmara check boundaries

# Explain a capability, invariant, or module
sysmara explain <type> <name>

# Analyze impact of a capability or entity
sysmara impact <type> <name>

# Create and display change plans
sysmara plan create <title>
sysmara plan show <file>

# Database commands
sysmara db generate    # generate schema from entity specs
sysmara db migrate     # create migration file
sysmara db status      # show migration status

# Generate starter app/ implementation files from specs (skip existing)
sysmara scaffold

# Start the server with auto-wired routes
sysmara start
sysmara start --port 8080 --host 127.0.0.1
sysmara start --no-schema   # skip DB schema creation

# Flow execution
sysmara flow list                        # list all flows with step counts
sysmara flow validate <name>             # validate a flow
sysmara flow run <name> --input <json>   # execute a flow
sysmara flow log                         # show execution log summary

# Show help
sysmara help
```

## API

```typescript
import {
  parseSpecDirectory,
  crossValidate,
  buildSystemGraph,
  buildSystemMap,
  compileCapabilities,
  runDiagnostics,
  formatDiagnosticsTerminal,
  analyzeImpact,
  resolveConfig,
  // Change Plan Protocol
  generateChangePlan,
  createEmptyPlan,
  renderChangePlanTerminal,
  // Flow Execution Engine
  FlowExecutor,
  FlowExecutionLog,
  evaluateCondition,
  // Scaffold
  scaffoldSpecs,
  // Database
  SysmaraORM,
  SysmaraRepository,
  MigrationEngine,
  registerAdapter,
  getAdapter,
  listAdapters,
} from '@sysmara/core';

// Load and parse specs
const config = resolveConfig();
const specs = await parseSpecDirectory(config.specDir);

// Validate
const errors = crossValidate(specs);

// Build the system graph
const graph = buildSystemGraph(specs);
const map = buildSystemMap(specs);

// Compile capabilities
const output = compileCapabilities(specs);

// Scaffold starter implementation files
const scaffold = scaffoldSpecs(specs);
// scaffold.files → entities/*.ts, capabilities/*.ts, policies/*.ts, etc.

// Run diagnostics
const report = runDiagnostics(specs);
console.log(formatDiagnosticsTerminal(report));

// Analyze impact
const impact = analyzeImpact(graph, 'entity:user');

// Database — SysMARA ORM
const orm = new SysmaraORM(dbConfig, specs);
await orm.connect();
await orm.applySchema();
const repo = orm.repository('user');
const user = await repo.findOne({ email: 'alice@example.com' });
await orm.disconnect();
```

### Runtime Server

```typescript
import { SysmaraServer, Router } from '@sysmara/core';

const router = new Router();
router.get('/health', async () => ({ status: 'ok' }));

const server = new SysmaraServer({ port: 3000 });
server.use(router);
await server.start();
```

## License

MIT
