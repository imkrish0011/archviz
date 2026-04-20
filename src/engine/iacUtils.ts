import type { ArchEdge, ArchNode } from '../types';

export interface TerraformVariable {
  name: string;
  type: 'string' | 'number' | 'bool' | 'list(string)';
  description?: string;
  defaultValue?: string | number | boolean | string[];
  sensitive?: boolean;
}

export interface TerraformOutput {
  name: string;
  description: string;
  value: string;
}

export interface UnsupportedMapping {
  provider: string;
  display: string;
}

const unsupportedServiceMap: Record<string, UnsupportedMapping> = {
  pinecone: { provider: 'pinecone-community/pinecone', display: 'Pinecone' },
  datadog: { provider: 'DataDog/datadog', display: 'DataDog' },
  auth0: { provider: 'auth0/auth0', display: 'Auth0' },
  'cloudflare-workers': { provider: 'cloudflare/cloudflare', display: 'Cloudflare' },
  'cloudflare-pages': { provider: 'cloudflare/cloudflare', display: 'Cloudflare' },
  snowflake: { provider: 'Snowflake-Labs/snowflake', display: 'Snowflake' },
  'snowflake-dwh': { provider: 'Snowflake-Labs/snowflake', display: 'Snowflake' },
  'openai-api': { provider: 'openai/openai', display: 'OpenAI API' },
  'stripe-api': { provider: 'stripe/stripe', display: 'Stripe' },
  'hashicorp-vault': { provider: 'hashicorp/vault', display: 'Vault' },
  rabbitmq: { provider: 'cyrilgdn/rabbitmq', display: 'RabbitMQ' },
  'message-queue': { provider: 'cyrilgdn/rabbitmq', display: 'RabbitMQ' },
  bigtable: { provider: 'hashicorp/google', display: 'Bigtable' },
  spanner: { provider: 'hashicorp/google', display: 'Spanner' },
};

const externalClientTypes = new Set([
  'client-browser',
  'mobile-app',
  'external-api',
  'openai-api',
  'stripe-api',
]);

const supportedAwsTypes = new Set([
  'api-server',
  'web-server',
  'worker',
  'websocket-server',
  'graphql-server',
  'game-server',
  'ml-worker',
  'lambda',
  'ecs-fargate',
  'kubernetes-cluster',
  'postgresql',
  'mysql',
  'redis',
  's3',
  'load-balancer',
  'dynamodb',
  'aws-cognito',
  'cdn',
  'api-gateway',
  'sqs',
  'sns',
  'dns',
]);

const databaseTypes = new Set(['postgresql', 'mysql', 'redis', 'mongodb', 'dynamodb']);

const defaultPortMap: Record<string, number> = {
  postgresql: 5432,
  mysql: 3306,
  redis: 6379,
  'load-balancer': 443,
  'api-server': 8080,
  'web-server': 8080,
  worker: 8080,
  'websocket-server': 8080,
  'graphql-server': 8080,
  'game-server': 8080,
  'ml-worker': 8080,
  lambda: 443,
  'ecs-fargate': 8080,
  'kubernetes-cluster': 443,
};

export function sanitizeName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^[0-9]/, '_$&');
}

export function toLogicalId(label: string): string {
  const words = label
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const base = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('') || 'Resource';
  return /^[0-9]/.test(base) ? `R${base}` : base;
}

export function buildUniqueNames(nodes: ArchNode[]): Map<string, string> {
  const names = new Map<string, string>();
  const seen = new Set<string>();

  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') {
      continue;
    }

    let candidate = sanitizeName(node.data.label);
    if (seen.has(candidate)) {
      candidate = `${candidate}_${sanitizeName(node.id).slice(-6)}`;
    }

    seen.add(candidate);
    names.set(node.id, candidate);
  }

  return names;
}

export function getNodeConfig(node: ArchNode): Record<string, unknown> {
  const config = node.data.config;
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    return config as Record<string, unknown>;
  }
  return {};
}

export function getNodeSetting<T>(node: ArchNode, keys: string[], fallback: T): T {
  const config = getNodeConfig(node);
  for (const key of keys) {
    if (key in config && config[key] !== undefined && config[key] !== null) {
      return config[key] as T;
    }
    if (key in node.data && node.data[key] !== undefined && node.data[key] !== null) {
      return node.data[key] as T;
    }
  }
  return fallback;
}

export function getDefaultPort(type: string): number {
  return defaultPortMap[type] ?? 443;
}

export function isUnsupportedNonAwsType(type: string): boolean {
  return type in unsupportedServiceMap;
}

export function getUnsupportedMapping(type: string): UnsupportedMapping | undefined {
  return unsupportedServiceMap[type];
}

export function isExternalClientType(type: string): boolean {
  return externalClientTypes.has(type);
}

export function isSupportedAwsType(type: string): boolean {
  return supportedAwsTypes.has(type);
}

export function isDatabaseType(type: string): boolean {
  return databaseTypes.has(type);
}

export function buildDependencyMap(edges: ArchEdge[]): Map<string, string[]> {
  const dependencies = new Map<string, string[]>();

  for (const edge of edges) {
    const targetDependencies = dependencies.get(edge.target) ?? [];
    if (!targetDependencies.includes(edge.source)) {
      targetDependencies.push(edge.source);
    }
    dependencies.set(edge.target, targetDependencies);
  }

  return dependencies;
}

export function renderHclValue(value: string | number | boolean | string[]): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => JSON.stringify(item)).join(', ')}]`;
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function renderVariableBlocks(variables: TerraformVariable[]): string {
  return variables
    .map(variable => {
      const lines = [`variable "${variable.name}" {`, `  type = ${variable.type}`];
      if (variable.description) {
        lines.push(`  description = ${JSON.stringify(variable.description)}`);
      }
      if (variable.defaultValue !== undefined) {
        lines.push(`  default = ${renderHclValue(variable.defaultValue)}`);
      }
      if (variable.sensitive) {
        lines.push('  sensitive = true');
      }
      lines.push('}');
      return lines.join('\n');
    })
    .join('\n\n');
}

export function renderOutputBlocks(outputs: TerraformOutput[]): string {
  return outputs
    .map(output => [
      `output "${output.name}" {`,
      `  description = ${JSON.stringify(output.description)}`,
      `  value       = ${output.value}`,
      '}',
    ].join('\n'))
    .join('\n\n');
}

export function buildSubnetCidrs(prefix: '10.0', count: number, offset: number): string[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => `${prefix}.${index + offset}.0/24`);
}

export function toYaml(value: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);

  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    return value
      .map(item => {
        if (isPrimitive(item)) {
          return `${pad}- ${formatYamlScalar(item)}`;
        }
        const nested = toYaml(item, indent + 2);
        const nestedLines = nested.split('\n');
        return `${pad}- ${nestedLines[0].trimStart()}\n${nestedLines.slice(1).join('\n')}`;
      })
      .join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '{}';
    }

    return entries
      .map(([key, entryValue]) => {
        if (isPrimitive(entryValue)) {
          return `${pad}${key}: ${formatYamlScalar(entryValue)}`;
        }

        const nested = toYaml(entryValue, indent + 2);
        return `${pad}${key}:\n${nested}`;
      })
      .join('\n');
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${pad}${formatYamlScalar(value)}`;
  }
  return `${pad}${JSON.stringify(value)}`;
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function formatYamlScalar(value: string | number | boolean | null): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === '' || /[:#{}\[\],&*!|>'"%@`]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}
