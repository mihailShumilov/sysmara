import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory } from '../../spec/index.js';
import { buildSystemGraph, buildSystemMap } from '../../graph/index.js';
import type { SysmaraConfig } from '../../types/index.js';
import { header, success, error, info } from '../format.js';

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function commandGraph(cwd: string, config: SysmaraConfig, jsonMode: boolean): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);
  const frameworkDir = path.resolve(cwd, config.frameworkDir);

  if (!jsonMode) console.log(header('System Graph'));

  const result = await parseSpecDirectory(specDir);

  if (result.diagnostics.length > 0 && !jsonMode) {
    for (const d of result.diagnostics) {
      console.log(`  [${d.severity.toUpperCase()}] ${d.message}`);
    }
  }

  if (!result.specs) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, diagnostics: result.diagnostics }, null, 2));
    } else {
      console.error(error('Failed to parse specs. Fix the errors above and try again.'));
    }
    process.exit(1);
  }

  const specs = result.specs;
  const graph = buildSystemGraph(specs);
  const map = buildSystemMap(specs);

  await ensureDir(frameworkDir);

  await writeFile(
    path.join(frameworkDir, 'system-graph.json'),
    JSON.stringify(graph, null, 2),
  );

  await writeFile(
    path.join(frameworkDir, 'system-map.json'),
    JSON.stringify(map, null, 2),
  );

  if (jsonMode) {
    console.log(JSON.stringify({
      success: true,
      graph: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        file: path.join(config.frameworkDir, 'system-graph.json'),
      },
      map: {
        modules: map.modules.length,
        capabilities: map.capabilities.length,
        file: path.join(config.frameworkDir, 'system-map.json'),
      },
    }, null, 2));
  } else {
    console.log('');
    console.log(info(`system-graph.json — ${graph.nodes.length} nodes, ${graph.edges.length} edges`));
    console.log(info(`system-map.json — ${map.modules.length} modules, ${map.capabilities.length} capabilities`));
    console.log('');
    console.log(success(`Files written to ${config.frameworkDir}/`));
  }
}
