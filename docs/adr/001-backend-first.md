# ADR-001: Backend-First in v0.1

## Status
Accepted

## Context
SysMARA could target full-stack, frontend-first, or backend-first. AI agents performing system changes need a stable, well-defined domain layer to reason about. Frontend concerns (UI state, rendering, interaction) introduce ambiguity and human-subjective decisions that are hard to formalize.

## Decision
v0.1 is backend-only. The framework provides HTTP routing, capability modeling, and system graph tooling for backend services. No frontend rendering, no SSR, no client-side framework integration.

## Consequences
- Simpler scope, faster to production quality
- AI agents can focus on domain logic without UI ambiguity
- Frontend integration can be layered on in later phases via API generation
