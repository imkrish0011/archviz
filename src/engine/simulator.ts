import type { ArchNode, ArchEdge, SimulationConfig, SystemMetrics, LetterGrade } from '../types';
import { calculateRPSFromUsers, calculateDBLoads } from './trafficModel';
import { calculateTotalLatency } from './latencyModel';
import { calculateTotalCost } from './costEngine';
import { calculateSystemReliability, calculateAvailability } from './failureModel';
import { detectBottlenecks, calculateNodeLoads, calculateLoadPercent, getHealthStatus } from './bottleneckDetector';
import { generateRecommendations, generateWarnings } from './recommendationEngine';
import { calculateSLA } from './slaCalculator';

/**
 * Simulator — Orchestrator
 * Runs all engine modules and produces SystemMetrics.
 */

function getLetterGrade(score: number): LetterGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function runSimulation(
  nodes: ArchNode[],
  edges: ArchEdge[],
  config: SimulationConfig
): { metrics: SystemMetrics; nodeLoads: Map<string, number>; nodeHealth: Map<string, { loadPercent: number; status: string }> } {
  // 1. Calculate RPS
  const rps = calculateRPSFromUsers(config.concurrentUsers, config.rpsMultiplier);
  
  // 2. Calculate DB loads (considering cache)
  const dbLoads = calculateDBLoads(nodes, rps, config.cacheHitRate);
  
  // 3. Calculate per-node loads
  const nodeLoads = calculateNodeLoads(nodes, edges, rps, dbLoads);
  
  // 4. Calculate total cost
  const totalCost = calculateTotalCost(nodes);
  
  // 5. Calculate total latency
  const estimatedLatency = calculateTotalLatency(nodes, edges, nodeLoads);
  
  // 6. Calculate reliability & availability
  const reliability = calculateSystemReliability(nodes, edges);
  const availability = calculateAvailability(reliability);
  
  // 7. Detect bottlenecks
  const bottlenecks = detectBottlenecks(nodes, nodeLoads);
  
  // 8. Generate warnings
  const warnings = generateWarnings(nodes, edges, rps, nodeLoads);
  
  // 9. Generate recommendations
  const recommendations = generateRecommendations(nodes, edges, rps, nodeLoads, totalCost);
  
  // 10. Calculate health score (0-100)
  let healthScore = 100;
  
  // Penalize for bottlenecks
  for (const bn of bottlenecks) {
    if (bn.status === 'critical') healthScore -= 15;
    else if (bn.status === 'warning') healthScore -= 5;
  }
  
  // Penalize for warnings
  healthScore -= warnings.filter(w => w.type === 'critical').length * 10;
  healthScore -= warnings.filter(w => w.type === 'warning').length * 5;
  
  // Penalize for low availability
  if (availability < 99.9) healthScore -= 10;
  if (availability < 99) healthScore -= 15;
  
  // Penalize for high latency
  if (estimatedLatency > 500) healthScore -= 10;
  if (estimatedLatency > 1000) healthScore -= 15;
  
  // Bonus for good architecture practices
  const activeNodes = nodes.filter(n => !n.data.isDisabled && !n.data.isFailed);
  if (activeNodes.some(n => n.data.componentType === 'load-balancer')) healthScore += 5;
  if (activeNodes.some(n => n.data.componentType === 'redis')) healthScore += 5;
  if (activeNodes.some(n => n.data.componentType === 'cdn')) healthScore += 3;
  
  healthScore = Math.max(0, Math.min(100, healthScore));
  
  // 11. Calculate throughput (max RPS the system can handle)
  const activeComputeNodes = activeNodes.filter(n => 
    ['api-server', 'web-server', 'websocket-server'].includes(n.data.componentType)
  );
  const throughput = activeComputeNodes.reduce((sum, n) => {
    return sum + n.data.tier.capacity * n.data.instances;
  }, 0) || rps;
  
  // Calculate per-node health
  const nodeHealth = new Map<string, { loadPercent: number; status: string }>();
  for (const node of nodes) {
    const load = nodeLoads.get(node.id) || 0;
    const loadPercent = calculateLoadPercent(load, node.data.tier.capacity, node.data.instances);
    const status = getHealthStatus(loadPercent);
    nodeHealth.set(node.id, { loadPercent, status });
  }
  
  // 12. Calculate advanced SLA
  const slaResult = calculateSLA(nodes, edges);

  const metrics: SystemMetrics = {
    totalCost,
    estimatedLatency,
    healthScore,
    letterGrade: getLetterGrade(healthScore),
    throughput,
    availability,
    compositeSLA: slaResult.compositeSLA,
    nines: slaResult.nines,
    downtimePerYear: slaResult.downtimePerYear,
    downtimePerMonth: slaResult.downtimePerMonth,
    bottlenecks,
    warnings,
    recommendations,
  };
  
  return { metrics, nodeLoads, nodeHealth };
}
