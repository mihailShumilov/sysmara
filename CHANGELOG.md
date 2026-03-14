# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-03-14

### Added

- **CLI commands:** add, explain, impact, plan (create/show), doctor, check boundaries
- **Change Plan Protocol:** formal artifact for modeling system changes before code mutation
  - Risk classification (low/medium/high/critical)
  - Impact analysis with affected items
  - Human review flags
  - Markdown, JSON, and terminal renderers
- **Impact analysis UX:** rich terminal output with sections, total impact radius
- **Three example applications:**
  - SaaS Billing (users, workspaces, subscriptions, invoices)
  - Admin Approvals (approval workflows with audit trails)
  - Content Publishing (article lifecycle with moderation)
- **Doctor command:** comprehensive health check across all framework subsystems
- **Explain command:** deep-dive explanations for capabilities, invariants, and modules
- Shared CLI formatting utilities (header, table, section, bullet)
- `--json` flag support across all CLI commands

### Fixed

- YAML parser now handles wrapped format (e.g., `entities:` wrapping an array)
- CLI commands properly destructure `parseSpecDirectory` result

## [0.1.0] — 2025-03-14

### Added

- Core spec system with YAML parsing and Zod validation
- Cross-reference validation engine
- AI System Graph builder with typed nodes and edges
- System Map generator (AI-facing module index)
- Capability Compiler with route handler and test scaffold generation
- Diagnostics engine with 20+ validation checks
- Module boundary enforcement with cycle detection
- Invariant resolution engine (entity-level and capability-level)
- Safe edit zone validation with protected region support
- Impact analysis foundation (graph traversal for change surfaces)
- HTTP runtime with typed handlers, router, and error classes
- CLI with init, build, graph, diagnose, compile, and impact commands
- Comprehensive test suite
