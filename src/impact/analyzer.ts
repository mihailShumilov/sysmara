import type {
  SystemGraph,
  SystemSpecs,
  ImpactSurface,
  GraphNode,
  GraphEdge,
} from '../types/index.js';

export function analyzeImpact(
  graph: SystemGraph,
  target: string,
  _specs?: SystemSpecs
): ImpactSurface | null {
  const targetNode = graph.nodes.find((n) => n.id === target);
  if (!targetNode) {
    return null;
  }

  // Build adjacency lists (both directions)
  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges) {
    const outList = outgoing.get(edge.source);
    if (outList) {
      outList.push(edge);
    } else {
      outgoing.set(edge.source, [edge]);
    }

    const inList = incoming.get(edge.target);
    if (inList) {
      inList.push(edge);
    } else {
      incoming.set(edge.target, [edge]);
    }
  }

  // BFS traversal with max depth 3
  const visited = new Set<string>();
  const affectedNodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  interface QueueEntry {
    nodeId: string;
    depth: number;
  }

  const queue: QueueEntry[] = [{ nodeId: target, depth: 0 }];
  visited.add(target);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.nodeId !== target) {
      const node = nodeMap.get(current.nodeId);
      if (node) {
        affectedNodes.push(node);
      }
    }

    if (current.depth >= 3) {
      continue;
    }

    // Traverse outgoing edges
    const outEdges = outgoing.get(current.nodeId) ?? [];
    for (const edge of outEdges) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push({ nodeId: edge.target, depth: current.depth + 1 });
      }
    }

    // Traverse incoming edges
    const inEdges = incoming.get(current.nodeId) ?? [];
    for (const edge of inEdges) {
      if (!visited.has(edge.source)) {
        visited.add(edge.source);
        queue.push({ nodeId: edge.source, depth: current.depth + 1 });
      }
    }
  }

  // Categorize affected nodes by type
  const affectedModules: string[] = [];
  const affectedInvariants: string[] = [];
  const affectedPolicies: string[] = [];
  const affectedCapabilities: string[] = [];
  const affectedRoutes: string[] = [];
  const affectedFlows: string[] = [];

  for (const node of affectedNodes) {
    switch (node.type) {
      case 'module':
        affectedModules.push(node.name);
        break;
      case 'invariant':
        affectedInvariants.push(node.name);
        break;
      case 'policy':
        affectedPolicies.push(node.name);
        break;
      case 'capability':
        affectedCapabilities.push(node.name);
        break;
      case 'route':
        affectedRoutes.push(node.name);
        break;
      case 'flow':
        affectedFlows.push(node.name);
        break;
    }
  }

  // Sort all arrays for deterministic output
  affectedModules.sort();
  affectedInvariants.sort();
  affectedPolicies.sort();
  affectedCapabilities.sort();
  affectedRoutes.sort();
  affectedFlows.sort();

  // Generate test file paths for affected capabilities
  const allAffectedCaps = [...affectedCapabilities];
  if (targetNode.type === 'capability') {
    allAffectedCaps.push(targetNode.name);
    allAffectedCaps.sort();
  }
  const affectedTests = allAffectedCaps.map(
    (capName) => `tests/capabilities/${capName}.test.ts`
  );

  // Generate artifact paths for all affected nodes + target
  const allAffected = [targetNode, ...affectedNodes];
  const generatedArtifacts = allAffected
    .map((node) => `generated/${node.type}/${node.name}.ts`)
    .sort();

  return {
    target,
    targetType: targetNode.type,
    affectedModules,
    affectedInvariants,
    affectedPolicies,
    affectedCapabilities,
    affectedRoutes,
    affectedFlows,
    affectedTests,
    generatedArtifacts,
  };
}
