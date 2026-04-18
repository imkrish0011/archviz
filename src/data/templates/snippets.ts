import type { Template } from '../../types';

export const snippetTemplates: Template[] = [
  {
    id: 'snippet-serverless-crud',
    name: 'Serverless CRUD API',
    category: 'snippet',
    description: 'A standard API Gateway to Lambda to DynamoDB pattern.',
    keyInsight: 'Highly scalable, zero idle cost architecture ideal for variable workloads.',
    baselineCost: 5.0,
    nodeCount: 3,
    nodes: [
      { id: 'gw-1', type: 'archNode', position: { x: 0, y: 0 }, componentType: 'api-gateway', tierIndex: 0 },
      { id: 'lam-1', type: 'archNode', position: { x: 200, y: 0 }, componentType: 'lambda', tierIndex: 0 },
      { id: 'db-1', type: 'archNode', position: { x: 400, y: 0 }, componentType: 'dynamodb', tierIndex: 0 },
    ],
    edges: [
      { id: 'e-gw-lam', source: 'gw-1', target: 'lam-1' },
      { id: 'e-lam-db', source: 'lam-1', target: 'db-1' },
    ],
  },
  {
    id: 'snippet-cqrs',
    name: 'CQRS Event Sourcing',
    category: 'snippet',
    description: 'Separates read and write workloads utilizing an event bus interface.',
    keyInsight: 'Maintains read performance during massive transaction spikes.',
    baselineCost: 155.0,
    nodeCount: 5,
    nodes: [
      { id: 'api-1', type: 'archNode', position: { x: 0, y: 100 }, componentType: 'api-gateway', tierIndex: 0 },
      { id: 'wr-1', type: 'archNode', position: { x: 200, y: 0 }, componentType: 'ecs-fargate', tierIndex: 1 },
      { id: 'rd-1', type: 'archNode', position: { x: 200, y: 200 }, componentType: 'ecs-fargate', tierIndex: 1 },
      { id: 'bus-1', type: 'archNode', position: { x: 400, y: 0 }, componentType: 'eventbridge', tierIndex: 0 },
      { id: 'db-1', type: 'archNode', position: { x: 400, y: 200 }, componentType: 'postgresql', tierIndex: 1 },
    ],
    edges: [
      { id: 'e-1', source: 'api-1', target: 'wr-1' },
      { id: 'e-2', source: 'api-1', target: 'rd-1' },
      { id: 'e-3', source: 'wr-1', target: 'bus-1' },
      { id: 'e-4', source: 'bus-1', target: 'db-1' },
      { id: 'e-5', source: 'rd-1', target: 'db-1' },
    ],
  },
  {
    id: 'snippet-cache-aside',
    name: 'Cache-Aside Pattern',
    category: 'snippet',
    description: 'Application checks cache first, falls back to database.',
    keyInsight: 'Dramatically reduces database load and read latency.',
    baselineCost: 45.0,
    nodeCount: 3,
    nodes: [
      { id: 'app-1', type: 'archNode', position: { x: 0, y: 0 }, componentType: 'api-server', tierIndex: 0 },
      { id: 'cache-1', type: 'archNode', position: { x: 250, y: -60 }, componentType: 'redis', tierIndex: 0 },
      { id: 'db-1', type: 'archNode', position: { x: 250, y: 60 }, componentType: 'postgresql', tierIndex: 0 },
    ],
    edges: [
      { id: 'e-app-cache', source: 'app-1', target: 'cache-1' },
      { id: 'e-app-db', source: 'app-1', target: 'db-1' },
    ],
  },
  {
    id: 'snippet-data-pipeline',
    name: 'Real-Time Data Pipeline',
    category: 'snippet',
    description: 'API to Kafka to Apache Spark to Snowflake pipeline.',
    keyInsight: 'Decoupled, high-throughput event streaming into analytics warehouse.',
    baselineCost: 655.0,
    nodeCount: 4,
    nodes: [
      { id: 'api-1', type: 'archNode', position: { x: 0, y: 0 }, componentType: 'api-gateway', tierIndex: 0 },
      { id: 'kafka-1', type: 'archNode', position: { x: 250, y: 0 }, componentType: 'confluent-kafka', tierIndex: 0 },
      { id: 'spark-1', type: 'archNode', position: { x: 500, y: 0 }, componentType: 'apache-spark', tierIndex: 0 },
      { id: 'snow-1', type: 'archNode', position: { x: 750, y: 0 }, componentType: 'snowflake-dwh', tierIndex: 0 },
    ],
    edges: [
      { id: 'e-1', source: 'api-1', target: 'kafka-1' },
      { id: 'e-2', source: 'kafka-1', target: 'spark-1' },
      { id: 'e-3', source: 'spark-1', target: 'snow-1' },
    ],
  },
  {
    id: 'snippet-rag-ai',
    name: 'RAG AI Pipeline',
    category: 'snippet',
    description: 'Retrieval-Augmented Generation using vLLM and PostgreSQL (PGVector).',
    keyInsight: 'Privately hosted LLM augmented with enterprise data context.',
    baselineCost: 1245.0,
    nodeCount: 3,
    nodes: [
      { id: 'app-1', type: 'archNode', position: { x: 0, y: 0 }, componentType: 'api-server', tierIndex: 0 },
      { id: 'vllm-1', type: 'archNode', position: { x: 250, y: -80 }, componentType: 'vllm-server', tierIndex: 0 },
      { id: 'vec-1', type: 'archNode', position: { x: 250, y: 80 }, componentType: 'postgresql', tierIndex: 0 },
    ],
    edges: [
      { id: 'e-app-vllm', source: 'app-1', target: 'vllm-1' },
      { id: 'e-app-vec', source: 'app-1', target: 'vec-1' },
      { id: 'e-vec-vllm', source: 'vec-1', target: 'vllm-1' },
    ],
  }
];
