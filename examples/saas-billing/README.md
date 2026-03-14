# SaaS Billing Example

A realistic, production-grade SaaS billing backend specification built with the SysMARA framework. This example demonstrates how SysMARA's spec-driven architecture handles multi-tenant billing with workspaces, subscriptions, invoices, and role-based access control.

This is not a toy example. It models the billing infrastructure that real SaaS platforms like Slack, Notion, and Linear use: workspace-scoped subscriptions, plan upgrades/downgrades, invoice lifecycle management, and ownership transfers -- all governed by invariants and policies that an AI agent can reason about safely.

## Architecture

```
+------------------+       +---------------------+       +------------------+
|     users        |       |    workspaces        |       |     billing      |
|                  |       |                      |       |                  |
|  - user          |<------+  - workspace         |<------+  - subscription  |
|                  |       |                      |       |  - invoice       |
|  create_user     |       |  create_workspace    |       |                  |
|  get_user        |       |  get_workspace       |       |  create_sub      |
|                  |       |  transfer_owner      |       |  cancel_sub      |
|                  |       |  list_members         |       |  upgrade_sub     |
|                  |       |  add_member           |       |  downgrade_sub   |
|                  |       |                      |       |  generate_invoice|
|                  |       |                      |       |  void_invoice    |
|                  |       |                      |       |  get_invoice     |
+------------------+       +---------------------+       +------------------+
         ^                           ^
         |                           |
         +------ dependencies -------+
```

Modules have explicit dependency declarations. `billing` depends on both `users` and `workspaces`. `workspaces` depends on `users`. This dependency graph determines build order, impact analysis scope, and what an AI agent needs to understand when making changes.

## Capabilities

| Capability | Module | Description | Key Invariants |
|---|---|---|---|
| `create_user` | users | Register a new user account | `email_must_be_unique` |
| `get_user` | users | Retrieve a user by ID | -- |
| `create_workspace` | workspaces | Create a new workspace | `workspace_must_have_owner`, `workspace_name_not_empty` |
| `get_workspace` | workspaces | Retrieve a workspace by ID | -- |
| `transfer_workspace_owner` | workspaces | Transfer workspace ownership | `workspace_must_have_owner` |
| `list_workspace_members` | workspaces | List workspace members | -- |
| `add_workspace_member` | workspaces | Add a user to a workspace | `workspace_must_have_owner` |
| `create_subscription` | billing | Create a subscription for a workspace | `subscription_must_have_workspace`, `no_duplicate_active_subscription` |
| `cancel_subscription` | billing | Cancel an active subscription | `subscription_must_have_workspace` |
| `upgrade_subscription` | billing | Upgrade to a higher-tier plan | `no_duplicate_active_subscription` |
| `downgrade_subscription` | billing | Downgrade to a lower-tier plan | `cannot_downgrade_with_unpaid_invoices` |
| `generate_invoice` | billing | Generate an invoice for a billing period | `invoice_amount_must_be_positive`, `invoice_must_have_subscription` |
| `void_invoice` | billing | Void an existing invoice | `invoice_must_have_subscription` |
| `get_invoice` | billing | Retrieve an invoice by ID | -- |

## Modules

| Module | Entities | Capabilities | Dependencies |
|---|---|---|---|
| `users` | user | create_user, get_user | -- |
| `workspaces` | workspace | create_workspace, get_workspace, transfer_workspace_owner, list_workspace_members, add_workspace_member | users |
| `billing` | subscription, invoice | create_subscription, cancel_subscription, upgrade_subscription, downgrade_subscription, generate_invoice, void_invoice, get_invoice | users, workspaces |

## Key Invariants

**`email_must_be_unique`** -- Prevents duplicate user registrations. Enforced globally across all user records. Any capability that creates or modifies a user email must satisfy this constraint.

**`no_duplicate_active_subscription`** -- Ensures a workspace cannot have two active (or trialing) subscriptions simultaneously. This invariant is scoped per workspace and checks the `status` field. It prevents billing errors from concurrent subscription creation.

**`cannot_downgrade_with_unpaid_invoices`** -- Blocks plan downgrades when the workspace has open or past-due invoices. This protects revenue by ensuring outstanding payments are resolved before reducing a subscription tier.

**`invoice_amount_must_be_positive`** -- Validates that every invoice has a positive amount. Prevents generation of zero-value or negative invoices that would corrupt financial records.

**`workspace_must_have_owner`** -- Referential integrity constraint ensuring every workspace points to a valid user. Prevents orphaned workspaces and ensures there is always an accountable owner for billing.

## Policies

| Policy | Effect | Description |
|---|---|---|
| `admin_full_access` | allow | System admins bypass all restrictions (priority 100) |
| `billing_admin_manage_subscriptions` | allow | Billing admins can manage subscriptions and invoices globally (priority 90) |
| `owner_can_transfer_workspace` | allow | Only workspace owners can transfer ownership (priority 85) |
| `workspace_owner_manage` | allow | Owners manage their own workspace and billing (priority 80) |
| `member_read_only` | allow | Members can only read workspace data (priority 50) |

Policies are evaluated by priority. A user with the `admin` role matches `admin_full_access` (priority 100) and is granted access before any lower-priority policy is checked.

## Flows

**Workspace Onboarding** -- Triggered after `create_workspace` succeeds. Automatically provisions a free subscription and sends a welcome notification. If subscription creation fails, the workspace creation is rolled back.

**Billing Cycle** -- Scheduled at the end of each billing period. Generates an invoice, emails it to the workspace owner, and initiates payment processing. Invoice generation retries up to 3 times on failure. Failed payments mark the subscription as past_due.

**Ownership Transfer** -- Triggered when `transfer_workspace_owner` is invoked. Validates the new owner exists and is a workspace member, performs the transfer, and notifies both the previous and new owner.

## Running the Example

```bash
cd examples/saas-billing
npx sysmara build
```

This will:
1. Parse all specs in `system/`
2. Validate entity references, invariant consistency, and policy coverage
3. Generate route handlers, type definitions, and test scaffolds in `app/generated/`
4. Report any spec violations or orphaned references

## Extending the System

To add a new capability:

1. Define it in `system/capabilities.yaml` with input/output fields, policies, and invariants
2. Add any new invariants to `system/invariants.yaml`
3. Update the relevant module in `system/modules.yaml`
4. Run `npx sysmara build` to regenerate artifacts
5. Implement the capability logic in `app/capabilities/`

To add a new entity:

1. Define it in `system/entities.yaml` with fields and invariants
2. Assign it to a module in `system/modules.yaml`
3. Create capabilities that operate on the entity
4. Run `npx sysmara build`

## Safe Edit Zones

The framework enforces edit zones to prevent accidental modification of generated or protected code:

| Path | Zone | Description |
|---|---|---|
| `app/generated/**` | `generated` | Compiler output -- overwritten on each build. Never edit these files. |
| `app/capabilities/**` | `editable` | Your capability implementations. Safe to edit freely. |
| `app/protected/**` | `protected` | Billing infrastructure. Requires explicit authorization to modify. |
| `system/**` | `editable` | System specifications. Owned by the architect role. |

AI agents are configured to respect these zones. An agent can freely modify files in `editable` zones, will never touch `generated` zones, and will request human approval before modifying `protected` zones.

## Impact Analysis

When you run impact analysis on a capability, SysMARA traces all dependencies to show what would be affected by a change.

Example output for `sysmara impact capability transfer_workspace_owner`:

```
Impact Analysis: transfer_workspace_owner
==========================================

Direct Impact:
  Entity: workspace (owner_id field modified)
  Entity: user (referenced for validation)

Invariants Checked:
  - workspace_must_have_owner (ENFORCED)

Policies Evaluated:
  - owner_can_transfer_workspace (priority 85)
  - admin_full_access (priority 100)

Flow Triggered:
  - ownership_transfer
    Step 1: validate_new_owner (validation)
    Step 2: transfer_ownership (capability)
    Step 3: notify_previous_owner (side_effect)
    Step 4: notify_new_owner (side_effect)

Module Impact:
  - workspaces (direct -- contains the capability)
  - users (indirect -- new owner must be a valid user)
  - billing (indirect -- subscription ownership follows workspace)

Downstream Effects:
  - Subscription billing contact may change
  - Workspace member permissions unchanged
  - Existing invoices unaffected

Risk: LOW
  - No billing invariants affected
  - No data migration required
  - Rollback: re-transfer ownership back to original owner
```

## Change Plans

The `system/change-plans/` directory contains structured plans for system evolution. Each plan documents proposed changes with full traceability:

- What capabilities, entities, and policies are added or modified
- Which invariants are affected and how
- Migration steps and rollout strategy
- Open questions requiring human judgment
- Which generated artifacts need to be refreshed

See `system/change-plans/add-team-billing.yaml` for an example that proposes adding team billing with shared subscriptions. The plan identifies that the `no_duplicate_active_subscription` invariant must be updated to accommodate team subscriptions alongside personal ones -- a decision that requires human review.

## What AI Agents Can Safely Change

Based on the spec, an AI agent operating on this codebase can:

- **Implement capabilities** in `app/capabilities/` -- the spec defines inputs, outputs, and invariants, so the agent knows exactly what the function must do and what constraints it must satisfy.
- **Add new capabilities** by updating `system/capabilities.yaml` and regenerating. The framework validates that all referenced entities, invariants, and policies exist.
- **Modify flows** by updating `system/flows.yaml`. The framework validates step references and input mappings.
- **Generate change plans** to propose structural changes. These plans are always marked as draft and require human review.

An AI agent cannot:

- Modify `app/generated/` -- these files are overwritten on build.
- Modify `app/protected/` without explicit authorization.
- Remove invariants that are referenced by capabilities (referential integrity is enforced).
- Create policies that escalate privileges beyond what the spec allows.

## What Invariants Protect

Invariants serve as the system's safety net. They are enforced at build time (spec validation) and at runtime (capability execution). Key protections:

- **Financial accuracy**: `invoice_amount_must_be_positive` prevents zero or negative invoices from entering the system.
- **Billing consistency**: `no_duplicate_active_subscription` prevents double-billing a workspace.
- **Revenue protection**: `cannot_downgrade_with_unpaid_invoices` ensures payment before plan reduction.
- **Data integrity**: `workspace_must_have_owner` and `invoice_must_have_subscription` enforce referential integrity across entities.
- **Uniqueness**: `email_must_be_unique` prevents duplicate accounts.

These invariants cannot be bypassed by AI agents. Even an admin-level agent must satisfy all invariants before a capability execution succeeds. This makes the billing system safe for automated operations.
