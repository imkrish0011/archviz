import type { ArchEdge, ArchNode } from '../types';
import { getComponentDefinition } from '../data/componentLibrary';
import { generateCloudFormation } from './cloudformationGenerator';
import { generateTerraform, type TerraformArtifacts } from './hclGenerator';
import { sanitizeName } from './iacUtils';

export { generateTerraform, generateCloudFormation, sanitizeName };
export type { TerraformArtifacts };

interface DownloadFile {
  filename: string;
  content: string;
  mimeType: string;
}

type TerraformDownloadMode = 'files' | 'zip';

export function parseTfState(
  stateJson: {
    resources?: Array<{
      mode?: string;
      type?: string;
      name?: string;
      instances?: Array<{ attributes?: Record<string, unknown> }>;
    }>;
  } | null,
): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];

  if (!stateJson || !Array.isArray(stateJson.resources)) {
    return { nodes, edges };
  }

  let yOffset = 0;

  for (const resource of stateJson.resources) {
    if (resource.mode !== 'managed') {
      continue;
    }

    let compType = '';

    switch (resource.type) {
      case 'aws_instance':
        compType = 'api-server';
        break;
      case 'aws_db_instance':
        compType = 'postgresql';
        break;
      case 'aws_lb':
      case 'aws_elb':
      case 'aws_alb':
        compType = 'load-balancer';
        break;
      case 'aws_s3_bucket':
        compType = 's3';
        break;
      case 'aws_lambda_function':
        compType = 'lambda';
        break;
      case 'aws_elasticache_cluster':
      case 'aws_elasticache_replication_group':
        compType = 'redis';
        break;
      case 'aws_ecs_service':
        compType = 'ecs-fargate';
        break;
      case 'aws_eks_cluster':
        compType = 'kubernetes-cluster';
        break;
      case 'aws_cloudfront_distribution':
        compType = 'cdn';
        break;
      case 'aws_apigatewayv2_api':
      case 'aws_api_gateway_rest_api':
        compType = 'api-gateway';
        break;
      case 'aws_sqs_queue':
        compType = 'sqs';
        break;
      case 'aws_sns_topic':
        compType = 'sns';
        break;
      case 'aws_route53_zone':
        compType = 'dns';
        break;
      case 'aws_dynamodb_table':
        compType = 'dynamodb';
        break;
      default:
        continue;
    }

    const definition = getComponentDefinition(compType);
    if (!definition) {
      continue;
    }

    const instanceName = resource.name || resource.type || 'resource';
    const instanceCount = Array.isArray(resource.instances) ? resource.instances.length : 1;
    const tier = definition.tiers[definition.defaultTierIndex];

    nodes.push({
      id: `tf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'archNode',
      position: { x: 100 + Math.random() * 50, y: 100 + yOffset },
      data: {
        componentType: definition.type,
        label: instanceName,
        category: definition.category,
        icon: definition.icon,
        tier,
        tierIndex: definition.defaultTierIndex,
        instances: instanceCount > 0 ? instanceCount : 1,
        scalingType: definition.scalingType,
        reliability: definition.reliability,
        scalingFactor: definition.scalingFactor,
        healthStatus: 'healthy',
        loadPercent: 0,
      },
    } as ArchNode);

    yOffset += 100;
  }

  return { nodes, edges };
}

export function downloadTerraform(
  nodes: ArchNode[],
  edges: ArchEdge[],
  projectName: string,
  mode: TerraformDownloadMode = 'files',
): void {
  const files = buildTerraformFiles(generateTerraform(nodes, edges, projectName), projectName);

  if (mode === 'zip') {
    triggerDownload({
      filename: `${sanitizeName(projectName) || 'archviz'}-terraform.zip`,
      content: '',
      mimeType: 'application/zip',
    }, createZipBlob(files));
    return;
  }

  for (const file of files) {
    triggerDownload(file);
  }
}

export function downloadCloudFormation(nodes: ArchNode[], edges: ArchEdge[], projectName: string): void {
  const content = generateCloudFormation(nodes, edges, projectName);
  triggerDownload({
    filename: `${sanitizeName(projectName) || 'archviz'}-cfn.yaml`,
    content,
    mimeType: 'text/yaml',
  });
}

interface DockerService {
  image?: string;
  ports?: string[];
  environment?: string[];
  volumes?: string[];
  command?: string;
  working_dir?: string;
  deploy?: { replicas: number };
}

export function generateDockerCompose(nodes: ArchNode[], _edges: ArchEdge[], projectName: string): string {
  const services: Record<string, DockerService> = {};

  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') {
      continue;
    }

    const name = sanitizeName(node.data.label);
    const type = node.data.componentType;

    if (['api-server', 'web-server', 'worker', 'websocket-server', 'graphql-server'].includes(type)) {
      services[name] = {
        image: `my-registry.local/${name}:latest`,
        ports: ['8080:8080'],
        environment: ['NODE_ENV=development'],
        deploy: { replicas: node.data.scalingType === 'horizontal' ? node.data.instances : 1 },
      };
    } else if (type === 'postgresql') {
      services[name] = {
        image: 'postgres:15',
        environment: [
          'POSTGRES_USER=${POSTGRES_USER:-admin}',
          'POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-secret}',
          'POSTGRES_DB=${POSTGRES_DB:-mydb}',
        ],
        ports: ['5432:5432'],
        volumes: [`${name}_data:/var/lib/postgresql/data`],
      };
    } else if (type === 'mysql') {
      services[name] = {
        image: 'mysql:8',
        environment: ['MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-secret}', 'MYSQL_DATABASE=${MYSQL_DATABASE:-mydb}'],
        ports: ['3306:3306'],
        volumes: [`${name}_data:/var/lib/mysql`],
      };
    } else if (type === 'redis') {
      services[name] = { image: 'redis:7-alpine', ports: ['6379:6379'] };
    } else if (type === 's3') {
      services[name] = { image: 'minio/minio', command: 'server /data', ports: ['9000:9000'] };
    } else if (type === 'mongodb') {
      services[name] = { image: 'mongo:6', ports: ['27017:27017'], volumes: [`${name}_data:/data/db`] };
    } else if (type === 'cassandra') {
      services[name] = { image: 'cassandra:4', ports: ['9042:9042'], volumes: [`${name}_data:/var/lib/cassandra`] };
    } else if (type === 'elasticsearch') {
      services[name] = {
        image: 'elasticsearch:8.10.2',
        environment: ['discovery.type=single-node'],
        ports: ['9200:9200', '9300:9300'],
        volumes: [`${name}_data:/usr/share/elasticsearch/data`],
      };
    } else if (type === 'kafka') {
      services[name] = {
        image: 'confluentinc/cp-kafka:latest',
        ports: ['9092:9092'],
        environment: [
          'KAFKA_BROKER_ID=1',
          'KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181',
          'KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092',
          'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1',
        ],
      };
    } else if (['rabbitmq', 'message-queue'].includes(type)) {
      services[name] = { image: 'rabbitmq:3-management-alpine', ports: ['5672:5672', '15672:15672'] };
    } else if (['nextjs', 'react', 'vue'].includes(type)) {
      services[name] = {
        image: 'node:20-alpine',
        command: 'npm run dev',
        ports: ['3000:3000'],
        volumes: ['./frontend:/app'],
        working_dir: '/app',
      };
    }
  }

  const volumeNames = Object.keys(services)
    .filter(key => Boolean(services[key].volumes))
    .map(key => `${key}_data`);

  let yaml = `# NOTE: Ensure you use a .env file to inject actual values for interpolations.\nversion: '3.8'\nname: ${sanitizeName(projectName)}\n\nservices:\n`;

  for (const [serviceName, serviceDefinition] of Object.entries(services)) {
    yaml += `  ${serviceName}:\n`;
    if (serviceDefinition.image) yaml += `    image: ${serviceDefinition.image}\n`;
    if (serviceDefinition.command) yaml += `    command: ${serviceDefinition.command}\n`;
    if (serviceDefinition.ports) {
      yaml += '    ports:\n';
      serviceDefinition.ports.forEach(port => {
        yaml += `      - "${port}"\n`;
      });
    }
    if (serviceDefinition.environment) {
      yaml += '    environment:\n';
      serviceDefinition.environment.forEach(entry => {
        yaml += `      - ${entry}\n`;
      });
    }
    if (serviceDefinition.volumes) {
      yaml += '    volumes:\n';
      serviceDefinition.volumes.forEach(volume => {
        yaml += `      - ${volume}\n`;
      });
    }
    if (serviceDefinition.deploy) {
      yaml += `    deploy:\n      replicas: ${serviceDefinition.deploy.replicas}\n`;
    }
  }

  if (volumeNames.length > 0) {
    yaml += '\nvolumes:\n';
    volumeNames.forEach(volumeName => {
      yaml += `  ${volumeName}:\n`;
    });
  }

  return yaml;
}

export function generateKubernetesManifests(nodes: ArchNode[], edges: ArchEdge[], _projectName: string): string {
  let manifests = '';

  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') {
      continue;
    }
    if (!['api-server', 'web-server', 'worker', 'websocket-server', 'redis', 'postgresql', 'mysql'].includes(node.data.componentType)) {
      continue;
    }

    const name = sanitizeName(node.data.label).replace(/_/g, '-');
    const replicas = node.data.scalingType === 'horizontal' ? node.data.instances : 1;

    manifests += `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\n  namespace: default\n  labels:\n    app: ${name}\n`;
    manifests += `spec:\n  replicas: ${replicas}\n  selector:\n    matchLabels:\n      app: ${name}\n`;
    manifests += `  template:\n    metadata:\n      labels:\n        app: ${name}\n`;
    manifests += `    spec:\n      containers:\n      - name: ${name}\n        image: ${name}:latest\n`;
    manifests += '        ports:\n        - containerPort: 8080\n---\n';

    const isCompute = ['api-server', 'web-server', 'websocket-server', 'graphql-server'].includes(node.data.componentType);
    const incomingEdges = edges.filter(edge => edge.target === node.id);
    const isBehindLb = incomingEdges.some(edge => {
      const sourceNode = nodes.find(candidate => candidate.id === edge.source);
      return sourceNode?.data.componentType === 'load-balancer';
    });

    const serviceType = isCompute && !isBehindLb ? 'LoadBalancer' : 'ClusterIP';

    manifests += `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${name}-svc\n  namespace: default\n`;
    manifests += 'spec:\n  selector:\n    app: ' + name + '\n  ports:\n    - protocol: TCP\n      port: 80\n      targetPort: 8080\n';
    manifests += `  type: ${serviceType}\n---\n`;
  }

  return manifests || '# No applicable workloads found for Kubernetes manifest generation.';
}

export function downloadDockerCompose(nodes: ArchNode[], edges: ArchEdge[], projectName: string): void {
  triggerDownload({
    filename: `${sanitizeName(projectName) || 'archviz'}-docker-compose.yaml`,
    content: generateDockerCompose(nodes, edges, projectName),
    mimeType: 'text/yaml',
  });
}

export function downloadKubernetesManifests(nodes: ArchNode[], edges: ArchEdge[], projectName: string): void {
  triggerDownload({
    filename: `${sanitizeName(projectName) || 'archviz'}-k8s-manifests.yaml`,
    content: generateKubernetesManifests(nodes, edges, projectName),
    mimeType: 'text/yaml',
  });
}

function buildTerraformFiles(artifacts: TerraformArtifacts, projectName: string): DownloadFile[] {
  const prefix = sanitizeName(projectName) || 'archviz';
  return [
    { filename: `${prefix}-main.tf`, content: artifacts.mainTf, mimeType: 'text/plain' },
    { filename: `${prefix}-variables.tf`, content: artifacts.variablesTf, mimeType: 'text/plain' },
    { filename: `${prefix}-outputs.tf`, content: artifacts.outputsTf, mimeType: 'text/plain' },
  ];
}

function triggerDownload(file: DownloadFile, blobOverride?: Blob): void {
  const blob = blobOverride ?? new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = file.filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function createZipBlob(files: DownloadFile[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encodeText(file.filename);
    const dataBytes = encodeText(file.content);
    const crc = crc32(dataBytes);
    const localHeader = concatUint8Arrays([
      numberToBytes(0x04034b50, 4),
      numberToBytes(20, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(crc, 4),
      numberToBytes(dataBytes.length, 4),
      numberToBytes(dataBytes.length, 4),
      numberToBytes(nameBytes.length, 2),
      numberToBytes(0, 2),
      nameBytes,
      dataBytes,
    ]);

    const centralHeader = concatUint8Arrays([
      numberToBytes(0x02014b50, 4),
      numberToBytes(20, 2),
      numberToBytes(20, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(crc, 4),
      numberToBytes(dataBytes.length, 4),
      numberToBytes(dataBytes.length, 4),
      numberToBytes(nameBytes.length, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 4),
      numberToBytes(offset, 4),
      nameBytes,
    ]);

    localParts.push(localHeader);
    centralParts.push(centralHeader);
    offset += localHeader.length;
  }

  const centralDirectory = concatUint8Arrays(centralParts);
  const endRecord = concatUint8Arrays([
    numberToBytes(0x06054b50, 4),
    numberToBytes(0, 2),
    numberToBytes(0, 2),
    numberToBytes(files.length, 2),
    numberToBytes(files.length, 2),
    numberToBytes(centralDirectory.length, 4),
    numberToBytes(offset, 4),
    numberToBytes(0, 2),
  ]);

  const bytes = concatUint8Arrays([...localParts, centralDirectory, endRecord]);
  const safeBytes = new Uint8Array(bytes.length);
  safeBytes.set(bytes);
  return new Blob([safeBytes], { type: 'application/zip' });
}

function encodeText(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let cursor = 0;

  for (const part of parts) {
    merged.set(part, cursor);
    cursor += part.length;
  }

  return merged;
}

function numberToBytes(value: number, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  let remaining = value >>> 0;
  for (let index = 0; index < byteLength; index += 1) {
    bytes[index] = remaining & 0xff;
    remaining >>>= 8;
  }
  return bytes;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
