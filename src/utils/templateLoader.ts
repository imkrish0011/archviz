import type { ArchNode, ArchEdge, Template, TemplateNodeDef } from '../types';
import { getComponentDefinition } from '../data/componentLibrary';
import { famousSystemTemplates } from '../data/templates/famousSystemTemplates';
import { starterTemplates } from '../data/templates/starterTemplates';

export function getAllTemplates(): Template[] {
  return [...famousSystemTemplates, ...starterTemplates];
}

export function getTemplateById(id: string): Template | undefined {
  return getAllTemplates().find(t => t.id === id);
}

function createNodeFromDef(def: TemplateNodeDef): ArchNode | null {
  const compDef = getComponentDefinition(def.componentType);
  if (!compDef) return null;
  
  const tierIndex = def.tierIndex ?? compDef.defaultTierIndex;
  const tier = compDef.tiers[tierIndex] || compDef.tiers[compDef.defaultTierIndex];
  
  return {
    id: def.id,
    type: 'archNode',
    position: def.position,
    data: {
      componentType: compDef.type,
      label: compDef.label,
      category: compDef.category,
      icon: compDef.icon,
      tier,
      tierIndex,
      instances: def.instances ?? 1,
      scalingType: compDef.scalingType,
      reliability: compDef.reliability,
      scalingFactor: compDef.scalingFactor,
      cacheHitRate: def.cacheHitRate,
      architecturalNote: def.architecturalNote,
      healthStatus: 'healthy',
      loadPercent: 0,
    },
  };
}

/**
 * Converts a Template into ArchNodes and ArchEdges.
 * Returns them as arrays ready for the store.
 */
export function instantiateTemplate(template: Template): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  
  for (const nodeDef of template.nodes) {
    const node = createNodeFromDef(nodeDef);
    if (node) nodes.push(node);
  }
  
  for (const edgeDef of template.edges) {
    edges.push({
      id: edgeDef.id,
      source: edgeDef.source,
      target: edgeDef.target,
      animated: true,
    });
  }
  
  return { nodes, edges };
}

/**
 * Loads a template with staggered node animation.
 * Nodes appear one by one with a delay.
 */
export function loadTemplateWithAnimation(
  template: Template,
  setNodes: (nodes: ArchNode[]) => void,
  setEdges: (edges: ArchEdge[]) => void,
  onComplete?: () => void
): () => void {
  const { nodes, edges } = instantiateTemplate(template);
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  
  // Start with empty, then add nodes one by one
  setNodes([]);
  setEdges([]);
  
  nodes.forEach((_node, index) => {
    const timeout = setTimeout(() => {
      setNodes(nodes.slice(0, index + 1));
      
      // When all nodes are loaded, add edges
      if (index === nodes.length - 1) {
        const edgeTimeout = setTimeout(() => {
          setEdges(edges);
          onComplete?.();
        }, 150);
        timeouts.push(edgeTimeout);
      }
    }, index * 80); // 80ms stagger per node
    
    timeouts.push(timeout);
  });
  
  // Return cleanup function
  return () => timeouts.forEach(clearTimeout);
}
