import dagre from '@dagrejs/dagre';
import type { ArchNode, ArchEdge } from '../types';

export type LayoutDirection = 'LR' | 'TB';

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;   // horizontal gap between ranks
  nodeSep?: number;   // vertical gap between nodes in same rank
}

/**
 * Applies a DAG (Directed Acyclic Graph) layout to the given nodes/edges
 * using the dagre algorithm. Returns a new array of nodes with updated positions.
 */
export function applyAutoLayout(
  nodes: ArchNode[],
  edges: ArchEdge[],
  options: LayoutOptions = {}
): ArchNode[] {
  const {
    direction = 'LR',
    nodeWidth = 180,
    nodeHeight = 80,
    rankSep = 100,
    nodeSep = 60,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 40,
    marginy: 40,
  });

  // Only layout non-group nodes (group nodes stay as-is or are handled separately)
  const layoutNodes = nodes.filter(n => n.type !== 'groupNode');
  const groupNodes = nodes.filter(n => n.type === 'groupNode');

  for (const node of layoutNodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of edges) {
    // Only add edges where both source and target are in the layout set
    const hasSource = layoutNodes.some(n => n.id === edge.source);
    const hasTarget = layoutNodes.some(n => n.id === edge.target);
    if (hasSource && hasTarget) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const layoutMap = new Map<string, { x: number; y: number }>();
  for (const nodeId of g.nodes()) {
    const pos = g.node(nodeId);
    if (pos) {
      layoutMap.set(nodeId, {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      });
    }
  }

  const updatedNodes = nodes.map(node => {
    const newPos = layoutMap.get(node.id);
    if (newPos) {
      return { ...node, position: newPos };
    }
    return node;
  });

  return updatedNodes;
}
