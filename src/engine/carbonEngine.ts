import type { ArchNode } from '../types';

/**
 * Carbon Engine
 * Maps cloud regions to estimated carbon intensity and calculates
 * per-node monthly CO2 footprint based on tier and location.
 */

// gCO2eq per kWh — approximate grid carbon intensity by AWS region
const regionCarbonIntensity: Record<string, { gCO2perKWh: number; label: string; rating: 'low' | 'medium' | 'high' }> = {
  // Low carbon (hydro/nuclear/wind dominant)
  'eu-north-1':    { gCO2perKWh: 8,   label: 'Stockholm',    rating: 'low' },
  'ca-central-1':  { gCO2perKWh: 30,  label: 'Canada',       rating: 'low' },
  'eu-west-1':     { gCO2perKWh: 45,  label: 'Ireland',      rating: 'low' },
  'us-west-2':     { gCO2perKWh: 50,  label: 'Oregon',       rating: 'low' },
  
  // Medium carbon
  'eu-west-2':     { gCO2perKWh: 230, label: 'London',       rating: 'medium' },
  'eu-central-1':  { gCO2perKWh: 340, label: 'Frankfurt',    rating: 'medium' },
  'ap-northeast-1':{ gCO2perKWh: 400, label: 'Tokyo',        rating: 'medium' },
  'ap-southeast-1':{ gCO2perKWh: 410, label: 'Singapore',    rating: 'medium' },
  
  // High carbon (coal/gas dominant)
  'us-east-1':     { gCO2perKWh: 380, label: 'N. Virginia',  rating: 'high' },
  'us-east-2':     { gCO2perKWh: 450, label: 'Ohio',         rating: 'high' },
  'ap-south-1':    { gCO2perKWh: 700, label: 'Mumbai',       rating: 'high' },
  'ap-southeast-2':{ gCO2perKWh: 600, label: 'Sydney',       rating: 'high' },
};

// Default carbon intensity when region is unknown
const DEFAULT_CARBON = { gCO2perKWh: 380, label: 'Unknown', rating: 'high' as const };

/**
 * Estimate vCPU count from tier label
 */
function estimateVCPUs(node: ArchNode): number {
  const cpu = node.data.tier.cpu;
  if (cpu) {
    const match = cpu.match(/(\d+)/);
    if (match) return parseInt(match[1]);
  }
  // Fallback based on component type
  const type = node.data.componentType;
  if (['lambda', 'cloudflare-workers'].includes(type)) return 0.25; // Serverless = fractional
  if (['gpu-instance', 'ml-worker'].includes(type)) return 8;
  if (type === 'kubernetes-cluster') return 4;
  return 2; // Default
}

/**
 * Estimate monthly power consumption in kWh for a node
 * Based on: vCPUs × PUE × hours × TDP-per-core
 */
function estimateMonthlyKWh(node: ArchNode): number {
  const vcpus = estimateVCPUs(node);
  const instances = node.data.instances || 1;
  
  // ~7W per vCPU average, PUE ~1.2 for cloud DCs
  const wattsPerVCPU = 7;
  const pue = 1.2;
  const hoursPerMonth = 730;
  
  // Serverless gets a huge discount (only runs when invoked)
  const type = node.data.componentType;
  const utilizationFactor = ['lambda', 'cloudflare-workers', 'app-runner'].includes(type) ? 0.05 : 0.6;
  
  // GPU instances consume much more
  const gpuMultiplier = ['gpu-instance', 'ml-worker'].includes(type) ? 8 : 1;
  
  return (vcpus * wattsPerVCPU * pue * hoursPerMonth * utilizationFactor * gpuMultiplier * instances) / 1000;
}

/**
 * Get the region for a node by walking up its parent chain
 */
function getNodeRegion(node: ArchNode, allNodes: ArchNode[]): string {
  // Check if node has a parent group that looks like a region
  let current: ArchNode | undefined = node;
  while (current) {
    const label = current.data.label.toLowerCase();
    // Check if the label contains a region identifier
    for (const regionKey of Object.keys(regionCarbonIntensity)) {
      if (label.includes(regionKey)) return regionKey;
    }
    // Also check common region labels
    if (label.includes('london')) return 'eu-west-2';
    if (label.includes('virginia') || label.includes('us-east')) return 'us-east-1';
    if (label.includes('oregon') || label.includes('us-west')) return 'us-west-2';
    if (label.includes('ireland') || label.includes('eu-west')) return 'eu-west-1';
    if (label.includes('frankfurt') || label.includes('eu-central')) return 'eu-central-1';
    if (label.includes('stockholm') || label.includes('eu-north')) return 'eu-north-1';
    if (label.includes('canada') || label.includes('ca-central')) return 'ca-central-1';
    if (label.includes('tokyo') || label.includes('ap-northeast')) return 'ap-northeast-1';
    if (label.includes('mumbai') || label.includes('ap-south')) return 'ap-south-1';
    
    // Walk up to parent
    const parentId: string | undefined = current.data.parentId as string | undefined;
    current = parentId ? allNodes.find(n => n.id === parentId) : undefined;
  }
  
  return 'us-east-1'; // Default
}

export interface NodeCarbonFootprint {
  nodeId: string;
  label: string;
  region: string;
  regionLabel: string;
  monthlyKWh: number;
  monthlyCO2kg: number;
  rating: 'low' | 'medium' | 'high';
  suggestedRegion?: string;
  potentialSavingsKg?: number;
}

/**
 * Calculate carbon footprint for all nodes
 */
export function calculateCarbonFootprints(nodes: ArchNode[]): NodeCarbonFootprint[] {
  const results: NodeCarbonFootprint[] = [];
  
  for (const node of nodes) {
    if (node.data.componentType === 'groupNode' || node.data.isGroup) continue;
    if (['client-browser', 'mobile-app', 'external-api'].includes(node.data.componentType)) continue;
    
    const region = getNodeRegion(node, nodes);
    const carbonInfo = regionCarbonIntensity[region] || DEFAULT_CARBON;
    const monthlyKWh = estimateMonthlyKWh(node);
    const monthlyCO2kg = (monthlyKWh * carbonInfo.gCO2perKWh) / 1000;
    
    // Find the greenest region
    const greenestRegion = Object.entries(regionCarbonIntensity)
      .sort((a, b) => a[1].gCO2perKWh - b[1].gCO2perKWh)[0];
    
    const potentialCO2 = (monthlyKWh * greenestRegion[1].gCO2perKWh) / 1000;
    
    results.push({
      nodeId: node.id,
      label: node.data.label,
      region,
      regionLabel: carbonInfo.label,
      monthlyKWh,
      monthlyCO2kg: Math.round(monthlyCO2kg * 100) / 100,
      rating: carbonInfo.rating,
      suggestedRegion: carbonInfo.rating !== 'low' ? greenestRegion[0] : undefined,
      potentialSavingsKg: carbonInfo.rating !== 'low' 
        ? Math.round((monthlyCO2kg - potentialCO2) * 100) / 100 
        : undefined,
    });
  }
  
  return results;
}

/**
 * Get total carbon footprint
 */
export function getTotalCarbonFootprint(nodes: ArchNode[]): { totalCO2kg: number; rating: 'low' | 'medium' | 'high' } {
  const footprints = calculateCarbonFootprints(nodes);
  const totalCO2kg = footprints.reduce((sum, f) => sum + f.monthlyCO2kg, 0);
  
  const avgRating = totalCO2kg / Math.max(1, footprints.length);
  const rating: 'low' | 'medium' | 'high' = avgRating < 2 ? 'low' : avgRating < 10 ? 'medium' : 'high';
  
  return { totalCO2kg: Math.round(totalCO2kg * 100) / 100, rating };
}

export function getCarbonHeatmapColor(rating: 'low' | 'medium' | 'high'): string {
  switch (rating) {
    case 'low': return 'rgba(16, 185, 129, 0.15)';    // Subtle green
    case 'medium': return 'rgba(234, 179, 8, 0.15)';   // Subtle yellow
    case 'high': return 'rgba(239, 68, 68, 0.12)';     // Muted red
  }
}

export function getCarbonBorderColor(rating: 'low' | 'medium' | 'high'): string {
  switch (rating) {
    case 'low': return '#10b981';
    case 'medium': return '#eab308';
    case 'high': return '#ef4444';
  }
}

export { regionCarbonIntensity };
