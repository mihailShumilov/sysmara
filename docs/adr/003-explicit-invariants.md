# ADR-003: Explicit Invariants

## Status
Accepted

## Context
In traditional frameworks, business rules are scattered across controllers, middleware, validators, and database constraints. They are implicit — understood by the original developer but invisible to new contributors or AI agents. When an AI agent modifies code, it has no way to know which rules must never be violated.

## Decision
Invariants are first-class, machine-readable specs. Each invariant declares which entity it protects, what the rule is, its severity, and its enforcement mode (runtime, compile, or both). Capabilities explicitly reference the invariants they must respect.

## Consequences
- AI agents can discover all rules before making changes
- Invariant violations are detectable at compile/build time
- Every capability-invariant link is auditable
- Requires discipline: developers must declare invariants, not just implement them
