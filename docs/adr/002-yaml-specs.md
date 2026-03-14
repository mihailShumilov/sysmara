# ADR-002: YAML as Specification Format

## Status
Accepted

## Context
System specifications need a human-authored, machine-parseable format. Options considered: TypeScript DSL, JSON, YAML, TOML, custom DSL.

TypeScript DSL couples specs to implementation. JSON lacks comments and readability. TOML lacks nested structure expressiveness. Custom DSLs require custom parsers and tooling.

## Decision
YAML is the primary spec format. It is human-readable, supports comments, handles nested structures well, and has mature parsers in every language. AI agents can read and write YAML reliably.

## Consequences
- Specs are decoupled from TypeScript implementation
- Humans can review specs without understanding TypeScript
- YAML parsing introduces a dependency (the `yaml` package)
- Schema validation must be explicit (via Zod) since YAML is untyped
