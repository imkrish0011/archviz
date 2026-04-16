import type { ArchNodeData } from '../types';

/**
 * Connection Validator — prevents architectural anti-patterns at the
 * component level, not just the category level.
 */

export interface ValidationResult {
  allowed: boolean;
  level: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface AntiPatternRule {
  sourceTypes: string[];      // component types that trigger this rule
  targetTypes: string[];      // component types they cannot connect TO
  level: 'error' | 'warning';
  message: string;
  suggestion: string;
}

/**
 * Component-level anti-pattern rules.
 * Category-level rules already exist in the store; these are finer-grained.
 */
const antiPatterns: AntiPatternRule[] = [
  // Frontend → Database (direct)
  {
    sourceTypes: ['web-frontend', 'mobile-client', 'iot-device'],
    targetTypes: ['rds-postgres', 'rds-mysql', 'dynamodb', 'mongodb', 'neo4j', 'influxdb', 'elasticsearch'],
    level: 'error',
    message: 'Client cannot connect directly to a database.',
    suggestion: 'Route through an API Gateway or Backend service for security.',
  },
  // Frontend → messaging queue (direct)
  {
    sourceTypes: ['web-frontend', 'mobile-client'],
    targetTypes: ['sqs-queue', 'sns-topic', 'apache-kafka', 'amazon-kinesis', 'rabbitmq', 'amazon-eventbridge'],
    level: 'error',
    message: 'Client-side apps should not push directly to queues.',
    suggestion: 'Use a backend API or serverless function as a proxy.',
  },
  // Lambda → RDS without VPC context (warning only)
  {
    sourceTypes: ['lambda'],
    targetTypes: ['rds-postgres', 'rds-mysql'],
    level: 'warning',
    message: 'Lambda connecting to RDS requires VPC configuration.',
    suggestion: 'Consider placing Lambda inside a VPC subnet or use RDS Data API.',
  },
  // Anything → Glacier (latency warning)
  {
    sourceTypes: ['*'],
    targetTypes: ['amazon-glacier'],
    level: 'warning',
    message: 'Glacier retrieval can take hours. Not suitable for real-time access.',
    suggestion: 'Use S3 Standard or S3-IA for frequently accessed data.',
  },
  // Direct compute-to-compute without load balancer or gateway
  {
    sourceTypes: ['ec2', 'ecs-fargate', 'aws-fargate', 'kubernetes'],
    targetTypes: ['ec2', 'ecs-fargate', 'aws-fargate', 'kubernetes'],
    level: 'warning',
    message: 'Direct service-to-service calls lack load balancing.',
    suggestion: 'Place an internal Load Balancer or Service Mesh between compute nodes.',
  },
  // Cache as a primary data store (connecting storage → cache backwards)
  {
    sourceTypes: ['redis', 'memcached'],
    targetTypes: ['web-frontend', 'mobile-client'],
    level: 'error',
    message: 'Cache should not serve clients directly.',
    suggestion: 'Clients should query a backend that checks the cache layer.',
  },
];

/**
 * Validates a proposed connection between two nodes.
 * Returns an object indicating if the connection is allowed + any warnings.
 */
export function validateConnection(
  sourceData: ArchNodeData,
  targetData: ArchNodeData,
): ValidationResult {
  const srcType = sourceData.componentType;
  const tgtType = targetData.componentType;

  // Self-connection check
  if (srcType === tgtType) {
    return {
      allowed: true,
      level: 'info',
      message: '',
    };
  }

  for (const rule of antiPatterns) {
    const sourceMatches = rule.sourceTypes.includes('*') || rule.sourceTypes.includes(srcType);
    const targetMatches = rule.targetTypes.includes(tgtType);

    if (sourceMatches && targetMatches) {
      return {
        allowed: rule.level !== 'error',
        level: rule.level,
        message: rule.message,
        suggestion: rule.suggestion,
      };
    }
  }

  // No anti-pattern triggered — connection is clean
  return {
    allowed: true,
    level: 'info',
    message: '',
  };
}
