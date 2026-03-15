# SaaS Task Manager -- SysMARA Example

This example demonstrates how a single human prompt produces a complete SysMARA project specification.

## Original Prompt

> Build a SaaS task manager with workspaces, tasks, and user roles

That single sentence was expanded into a full system specification containing entities, capabilities, policies, invariants, modules, and flows.

## Project Structure

```
saas-task-manager/
  PROMPT.md                  # The original one-line prompt
  sysmara.config.yaml        # Project configuration
  README.md                  # This file
  system/
    entities.yaml            # 5 entities: user, workspace, task, workspace_member, comment
    capabilities.yaml        # 15 capabilities across 3 modules
    policies.yaml            # 5 access-control policies
    invariants.yaml          # 6 data integrity invariants
    modules.yaml             # 3 modules: auth, workspaces, tasks
    flows.yaml               # 2 multi-step flows: task_lifecycle, workspace_onboarding
```

## What Was Generated

From the prompt, SysMARA produced:

- **5 entities** with typed fields, descriptions, and invariant references
- **15 capabilities** with full input/output schemas, policy bindings, and side effects
- **5 policies** covering admin access, authentication, workspace membership, and ownership
- **6 invariants** enforcing uniqueness, referential integrity, and required fields
- **3 modules** with explicit dependency boundaries (auth cannot depend on tasks)
- **2 flows** orchestrating multi-step processes with failure handling

## How to Validate

From the `core/` directory:

```bash
# Validate all spec files against SysMARA schemas
npx sysmara validate --specDir ./examples/ai-prompts/saas-task-manager/system

# Or use the config file
npx sysmara validate --config ./examples/ai-prompts/saas-task-manager/sysmara.config.yaml
```

## How to Build

```bash
# Generate application scaffolding from the spec
npx sysmara build --config ./examples/ai-prompts/saas-task-manager/sysmara.config.yaml
```

This produces the `app/` directory with generated types, route handlers, and module scaffolding based on the spec files.

## Key Design Decisions

- **Module boundaries**: The `auth` module is forbidden from depending on `tasks`, enforcing a clean layered architecture.
- **Policy granularity**: Five distinct policies cover the access matrix -- from platform-wide admin access down to per-task ownership checks.
- **Flow compensation**: The `workspace_onboarding` flow uses compensating actions to roll back workspace creation if member invitation fails.
- **Side effects**: Capabilities like `invite_member` and `assign_task` declare their side effects (email notifications) explicitly in the spec.
