# Blog Platform — SysMARA Example

## Original Prompt

See [PROMPT.md](./PROMPT.md) for the full copy-pasteable prompt.

## Project Structure

```
blog-platform/
  PROMPT.md                   # The original natural-language prompt
  sysmara.config.yaml         # Project configuration
  README.md                   # This file
  system/
    entities.yaml             # Data model: author, post, tag, post_tag, comment, moderation_log
    capabilities.yaml         # 21 capabilities across 3 modules
    policies.yaml             # 8 access control policies
    invariants.yaml           # 9 business rule invariants
    modules.yaml              # 3 modules: authors, content, engagement
    flows.yaml                # 3 workflows: publishing, moderation, content lifecycle
  app/                        # Generated application code (after build)
  .framework/                 # Framework internals (after build)
```

## Modules

| Module       | Entities                  | Description                                    |
|-------------|---------------------------|------------------------------------------------|
| `authors`   | author                    | Author profiles and identity management        |
| `content`   | post, tag, post_tag       | Blog posts, tags, and content lifecycle         |
| `engagement`| comment, moderation_log   | Comments, moderation, and reader interaction    |

## Capabilities Overview

- **Authors**: create, get, list, update
- **Content**: create/get/list/update/delete posts, publish, archive, submit for review, create/list tags, tag/untag posts
- **Engagement**: add/list comments, approve/reject comments, flag content

## Validation

```bash
# Validate the system specification
npx sysmara validate

# Build the application from the spec
npx sysmara build

# Start the development server
npx sysmara dev
```

## Key Design Decisions

- **Post status lifecycle**: draft -> in_review -> approved -> published -> archived
- **Comment moderation**: All comments start as `pending` and require moderator approval
- **Role hierarchy**: writer < editor < admin, with each role inheriting lower-level permissions
- **Module boundaries**: `authors` cannot depend on `engagement`, enforcing clean separation
- **Audit trail**: All moderation actions are logged in `moderation_log` for accountability
