/**
 * Region Utilities
 * Parses region labels into normalized geographical zones to calculate 
 * inter-region ping penalties and cost multipliers.
 */

export type GeoZone = 'na-east' | 'na-west' | 'eu' | 'ap-south' | 'ap-east' | 'sa' | 'unknown';

export function getGeoZone(regionLabel: string | undefined): GeoZone {
  if (!regionLabel) return 'na-east'; // Default
  const lower = regionLabel.toLowerCase();
  
  if (lower.includes('london') || lower.includes('ireland') || lower.includes('frankfurt') || lower.includes('eu-') || lower.includes('stockholm')) return 'eu';
  if (lower.includes('virginia') || lower.includes('us-east') || lower.includes('canada')) return 'na-east';
  if (lower.includes('oregon') || lower.includes('us-west')) return 'na-west';
  if (lower.includes('são paulo') || lower.includes('sa-east')) return 'sa';
  if (lower.includes('mumbai') || lower.includes('ap-south')) return 'ap-south';
  if (lower.includes('singapore') || lower.includes('tokyo') || lower.includes('ap-') || lower.includes('sydney')) return 'ap-east';
  
  return 'unknown';
}

export function getCrossRegionLatency(zoneA: GeoZone, zoneB: GeoZone): number {
  if (zoneA === zoneB) return 0;
  
  // Create a symmetric dictionary
  const pair = [zoneA, zoneB].sort().join(':');
  
  const latencyMap: Record<string, number> = {
    'eu:na-east': 80,
    'eu:na-west': 130,
    'eu:sa': 200,
    'ap-south:eu': 130,
    'ap-east:eu': 220,
    
    'na-east:na-west': 60,
    'na-east:sa': 110,
    'ap-south:na-east': 180,
    'ap-east:na-east': 160,
    
    'na-west:sa': 150,
    'ap-south:na-west': 200,
    'ap-east:na-west': 110,
    
    'ap-east:sa': 300,
    'ap-south:sa': 280,
    
    'ap-east:ap-south': 70,
  };
  
  return latencyMap[pair] || 150; // Fallback 150ms for unknown crossing
}

export function getRegionalPricingMultiplier(zone: GeoZone): number {
  switch (zone) {
    case 'na-east': return 1.0;
    case 'na-west': return 1.0;
    case 'eu': return 1.04;
    case 'ap-south': return 1.06;
    case 'ap-east': return 1.12;
    case 'sa': return 1.35;
    default: return 1.0;
  }
}
