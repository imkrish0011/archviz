import type { Node, Edge } from '@xyflow/react';

// ─── Component Types ─────────────────────────────────────────
export type ComponentCategory = 'client' | 'compute' | 'storage' | 'network' | 'messaging' | 'observability' | 'boundary' | 'deployment' | 'security' | 'pipeline' | 'meta';
export type ScalingType = 'horizontal' | 'vertical';
export type HealthStatus = 'healthy' | 'warning' | 'critical';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type CloudProvider = 'aws' | 'gcp' | 'azure';

export interface ComponentTier {
  id: string;
  label: string;
  monthlyCost: number;
  capacity: number;    // requests per second
  latency: number;     // ms
  ram?: string;
  cpu?: string;
  costPerMillionRequests?: number;
  pricingOffsets?: {   // Multiplier used for arbitrage (e.g. 1.1 for 10% more expensive)
    gcp?: number;
    azure?: number;
  };
}

export interface ComponentDefinition {
  type: string;
  label: string;
  category: ComponentCategory;
  icon: string;         // lucide icon name
  description: string;
  tiers: ComponentTier[];
  defaultTierIndex: number;
  scalingType: ScalingType;
  reliability: number;  // 0–1
  scalingFactor: number;
  baseLatency: number;
  architecturalNote?: string;
}

export interface ArchNodeData {
  componentType: string;
  label: string;
  category: ComponentCategory;
  icon: string;
  tier: ComponentTier;
  tierIndex: number;
  instances: number;
  scalingType: ScalingType;
  reliability: number;
  scalingFactor: number;
  cacheHitRate?: number;
  architecturalNote?: string;
  healthStatus: HealthStatus;
  loadPercent: number;
  isFailed?: boolean;
  isDisabled?: boolean;
  
  // Blue/Green Deployment
  appVersion?: 'v1' | 'v2';
  isDeploymentClone?: boolean;
  
  // Group / Boundary
  isGroup?: boolean;
  
  // Advanced Configurations
  pricingModel?: 'on-demand' | 'savings-1yr' | 'reserved-3yr' | 'spot';
  volumeType?: 'gp3' | 'io1' | 'magnetic';
  dataResidency?: 'global' | 'strict-eu' | 'strict-us';
  drStrategy?: 'none' | 'active-passive' | 'active-active';

  // Auth Specific
  mfaEnabled?: boolean;
  sessionStrategy?: 'stateful' | 'stateless' | 'cookie';
  
  // Security / Hierarchy
  securityContext?: string;
  parentId?: string;

  // Server Specific
  scalingPolicy?: 'cpu-70' | 'mem-80' | 'custom';
  containerRuntime?: 'docker' | 'containerd' | 'firecracker';
  strictTls?: boolean;
  
  [key: string]: unknown;
}

export type ArchNode = Node<ArchNodeData>;

// ─── Edge Configuration ──────────────────────────────────────
export type ConnectionType = 'sync-http' | 'async-event' | 'firewall-boundary' | 'default';

export interface EdgeConfig {
  protocol?: 'HTTPS' | 'gRPC' | 'WebSocket' | 'TCP' | 'AMQP' | 'Custom';
  connectionType?: ConnectionType;
  iamAction?: string;
  dataFlow?: 'request' | 'response' | 'bidirectional' | 'event';
  bandwidth?: string;
  encrypted?: boolean;
  edgeLabel?: string;
  payloadSizeBytes?: number;
  isCrossAZ?: boolean;
  trafficWeight?: number; // 0-100, used during Blue/Green deployments
}

export type ArchEdge = Edge & { config?: EdgeConfig };

// ─── Simulation Types ────────────────────────────────────────
export interface SimulationConfig {
  concurrentUsers: number;
  rpsMultiplier: number;
  cacheHitRate: number;
}

export type SimulationEvent = 
  | 'serverCrash' 
  | 'removeCache' 
  | 'trafficSpike' 
  | 'cdnFailure' 
  | 'dbFailover'
  | 'regionOutage';

export interface Bottleneck {
  nodeId: string;
  label: string;
  loadPercent: number;
  status: HealthStatus;
}

export interface Warning {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  recommendationId?: string;
}

export interface Recommendation {
  id: string;
  reason: string;
  expectedImprovement: string;
  costImpact: string;
  severity: 'high' | 'medium' | 'low';
  componentToAdd?: string;
  solution?: string;
  insight?: string;
}

export interface SystemMetrics {
  totalCost: number;
  estimatedLatency: number;
  healthScore: number;
  letterGrade: LetterGrade;
  throughput: number;
  availability: number;
  compositeSLA: number;
  nines: string;
  downtimePerYear: string;
  downtimePerMonth: string;
  bottlenecks: Bottleneck[];
  warnings: Warning[];
  recommendations: Recommendation[];
}

// ─── Security Types ──────────────────────────────────────────
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityFinding {
  id: string;
  severity: SecuritySeverity;
  title: string;
  description: string;
  remediation: string;
  compliance: string[];       // e.g. ['SOC2', 'HIPAA', 'PCI-DSS']
  affectedNodeIds: string[];
}

export interface SecurityReport {
  findings: SecurityFinding[];
  score: number;              // 0-100
  grade: LetterGrade;
}

// ─── SLA Types ───────────────────────────────────────────────
export interface SLAPathSegment {
  nodeId: string;
  label: string;
  componentSLA: number;
  effectiveSLA: number;       // after instances/multi-AZ
}

export interface SLAResult {
  compositeSLA: number;
  nines: string;
  downtimePerYear: string;
  downtimePerMonth: string;
  pathBreakdown: SLAPathSegment[];
  weakestLink: { label: string; sla: number } | null;
}

// ─── Snapshot Types ──────────────────────────────────────────
export interface Snapshot {
  id: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
  timestamp: number;
  label: string;
  healthScore: number;
  monthlyCost: number;
  simulationConfig: SimulationConfig;
}

// ─── Template Types ──────────────────────────────────────────
export type TemplateCategory = 'famous' | 'starter' | 'snippet';

export interface TemplateNodeDef {
  id: string;
  type: string;
  position: { x: number; y: number };
  componentType: string;
  tierIndex?: number;
  instances?: number;
  cacheHitRate?: number;
  architecturalNote?: string;
}

export interface TemplateEdgeDef {
  id: string;
  source: string;
  target: string;
}

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  keyInsight: string;
  baselineCost: number;
  nodeCount: number;
  nodes: TemplateNodeDef[];
  edges: TemplateEdgeDef[];
}

// ─── Cloud Project Types ──────────────────────────────────────
export interface CloudProject {
  id: string;
  uid: string;
  name: string;
  thumbnail?: string;
  nodeCount: number;
  edgeCount: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
