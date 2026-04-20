import type { ArchNodeData } from '../types';

/**
 * Connection Validator — prevents architectural anti-patterns leveraging 
 * dynamic component category metadata.
 */

export interface ValidationResult {
  allowed: boolean;
  level: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

/**
 * Validates a proposed connection between two nodes.
 * Returns an object indicating if the connection is allowed + any warnings.
 */
export function validateConnection(
  sourceData: ArchNodeData,
  targetData: ArchNodeData,
): ValidationResult {
  const srcCat = sourceData.category;
  const tgtCat = targetData.category;
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

  const isFrontend = ['frontend', 'client', 'frontend-framework'].includes(srcCat) || srcType.includes('client');
  const isStorage = ['storage', 'database'].includes(tgtCat);
  const isMessaging = ['messaging', 'queue'].includes(tgtCat);

  // Frontend -> Database (direct)
  if (isFrontend && isStorage) {
    // Exception for Frontend PaaS like Supabase/Firebase which allow direct client connections
    if (['supabase', 'firebase', 'planetscale'].includes(tgtType)) {
      return { allowed: true, level: 'info', message: '' };
    }
    return {
      allowed: false,
      level: 'error',
      message: 'Client cannot connect directly to a traditional database.',
      suggestion: 'Route through an API Gateway, Backend service, or use a Serverless BaaS.',
    };
  }

  // Frontend -> Messaging
  if (isFrontend && isMessaging) {
    return {
      allowed: false,
      level: 'error',
      message: 'Client-side apps should not push directly to queues.',
      suggestion: 'Use a backend API or serverless function as a proxy.',
    };
  }

  // Compute -> Compute (without load balancer)
  const isComputeSrc = ['compute', 'serverless'].includes(srcCat);
  const isComputeTgt = ['compute', 'serverless'].includes(tgtCat);
  if (isComputeSrc && isComputeTgt) {
    return {
      allowed: true, // Warnings are allowed
      level: 'warning',
      message: 'Direct service-to-service calls lack load balancing.',
      suggestion: 'Place an internal Load Balancer or Service Mesh between compute nodes.',
    };
  }

  // Cache backwards connection (cache -> frontend)
  if (srcType.includes('redis') || srcType.includes('memcached') || srcCat === 'cache') {
    if (['frontend', 'client', 'frontend-framework'].includes(tgtCat)) {
      return {
        allowed: false,
        level: 'error',
        message: 'Cache should not serve clients directly.',
        suggestion: 'Clients should query a backend that checks the cache layer.',
      };
    }
  }

  // Lambda -> RDS without VPC context (warning)
  if (srcType === 'lambda' && (tgtType.includes('postgresql') || tgtType.includes('mysql') || tgtType.includes('rds'))) {
    return {
      allowed: true,
      level: 'warning',
      message: 'Lambda connecting to RDS requires VPC configuration.',
      suggestion: 'Consider placing Lambda inside a VPC subnet or use RDS Data API.',
    };
  }

  // Glacier warning
  if (tgtType.includes('glacier')) {
    return {
      allowed: true,
      level: 'warning',
      message: 'Glacier retrieval can take hours. Not suitable for real-time access.',
      suggestion: 'Use S3 Standard or S3-IA for frequently accessed data.',
    };
  }

  // No anti-pattern triggered — connection is clean
  return {
    allowed: true,
    level: 'info',
    message: '',
  };
}
