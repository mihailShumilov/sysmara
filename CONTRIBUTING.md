# Contributing to SysMARA

Thank you for your interest in contributing to SysMARA. This document outlines the process and guidelines for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/core.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b my-feature`
5. Make your changes
6. Run checks: `npm run typecheck && npm run lint && npm test`
7. Commit and push your branch
8. Open a pull request

## Development Setup

```bash
npm install
npm run build
npm run test
```

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run the test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |
| `npm run clean` | Remove the `dist/` directory |

## Code Standards

### TypeScript Strict Mode Required

All code must compile under `strict: true` in `tsconfig.json`. No `@ts-ignore` or `@ts-expect-error` comments unless accompanied by a justifying comment.

### No Decorators or Reflection

SysMARA does not use decorator-heavy patterns or runtime reflection (e.g., `reflect-metadata`). Architecture is expressed in YAML specs, not in code annotations. Keep code explicit and statically analyzable.

### Explicit Over Implicit

- Prefer explicit function signatures over inferred types at module boundaries
- Prefer named exports over default exports
- Prefer explicit error handling over thrown exceptions where practical
- Prefer composition over inheritance

### Machine-Readable Over Convention-Only

If a design decision affects system behavior, it should be expressible in the spec format, not only in code convention. When adding new concepts to the framework, consider whether they should be represented in the system graph.

### No `any`

The ESLint config enforces `@typescript-eslint/no-explicit-any` as an error. Use `unknown` and type narrowing instead.

### Tests Must Pass

All pull requests must pass the full test suite. Add tests for new functionality. Tests live in the `tests/` directory and use Vitest.

## Project Architecture

```
src/
  types/        # Shared TypeScript types and Zod schemas
  spec/         # YAML spec parsing and validation
  graph/        # System graph and system map builders
  compiler/     # Capability compiler (code generation)
  diagnostics/  # Diagnostics engine
  impact/       # Impact analysis
  invariants/   # Invariant resolution engine
  boundaries/   # Module boundary enforcement
  safety/       # Edit zone validation
  runtime/      # HTTP server, router, config, errors, logger
  cli/          # CLI entry point
```

## Pull Request Guidelines

- Keep PRs focused on a single concern
- Include tests for new functionality
- Update specs and types if adding new concepts
- Ensure `npm run typecheck`, `npm run lint`, and `npm test` all pass
- Write a clear description of what changed and why

## Reporting Issues

Use GitHub Issues. For bugs, include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Node.js version and OS

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold its terms.
