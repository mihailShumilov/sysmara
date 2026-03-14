# Content Publishing API

A production-grade content publishing API built with SysMARA. This example demonstrates state machine lifecycle management, multi-step flow orchestration, and role-based policy layering for an editorial content platform.

## Why This Example Exists

Most API examples are CRUD toys. This one is not. The Content Publishing API showcases three patterns that real systems need but frameworks rarely address:

1. **State machine lifecycle** -- Articles move through `draft -> in_review -> approved -> published -> archived` with invariants that enforce valid transitions and prevent shortcuts.
2. **Flow orchestration** -- Multi-step editorial workflows (review, publish, moderate) are declared as flows, not buried in imperative code.
3. **Policy layering by role** -- Writers, editors, chief editors, and admins each have distinct permissions that compose through a priority-based policy system, including a deny rule that prevents writers from self-publishing.

## Architecture Summary

```
system/                          # Declarative specifications (source of truth)
  entities.yaml                  # 5 entities: article, author, category, comment, media_asset
  capabilities.yaml              # 15 capabilities covering CRUD + lifecycle transitions
  policies.yaml                  # 8 policies with role-based access control
  invariants.yaml                # 10 invariants protecting data integrity
  modules.yaml                   # 4 modules: content, authors, categories, engagement
  flows.yaml                     # 4 flows: article lifecycle, review, moderation, archival
  safe-edit-zones.yaml           # Edit zone declarations for AI agents
  glossary.yaml                  # Domain terminology definitions

app/                             # Implementation code
  entities/                      # Entity model implementations
  capabilities/                  # Capability handler implementations
  policies/                      # Policy enforcement logic
  invariants/                    # Invariant validation logic
  modules/                       # Module wiring and dependency injection
  flows/                         # Flow step implementations
  routes/                        # HTTP route definitions
  services/                      # Business logic services
  adapters/                      # External system adapters (storage, notifications)
  generated/                     # SysMARA compiler output (do not edit)
  protected/media/               # Media storage infrastructure (protected zone)
  tests/                         # Test suites
```

## Article Lifecycle

Articles follow a strict state machine with invariant-enforced transitions:

```
                   reject_article
                  (returns to draft)
                 /                 \
                v                   |
  [draft] --submit_for_review--> [in_review] --approve_article--> [approved]
                                                                      |
                                                                publish_article
                                                                      |
                                                                      v
                                                                [published]
                                                                      |
                                                                archive_article
                                                                      |
                                                                      v
                                                                 [archived]
```

Key constraints enforced by invariants:
- No skipping stages (draft cannot jump to published)
- Publication requires a reviewer to be assigned
- Only rejection can move an article backward (in_review -> draft)
- Archived articles are immutable

## Module Dependency Graph

```
  [authors]         [categories]
      |                  |
      +--------+---------+
               |
           [content]
            article, media_asset
            11 capabilities
               |
          [engagement]
            comment
            2 capabilities
```

Modules are isolated. The `engagement` module depends on `content` and `authors` but cannot directly modify articles -- it only references published articles for comment attachment.

## Capabilities

| Capability | Module | Description | Key Policies |
|---|---|---|---|
| `create_article` | content | Create a new draft article | writer_create_own |
| `get_article` | content | Retrieve article by ID | public_read_published |
| `update_article` | content | Modify article content | author_manage_own_drafts |
| `delete_article` | content | Permanently delete article | admin_full_access |
| `list_articles` | content | List with filters and pagination | public_read_published |
| `submit_for_review` | content | Transition draft to in_review | writer_create_own |
| `approve_article` | content | Transition in_review to approved | editor_review |
| `reject_article` | content | Return in_review to draft | editor_review |
| `publish_article` | content | Transition approved to published | chief_editor_publish, writer_cannot_publish_own |
| `archive_article` | content | Transition published to archived | chief_editor_publish |
| `create_category` | categories | Create a content category | editor_review |
| `update_category` | categories | Modify category metadata | editor_review |
| `create_comment` | engagement | Submit a comment on a published article | writer_create_own |
| `moderate_comment` | engagement | Approve, reject, or flag comments | editor_moderate_comments |
| `upload_media` | content | Upload a media file (max 50MB) | writer_create_own |

## Key Invariants

### State Transition Invariants

**`article_state_transitions_only_forward`** is the most important invariant. It defines the article lifecycle as a state machine with explicit allowed transitions:

- `draft` -> `in_review`
- `in_review` -> `approved` or `draft` (rejection)
- `approved` -> `published`
- `published` -> `archived`
- `archived` -> (terminal, no transitions)

This prevents an AI agent or API consumer from accidentally setting an article to "published" when it is still a draft.

**`draft_cannot_be_published_directly`** is a redundant safety net that explicitly blocks the draft-to-published shortcut, even if someone modifies the state machine transitions.

**`archived_articles_immutable`** prevents any modification to archived content, preserving the historical record.

### Referential Invariants

- **`published_article_must_have_reviewer`** -- Ensures editorial accountability by requiring a reviewer before publication.
- **`comment_must_reference_published_article`** -- Prevents comments on drafts, avoiding public exposure of unpublished content.
- **`author_must_have_user`** -- Ensures every author profile maps to a real user account.

### Uniqueness Invariants

- **`slug_must_be_unique`** and **`category_slug_must_be_unique`** -- Guarantee clean, collision-free URLs.

### Validation Invariants

- **`media_size_limit`** -- Caps uploads at 50MB (52,428,800 bytes).
- **`category_cannot_be_own_parent`** -- Prevents circular hierarchy references.

## Policy Layering by Role

Policies are evaluated by priority (highest wins). A `deny` policy at priority 90 overrides an `allow` at priority 50.

| Role | Can Create | Can Edit Own | Can Review | Can Publish | Can Archive | Can Moderate | Can Delete |
|---|---|---|---|---|---|---|---|
| **writer** | Yes | Drafts only | No | No | No | No | No |
| **editor** | Yes | Drafts only | Yes | No | No | Yes | No |
| **chief_editor** | Yes | Drafts only | Yes | Yes | Yes | Yes | No |
| **admin** | Yes | Any | Yes | Yes | Yes | Yes | Yes |

Notable policy interactions:
- `writer_cannot_publish_own` (deny, priority 90) blocks writers from publishing even if they somehow have the chief_editor role -- the deny rule takes precedence.
- `public_read_published` (allow, priority 10) lets unauthenticated users read published articles and list published content.
- `author_manage_own_drafts` (allow, priority 55) restricts writers to editing only their own articles in draft status.

## How to Run

```bash
# From the repository root
cd examples/content-publishing

# Compile the system specifications
sysmara compile

# Start the development server
sysmara dev

# The API will be available at http://0.0.0.0:3002
```

## How to Extend

### Adding a "Scheduled Publish" Capability

1. Add a `scheduled_at` field to the `article` entity in `system/entities.yaml`:
   ```yaml
   - name: scheduled_at
     type: date
     required: false
     description: Future timestamp for scheduled publication
   ```

2. Add a `schedule_publish` capability in `system/capabilities.yaml` that transitions `approved -> scheduled`:
   ```yaml
   - name: schedule_publish
     description: Schedule an approved article for future publication
     module: content
     entities: [article]
     input:
       - name: article_id
         type: string
         required: true
       - name: scheduled_at
         type: date
         required: true
     output:
       - name: article
         type: article
     policies: [chief_editor_publish, admin_full_access]
     invariants: [article_state_transitions_only_forward]
   ```

3. Update the state machine invariant to include the `scheduled` state:
   ```yaml
   approved:
     - published
     - scheduled
   scheduled:
     - published
     - approved   # allow cancellation
   ```

4. Run `sysmara compile` to regenerate the app scaffolding.

5. Implement the scheduling logic in `app/capabilities/schedule_publish.ts`.

### Impact Analysis

SysMARA provides impact analysis to understand the blast radius of changes before making them:

```bash
# What would be affected if we change the publish_article capability?
sysmara impact capability publish_article
```

Example output:
```
Capability: publish_article
  Module: content
  Entities: article
  Policies: chief_editor_publish, admin_full_access, writer_cannot_publish_own
  Invariants: article_state_transitions_only_forward, published_article_must_have_reviewer
  Flows: review_and_publish (step: schedule_publish)
  Downstream: engagement (comment creation depends on published articles)
```

This tells you that changing `publish_article` could affect comment creation in the engagement module, because `comment_must_reference_published_article` depends on articles being in published status.

```bash
# What depends on the article entity?
sysmara impact entity article

# What would break if we remove the editor_review policy?
sysmara impact policy editor_review
```

## What AI Agents Can Safely Change

The `system/safe-edit-zones.yaml` file declares what is safe for AI agents to modify:

| Zone | Path | What It Means |
|---|---|---|
| **generated** | `app/generated/**` | Compiler output. Agents must not edit these files directly. |
| **editable** | `app/capabilities/**` | Capability implementations. Safe for agents to modify. |
| **protected** | `app/protected/media/**` | Media infrastructure. Requires infrastructure team review. |
| **editable** | `system/**` | System specs. Safe for architects and agents with spec-level access. |

An AI agent working on this codebase can freely modify files in `app/capabilities/` (implementing or updating capability handlers) but should never touch `app/generated/` or `app/protected/media/`.

## What Invariants Protect

Invariants are the guardrails that prevent both humans and AI agents from corrupting content integrity:

- **State machine invariants** prevent an article from being published without going through review. No agent can skip the editorial workflow.
- **Referential invariants** ensure comments only appear on published articles and every author maps to a real user. An agent cannot create orphaned data.
- **Uniqueness invariants** prevent URL collisions. An agent creating articles must generate unique slugs.
- **Validation invariants** enforce business limits (50MB media cap, no circular categories). An agent uploading media cannot exceed the size limit.

These invariants are enforced at the framework level, not in application code. They cannot be bypassed by modifying capability implementations.
