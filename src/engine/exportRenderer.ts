import { toPng } from 'html-to-image';
import type { ArchNode, ArchEdge } from '../types';
import { getComponentDefinition } from '../data/componentLibrary';

export async function captureArchitectureAsImage(nodes: ArchNode[], edges: ArchEdge[]): Promise<string> {
  if (nodes.length === 0) throw new Error('No nodes to export');

  // 1. Calculate Bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const nodeDimensions = new Map<string, { w: number, h: number }>();

  nodes.forEach(node => {
    // Default fallback sizes if React Flow hasn't measured it
    const w = node.measured?.width || 180;
    const h = node.measured?.height || 65;
    nodeDimensions.set(node.id, { w, h });

    if (node.position.x < minX) minX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
    if (node.position.x + w > maxX) maxX = node.position.x + w;
    if (node.position.y + h > maxY) maxY = node.position.y + h;
  });

  const padding = 100;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const width = maxX - minX;
  const height = maxY - minY;

  // 2. Create underneath container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.zIndex = '-9999';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.backgroundColor = '#0f111a'; // archviz midnight background
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  container.style.overflow = 'hidden';

  // 3. Create SVG for Edges
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.pointerEvents = 'none';

  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const sDim = nodeDimensions.get(edge.source)!;
    const tDim = nodeDimensions.get(edge.target)!;

    // Simple center-to-center routing
    const x1 = (sourceNode.position.x - minX) + sDim.w / 2;
    const y1 = (sourceNode.position.y - minY) + sDim.h / 2;
    const x2 = (targetNode.position.x - minX) + tDim.w / 2;
    const y2 = (targetNode.position.y - minY) + tDim.h / 2;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1.toString());
    line.setAttribute('y1', y1.toString());
    line.setAttribute('x2', x2.toString());
    line.setAttribute('y2', y2.toString());
    line.setAttribute('stroke', '#334155'); // slate-700
    line.setAttribute('stroke-width', '2');
    if (edge.animated) {
      line.setAttribute('stroke-dasharray', '5,5');
    }
    svg.appendChild(line);
  });
  container.appendChild(svg);

  // 4. Create Node Elements
  nodes.forEach(node => {
    const dim = nodeDimensions.get(node.id)!;
    const nodeEl = document.createElement('div');
    nodeEl.style.position = 'absolute';
    nodeEl.style.left = `${node.position.x - minX}px`;
    nodeEl.style.top = `${node.position.y - minY}px`;
    nodeEl.style.width = `${dim.w}px`;
    // nodeEl.style.height = `${dim.h}px`; // allow text to define height if needed, or fix it
    
    // Styling matching the dark node theme
    nodeEl.style.backgroundColor = '#1e293b'; // slate-800
    nodeEl.style.border = '1px solid #475569'; // slate-600
    nodeEl.style.borderRadius = '8px';
    nodeEl.style.padding = '12px 16px';
    nodeEl.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.5)';
    nodeEl.style.display = 'flex';
    nodeEl.style.flexDirection = 'column';
    nodeEl.style.gap = '4px';
    
    const def = getComponentDefinition(node.data.componentType);
    
    // Label
    const label = document.createElement('div');
    label.style.color = '#f8fafc'; // slate-50
    label.style.fontWeight = 'bold';
    label.style.fontSize = '14px';
    label.textContent = node.data.label;
    nodeEl.appendChild(label);

    // Subtitle / Provider
    const sub = document.createElement('div');
    sub.style.color = '#94a3b8'; // slate-400
    sub.style.fontSize = '10px';
    sub.style.textTransform = 'uppercase';
    sub.style.letterSpacing = '0.5px';
    const category = def?.category || 'Service';
    // Just display category as subtitle
    sub.textContent = `${category.toUpperCase()}`;
    nodeEl.appendChild(sub);
    
    // Badge status if simulated
    if (node.data.healthStatus && node.data.healthStatus !== 'healthy') {
        const badge = document.createElement('div');
        badge.style.marginTop = '4px';
        badge.style.fontSize = '10px';
        badge.style.padding = '2px 6px';
        badge.style.borderRadius = '4px';
        badge.style.alignSelf = 'flex-start';
        if (node.data.healthStatus === 'warning') {
            badge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
            badge.style.color = '#f59e0b';
            badge.textContent = 'WARNING';
        } else {
            badge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            badge.style.color = '#ef4444';
            badge.textContent = 'CRITICAL';
        }
        nodeEl.appendChild(badge);
    }

    container.appendChild(nodeEl);
  });

  document.body.appendChild(container);

  try {
    // Let the DOM fully paint before resolving the image block
    await new Promise(resolve => setTimeout(resolve, 200));

    // 5. Capture with html-to-image
    const dataUrl = await toPng(container, {
      quality: 1,
      pixelRatio: 2,
      skipFonts: true
    });
    return dataUrl;
  } finally {
    // Cleanup
    document.body.removeChild(container);
  }
}
