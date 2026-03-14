# Admin Approvals System

An internal administration and approvals system built on the SysMARA framework. This example demonstrates how to model a production-grade approval workflow with role-based access control, multi-step reviews, immutable audit logging, and AI-safe edit zones.

## Why This Example Exists

This is not a toy. It exists to demonstrate several critical SysMARA patterns working together in a realistic internal tool:

- **Human-review-only zones** -- audit infrastructure that AI agents cannot modify without security team sign-off
- **Multi-step approval workflows** -- sequential review chains with escalation
- **Policy layering** -- eight policies at different priority levels combining to produce nuanced access control
- **Invariant enforcement** -- hard rules that cannot be bypassed regardless of role
- **Immutable audit trails** -- append-only logging enforced at the framework level

## Architecture Summary

The system is organized into four modules that build on each other:

```
  +------------+
  |  identity  |  Users, roles, departments
  +------+-----+
         |
  +------v-----+     +--------+
  |  approvals  |     |  audit |  Immutable action log
  +------+-----+     +----+---+
         |                |
  +------v----------------v---+
  |        resources           |  Protected data, configs, deployments
  +----------------------------+
```

### Module Responsibilities

| Module      | Entities                          | Core Responsibility                          |
|-------------|-----------------------------------|----------------------------------------------|
| `identity`  | `user`                            | User lifecycle, roles, department assignment  |
| `approvals` | `approval_request`, `approval_step` | Request creation, review workflow, escalation |
| `audit`     | `audit_log`                       | Immutable recording of all system actions     |
| `resources` | `protected_resource`              | Gated access to sensitive systems and data    |

## Capabilities

| Capability                 | Module      | Description                                              |
|----------------------------|-------------|----------------------------------------------------------|
| `create_user`              | identity    | Register a new user with default member role             |
| `update_user_role`         | identity    | Change a user's role (triggers approval workflow)        |
| `deactivate_user`          | identity    | Deactivate a user account                                |
| `create_approval_request`  | approvals   | Submit a new approval request                            |
| `get_approval_request`     | approvals   | Retrieve a request with its steps                        |
| `list_approval_requests`   | approvals   | List requests with status/type/assignment filters        |
| `approve_step`             | approvals   | Approve the current pending step in a workflow           |
| `reject_step`              | approvals   | Reject a step (rejects the entire request)               |
| `escalate_request`         | approvals   | Escalate to a higher-authority reviewer                  |
| `get_audit_log`            | audit       | Retrieve a single audit entry                            |
| `list_audit_logs`          | audit       | Search and filter audit entries                          |
| `export_protected_data`    | resources   | Export data from a protected resource                    |
| `modify_system_config`     | resources   | Change a system configuration (requires approval)        |
| `trigger_deployment`       | resources   | Trigger a deployment (requires 2 reviewers + admin)      |

## Key Invariants

These rules are enforced at runtime and cannot be bypassed by any role:

### requester_cannot_approve_own_request
A user who submitted a request cannot serve as reviewer on any step of that request. This prevents conflicts of interest. Enforced on `approve_step` and `reject_step`.

### approval_steps_must_be_sequential
Steps must be completed in their defined order. Step N cannot be decided until steps 1 through N-1 are resolved. This ensures the intended review chain is respected.

### critical_requests_require_escalation
Requests created with `critical` priority are automatically escalated to an admin or super_admin reviewer. No manual intervention is needed -- the system enforces it.

### audit_log_immutable
Audit log entries are append-only. The framework rejects any attempt to update or delete an audit entry at compile time. This produces a tamper-proof record for compliance.

### role_change_requires_approval
Changing a user's role (except by super_admin) must go through the approval workflow. This prevents unauthorized privilege escalation.

### deactivated_users_cannot_act
Deactivated users are blocked from all actions before any business logic runs. This is a system-wide guard.

### restricted_data_requires_two_approvals
Accessing restricted-sensitivity resources requires at least two independent approvals (two-person rule).

### deployment_requires_admin_final_approval
Deployments must have an admin or super_admin as the final approval step. Reviewer approvals alone are insufficient.

## Policy Layering

Policies are evaluated by priority (highest wins). Deny policies at equal priority override allow policies.

```
Priority 1000  super_admin_full_access       ALLOW  (overrides everything)
Priority  900  self_service_blocked           DENY   (blocks own-request approval)
Priority  850  deployment_requires_two_approvals  DENY (blocks under-reviewed deploys)
Priority  800  restricted_data_requires_approval  DENY (blocks unapproved data access)
Priority  600  audit_log_read_admin_only      ALLOW  (admin+ only for audit)
Priority  500  admin_manage_users             ALLOW  (admin user management)
Priority  400  reviewer_approve_requests      ALLOW  (reviewer workflow access)
Priority  300  member_request_only            ALLOW  (member self-service)
```

A member calling `approve_step` is denied because no policy at priority 300+ grants that capability to members. An admin calling `approve_step` on their own request is denied by `self_service_blocked` (priority 900), even though `admin_manage_users` (priority 500) would otherwise allow related actions. A super_admin bypasses everything via priority 1000.

## Human-Review-Only Zones

The `safe-edit-zones.yaml` configuration defines four zone types:

| Zone               | Path                       | Who Can Modify                    |
|--------------------|----------------------------|-----------------------------------|
| `generated`        | `app/generated/**`         | SysMARA compiler only               |
| `editable`         | `app/capabilities/**`      | AI agents and developers freely   |
| `editable`         | `system/**`                | Architect (AI agents can propose) |
| `human-review-only`| `app/protected/audit/**`   | Security team review required     |
| `protected`        | `app/protected/auth/**`    | Security team only -- do not modify |

The `human-review-only` zone for audit infrastructure means that even valid changes require a security team member to review and approve before merge. This is distinct from `protected`, where the code should not be modified at all.

## How to Run

```bash
# From the repository root
cd examples/admin-approvals

# Generate the application scaffold
sysmara generate

# Start the development server
sysmara dev
# => listening on http://0.0.0.0:3001
```

## How to Extend

### Adding a new approval request type

1. Add the new type value to `approval_request.type` enum in `system/entities.yaml`
2. Add routing logic in `system/flows.yaml` under `approval_workflow` to assign appropriate reviewers
3. Implement the capability that consumes the approved request in `system/capabilities.yaml`
4. Add any type-specific policies in `system/policies.yaml`
5. Run `sysmara generate` to update generated code

### Adding a new role

1. Add the role to `user.role` enum in `system/entities.yaml`
2. Create a policy granting the role its capabilities in `system/policies.yaml`
3. Update the glossary in `system/glossary.yaml`
4. Run `sysmara generate`

### Adding a new protected resource type

1. Add the type to `protected_resource.type` enum in `system/entities.yaml`
2. Optionally add a new capability for interacting with it in `system/capabilities.yaml`
3. Add reviewer assignment rules in `system/flows.yaml`
4. Run `sysmara generate`

## Sample Impact Analysis

When an AI agent proposes a change, the framework evaluates its impact:

```
Proposed change: Add "budget_approval" to approval_request.type enum

Impact analysis:
  entities.yaml      -- approval_request.type enum extended
  capabilities.yaml  -- no existing capability references budget_approval (safe)
  flows.yaml         -- approval_workflow handles unknown types via default rule (safe)
  policies.yaml      -- no policy specifically targets budget_approval (inherits defaults)
  invariants.yaml    -- all invariants apply to any request type (safe)

  Verdict: LOW RISK -- enum extension with no downstream breakage
  Auto-merge: eligible (editable zone, no invariant conflicts)
```

```
Proposed change: Remove audit_log_immutable invariant

Impact analysis:
  invariants.yaml    -- removes critical severity invariant
  entities.yaml      -- audit_log entity references this invariant
  modules.yaml       -- audit module lists this invariant
  policies.yaml      -- no direct reference but audit integrity depends on it

  Verdict: CRITICAL RISK -- removes compliance-critical protection
  Auto-merge: BLOCKED (invariant removal requires human review)
```

## What AI Agents Can Safely Change

- Capability implementations in `app/capabilities/`
- System specifications in `system/` (with architect review)
- Entity field additions (non-breaking)
- New policies (additive)
- New capabilities (additive)
- New flow steps (appended)
- Glossary entries

## What AI Agents CANNOT Change

- **Audit infrastructure** (`app/protected/audit/`) -- `human-review-only` zone owned by the security team. Changes require explicit security team review before merge.
- **Authentication infrastructure** (`app/protected/auth/`) -- `protected` zone. Must not be modified by AI agents under any circumstances.
- **Generated code** (`app/generated/`) -- only the SysMARA compiler writes here.
- **Invariant removal or weakening** -- removing or reducing the severity of an invariant triggers a critical-risk flag and blocks auto-merge.

## What Invariants Protect

| Invariant | Protects Against |
|-----------|-----------------|
| `requester_cannot_approve_own_request` | Conflict of interest, self-authorization |
| `approval_steps_must_be_sequential` | Skipping required review stages |
| `critical_requests_require_escalation` | Critical actions without senior oversight |
| `audit_log_immutable` | Evidence tampering, compliance violations |
| `role_change_requires_approval` | Unauthorized privilege escalation |
| `deactivated_users_cannot_act` | Ghost accounts performing actions |
| `restricted_data_requires_two_approvals` | Single-person access to restricted data |
| `deployment_requires_admin_final_approval` | Production deploys without admin sign-off |
