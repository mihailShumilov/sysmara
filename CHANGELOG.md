# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] — 2026-03-30

### Fixed

- **List handlers use `ctx.query` instead of `ctx.body`**: scaffolded list_* capability handlers now read filters from query parameters (GET requests have no body)
- **Policy violations return 403 instead of 500**: scaffolded policy enforcement now throws `ForbiddenError` (HTTP 403) instead of generic `Error` (which was caught as 500 INTERNAL_ERROR)
- **Generated server.ts parses real specs**: the generated `app/server.ts` entry point now calls `parseSpecDirectory()` and passes real specs to the ORM constructor instead of empty arrays
- **CLI version synced with package.json**: CLI `--version` now reports the correct version

### Added

- **Header-based actor extraction**: both `sysmara start` and the generated `app/server.ts` now extract actor identity from `X-Actor-Id` and `X-Actor-Roles` HTTP headers (previously all requests were anonymous)
- **Status transition capability scaffolding**: operations like `publish_post`, `archive_post`, `submit_post_for_review`, `approve_comment`, `reject_comment`, `flag_content` now generate proper status-transition logic (find entity, update status field) instead of falling through to a read-only `findById`
- **Association capability scaffolding**: operations like `tag_post`, `untag_post` now generate proper create/delete logic on the association entity instead of incorrect `findById` calls
- **Expanded operation inference**: `inferOperation()` now recognizes 20+ verb prefixes for status transitions (`publish_`, `archive_`, `approve_`, `reject_`, `submit_`, `moderate_`, `flag_`, etc.) and association operations (`tag_`, `untag_`, `link_`, `unlink_`, `invite_`, `kick_`)

## [0.7.2] — 2026-03-21

### Added

- **File nodes in the system graph**: each capability now generates three `file` nodes (`routes/*.ts`, `tests/*.test.ts`, `metadata/*.json`) in the system graph, matching the formal definition G = (V, E, τ_v, τ_e) from the scholarly article
- **`owns` edges**: module → file edges connect each module to the generated files of its capabilities, enabling precise file-level impact analysis
- **`affectedFiles` in impact analysis**: `ImpactSurface` now includes an `affectedFiles` array listing concrete file paths affected by a change
- Impact terminal formatter now displays the "Affected Files" section

### Fixed

- `generatedArtifacts` in impact analysis no longer produces invalid paths for file-type nodes

## [0.7.0] — 2026-03-19

### Added

- **`sysmara start` command**: auto-wires all capabilities to HTTP routes, connects to the database, applies schema (CREATE TABLE IF NOT EXISTS), and starts the server — zero boilerplate
- **Real database drivers**: SysmaraORM now executes actual SQL queries against real databases
  - PostgreSQL via `pg` (optional peer dependency)
  - MySQL via `mysql2` (optional peer dependency)
  - SQLite via `better-sqlite3` (optional peer dependency)
  - In-memory fallback when no driver is installed (testing/development)
- **ORM `connect()`/`disconnect()`/`applySchema()` methods**: full database lifecycle management
- **Server entry point generation**: `sysmara build` generates `app/server.ts` — a runnable entry point that imports all scaffolded capability handlers and registers them as routes
- **Auto route inference**: capability names are automatically mapped to HTTP methods and paths (e.g., `create_user` → `POST /users`, `get_user` → `GET /users/:id`)

### Changed

- **Config parser** now uses the `yaml` package (previously hand-rolled, fragile) — supports full YAML including nested objects, arrays, and all scalar types
- **SysmaraRepository** now accepts an optional database driver and executes real queries when connected (previously all methods were stubs returning hardcoded values)
- **SysmaraORM.capability()** now routes to actual CRUD operations through the repository (previously returned `{ status: 'pending' }`)

### Fixed

- CLI version string now matches package.json (`0.7.0`)

## [Unreleased]

### Added

- **Implement mode** (`--no-implement` flag): scaffold generators now produce working ORM-based implementations by default instead of TODO stubs. Pass `--no-implement` to `sysmara build` or `sysmara init` to get the old stub behavior
  - Capability handlers: CRUD logic via SysmaraORM repository (create/read/update/delete/list inferred from capability name)
  - Policy enforcers: real condition checks from spec conditions (role-based, equality, membership)
  - Invariant validators: field checks inferred from invariant names and rules (uniqueness, not-empty, range)
  - Service classes: ORM-injected constructor with real repository calls per capability
  - Entity validators: type-checked validation with constraint enforcement (enum, min/max, pattern)
- **Package.json generation**: `sysmara init` now creates `package.json` with npm scripts: `build`, `validate`, `dev` (starts DB + builds + watches), `start` (production), `db:start/stop/logs`, and all `sysmara:*` commands
- **README.md generation**: init creates a project-specific README with setup instructions, available commands table, project structure, and configuration details
- 19 new tests for implement-mode generators, package.json, and README generation

## [0.6.0] — 2026-03-16

### Added

- **Database-integrated init** (`sysmara init --db postgresql --orm sysmara-orm`): init command now accepts `--db` and `--orm` flags to configure the database provider and ORM adapter during project creation
- **Docker environment generation**: init creates `docker-compose.yml` (with the selected database service), `Dockerfile` (multi-stage production build), and `.dockerignore`
- **Environment file generation**: init creates `.env.example` (documented template) and `.env.local` (local dev defaults, gitignored)
- **Comprehensive .gitignore**: init generates a complete `.gitignore` with entries for Node.js, SysMARA, environment files, and IDE files
- **Auto schema generation in build**: `sysmara build` now auto-generates the database schema from entity specs when `database` is configured in `sysmara.config.yaml` (step 6 of the build pipeline)
- **CLI flag parsing**: extended `parseFlags` to support `--key=value` and `--key value` patterns for all commands
- Generator module (`src/generators/`) with Docker, env, and gitignore file generators
- 13 new tests for Docker and environment generators
- Updated BOOTSTRAP.md with database init steps, Docker startup, and auto schema generation

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
