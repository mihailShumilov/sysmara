# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] — 2026-03-16

### Added

- **Scaffold command** (`sysmara scaffold`): generates starter TypeScript implementation files in `app/` from YAML specs:
  - `app/entities/<name>.ts` — typed interface with validation helper
  - `app/capabilities/<name>.ts` — handler with typed input/output, policy/invariant TODOs
  - `app/policies/<name>.ts` — enforce function with condition comments
  - `app/invariants/<name>.ts` — validate function referencing entity type
  - `app/services/<module>.ts` — service class with method stubs per capability
- Scaffold is integrated into `sysmara build` (step 5) — runs automatically, skips existing files
- Standalone `sysmara scaffold` command for running independently
- Shared type utilities (`toPascalCase`, `toCamelCase`, `mapFieldType`) extracted to `src/scaffold/type-utils.ts`
- `scaffoldSpecs()` exported from `@sysmara/core` for programmatic use
- 24 new tests for scaffold generators, scaffolder, and type utilities

### Fixed

- **Compiler path bug:** `compileCapabilities()` was prefixing generated file paths with the absolute `outputDir`, causing double-path-join when CLI commands wrote files — resulting in nested filesystem-root directory structures inside `app/generated/`. Paths are now relative (`routes/foo.ts`, `tests/foo.test.ts`, `metadata/foo.json`).
- Removed unused `outputDir` parameter from `compileCapabilities()` (breaking change for programmatic API users who passed it — the parameter was silently ignored before this fix)

## [0.5.0] — 2026-03-15

### Added

- **AI Bootstrap Guide** (`BOOTSTRAP.md`): standalone protocol for AI agents to turn a human product description into a fully working SysMARA project — step-by-step from init to running server
- **AI Agent Guide** (`docs/ai-agent-guide.md`): human-readable documentation explaining SysMARA from an AI agent's perspective, including "Why this works" philosophy section
- **One-Prompt Workflow** (`docs/one-prompt-workflow.md`): exact step-by-step workflow from human prompt to working project, with copy-paste AI prompts for each step
- **Three one-prompt example projects** in `examples/ai-prompts/`:
  - `saas-task-manager/` — 5 entities, 15 capabilities, 5 policies, 6 invariants, 3 modules, 2 flows
  - `ecommerce-api/` — 6 entities, 16 capabilities, 6 policies, 8 invariants, 4 modules, 2 flows
  - `blog-platform/` — 6 entities, 21 capabilities, 8 policies, 9 invariants, 3 modules, 3 flows
- **"Build from one prompt" section** in README.md

## [0.4.0] — 2026-03-15

### Added

- **Flow Execution Engine:** production-ready flow executor with full lifecycle management
  - Saga compensation — on step failure, compensate completed steps in reverse order
  - Retry with exponential backoff — configurable max retries and base delay
  - Condition evaluation — safe recursive descent parser (no eval) for step conditions
  - Context threading — step outputs flow to subsequent steps automatically
  - AI-readable execution log with structured summaries (success rate, avg duration, recent failures)
  - Flow validation — check all step capabilities exist before execution
- **CLI commands:** `sysmara flow list`, `flow validate`, `flow run`, `flow log`
- **FlowExecutor class:** pluggable capability handler for testing and production use
- **FlowExecutionLog class:** in-memory execution store with summarize() API
- **Condition evaluator:** supports property access, comparison operators, logical AND/OR, null/boolean/string/number literals
- **Comprehensive test suite:** 24 tests covering happy path, abort, skip, compensate, retry, conditions, context threading, validation, and log summarization

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
