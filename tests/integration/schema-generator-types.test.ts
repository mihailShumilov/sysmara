import { describe, it, expect } from 'vitest';
import { generateSchema } from '../../src/database/adapters/sysmara-orm/schema-generator.js';
import type { SystemSpecs, EntitySpec } from '../../src/types/index.js';

/**
 * Coverage for the column-type-inference upgrades:
 *  - description-flagged JSON → JSONB / JSON
 *  - conventional long-text field names → TEXT
 *  - explicit maxLength constraint → VARCHAR(<n>)
 *  - `*_at` timestamp-like fields declared as `type: date` → TIMESTAMPTZ / DATETIME(3)
 *
 * These previously all collapsed to VARCHAR(255) / DATE, leading to silent
 * data truncation and surprising column types.
 */

function buildSpec(fields: EntitySpec['fields']): SystemSpecs {
  const entity: EntitySpec = {
    name: 'sample',
    description: 'A sample entity',
    module: 'samples',
    fields,
  };
  return {
    entities: [entity],
    capabilities: [],
    policies: [],
    invariants: [],
    modules: [],
    flows: [],
    safeEditZones: [],
    glossary: [],
  };
}

describe('schema-generator — postgres column types', () => {
  it('treats description-flagged JSON strings as JSONB', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        { name: 'bot_access', type: 'string', required: true,
          description: "JSON — Record<botName, 'allowed'|'blocked'|'partial'>" },
        { name: 'jsonld_types', type: 'string', required: false,
          description: 'JSON array of schema.org types' },
      ]),
      'postgresql',
    );
    expect(sql).toMatch(/"bot_access" JSONB/);
    expect(sql).toMatch(/"jsonld_types" JSONB/);
  });

  it('promotes conventional long-text field names to TEXT', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        { name: 'description', type: 'string', required: true },
        { name: 'recommendation', type: 'string', required: true },
        { name: 'page_html', type: 'string', required: false },
      ]),
      'postgresql',
    );
    expect(sql).toMatch(/"description" TEXT/);
    expect(sql).toMatch(/"recommendation" TEXT/);
    expect(sql).toMatch(/"page_html" TEXT/);
  });

  it('honours maxLength constraint for VARCHAR sizing', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        {
          name: 'email',
          type: 'string',
          required: true,
          constraints: [{ type: 'maxLength', value: 320 }],
        },
      ]),
      'postgresql',
    );
    expect(sql).toMatch(/"email" VARCHAR\(320\)/);
  });

  it('promotes *_at fields declared as date to TIMESTAMPTZ', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        { name: 'created_at', type: 'date', required: true },
        { name: 'completed_at', type: 'date', required: false },
        { name: 'birthdate', type: 'date', required: false },
      ]),
      'postgresql',
    );
    expect(sql).toMatch(/"created_at" TIMESTAMPTZ/);
    expect(sql).toMatch(/"completed_at" TIMESTAMPTZ/);
    // a true calendar date stays DATE
    expect(sql).toMatch(/"birthdate" DATE/);
  });

  it('keeps short string fields as VARCHAR(255) by default (back-compat)', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        { name: 'slug', type: 'string', required: true },
        { name: 'name', type: 'string', required: false },
      ]),
      'postgresql',
    );
    expect(sql).toMatch(/"slug" VARCHAR\(255\)/);
    expect(sql).toMatch(/"name" VARCHAR\(255\)/);
  });
});

describe('schema-generator — mysql column types', () => {
  it('emits JSON for description-flagged JSON', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        { name: 'metadata', type: 'string', required: true, description: 'JSONB blob' },
      ]),
      'mysql',
    );
    expect(sql).toMatch(/"metadata" JSON/);
  });

  it('emits TEXT for long-text names', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        { name: 'description', type: 'string', required: true },
      ]),
      'mysql',
    );
    expect(sql).toMatch(/"description" TEXT/);
  });

  it('promotes *_at date fields to DATETIME(3)', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        { name: 'created_at', type: 'date', required: true },
      ]),
      'mysql',
    );
    expect(sql).toMatch(/"created_at" DATETIME\(3\)/);
  });
});

describe('schema-generator — sqlite (unaffected)', () => {
  it('still emits TEXT for everything string-shaped', () => {
    const sql = generateSchema(
      buildSpec([
        { name: 'id', type: 'string', required: true },
        { name: 'description', type: 'string', required: true },
        { name: 'metadata', type: 'string', required: true, description: 'JSON blob' },
      ]),
      'sqlite',
    );
    expect(sql).toMatch(/"description" TEXT/);
    expect(sql).toMatch(/"metadata" TEXT/);
  });
});
