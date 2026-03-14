# SysMARA Examples

Three complete example applications demonstrating different aspects of the SysMARA framework.

## Examples

### [SaaS Billing](./saas-billing/)

A subscription billing platform with users, workspaces, subscriptions, and invoices.

- **Modules:** users, workspaces, billing
- **Highlights:** Multi-entity flows, invoice lifecycle, subscription management
- **Change Plan:** Includes `change-plans/add-team-billing.yaml` — a sample Change Plan Protocol artifact

### [Admin Approvals](./admin-approvals/)

A multi-step approval workflow system with audit trails.

- **Modules:** identity, approvals, audit, resources
- **Highlights:** State machine flows, human-review-only safe edit zones, approval chains

### [Content Publishing](./content-publishing/)

An article publishing platform with authors, categories, and comments.

- **Modules:** content, authors, categories, engagement
- **Highlights:** Article lifecycle state machine, media assets, moderation policies

## Running an Example

Each example is a standalone SysMARA project. From the framework root:

```bash
# Parse and validate specs
npx sysmara validate --spec-dir examples/saas-billing/system

# Build the system graph
npx sysmara graph --spec-dir examples/saas-billing/system

# Run diagnostics
npx sysmara doctor --spec-dir examples/saas-billing/system

# Explain a capability
npx sysmara explain capability create_subscription --spec-dir examples/saas-billing/system

# Analyze impact of a change
npx sysmara impact entity subscription --spec-dir examples/saas-billing/system

# Show a change plan
npx sysmara plan show examples/saas-billing/change-plans/add-team-billing.yaml
```

## Why Three Examples?

Each example exercises a different slice of the framework:

| Feature | SaaS Billing | Admin Approvals | Content Publishing |
|---------|:---:|:---:|:---:|
| Multi-module boundaries | ✓ | ✓ | ✓ |
| Entity relationships | ✓ | ✓ | ✓ |
| Flow state machines | | ✓ | ✓ |
| Change Plan Protocol | ✓ | | |
| Human-review-only zones | | ✓ | |
| Complex invariants | ✓ | ✓ | ✓ |
| Glossary terms | ✓ | ✓ | ✓ |

These examples serve as both tutorials for adopters and evaluation assets for the framework's correctness.
