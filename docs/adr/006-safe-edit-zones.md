# ADR-006: Safe Edit Zones

## Status
Accepted

## Context
When AI agents edit code, some files should never be touched (generated code that will be overwritten), some require human review, and some are free to edit. Without explicit ownership, AI agents may corrupt generated files or modify protected infrastructure.

## Decision
Every file path can be assigned an edit zone: `generated` (compiler output, do not edit), `editable` (safe for AI and human modification), `protected` (infrastructure, do not modify without explicit authorization), or `human-review-only` (changes require human approval). Edit zones are declared in `safe-edit-zones.yaml` and enforced by diagnostics.

## Consequences
- AI agents know which files they can safely modify
- Generated files are protected from accidental edits
- Human review gates are formally declared, not ad-hoc
- Zone violations are detectable and reportable
