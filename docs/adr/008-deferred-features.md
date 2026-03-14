# ADR-008: Intentionally Deferred Features

## Status
Accepted

## Context
v0.1 must be a solid foundation, not a speculative feature dump.

## Deferred Features

### Change Protocol
Formal RFC-style change proposals where AI agents submit structured change requests that are validated against the system graph before execution. Deferred because the graph and compiler must stabilize first.

### Multi-Agent Coordination
Concurrent AI agents working on the same system with conflict detection and resolution. Deferred because single-agent operation must be reliable first.

### Plugin System
Extensibility for custom spec types, generators, and validators. Deferred to avoid premature abstraction.

### Database Adapter Generation
Generating database schemas, migrations, and repository code from entity specs. Deferred to keep v0.1 focused on architecture, not persistence.

### API Client Generation
Generating typed API clients from capability/route specs. Deferred until runtime stabilizes.

### Flow Execution Engine
Actually executing multi-step flows with compensation and retry logic. v0.1 only models flows as specs.

### Frontend Integration
Any frontend rendering, SSR, or client-side framework integration. Backend-first by design.

## Consequences
- v0.1 is smaller but more reliable
- Each deferred feature has a clear path to implementation
- No speculative abstractions or plugin points polluting the core
