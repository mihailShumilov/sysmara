# AI Agent Guide for SysMARA

## What is SysMARA?

SysMARA (Model / Architecture / Runtime Abstraction) is a backend framework where every architectural decision is expressed as machine-readable YAML. Instead of writing code first and documenting later, you declare the entire system — entities, capabilities, policies, invariants, module boundaries, and workflows — in YAML specs. Then the framework validates, compiles, and enforces those specs.

The key difference: SysMARA treats AI agents as the primary implementors. Humans define boundaries. AI implements within them.

## Why This Works

Traditional frameworks encode architecture implicitly — in folder conventions, inheritance hierarchies, middleware chains, and tribal knowledge. An AI agent reading an Express.js codebase has to reverse-engineer the architecture from scattered files, comments, and patterns. It can guess wrong. It can violate constraints it never knew existed.

SysMARA inverts this. The architecture is the input, not the output. An AI agent reads `system/entities.yaml` and knows every entity, every field, every constraint. It reads `system/modules.yaml` and knows exactly which modules can depend on which. It reads `system/policies.yaml` and knows who can do what. There is no guessing.

This works because:

1. **Machine-readable specs eliminate ambiguity.** YAML is not prose. `invariants: [email_must_be_unique]` is a testable statement, not a suggestion in a README.

2. **Cross-validation catches mistakes before runtime.** If a capability references a non-existent entity, `sysmara build` fails immediately. The AI agent doesn't need to deploy and test to find the error.

3. **Module boundaries prevent architectural drift.** The framework physically prevents module A from calling module B unless B is in A's `allowedDependencies`. An AI agent literally cannot violate the boundary.

4. **Impact analysis tells the AI what its change will break.** Before modifying an entity, `sysmara impact entity <name>` shows every capability, policy, invariant, flow, and test affected. The AI can make informed decisions.

5. **The capability compiler generates boilerplate.** Route handlers, test scaffolds, and metadata are generated from specs. The AI only writes business logic — the part that actually requires intelligence.

## The One-Prompt Workflow

A human writes one prompt. An AI agent turns it into a working SysMARA project.

```
Human: "Build a task manager with workspaces, tasks, and user roles"

AI Agent:
  1. Reads BOOTSTRAP.md
  2. Runs `npx @sysmara/core init`
  3. Analyzes the prompt → extracts entities, capabilities, policies
  4. Writes all YAML specs in system/
  5. Runs `sysmara build` → validates everything
  6. Implements capability handlers in app/capabilities/
  7. Wires HTTP routes
  8. Runs tests
  9. Starts server → API is live
```

The full protocol is documented in [BOOTSTRAP.md](../BOOTSTRAP.md) (for AI agents) and [one-prompt-workflow.md](./one-prompt-workflow.md) (step-by-step with prompts).

## Spec Types at a Glance

| Spec | File | Purpose |
|------|------|---------|
| Entities | `system/entities.yaml` | Domain objects with typed fields and constraints |
| Capabilities | `system/capabilities.yaml` | Operations with inputs, outputs, policies, invariants |
| Policies | `system/policies.yaml` | Access control — who can invoke which capabilities |
| Invariants | `system/invariants.yaml` | Business rules that must always hold true |
| Modules | `system/modules.yaml` | Logical groupings with dependency boundaries |
| Flows | `system/flows.yaml` | Multi-step workflows with failure handling |
| Safe Edit Zones | `system/safe-edit-zones.yaml` | File ownership and edit permissions |
| Glossary | `system/glossary.yaml` | Domain term definitions |

## How to Read a SysMARA Project

When you encounter a SysMARA project for the first time:

1. **Start with `sysmara.config.yaml`** — understand the project name, paths, and database config.

2. **Read `system/modules.yaml`** — this is the table of contents. It tells you what domains exist and how they relate.

3. **Read `system/entities.yaml`** — understand the data model. Every field, every type, every constraint.

4. **Read `system/capabilities.yaml`** — understand what operations exist. This is the API surface.

5. **Read `system/policies.yaml`** — understand the access control model.

6. **Read `system/invariants.yaml`** — understand the business rules.

7. **Read `system/flows.yaml`** — understand the multi-step workflows.

8. **Run `sysmara doctor`** — verify the project is healthy.

9. **Look at `.framework/system-map.json`** — the AI-facing index of the entire system.

## How to Modify a SysMARA Project

Follow the Change Protocol:

1. **Understand the impact first.** Run `sysmara impact <type> <name>` for anything you plan to change.

2. **Modify the specs.** Change the YAML files in `system/`.

3. **Validate.** Run `sysmara validate` to catch reference errors.

4. **Build.** Run `sysmara build` to regenerate everything.

5. **Update implementations.** Modify capability handlers if needed.

6. **Test.** Run tests to verify nothing broke.

Never modify `app/generated/` directly — it gets overwritten on build.

## Example Projects

Three complete example projects are available in `examples/ai-prompts/`:

- **[saas-task-manager](../examples/ai-prompts/saas-task-manager/)** — Task management with workspaces, roles, and assignment workflows
- **[ecommerce-api](../examples/ai-prompts/ecommerce-api/)** — E-commerce with products, orders, inventory, and checkout flow
- **[blog-platform](../examples/ai-prompts/blog-platform/)** — Blog with posts, authors, tags, and moderation workflows

Each example includes the original human prompt and all generated specs.
