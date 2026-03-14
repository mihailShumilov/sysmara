# ADR-004: AI System Graph

## Status
Accepted

## Context
AI agents need to understand the full architecture before making changes. Reading source code files gives local context but not system-wide relationships. An AI agent asked to modify a capability needs to know: which entities are affected, which invariants must hold, which modules are impacted, which policies govern access, which tests exist.

## Decision
The framework builds a formal directed graph of the system from specs. Nodes represent entities, capabilities, modules, policies, invariants, flows, routes, and files. Edges represent relationships (belongs_to, uses_entity, governed_by, enforces, depends_on, triggers, exposes, owns, protects, step_of). The graph is output as stable JSON with deterministic ordering.

Two artifacts are produced:
- `system-graph.json`: full graph with all nodes and edges
- `system-map.json`: simplified index optimized for AI consumption

## Consequences
- AI agents can query the architecture before proposing changes
- Impact analysis becomes a graph traversal problem
- Architecture drift is detectable by comparing graph to implementation
- Graph must be rebuilt when specs change (included in `sysmara build`)
