# E-Commerce API — SysMARA Example

This project was generated from a single AI prompt using SysMARA.

## Original Prompt

See [PROMPT.md](./PROMPT.md) for the full copy-pasteable prompt.

## Project Structure

```
ecommerce-api/
  PROMPT.md                  # The original prompt
  sysmara.config.yaml        # Project configuration
  README.md                  # This file
  system/
    entities.yaml            # 6 entities: product, category, order, order_item, inventory, customer
    capabilities.yaml        # 16 capabilities across 4 modules
    policies.yaml            # 6 access policies (public, buyer, seller, admin, owner-based)
    invariants.yaml          # 8 business rule invariants
    modules.yaml             # 4 modules: catalog, orders, inventory, customers
    flows.yaml               # 2 flows: checkout and order cancellation
```

## Modules

| Module     | Entities              | Description                          |
|------------|-----------------------|--------------------------------------|
| catalog    | product, category     | Product and category management      |
| orders     | order, order_item     | Order lifecycle and payment           |
| inventory  | inventory             | Stock tracking and warehouse mgmt    |
| customers  | customer              | Customer registration and profiles   |

## Validate

```bash
npx sysmara validate
```

## Build

```bash
npx sysmara build
```

## Run

```bash
npx sysmara dev
# Server starts on http://localhost:3000
```

## What SysMARA Generated

From the one-line prompt, SysMARA produced:

- **6 entities** with typed fields, constraints, and cross-referenced invariants
- **16 capabilities** with full input/output schemas, policies, and side effects
- **6 policies** covering public access, role-based access, and ownership checks
- **8 invariants** enforcing business rules at runtime and compile time
- **4 modules** with explicit dependency boundaries (allowed and forbidden)
- **2 flows** modeling the checkout and cancellation processes with compensation logic
