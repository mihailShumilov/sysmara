# One-Prompt Workflow

This document shows the exact workflow from a single human prompt to a fully working SysMARA project — including the AI prompts to use at each step.

## Overview

```
Human prompt → AI reads BOOTSTRAP.md → YAML specs → sysmara build → capability logic → tests → running server
```

## Step-by-Step

### Step 1: Human Writes a Product Description

The human provides a natural language description. It can be as short as one sentence or as detailed as a product spec. Examples:

- *"Build a SaaS task manager with workspaces, tasks, and user roles"*
- *"Build an e-commerce API with products, orders, and inventory management"*
- *"Build a blog platform with posts, authors, tags, and moderation"*

### Step 2: AI Agent Reads BOOTSTRAP.md

Prompt to use with Claude Code, Codex, or any AI coding agent:

```
Read BOOTSTRAP.md in the project root. This contains the complete protocol
for bootstrapping a SysMARA project from a product description.
Follow it exactly.
```

### Step 3: AI Generates All YAML Specs

Prompt:

```
Read BOOTSTRAP.md. Based on this product description:

"[PASTE HUMAN'S PRODUCT DESCRIPTION HERE]"

Generate all SysMARA YAML specs in system/:
- system/entities.yaml — all domain entities with typed fields
- system/capabilities.yaml — all CRUD + domain operations
- system/policies.yaml — access control rules
- system/invariants.yaml — business rules
- system/modules.yaml — module boundaries and dependencies
- system/flows.yaml — multi-step workflows

Follow the spec format exactly as described in BOOTSTRAP.md.
Use snake_case for all names. Entities are singular nouns. Modules are plural.
Every entity needs id and created_at fields.
Every capability needs policies and invariants arrays (use [] if none).

Run `sysmara validate` to check for errors and fix any before finishing.
```

### Step 4: AI Validates and Builds

Prompt:

```
Run `sysmara build` to validate all specs and generate the system graph,
system map, route handlers, and test scaffolds.

If there are errors, read the diagnostic output, fix the YAML specs, and
rebuild. Repeat until `sysmara build` completes with 0 errors.
```

### Step 5: AI Compiles Route Handlers

This happens automatically as part of `sysmara build`. The compiler generates:
- `app/generated/routes/<capability>.ts` — TypeScript route handler stubs
- `app/generated/tests/<capability>.test.ts` — Vitest test scaffolds
- `app/generated/metadata/<capability>.json` — resolved capability metadata

### Step 6: AI Implements Capability Logic

Prompt:

```
Implement the business logic for each capability.
For each capability in system/capabilities.yaml, create a file at
app/capabilities/<capability_name>.ts that exports a handle function.

The handle function receives a HandlerContext with:
- ctx.params — URL parameters
- ctx.query — query string parameters
- ctx.body — request body
- ctx.actor — authenticated user info
- ctx.capability — capability name

Return the output matching the capability's output spec.
For now, use in-memory storage. Follow the patterns in BOOTSTRAP.md.
```

### Step 7: AI Writes and Runs Tests

Prompt:

```
Write tests for each capability in app/tests/.
Test scaffolds have been generated in app/generated/tests/.
Extend them with real test cases:
- Happy path for each capability
- Policy enforcement (unauthorized access should fail)
- Invariant enforcement (violating invariants should fail)

Run `npx vitest run` and fix any failures.
```

### Step 8: AI Starts the Server

Prompt:

```
Create server.ts in the project root.
Import SysmaraServer from @sysmara/core.
Register HTTP routes for each capability:
- create_* → POST
- get_* → GET with :id param
- list_* → GET
- update_* → PUT/PATCH with :id param
- delete_* → DELETE with :id param
- Domain capabilities → appropriate HTTP method

Start the server on port 3000.
Verify with: curl http://localhost:3000/health
```

## Complete One-Shot Prompt

If you want to do everything in a single prompt:

```
Read BOOTSTRAP.md. You are bootstrapping a new SysMARA project.

Product description:
"[PASTE DESCRIPTION HERE]"

Do the following in order:
1. Run `npx @sysmara/core init` to create the project
2. Analyze the product description and generate all YAML specs:
   - system/entities.yaml
   - system/capabilities.yaml
   - system/policies.yaml
   - system/invariants.yaml
   - system/modules.yaml
   - system/flows.yaml
3. Run `sysmara validate` — fix any errors
4. Run `sysmara build` — verify success
5. Implement capability handlers in app/capabilities/
6. Create server.ts with HTTP routes
7. Write tests in app/tests/
8. Run tests with `npx vitest run`
9. Start the server and verify /health responds

Follow BOOTSTRAP.md exactly. Use snake_case everywhere. Entities singular,
modules plural. Do not skip validation.
```

## Example: End-to-End with Task Manager

**Human prompt:**
> Build a SaaS task manager with workspaces, tasks, and user roles

**What the AI produces:**

```
my-task-manager/
├── sysmara.config.yaml
├── server.ts
├── system/
│   ├── entities.yaml        # user, workspace, task, workspace_member
│   ├── capabilities.yaml    # 13 capabilities (CRUD + domain)
│   ├── policies.yaml        # workspace_member_policy, task_owner_policy, admin_policy
│   ├── invariants.yaml      # email_unique, task_title_required, workspace_slug_unique
│   ├── modules.yaml         # auth, workspaces, tasks
│   └── flows.yaml           # task_lifecycle flow
├── app/
│   ├── capabilities/        # 13 capability handlers
│   ├── tests/               # test files
│   └── generated/           # compiler output (routes, tests, metadata)
└── .framework/
    ├── system-graph.json
    └── system-map.json
```

**Verification:**

```bash
sysmara validate    # 0 errors
sysmara build       # Success
npx vitest run      # All tests pass
npx tsx server.ts   # Server running on :3000
curl localhost:3000/health  # {"status":"ok"}
```

See the full example at [examples/ai-prompts/saas-task-manager/](../examples/ai-prompts/saas-task-manager/).
