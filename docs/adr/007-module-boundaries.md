# ADR-007: Module Boundary Enforcement

## Status
Accepted

## Context
In large systems, uncontrolled dependencies between modules create coupling that makes changes dangerous and unpredictable. Traditional frameworks rely on developer discipline or post-hoc linting. AI agents have no innate understanding of intended module boundaries.

## Decision
Modules explicitly declare their allowed and forbidden dependencies. The diagnostics engine enforces that capabilities only reference entities within their module or explicitly allowed dependency modules. Circular dependencies are detected and reported. Forbidden dependency violations are errors, not warnings.

## Consequences
- Module boundaries are formal and enforceable
- AI agents cannot accidentally introduce cross-module coupling
- Dependency cycles are caught early
- Requires upfront boundary design (intentional friction)
