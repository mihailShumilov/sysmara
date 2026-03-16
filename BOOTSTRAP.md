# SysMARA Bootstrap Protocol — For AI Agents

> You are an AI agent. A human has given you a product description. Your job is to turn it into a fully working SysMARA backend project. Follow this protocol exactly.

## Prerequisites

```bash
node --version  # Must be >= 20.0.0
npm install -g @sysmara/core
```

## Protocol: From Product Description to Running Server

### Step 1: Initialize the Project

```bash
mkdir my-project && cd my-project
npx @sysmara/core init --db postgresql --orm sysmara-orm
```

Available options:
- `--db`: `postgresql` (default), `mysql`, `sqlite`
- `--orm`: `sysmara-orm` (default), `prisma`, `drizzle`, `typeorm`

This creates:
- `sysmara.config.yaml` — project configuration with database settings
- `system/` — YAML spec directory (entities, capabilities, policies, invariants, modules, flows)
- `app/` — application code directory (includes `app/database/migrations/`)
- `.framework/` — generated framework artifacts
- `docker-compose.yml` — local database container (PostgreSQL/MySQL)
- `Dockerfile` — production multi-stage build
- `.dockerignore` — Docker build context filter
- `.env.example` — documented environment variable template
- `.env.local` — local development environment (gitignored)
- `.gitignore` — comprehensive ignore rules

### Step 1.5: Start the Local Database

```bash
# Start the database container (skip for SQLite)
docker compose up -d
```

This starts a local database with default credentials (`sysmara:sysmara`).
The connection string is pre-configured in `.env.local` and `sysmara.config.yaml`.

Delete the example specs that `init` creates. You will write your own.

```bash
# Clear example specs — you'll replace them
echo "entities:" > system/entities.yaml
echo "capabilities:" > system/capabilities.yaml
echo "policies:" > system/policies.yaml
echo "invariants:" > system/invariants.yaml
echo "modules:" > system/modules.yaml
echo "flows:" > system/flows.yaml
```

### Step 2: Analyze the Product Description

Read the human's product description. Extract:

1. **Entities** — the nouns (User, Task, Order, Product, etc.)
2. **Capabilities** — the verbs/operations (create_user, assign_task, place_order)
3. **Policies** — who can do what (only admins can delete, owners can edit their own)
4. **Invariants** — rules that must always hold (email must be unique, stock cannot be negative)
5. **Modules** — logical groupings of related entities and capabilities
6. **Flows** — multi-step workflows (checkout flow, onboarding flow)

### Step 3: Write Entity Specs

File: `system/entities.yaml`

```yaml
entities:
  - name: <snake_case_singular>
    description: <one sentence>
    module: <module_name>
    fields:
      - name: id
        type: string
        required: true
        description: Unique identifier
      - name: <field_name>
        type: <string|number|boolean|date|datetime|integer|float|decimal|uuid|enum|text|json>
        required: <true|false>
        description: <what this field represents>
        constraints:  # optional
          - type: <min|max|minLength|maxLength|pattern|enum|unique>
            value: <constraint_value>
            message: <optional error message>
    invariants:  # optional — list invariant names that apply
      - <invariant_name>
```

**Decision rules for entities:**
- Always include an `id` field (type: string, required: true)
- Always include `created_at` (type: datetime, required: true)
- Include `updated_at` if the entity is mutable
- Use snake_case for all names
- Use singular nouns (user, not users)
- Every entity must belong to exactly one module
- Add foreign key fields explicitly (e.g., `workspace_id` on a task entity)

### Step 4: Write Capability Specs

File: `system/capabilities.yaml`

```yaml
capabilities:
  - name: <verb_noun>
    description: <what this capability does>
    module: <module_name>
    entities:
      - <entity_name>
    input:
      - name: <field_name>
        type: <string|number|boolean|date|object|json>
        required: <true|false>
        description: <what this input is>
    output:
      - name: <field_name>
        type: <string|number|boolean|reference>
        required: <true|false>
        description: <what this output is>
    policies:
      - <policy_name>  # can be empty []
    invariants:
      - <invariant_name>  # can be empty []
    sideEffects:  # optional
      - <human-readable side effect>
    idempotent: <true|false>  # optional
```

**Decision rules for capabilities:**
- Name format: `verb_noun` (create_user, get_task, delete_order)
- Standard CRUD verbs: create, get, list, update, delete
- Domain verbs: assign, complete, approve, reject, cancel, archive, publish
- Every capability must reference at least one entity
- Every capability must belong to exactly one module
- `policies` and `invariants` arrays are required (use `[]` if none apply)
- Input fields are what the caller provides
- Output fields are what the capability returns

**Standard capability patterns:**

For each entity, you typically need:
```
create_<entity>  — POST, creates a new record
get_<entity>     — GET by ID, reads a single record
list_<entities>  — GET, reads multiple records with optional filters
update_<entity>  — PUT/PATCH, modifies an existing record
delete_<entity>  — DELETE, removes a record
```

Plus domain-specific capabilities:
```
assign_task      — assigns a task to a user
complete_task    — marks a task as done
process_payment  — runs payment for an order
```

### Step 5: Write Policy Specs

File: `system/policies.yaml`

```yaml
policies:
  - name: <descriptive_policy_name>
    description: <what this policy enforces>
    actor: <actor_type>
    capabilities:
      - <capability_name>
    conditions:
      - field: <actor.role|actor.id|resource.owner_id>
        operator: <eq|neq|in|not_in|exists|is_owner|has_role>
        value: <string_or_string_array>
    effect: <allow|deny>
```

**Decision rules for policies:**
- `actor` is the role or identity type (authenticated_user, admin, workspace_member)
- `effect: allow` — grants access when conditions match
- `effect: deny` — blocks access when conditions match
- Use `is_owner` operator for ownership checks
- Use `has_role` or `in` operator for role-based access
- Group capabilities that share the same access rules under one policy

### Step 6: Write Invariant Specs

File: `system/invariants.yaml`

```yaml
invariants:
  - name: <descriptive_invariant_name>
    description: <what rule must always hold>
    entity: <entity_name>
    rule: <human-readable rule statement>
    severity: <error|warning>
    enforcement: <runtime|compile|both>
```

**Decision rules for invariants:**
- Uniqueness constraints: `email_must_be_unique`, `slug_must_be_unique`
- Required field constraints: `title_must_not_be_empty`
- Business rules: `stock_must_be_positive`, `order_total_must_match_items`
- Referential rules: `task_assignee_must_be_workspace_member`
- `severity: error` — violations block the operation
- `severity: warning` — violations are logged but allowed
- `enforcement: runtime` — checked at execution time
- `enforcement: compile` — checked at build time
- `enforcement: both` — checked at both

### Step 7: Write Module Specs

File: `system/modules.yaml`

```yaml
modules:
  - name: <module_name>
    description: <module responsibility>
    entities:
      - <entity_name>
    capabilities:
      - <capability_name>
    allowedDependencies:
      - <other_module_name>  # can be empty []
    forbiddenDependencies:
      - <other_module_name>  # can be empty []
    owner: <team_or_person>  # optional
```

**Decision rules for modules:**
- Group by domain (auth, billing, tasks, users, workspaces)
- Every entity must appear in exactly one module's `entities` list
- Every capability must appear in exactly one module's `capabilities` list
- `allowedDependencies` lists modules this module may call
- `forbiddenDependencies` lists modules this module must never call
- No circular dependencies between modules
- A module's entity list must match what's declared in `entities.yaml` for those entities

### Step 8: Write Flow Specs (Optional)

File: `system/flows.yaml`

```yaml
flows:
  - name: <flow_name>
    description: <what this workflow does>
    trigger: <capability_name>
    module: <module_name>
    steps:
      - name: <step_name>
        action: <capability_name>
        onFailure: <abort|skip|retry|compensate>
        compensation: <capability_name>  # required if onFailure is compensate
        condition: '<expression>'  # optional, e.g. 'context.input.role === "admin"'
```

**Decision rules for flows:**
- Flows model multi-step business processes
- `trigger` must be a declared capability name
- Each step's `action` should be a declared capability
- `onFailure` strategies:
  - `abort` — stop the flow immediately
  - `skip` — continue to the next step
  - `retry` — retry with exponential backoff (up to 3 times)
  - `compensate` — run compensation for this and all previous steps in reverse
- Conditions use the expression format: `context.input.<field>`, `context.stepOutputs.<step>.<field>`

### Step 9: Validate

```bash
sysmara validate
```

This parses all YAML specs, validates with Zod schemas, and checks cross-references. Fix all errors before proceeding. Common errors:

| Error Code | Meaning | Fix |
|-----------|---------|-----|
| AX101-AX106 | Duplicate name | Rename the duplicate |
| AX201-AX209 | Unresolved reference | Check that referenced entity/capability/policy/invariant/module exists |
| AX301-AX304 | Boundary violation | Fix module dependencies or move capability to correct module |
| AX401-AX404 | Orphan | Add the entity/capability to a module |

### Step 10: Build

```bash
sysmara build
```

This runs the full pipeline:
1. Parse + validate all specs
2. Cross-validate references
3. Build system graph (`system-graph.json`) and system map (`system-map.json`)
4. Compile capabilities → generate route handlers, test scaffolds, metadata in `app/generated/`
5. Scaffold starter implementation files in `app/` (entities, capabilities, policies, invariants, services)
6. Generate database schema in `app/database/` (if database is configured in `sysmara.config.yaml`)
7. Run diagnostics

The database schema is auto-generated from your entity specs — no separate `sysmara db generate` call needed during bootstrap.

### Step 11: Implement Capability Logic

The compiler generates stubs in `app/generated/routes/<name>.ts`. These throw "Not implemented". You need to implement the actual business logic.

Create files in `app/capabilities/` for each capability:

```typescript
// app/capabilities/create_user.ts
import type { HandlerContext } from '@sysmara/core';

export async function handle(ctx: HandlerContext) {
  const { email, name, role } = ctx.body as { email: string; name: string; role?: string };

  // Your business logic here
  const user = {
    id: crypto.randomUUID(),
    email,
    name,
    role: role ?? 'member',
    created_at: new Date().toISOString(),
  };

  // In production: save to database via SysmaraORM
  // const orm = new SysmaraORM(config, specs);
  // const user = await orm.capability('create_user', { email, name, role });

  return { user };
}
```

### Step 12: Write Tests

Generated test scaffolds are in `app/generated/tests/<name>.test.ts`. Extend them in `app/tests/`:

```typescript
// app/tests/create_user.test.ts
import { describe, it, expect } from 'vitest';

describe('create_user', () => {
  it('should create a user with valid input', async () => {
    // Test implementation
  });

  it('should reject duplicate emails', async () => {
    // Test invariant: email_must_be_unique
  });

  it('should enforce admin-only policy', async () => {
    // Test policy: admin_creation_policy
  });
});
```

Run tests:

```bash
npx vitest run
```

### Step 13: Start the Server

Create `server.ts` in your project root:

```typescript
import { SysmaraServer } from '@sysmara/core';

const server = new SysmaraServer({ port: 3000 });

// Register routes for each capability
server.post('/api/users', 'create_user', async (ctx) => {
  const { handle } = await import('./app/capabilities/create_user.js');
  return handle(ctx);
});

server.get('/api/users/:id', 'get_user', async (ctx) => {
  const { handle } = await import('./app/capabilities/get_user.js');
  return handle(ctx);
});

// ... register all capability routes

await server.start();
console.log('Server running on http://localhost:3000');
```

Start:

```bash
npx tsx server.ts
```

Verify:

```bash
curl http://localhost:3000/health
# → {"status":"ok","uptime":...}
```

## Validation Checklist

Before reporting completion, verify:

- [ ] `sysmara validate` passes with 0 errors
- [ ] `sysmara build` completes successfully
- [ ] Every entity has an `id` and `created_at` field
- [ ] Every entity belongs to exactly one module
- [ ] Every capability belongs to exactly one module
- [ ] Every capability's `entities` list only references entities in the same module or allowed dependencies
- [ ] Every policy references capabilities that exist
- [ ] Every invariant references an entity that exists
- [ ] No circular module dependencies
- [ ] Module `entities` and `capabilities` lists match what's declared in the spec files
- [ ] Flow triggers and step actions reference existing capabilities
- [ ] Database container starts (`docker compose up -d`) — skip for SQLite
- [ ] Database schema generated in `app/database/`
- [ ] Tests pass
- [ ] Server starts and `/health` returns 200

## Common Mistakes

1. **Using plural entity names** — Use `user` not `users`. Module names are plural (`users`), entity names are singular (`user`).

2. **Forgetting the `actor` field on policies** — Every policy needs an `actor` string.

3. **Empty arrays vs missing fields** — `policies: []` and `invariants: []` are required on capabilities even when empty. Do not omit them.

4. **Mismatched module references** — If an entity says `module: tasks` then it must appear in the `tasks` module's `entities` list in `modules.yaml`.

5. **Circular module dependencies** — Module A depends on B and B depends on A. Refactor to break the cycle.

6. **Missing constraint `type` field** — Constraints need `type`, `value`, and optionally `message`.

7. **Flow step actions that don't exist** — Every step `action` should reference a declared capability.

8. **Invariant without matching entity** — The `entity` field on an invariant must reference an existing entity.

## Quick Reference: Field Types

Entity fields: `string`, `number`, `integer`, `float`, `decimal`, `boolean`, `date`, `datetime`, `timestamp`, `uuid`, `enum`, `text`, `json`, `boolean[]`, `string[]`, `number[]`

Capability input/output fields: `string`, `number`, `boolean`, `date`, `object`, `json`, `reference`

## Quick Reference: All CLI Commands

```bash
sysmara init [--db pg|mysql|sqlite] [--orm sysmara-orm|prisma|drizzle|typeorm]
                                     # Create project with DB, Docker, and env files
sysmara validate                      # Validate all specs
sysmara build                         # Full build pipeline
sysmara compile                       # Compile capabilities only
sysmara graph                         # Generate system graph + map
sysmara diagnose                      # Run diagnostics
sysmara doctor                        # Comprehensive health check
sysmara add <type> <name>             # Add a spec stub
sysmara explain <type> <name>         # Deep-dive explanation
sysmara impact <type> <name>          # Impact analysis
sysmara check boundaries              # Module boundary check
sysmara flow list                     # List all flows
sysmara flow validate <name>          # Validate a flow
sysmara flow run <name> --input <json> # Execute a flow
sysmara db generate                   # Generate DB schema
sysmara db migrate                    # Create migration
sysmara db status                     # Show DB status
```

## Example: Full Bootstrap from One Prompt

Human prompt: *"Build a task manager with workspaces, tasks, and user roles"*

The AI agent should:
1. Run `npx @sysmara/core init`
2. Create entities: `user`, `workspace`, `task`, `workspace_member`
3. Create capabilities: `create_user`, `get_user`, `create_workspace`, `get_workspace`, `list_workspaces`, `create_task`, `get_task`, `list_tasks`, `update_task`, `delete_task`, `assign_task`, `complete_task`, `invite_member`
4. Create policies: `workspace_member_policy`, `task_owner_policy`, `admin_full_access`
5. Create invariants: `email_must_be_unique`, `task_title_required`, `unique_workspace_slug`
6. Create modules: `auth`, `workspaces`, `tasks`
7. Create flows: `task_lifecycle` (create → assign → complete)
8. Run `sysmara validate` → fix any errors
9. Run `sysmara build` → verify success
10. Implement capability handlers
11. Wire up HTTP routes
12. Run tests
13. Start server
