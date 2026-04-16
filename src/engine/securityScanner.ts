import type { ArchNode, ArchEdge, SecurityFinding, SecurityReport, SecuritySeverity, LetterGrade } from '../types';

/**
 * Security Scanner — Enterprise-Grade Architectural Linting
 * 25 rules covering SOC2, HIPAA, PCI-DSS, GDPR, and NIST compliance.
 */

type RuleFn = (nodes: ArchNode[], edges: ArchEdge[], active: ArchNode[]) => SecurityFinding | null;

const DB_TYPES = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless', 'bigtable', 'elasticsearch', 'pinecone', 'snowflake'];
const AUTH_TYPES = ['auth0', 'aws-cognito', 'hashicorp-vault'];
const COMPUTE_TYPES = ['api-server', 'web-server', 'worker', 'lambda', 'websocket-server', 'ecs-fargate', 'app-runner', 'kubernetes-cluster', 'graphql-server', 'game-server', 'ml-worker'];
const QUEUE_TYPES = ['sqs', 'sns', 'kafka', 'message-queue', 'rabbitmq', 'amazon-sqs'];
const OBS_TYPES = ['cloudwatch', 'datadog'];

function hasType(nodes: ArchNode[], types: string[]): boolean {
  return nodes.some(n => types.includes(n.data.componentType));
}

function nodesOfType(nodes: ArchNode[], types: string[]): ArchNode[] {
  return nodes.filter(n => types.includes(n.data.componentType));
}

// ═══════════════════════════════════════════════════════════════
// RULES
// ═══════════════════════════════════════════════════════════════

const rules: { id: string; fn: RuleFn }[] = [
  // ── R1: Database publicly routable ──
  {
    id: 'db-public',
    fn: (_nodes, edges, active) => {
      const clients = nodesOfType(active, ['client-browser', 'mobile-app', 'external-api']);
      const dbs = nodesOfType(active, DB_TYPES);
      const affected: string[] = [];
      
      for (const client of clients) {
        for (const db of dbs) {
          if (edges.some(e => e.source === client.id && e.target === db.id)) {
            affected.push(db.id);
          }
        }
      }
      
      if (affected.length === 0) return null;
      return {
        id: 'db-public', severity: 'critical',
        title: 'Database directly accessible from clients',
        description: 'Client applications connect directly to the database without an intermediary API layer. This exposes the database to the public internet.',
        remediation: 'Route all database access through an API Server or API Gateway. Place databases in private subnets.',
        compliance: ['SOC2', 'HIPAA', 'PCI-DSS', 'NIST'],
        affectedNodeIds: affected,
      };
    },
  },

  // ── R2: No WAF/Firewall ──
  {
    id: 'no-waf',
    fn: (_nodes, _edges, active) => {
      const hasPublicFacing = hasType(active, ['load-balancer', 'api-gateway', 'cdn']);
      const hasWAF = hasType(active, ['waf', 'aws-waf']);
      
      if (!hasPublicFacing || hasWAF) return null;
      const affected = nodesOfType(active, ['load-balancer', 'api-gateway']).map(n => n.id);
      return {
        id: 'no-waf', severity: 'high',
        title: 'No Web Application Firewall detected',
        description: 'Public-facing endpoints lack WAF protection against SQL injection, XSS, DDoS, and bot attacks.',
        remediation: 'Add a WAF/Firewall component in front of your load balancer or API gateway.',
        compliance: ['SOC2', 'PCI-DSS', 'OWASP'],
        affectedNodeIds: affected,
      };
    },
  },

  // ── R3: No encryption at rest ──
  {
    id: 'no-encryption',
    fn: (_nodes, _edges, active) => {
      const storageNodes = nodesOfType(active, [...DB_TYPES, 's3']);
      const unencrypted = storageNodes.filter(n => !n.data.strictTls);
      
      if (unencrypted.length === 0) return null;
      return {
        id: 'no-encryption', severity: 'medium',
        title: 'Data storage without explicit encryption',
        description: `${unencrypted.length} storage component(s) do not have TLS/encryption explicitly enabled. Data at rest may be unprotected.`,
        remediation: 'Enable "Strict TLS" on all storage components in the configuration panel.',
        compliance: ['HIPAA', 'PCI-DSS', 'GDPR', 'SOC2'],
        affectedNodeIds: unencrypted.map(n => n.id),
      };
    },
  },

  // ── R4: No authentication component ──
  {
    id: 'no-auth',
    fn: (_nodes, _edges, active) => {
      const hasCompute = hasType(active, COMPUTE_TYPES);
      const hasAuth = hasType(active, AUTH_TYPES);
      
      if (!hasCompute || hasAuth) return null;
      return {
        id: 'no-auth', severity: 'high',
        title: 'No authentication/authorization service',
        description: 'The architecture has compute resources but no identity provider (Auth0, Cognito, Vault). APIs may be publicly accessible without authentication.',
        remediation: 'Add an Auth0, AWS Cognito, or HashiCorp Vault component for identity management.',
        compliance: ['SOC2', 'HIPAA', 'OWASP', 'NIST'],
        affectedNodeIds: nodesOfType(active, COMPUTE_TYPES).map(n => n.id),
      };
    },
  },

  // ── R5: Single Availability Zone ──
  {
    id: 'single-az',
    fn: (_nodes, _edges, active) => {
      const critical = active.filter(n =>
        [...DB_TYPES, 'api-server', 'web-server', 'load-balancer'].includes(n.data.componentType) &&
        !n.data.multiAZ && n.data.drStrategy !== 'active-active' && n.data.drStrategy !== 'active-passive'
      );
      
      if (critical.length === 0) return null;
      return {
        id: 'single-az', severity: 'medium',
        title: 'Critical components in single Availability Zone',
        description: `${critical.length} critical component(s) are not configured for Multi-AZ deployment. An AZ outage would cause total service disruption.`,
        remediation: 'Enable Multi-AZ or configure an Active-Passive/Active-Active DR strategy for critical components.',
        compliance: ['SOC2', 'NIST'],
        affectedNodeIds: critical.map(n => n.id),
      };
    },
  },

  // ── R6: Spot instances for stateful workloads ──
  {
    id: 'spot-stateful',
    fn: (_nodes, _edges, active) => {
      const spotStateful = active.filter(n =>
        n.data.pricingModel === 'spot' && [...DB_TYPES, ...QUEUE_TYPES].includes(n.data.componentType)
      );
      
      if (spotStateful.length === 0) return null;
      return {
        id: 'spot-stateful', severity: 'high',
        title: 'Spot instances used for stateful workloads',
        description: 'Databases or message queues are running on spot instances, which can be interrupted at any time causing data loss.',
        remediation: 'Switch stateful workloads to On-Demand or Reserved pricing. Spot is only safe for stateless, fault-tolerant jobs.',
        compliance: ['SOC2', 'HIPAA'],
        affectedNodeIds: spotStateful.map(n => n.id),
      };
    },
  },

  // ── R7: No observability ──
  {
    id: 'no-observability',
    fn: (_nodes, _edges, active) => {
      if (active.length <= 3) return null;
      if (hasType(active, OBS_TYPES)) return null;
      
      return {
        id: 'no-observability', severity: 'medium',
        title: 'No monitoring or observability stack',
        description: 'The architecture has no CloudWatch, DataDog, or equivalent monitoring. Incidents cannot be detected or diagnosed.',
        remediation: 'Add a CloudWatch or DataDog component to enable alerting, metrics, and log aggregation.',
        compliance: ['SOC2', 'NIST', 'ISO-27001'],
        affectedNodeIds: [],
      };
    },
  },

  // ── R8: Public S3 without CDN ──
  {
    id: 's3-no-cdn',
    fn: (_nodes, edges, active) => {
      const s3Nodes = nodesOfType(active, ['s3']);
      const clients = nodesOfType(active, ['client-browser', 'mobile-app']);
      const hasCDN = hasType(active, ['cdn']);
      
      const exposed = s3Nodes.filter(s3 =>
        clients.some(c => edges.some(e => e.source === c.id && e.target === s3.id)) && !hasCDN
      );
      
      if (exposed.length === 0) return null;
      return {
        id: 's3-no-cdn', severity: 'low',
        title: 'S3 bucket served directly without CDN',
        description: 'Clients access S3 storage directly. This increases latency and exposes origin to traffic spikes.',
        remediation: 'Place a CloudFront CDN in front of S3 to cache content, reduce latency, and protect the origin.',
        compliance: ['OWASP'],
        affectedNodeIds: exposed.map(n => n.id),
      };
    },
  },

  // ── R9: No MFA on auth ──
  {
    id: 'no-mfa',
    fn: (_nodes, _edges, active) => {
      const authNodes = nodesOfType(active, AUTH_TYPES).filter(n => !n.data.mfaEnabled);
      
      if (authNodes.length === 0) return null;
      return {
        id: 'no-mfa', severity: 'medium',
        title: 'Authentication without MFA enabled',
        description: 'Identity providers are configured without Multi-Factor Authentication, leaving accounts vulnerable to credential stuffing.',
        remediation: 'Enable MFA in the authentication component configuration panel.',
        compliance: ['SOC2', 'HIPAA', 'PCI-DSS', 'NIST'],
        affectedNodeIds: authNodes.map(n => n.id),
      };
    },
  },

  // ── R10: Stateful sessions without sticky LB ──
  {
    id: 'stateful-no-lb',
    fn: (_nodes, _edges, active) => {
      const statefulServers = active.filter(n =>
        n.data.sessionStrategy === 'stateful' && COMPUTE_TYPES.includes(n.data.componentType)
      );
      const hasLB = hasType(active, ['load-balancer']);
      
      if (statefulServers.length === 0 || hasLB) return null;
      return {
        id: 'stateful-no-lb', severity: 'low',
        title: 'Stateful sessions without load balancer',
        description: 'Servers use stateful session management but no load balancer with sticky sessions is configured.',
        remediation: 'Add a load balancer with session affinity, or switch to stateless JWT-based sessions.',
        compliance: ['SOC2'],
        affectedNodeIds: statefulServers.map(n => n.id),
      };
    },
  },

  // ── R11: No rate limiting ──
  {
    id: 'no-rate-limiting',
    fn: (_nodes, _edges, active) => {
      const hasGateway = hasType(active, ['api-gateway']);
      const hasWAF = hasType(active, ['waf', 'aws-waf']);
      const hasCompute = hasType(active, COMPUTE_TYPES);
      
      if (!hasCompute || hasGateway || hasWAF) return null;
      return {
        id: 'no-rate-limiting', severity: 'high',
        title: 'No API rate limiting or throttling',
        description: 'No API Gateway or WAF with rate limiting is present. The system is vulnerable to abuse and DDoS attacks.',
        remediation: 'Add an API Gateway with rate limiting policies, or a WAF with request throttling rules.',
        compliance: ['OWASP', 'PCI-DSS', 'NIST'],
        affectedNodeIds: [],
      };
    },
  },

  // ── R12: No private subnet isolation ──
  {
    id: 'no-nat-gateway',
    fn: (_nodes, _edges, active) => {
      const hasDB = hasType(active, DB_TYPES);
      const hasNAT = hasType(active, ['nat-gateway']);
      
      if (!hasDB || hasNAT || active.length <= 3) return null;
      return {
        id: 'no-nat-gateway', severity: 'medium',
        title: 'No network isolation (NAT Gateway missing)',
        description: 'Databases and internal services lack private subnet isolation. Without a NAT Gateway, private resources either have no internet access or are publicly exposed.',
        remediation: 'Add a NAT Gateway to enable secure outbound internet access from private subnets.',
        compliance: ['SOC2', 'PCI-DSS', 'NIST'],
        affectedNodeIds: nodesOfType(active, DB_TYPES).map(n => n.id),
      };
    },
  },

  // ── R13: No DNS management ──
  {
    id: 'no-dns',
    fn: (_nodes, _edges, active) => {
      const hasDNS = hasType(active, ['dns']);
      if (hasDNS || active.length <= 4) return null;
      
      return {
        id: 'no-dns', severity: 'low',
        title: 'No DNS management service',
        description: 'No Route 53 or DNS component detected. Without managed DNS, failover routing and health checks are unavailable.',
        remediation: 'Add Route 53 for DNS-based failover, geolocation routing, and health check-driven traffic management.',
        compliance: ['NIST'],
        affectedNodeIds: [],
      };
    },
  },

  // ── R14: Database without read replicas under load ──
  {
    id: 'db-no-replicas',
    fn: (_nodes, _edges, active) => {
      const relDBs = nodesOfType(active, ['postgresql', 'mysql', 'aurora-serverless']);
      const noReplicas = relDBs.filter(n => !n.data.readReplicas || Number(n.data.readReplicas) === 0);
      
      if (noReplicas.length === 0) return null;
      return {
        id: 'db-no-replicas', severity: 'low',
        title: 'Relational database without read replicas',
        description: 'Relational databases have no read replicas configured. Under high read load, the primary will become a bottleneck.',
        remediation: 'Add 1-3 read replicas in the database configuration to distribute read queries.',
        compliance: ['SOC2'],
        affectedNodeIds: noReplicas.map(n => n.id),
      };
    },
  },

  // ── R15: Single compute instance (no redundancy) ──
  {
    id: 'single-compute',
    fn: (_nodes, _edges, active) => {
      const singles = active.filter(n =>
        COMPUTE_TYPES.includes(n.data.componentType) &&
        n.data.scalingType === 'horizontal' && n.data.instances <= 1
      );
      
      if (singles.length === 0) return null;
      return {
        id: 'single-compute', severity: 'medium',
        title: 'Compute services lack redundancy',
        description: `${singles.length} compute service(s) run with only 1 instance. Any failure causes complete downtime for that service.`,
        remediation: 'Scale to at least 2 instances for critical compute services to enable zero-downtime deployments.',
        compliance: ['SOC2', 'NIST'],
        affectedNodeIds: singles.map(n => n.id),
      };
    },
  },

  // ── R16: No async processing (tightly coupled) ──
  {
    id: 'no-async',
    fn: (_nodes, _edges, active) => {
      const computeCount = nodesOfType(active, COMPUTE_TYPES).length;
      const hasQueue = hasType(active, QUEUE_TYPES);
      
      if (computeCount <= 2 || hasQueue) return null;
      return {
        id: 'no-async', severity: 'low',
        title: 'No async processing layer',
        description: 'Multiple compute services are tightly coupled without a message queue. Failures cascade synchronously.',
        remediation: 'Add SQS, Kafka, or a Message Queue to decouple services and enable retry logic.',
        compliance: ['SOC2'],
        affectedNodeIds: [],
      };
    },
  },

  // ── R17: Secrets management missing ──
  {
    id: 'no-secrets',
    fn: (_nodes, _edges, active) => {
      const hasVault = hasType(active, ['hashicorp-vault']);
      const hasDB = hasType(active, DB_TYPES);
      
      if (!hasDB || hasVault || active.length <= 3) return null;
      return {
        id: 'no-secrets', severity: 'medium',
        title: 'No secrets management service',
        description: 'Database credentials and API keys likely hardcoded or stored in environment variables without a centralized secrets manager.',
        remediation: 'Add HashiCorp Vault or use AWS Secrets Manager for secure secret rotation and access control.',
        compliance: ['SOC2', 'HIPAA', 'PCI-DSS'],
        affectedNodeIds: [],
      };
    },
  },

  // ── R18: No HTTPS termination ──
  {
    id: 'no-tls-termination',
    fn: (_nodes, _edges, active) => {
      const hasLB = hasType(active, ['load-balancer']);
      const hasCDN = hasType(active, ['cdn']);
      const hasGateway = hasType(active, ['api-gateway']);
      const hasCompute = hasType(active, COMPUTE_TYPES);
      
      if (!hasCompute || hasLB || hasCDN || hasGateway) return null;
      return {
        id: 'no-tls-termination', severity: 'high',
        title: 'No TLS/HTTPS termination point',
        description: 'No load balancer, CDN, or API gateway to terminate HTTPS. Traffic may be transmitted in plaintext.',
        remediation: 'Add a Load Balancer or API Gateway with an SSL certificate to terminate TLS.',
        compliance: ['PCI-DSS', 'HIPAA', 'GDPR'],
        affectedNodeIds: [],
      };
    },
  },

  // ── R19: Compute-to-DB without connection pooling layer ──
  {
    id: 'direct-compute-db',
    fn: (_nodes, edges, active) => {
      const computes = nodesOfType(active, ['api-server', 'web-server']);
      const dbs = nodesOfType(active, DB_TYPES);
      const hasCache = hasType(active, ['redis']);
      
      if (hasCache) return null;
      
      const directConnections = computes.filter(c => 
        dbs.some(db => edges.some(e => e.source === c.id && e.target === db.id))
      );
      
      if (directConnections.length === 0 || computes.length <= 1) return null;
      return {
        id: 'direct-compute-db', severity: 'low',
        title: 'Multiple servers hitting DB without connection pooling',
        description: 'Multiple compute instances connect directly to the database. This can exhaust connection limits under load.',
        remediation: 'Add a Redis cache layer for read-heavy queries, or use a connection pooler like PgBouncer.',
        compliance: ['SOC2'],
        affectedNodeIds: directConnections.map(n => n.id),
      };
    },
  },

  // ── R20: No DR strategy ──
  {
    id: 'no-dr',
    fn: (_nodes, _edges, active) => {
      if (active.length <= 4) return null;
      const critical = active.filter(n =>
        [...DB_TYPES, 'api-server', 'web-server'].includes(n.data.componentType)
      );
      const allNoDR = critical.every(n => !n.data.drStrategy || n.data.drStrategy === 'none');
      
      if (!allNoDR || critical.length === 0) return null;
      return {
        id: 'no-dr', severity: 'medium',
        title: 'No disaster recovery strategy configured',
        description: 'No components have Active-Passive or Active-Active DR configured. A regional failure would cause complete data loss.',
        remediation: 'Configure Active-Passive DR for databases and Active-Active for stateless compute services.',
        compliance: ['SOC2', 'HIPAA', 'NIST', 'ISO-27001'],
        affectedNodeIds: critical.map(n => n.id),
      };
    },
  },

  // ── R21: Sensitive data without data residency ──
  {
    id: 'no-data-residency',
    fn: (_nodes, _edges, active) => {
      const dbs = nodesOfType(active, DB_TYPES);
      const noResidency = dbs.filter(n => !n.data.dataResidency || n.data.dataResidency === 'global');
      
      if (noResidency.length === 0) return null;
      return {
        id: 'no-data-residency', severity: 'low',
        title: 'No data residency controls',
        description: 'Databases are configured with global data residency. For regulated industries, data must reside in specific regions.',
        remediation: 'Set data residency to "Strict EU" or "Strict US" in database configuration for GDPR/CCPA compliance.',
        compliance: ['GDPR', 'CCPA', 'HIPAA'],
        affectedNodeIds: noResidency.map(n => n.id),
      };
    },
  },

  // ── R22: Lambda without VPC ──
  {
    id: 'lambda-no-vpc',
    fn: (_nodes, _edges, active) => {
      const lambdas = nodesOfType(active, ['lambda']);
      const hasDB = hasType(active, DB_TYPES);
      
      if (lambdas.length === 0 || !hasDB) return null;
      return {
        id: 'lambda-no-vpc', severity: 'medium',
        title: 'Lambda functions accessing databases may lack VPC attachment',
        description: 'Lambda functions communicating with databases should be in a VPC for network isolation and security.',
        remediation: 'Ensure Lambda functions are deployed within VPC private subnets with appropriate security groups.',
        compliance: ['SOC2', 'PCI-DSS'],
        affectedNodeIds: lambdas.map(n => n.id),
      };
    },
  },

  // ── R23: WebSocket without rate limiting ──
  {
    id: 'ws-no-protection',
    fn: (_nodes, _edges, active) => {
      const wsServers = nodesOfType(active, ['websocket-server']);
      const hasWAF = hasType(active, ['waf', 'aws-waf']);
      
      if (wsServers.length === 0 || hasWAF) return null;
      return {
        id: 'ws-no-protection', severity: 'medium',
        title: 'WebSocket servers without DDoS protection',
        description: 'WebSocket connections are persistent and can be weaponized for resource exhaustion attacks (SlowLoris, connection flooding).',
        remediation: 'Deploy a WAF with WebSocket-aware rules and connection rate limiting.',
        compliance: ['OWASP', 'NIST'],
        affectedNodeIds: wsServers.map(n => n.id),
      };
    },
  },

  // ── R24: Logging gap (compute without observability connection) ──
  {
    id: 'logging-gap',
    fn: (_nodes, edges, active) => {
      if (!hasType(active, OBS_TYPES)) return null;
      const obsNodes = nodesOfType(active, OBS_TYPES);
      const computes = nodesOfType(active, COMPUTE_TYPES);
      
      const unlogged = computes.filter(c =>
        !obsNodes.some(o => edges.some(e =>
          (e.source === c.id && e.target === o.id) || (e.source === o.id && e.target === c.id)
        ))
      );
      
      if (unlogged.length === 0) return null;
      return {
        id: 'logging-gap', severity: 'low',
        title: 'Compute services not connected to monitoring',
        description: `${unlogged.length} compute service(s) are not connected to the observability stack. Logs and metrics will be missing.`,
        remediation: 'Connect all compute services to CloudWatch or DataDog for centralized logging.',
        compliance: ['SOC2', 'ISO-27001'],
        affectedNodeIds: unlogged.map(n => n.id),
      };
    },
  },

  // ── R25: Third-party API without circuit breaker ──
  {
    id: 'no-circuit-breaker',
    fn: (_nodes, edges, active) => {
      const externalAPIs = nodesOfType(active, ['external-api', 'openai-api', 'stripe-api']);
      const computes = nodesOfType(active, COMPUTE_TYPES);
      const hasQueue = hasType(active, QUEUE_TYPES);
      
      if (externalAPIs.length === 0 || hasQueue) return null;
      
      const directlyCalledFrom = computes.filter(c =>
        externalAPIs.some(api => edges.some(e => e.source === c.id && e.target === api.id))
      );
      
      if (directlyCalledFrom.length === 0) return null;
      return {
        id: 'no-circuit-breaker', severity: 'low',
        title: 'External APIs called without circuit breaker pattern',
        description: 'External API calls are made synchronously without a message queue as buffer. If the third-party service is down, your entire system cascades.',
        remediation: 'Add a message queue between compute services and external APIs to enable retry, timeout, and circuit-breaking.',
        compliance: ['SOC2'],
        affectedNodeIds: directlyCalledFrom.map(n => n.id),
      };
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// SCANNER
// ═══════════════════════════════════════════════════════════════

export function runSecurityScan(nodes: ArchNode[], edges: ArchEdge[]): SecurityReport {
  const active = nodes.filter(n => !n.data.isDisabled && !n.data.isFailed);
  
  if (active.length === 0) {
    return { findings: [], score: 100, grade: 'A' };
  }

  const findings: SecurityFinding[] = [];

  for (const rule of rules) {
    const finding = rule.fn(nodes, edges, active);
    if (finding) findings.push(finding);
  }

  // Sort by severity
  const severityOrder: Record<SecuritySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Calculate score (100 minus deductions)
  let score = 100;
  for (const f of findings) {
    switch (f.severity) {
      case 'critical': score -= 18; break;
      case 'high':     score -= 12; break;
      case 'medium':   score -= 6;  break;
      case 'low':      score -= 3;  break;
    }
  }
  score = Math.max(0, Math.min(100, score));

  let grade: LetterGrade;
  if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return { findings, score, grade };
}
