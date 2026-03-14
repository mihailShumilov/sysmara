import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory } from '../../spec/index.js';
import { buildSystemGraph } from '../../graph/index.js';
import { analyzeImpact, formatImpactTerminal, formatImpactJSON } from '../../impact/index.js';
import type { SysmaraConfig } from '../../types/index.js';
import { header, error } from '../format.js';

type ImpactType = 'capability' | 'entity';

const VALID_TYPES: ImpactType[] = ['capability', 'entity'];

export async function commandImpact(
  cwd: string,
  type: string,
  name: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  if (!VALID_TYPES.includes(type as ImpactType)) {
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
  const graph = buildSystemGraph(specs);
  const target = `${type}:${name}`;
  const impact = analyzeImpact(graph, target, specs);

  if (!impact) {
    console.error(error(`Target "${target}" not found in system graph.`));
    const matchingNodes = graph.nodes.filter((n) => n.type === type);
    if (matchingNodes.length > 0) {
      console.log(`\nAvailable ${type} targets:`);
      for (const node of matchingNodes) {
        console.log(`  - ${node.name}`);
      }
    }
    process.exit(1);
  }

  if (jsonMode) {
    console.log(formatImpactJSON(impact));
  } else {
    console.log(header(`Impact Analysis: ${target}`));
    console.log('');
    console.log(formatImpactTerminal(impact));
  }
}
