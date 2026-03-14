/**
 * @module cli/commands/add
 * CLI command that scaffolds a new spec entry (entity, capability, policy,
 * invariant, module, or flow) by appending a template to the appropriate
 * YAML spec file.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse, stringify } from 'yaml';
import type { SysmaraConfig } from '../../types/index.js';
import { success, error } from '../format.js';

type SpecType = 'entity' | 'capability' | 'policy' | 'invariant' | 'module' | 'flow';

const VALID_TYPES: SpecType[] = ['entity', 'capability', 'policy', 'invariant', 'module', 'flow'];

interface SpecFileMapping {
  file: string;
  key: string;
  nameField: string;
}

const TYPE_FILE_MAP: Record<SpecType, SpecFileMapping> = {
  entity: { file: 'entities.yaml', key: 'entities', nameField: 'name' },
  capability: { file: 'capabilities.yaml', key: 'capabilities', nameField: 'name' },
  policy: { file: 'policies.yaml', key: 'policies', nameField: 'name' },
  invariant: { file: 'invariants.yaml', key: 'invariants', nameField: 'name' },
  module: { file: 'modules.yaml', key: 'modules', nameField: 'name' },
  flow: { file: 'flows.yaml', key: 'flows', nameField: 'name' },
};

function getDefaultTemplate(type: SpecType, name: string): Record<string, unknown> {
  switch (type) {
    case 'entity':
      return {
        name,
        description: 'TODO: Describe this entity',
        module: 'TODO',
        fields: [],
      };
    case 'capability':
      return {
        name,
        description: 'TODO: Describe this capability',
        module: 'TODO',
        entities: [],
        input: [],
        output: [],
        policies: [],
        invariants: [],
      };
    case 'policy':
      return {
        name,
        description: 'TODO: Describe this policy',
        actor: 'authenticated_user',
        capabilities: [],
        conditions: [],
        effect: 'allow',
      };
    case 'invariant':
      return {
        name,
        description: 'TODO: Describe this invariant',
        entity: 'TODO',
        rule: 'TODO: Define the rule',
        severity: 'error',
        enforcement: 'runtime',
      };
    case 'module':
      return {
        name,
        description: 'TODO: Describe this module',
        entities: [],
        capabilities: [],
        allowedDependencies: [],
        forbiddenDependencies: [],
      };
    case 'flow':
      return {
        name,
        description: 'TODO: Describe this flow',
        trigger: 'TODO',
        steps: [],
        module: 'TODO',
      };
  }
}

/**
 * Adds a new spec entry of the given type to the project's spec directory.
 * Creates the spec YAML file if it does not exist, checks for duplicate names,
 * and appends a default template that the user can then edit.
 *
 * @param cwd - Current working directory (project root).
 * @param type - Spec type to add: `'entity'`, `'capability'`, `'policy'`, `'invariant'`, `'module'`, or `'flow'`.
 * @param name - Unique name for the new spec entry.
 * @param config - Resolved SysMARA project configuration.
 * @throws Exits the process with code 1 if the type is invalid or a duplicate name exists.
 */
export async function commandAdd(cwd: string, type: string, name: string, config: SysmaraConfig): Promise<void> {
  if (!VALID_TYPES.includes(type as SpecType)) {
    console.error(error(`Unknown type "${type}". Valid types: ${VALID_TYPES.join(', ')}`));
    process.exit(1);
  }

  const specType = type as SpecType;
  const mapping = TYPE_FILE_MAP[specType];
  const specDir = path.resolve(cwd, config.specDir);
  const filePath = path.join(specDir, mapping.file);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    // File does not exist — create with empty array
    content = `${mapping.key}: []\n`;
  }

  const parsed = parse(content) as Record<string, Array<Record<string, unknown>>> | null;
  const entries: Array<Record<string, unknown>> = parsed?.[mapping.key] ?? [];

  // Check for duplicate
  const existing = entries.find((entry) => entry[mapping.nameField] === name);
  if (existing) {
    console.error(error(`A ${specType} named "${name}" already exists in ${mapping.file}`));
    process.exit(1);
  }

  const template = getDefaultTemplate(specType, name);
  entries.push(template);

  const output: Record<string, unknown> = { [mapping.key]: entries };
  const yamlContent = stringify(output, { lineWidth: 120 });

  await fs.writeFile(filePath, yamlContent, 'utf-8');
  console.log(success(`Added ${specType} "${name}" to ${mapping.file}`));
  console.log(`\nEdit ${path.relative(cwd, filePath)} to fill in the details.`);
}
