/**
 * @module cli/commands/explain
 * CLI command that provides a detailed human-readable or JSON explanation
 * of a specific capability, invariant, or module, including its relationships
 * to other specs in the system.
 */

import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory } from '../../spec/index.js';
import type { SysmaraConfig, SystemSpecs, CapabilitySpec, InvariantSpec, ModuleSpec } from '../../types/index.js';
import { header, error, section } from '../format.js';

type ExplainType = 'capability' | 'invariant' | 'module';

const VALID_TYPES: ExplainType[] = ['capability', 'invariant', 'module'];

function explainCapability(cap: CapabilitySpec, specs: SystemSpecs): string {
  const lines: string[] = [];

  lines.push(header(`Capability: ${cap.name}`));
  lines.push('');
  lines.push(`  Description:  ${cap.description}`);
  lines.push(`  Module:       ${cap.module}`);
  lines.push(`  Idempotent:   ${cap.idempotent ?? 'not specified'}`);
  lines.push(`  Side Effects: ${cap.sideEffects?.join(', ') || 'none'}`);

  lines.push(section('Entities'));
  if (cap.entities.length > 0) {
    for (const e of cap.entities) {
      lines.push(`    - ${e}`);
    }
  } else {
    lines.push('    (none)');
  }

  lines.push(section('Input'));
  if (cap.input.length > 0) {
    for (const field of cap.input) {
      const req = field.required ? 'required' : 'optional';
      lines.push(`    - ${field.name}: ${field.type} (${req})`);
    }
  } else {
    lines.push('    (none)');
  }

  lines.push(section('Output'));
  if (cap.output.length > 0) {
    for (const field of cap.output) {
      const req = field.required ? 'required' : 'optional';
      lines.push(`    - ${field.name}: ${field.type} (${req})`);
    }
  } else {
    lines.push('    (none)');
  }

  lines.push(section('Policies'));
  if (cap.policies.length > 0) {
    for (const p of cap.policies) {
      const policy = specs.policies.find((pol) => pol.name === p);
      if (policy) {
        lines.push(`    - ${p}: ${policy.description} (effect: ${policy.effect})`);
      } else {
        lines.push(`    - ${p} (not found in specs)`);
      }
    }
  } else {
    lines.push('    (none)');
  }

  lines.push(section('Invariants'));
  if (cap.invariants.length > 0) {
    for (const inv of cap.invariants) {
      const invariant = specs.invariants.find((i) => i.name === inv);
      if (invariant) {
        lines.push(`    - ${inv}: ${invariant.description} [${invariant.severity}]`);
      } else {
        lines.push(`    - ${inv} (not found in specs)`);
      }
    }
  } else {
    lines.push('    (none)');
  }

  // Show owning module details
  const ownerModule = specs.modules.find((m) => m.name === cap.module);
  if (ownerModule) {
    lines.push(section('Owner Module'));
    lines.push(`    Name:  ${ownerModule.name}`);
    lines.push(`    Owner: ${ownerModule.owner ?? 'unspecified'}`);
  }

  return lines.join('\n');
}

function explainCapabilityJSON(cap: CapabilitySpec, specs: SystemSpecs): Record<string, unknown> {
  const ownerModule = specs.modules.find((m) => m.name === cap.module);
  return {
    name: cap.name,
    description: cap.description,
    module: cap.module,
    idempotent: cap.idempotent ?? null,
    sideEffects: cap.sideEffects ?? [],
    entities: cap.entities,
    input: cap.input,
    output: cap.output,
    policies: cap.policies.map((p) => {
      const policy = specs.policies.find((pol) => pol.name === p);
      return { name: p, description: policy?.description ?? null, effect: policy?.effect ?? null };
    }),
    invariants: cap.invariants.map((inv) => {
      const invariant = specs.invariants.find((i) => i.name === inv);
      return { name: inv, description: invariant?.description ?? null, severity: invariant?.severity ?? null };
    }),
    ownerModule: ownerModule ? { name: ownerModule.name, owner: ownerModule.owner ?? null } : null,
  };
}

function explainInvariant(inv: InvariantSpec, specs: SystemSpecs): string {
  const lines: string[] = [];

  lines.push(header(`Invariant: ${inv.name}`));
  lines.push('');
  lines.push(`  Description:  ${inv.description}`);
  lines.push(`  Entity:       ${inv.entity}`);
  lines.push(`  Rule:         ${inv.rule}`);
  lines.push(`  Severity:     ${inv.severity}`);
  lines.push(`  Enforcement:  ${inv.enforcement}`);

  // Find capabilities that reference this invariant
  const referencingCaps = specs.capabilities.filter((c) => c.invariants.includes(inv.name));
  lines.push(section('Referenced by Capabilities'));
  if (referencingCaps.length > 0) {
    for (const cap of referencingCaps) {
      lines.push(`    - ${cap.name} (module: ${cap.module})`);
    }
  } else {
    lines.push('    (none)');
  }

  return lines.join('\n');
}

function explainInvariantJSON(inv: InvariantSpec, specs: SystemSpecs): Record<string, unknown> {
  const referencingCaps = specs.capabilities.filter((c) => c.invariants.includes(inv.name));
  return {
    name: inv.name,
    description: inv.description,
    entity: inv.entity,
    rule: inv.rule,
    severity: inv.severity,
    enforcement: inv.enforcement,
    referencedByCapabilities: referencingCaps.map((c) => ({ name: c.name, module: c.module })),
  };
}

function explainModule(mod: ModuleSpec, specs: SystemSpecs): string {
  const lines: string[] = [];

  lines.push(header(`Module: ${mod.name}`));
  lines.push('');
  lines.push(`  Description: ${mod.description}`);
  lines.push(`  Owner:       ${mod.owner ?? 'unspecified'}`);

  lines.push(section('Entities'));
  if (mod.entities.length > 0) {
    for (const e of mod.entities) {
      const entity = specs.entities.find((en) => en.name === e);
      lines.push(`    - ${e}${entity ? `: ${entity.description}` : ''}`);
    }
  } else {
    lines.push('    (none)');
  }

  lines.push(section('Capabilities'));
  if (mod.capabilities.length > 0) {
    for (const c of mod.capabilities) {
      const cap = specs.capabilities.find((ca) => ca.name === c);
      lines.push(`    - ${c}${cap ? `: ${cap.description}` : ''}`);
    }
  } else {
    lines.push('    (none)');
  }

  lines.push(section('Allowed Dependencies'));
  if (mod.allowedDependencies.length > 0) {
    for (const d of mod.allowedDependencies) {
      lines.push(`    - ${d}`);
    }
  } else {
    lines.push('    (none)');
  }

  lines.push(section('Forbidden Dependencies'));
  if (mod.forbiddenDependencies.length > 0) {
    for (const d of mod.forbiddenDependencies) {
      lines.push(`    - ${d}`);
    }
  } else {
    lines.push('    (none)');
  }

  return lines.join('\n');
}

function explainModuleJSON(mod: ModuleSpec, specs: SystemSpecs): Record<string, unknown> {
  return {
    name: mod.name,
    description: mod.description,
    owner: mod.owner ?? null,
    entities: mod.entities.map((e) => {
      const entity = specs.entities.find((en) => en.name === e);
      return { name: e, description: entity?.description ?? null };
    }),
    capabilities: mod.capabilities.map((c) => {
      const cap = specs.capabilities.find((ca) => ca.name === c);
      return { name: c, description: cap?.description ?? null };
    }),
    allowedDependencies: mod.allowedDependencies,
    forbiddenDependencies: mod.forbiddenDependencies,
  };
}

/**
 * Explains a capability, invariant, or module by displaying its full spec
 * details and cross-references to related specs (policies, invariants,
 * entities, modules, etc.).
 *
 * @param cwd - Current working directory (project root).
 * @param type - Spec type to explain: `'capability'`, `'invariant'`, or `'module'`.
 * @param name - Name of the spec entry to explain.
 * @param config - Resolved SysMARA project configuration.
 * @param jsonMode - When `true`, outputs a structured JSON object instead of formatted text.
 * @throws Exits the process with code 1 if the type is invalid or the named spec is not found.
 */
export async function commandExplain(
  cwd: string,
  type: string,
  name: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  if (!VALID_TYPES.includes(type as ExplainType)) {
    console.error(error(`Unknown type "${type}". Valid types: ${VALID_TYPES.join(', ')}`));
    process.exit(1);
  }

  const specDir = path.resolve(cwd, config.specDir);
  const result = await parseSpecDirectory(specDir);

  if (!result.specs) {
    console.error(error('Failed to parse specs.'));
    if (result.diagnostics.length > 0) {
      for (const d of result.diagnostics) {
        console.log(`  [${d.severity.toUpperCase()}] ${d.message}`);
      }
    }
    process.exit(1);
  }

  const specs = result.specs;
  const explainType = type as ExplainType;

  switch (explainType) {
    case 'capability': {
      const cap = specs.capabilities.find((c) => c.name === name);
      if (!cap) {
        console.error(error(`Capability "${name}" not found.`));
        console.log(`\nAvailable capabilities: ${specs.capabilities.map((c) => c.name).join(', ')}`);
        process.exit(1);
      }
      if (jsonMode) {
        console.log(JSON.stringify(explainCapabilityJSON(cap, specs), null, 2));
      } else {
        console.log(explainCapability(cap, specs));
      }
      break;
    }
    case 'invariant': {
      const inv = specs.invariants.find((i) => i.name === name);
      if (!inv) {
        console.error(error(`Invariant "${name}" not found.`));
        console.log(`\nAvailable invariants: ${specs.invariants.map((i) => i.name).join(', ')}`);
        process.exit(1);
      }
      if (jsonMode) {
        console.log(JSON.stringify(explainInvariantJSON(inv, specs), null, 2));
      } else {
        console.log(explainInvariant(inv, specs));
      }
      break;
    }
    case 'module': {
      const mod = specs.modules.find((m) => m.name === name);
      if (!mod) {
        console.error(error(`Module "${name}" not found.`));
        console.log(`\nAvailable modules: ${specs.modules.map((m) => m.name).join(', ')}`);
        process.exit(1);
      }
      if (jsonMode) {
        console.log(JSON.stringify(explainModuleJSON(mod, specs), null, 2));
      } else {
        console.log(explainModule(mod, specs));
      }
      break;
    }
  }
}
