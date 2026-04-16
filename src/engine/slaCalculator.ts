import type { ArchNode, ArchEdge, SLAResult, SLAPathSegment } from '../types';

/**
 * SLA / SLO Calculator — Math-driven Composite Availability
 *
 * Uses graph topology to determine serial vs parallel paths.
 * Serial:   SLA_composite = SLA_A × SLA_B × SLA_C
 * Parallel: SLA_composite = 1 - ∏(1 - SLA_i) for each parallel instance
 *
 * Instance redundancy (horizontal scaling) is treated as parallel.
 */

// ── SLA data for components (inherent SLA from cloud providers) ──
const INHERENT_SLA: Record<string, number> = {
  'client-browser':     1.0,
  'mobile-app':         1.0,
  'external-api':       0.99,
  'auth0':              0.9999,
  'aws-cognito':        0.999,
  'hashicorp-vault':    0.9995,
  'openai-api':         0.98,
  'stripe-api':         0.9999,
  'api-server':         0.995,
  'web-server':         0.995,
  'worker':             0.99,
  'lambda':             0.9995,
  'websocket-server':   0.99,
  'ecs-fargate':        0.999,
  'app-runner':         0.999,
  'kubernetes-cluster': 0.9995,
  'cloudflare-workers': 0.9999,
  'graphql-server':     0.99,
  'game-server':        0.995,
  'ml-worker':          0.98,
  'batch':              0.99,
  'postgresql':         0.995,
  'mysql':              0.995,
  'mongodb':            0.99,
  'cassandra':          0.999,
  'dynamodb':           0.9999,
  'aurora-serverless':  0.9999,
  'redis':              0.995,
  's3':                 0.9999,
  'elasticsearch':      0.99,
  'bigtable':           0.9999,
  'pinecone':           0.999,
  'snowflake':          0.9999,
  'load-balancer':      0.9999,
  'cdn':                0.9999,
  'api-gateway':        0.9999,
  'nat-gateway':        0.9999,
  'dns':                1.0,
  'waf':                0.9999,
  'aws-waf':            0.9995,
  'transit-gateway':    0.9999,
  'sqs':                0.9999,
  'amazon-sqs':         0.9999,
  'sns':                0.9999,
  'kafka':              0.999,
  'message-queue':      0.999,
  'rabbitmq':           0.999,
  'cloudwatch':         0.9999,
  'datadog':            0.999,
};

/**
 * Calculate the effective SLA for a single node taking into account:
 * 1. Inherent cloud SLA
 * 2. Instance redundancy (horizontal scaling = parallel)
 * 3. Multi-AZ boost
 * 4. DR strategy boost
 * 5. Spot instance penalty
 */
function getEffectiveNodeSLA(node: ArchNode): number {
  let baseSLA = INHERENT_SLA[node.data.componentType] ?? node.data.reliability;

  // Spot instance penalty — unreliable
  if (node.data.pricingModel === 'spot') {
    baseSLA *= 0.90;
  }

  // Instance redundancy (parallel formula)
  const instances = node.data.scalingType === 'horizontal' ? node.data.instances : 1;
  if (instances > 1) {
    // P(all fail) = (1-SLA)^n, so effective = 1 - (1-SLA)^n
    const failProb = Math.pow(1 - baseSLA, instances);
    baseSLA = 1 - failProb;
  }

  // Multi-AZ boost
  if (node.data.multiAZ) {
    baseSLA = 1 - (1 - baseSLA) * 0.1; // 10x reduction in failure probability
  }

  // DR strategy boosts
  if (node.data.drStrategy === 'active-active') {
    baseSLA = 1 - (1 - baseSLA) * 0.01; // 100x reduction
  } else if (node.data.drStrategy === 'active-passive') {
    baseSLA = 1 - (1 - baseSLA) * 0.2; // 5x reduction
  }

  return Math.min(1, baseSLA);
}

/**
 * Convert SLA to "nines" notation
 * 99% = 2 nines, 99.9% = 3 nines, 99.99% = 4 nines, etc.
 */
function calculateNines(sla: number): string {
  if (sla >= 1) return '∞ nines';
  if (sla <= 0) return '0 nines';

  const nines = -Math.log10(1 - sla);
  if (nines >= 5) return `${nines.toFixed(1)} nines (99.999%+)`;
  if (nines >= 4) return `${nines.toFixed(1)} nines`;
  if (nines >= 3) return `${nines.toFixed(1)} nines`;
  if (nines >= 2) return `${nines.toFixed(1)} nines`;
  return `${nines.toFixed(2)} nines`;
}

/**
 * Convert SLA to human-readable downtime
 */
function calculateDowntime(sla: number, periodMinutes: number): string {
  const downtimeMinutes = (1 - sla) * periodMinutes;

  if (downtimeMinutes < 1) {
    return `${(downtimeMinutes * 60).toFixed(0)}s`;
  }
  if (downtimeMinutes < 60) {
    return `${downtimeMinutes.toFixed(1)}m`;
  }
  const hours = Math.floor(downtimeMinutes / 60);
  const mins = Math.round(downtimeMinutes % 60);
  if (hours < 24) {
    return `${hours}h ${mins}m`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

/**
 * Find the critical path through the architecture.
 * Uses BFS from entry points (clients, DNS, LB) to leaf nodes.
 * The critical path is the longest serial chain of dependencies.
 */
function findCriticalPaths(
  nodes: ArchNode[],
  edges: ArchEdge[]
): string[][] {
  const active = nodes.filter(n => !n.data.isDisabled && !n.data.isFailed);
  const nodeMap = new Map(active.map(n => [n.id, n]));

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const node of active) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      adj.get(edge.source)?.push(edge.target);
    }
  }

  // Find entry nodes (no incoming edges, or client/network entry points)
  const entryTypes = ['client-browser', 'mobile-app', 'dns', 'cdn', 'load-balancer', 'external-api'];
  const hasIncoming = new Set(edges.filter(e => nodeMap.has(e.target)).map(e => e.target));

  let entryNodes = active.filter(n => entryTypes.includes(n.data.componentType));
  if (entryNodes.length === 0) {
    entryNodes = active.filter(n => !hasIncoming.has(n.id));
  }
  if (entryNodes.length === 0 && active.length > 0) {
    entryNodes = [active[0]];
  }

  // BFS to find all paths
  const allPaths: string[][] = [];

  for (const entry of entryNodes) {
    const queue: string[][] = [[entry.id]];
    const maxPaths = 20;
    let pathCount = 0;

    while (queue.length > 0 && pathCount < maxPaths) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      const neighbors = adj.get(current) || [];

      if (neighbors.length === 0 || path.length > 15) {
        allPaths.push(path);
        pathCount++;
        continue;
      }

      for (const next of neighbors) {
        if (!path.includes(next)) {
          queue.push([...path, next]);
        }
      }
    }
  }

  return allPaths;
}

// ═══════════════════════════════════════════════════════════════
// MAIN CALCULATOR
// ═══════════════════════════════════════════════════════════════

export function calculateSLA(nodes: ArchNode[], edges: ArchEdge[]): SLAResult {
  const active = nodes.filter(n => !n.data.isDisabled && !n.data.isFailed);

  if (active.length === 0) {
    return {
      compositeSLA: 1,
      nines: '∞ nines',
      downtimePerYear: '0s',
      downtimePerMonth: '0s',
      pathBreakdown: [],
      weakestLink: null,
    };
  }

  // Calculate individual effective SLAs
  const effectiveSLAs = new Map<string, number>();
  const pathBreakdown: SLAPathSegment[] = [];
  let weakestNode: { label: string; sla: number } | null = null;

  for (const node of active) {
    const inherent = INHERENT_SLA[node.data.componentType] ?? node.data.reliability;
    const effective = getEffectiveNodeSLA(node);
    effectiveSLAs.set(node.id, effective);

    pathBreakdown.push({
      nodeId: node.id,
      label: node.data.label,
      componentSLA: inherent,
      effectiveSLA: effective,
    });

    if (!weakestNode || effective < weakestNode.sla) {
      weakestNode = { label: node.data.label, sla: effective };
    }
  }

  // Find critical paths
  const paths = findCriticalPaths(nodes, edges);

  let compositeSLA: number;

  if (paths.length === 0) {
    // No paths → multiply all SLAs (treat as serial)
    compositeSLA = 1;
    for (const sla of effectiveSLAs.values()) {
      compositeSLA *= sla;
    }
  } else {
    // Calculate SLA for each path (serial multiplication within path)
    const pathSLAs: number[] = [];

    for (const path of paths) {
      let pathSLA = 1;
      for (const nodeId of path) {
        const sla = effectiveSLAs.get(nodeId);
        if (sla !== undefined) {
          pathSLA *= sla;
        }
      }
      pathSLAs.push(pathSLA);
    }

    // If multiple paths exist to the same destination → parallel (best case)
    // The overall SLA is the worst critical path SLA
    // (a system is as reliable as its weakest path)
    compositeSLA = Math.min(...pathSLAs);
  }

  // Clamp
  compositeSLA = Math.max(0, Math.min(1, compositeSLA));

  const MINUTES_PER_YEAR = 365.25 * 24 * 60;
  const MINUTES_PER_MONTH = 30.44 * 24 * 60;

  return {
    compositeSLA,
    nines: calculateNines(compositeSLA),
    downtimePerYear: calculateDowntime(compositeSLA, MINUTES_PER_YEAR),
    downtimePerMonth: calculateDowntime(compositeSLA, MINUTES_PER_MONTH),
    pathBreakdown: pathBreakdown.sort((a, b) => a.effectiveSLA - b.effectiveSLA),
    weakestLink: weakestNode,
  };
}

/**
 * Format SLA as a percentage string
 */
export function formatSLA(sla: number): string {
  if (sla >= 0.9999) return `${(sla * 100).toFixed(3)}%`;
  if (sla >= 0.999) return `${(sla * 100).toFixed(2)}%`;
  if (sla >= 0.99) return `${(sla * 100).toFixed(1)}%`;
  return `${(sla * 100).toFixed(0)}%`;
}
