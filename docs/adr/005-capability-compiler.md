# ADR-005: Capability Compiler

## Status
Accepted

## Context
When AI agents implement capabilities, they need consistent scaffolding: handler signatures matching the spec, test files covering policies and invariants, metadata linking everything together. Manually creating these files is error-prone and inconsistent.

## Decision
A capability compiler reads capability specs and produces deterministic artifacts: route handler stubs, test scaffolds, and metadata JSON files. Generated files include source references, edit zone markers, and regeneration warnings. A manifest tracks all generated files with checksums.

## Consequences
- Consistent implementation scaffolding across all capabilities
- Generated files are clearly marked and tracked
- AI agents can focus on implementing logic, not boilerplate
- Manifest enables drift detection between specs and generated code
- v0.1 scope is limited to stubs and metadata — full codegen deferred
