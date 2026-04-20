import type { ArchEdge, ArchNode } from '../types';
import {
  buildDependencyMap,
  buildSubnetCidrs,
  buildUniqueNames,
  getDefaultPort,
  getNodeSetting,
  getUnsupportedMapping,
  isDatabaseType,
  isExternalClientType,
  isSupportedAwsType,
  isUnsupportedNonAwsType,
  renderOutputBlocks,
  renderVariableBlocks,
  sanitizeName,
  type TerraformOutput,
  type TerraformVariable,
} from './iacUtils';

export interface TerraformArtifacts {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
}

interface VariableRegistry {
  all: TerraformVariable[];
  ensure: (variable: TerraformVariable) => string;
}

export function generateTerraform(nodes: ArchNode[], edges: ArchEdge[], projectName: string): TerraformArtifacts {
  const activeNodes = nodes.filter(node => node.data.componentType !== 'groupNode');
  const names = buildUniqueNames(activeNodes);
  const dependencies = buildDependencyMap(edges);

  const publicSubnetCount = Math.max(
    1,
    nodes.filter(node =>
      node.data.componentType === 'groupNode' && node.data.label.toLowerCase().includes('public')
    ).length,
  );
  const privateSubnetCount = Math.max(
    1,
    nodes.filter(node =>
      node.data.componentType === 'groupNode' && node.data.label.toLowerCase().includes('private')
    ).length,
  );

  const variables = createVariableRegistry([
    {
      name: 'aws_region',
      type: 'string',
      description: 'AWS region for all resources',
      defaultValue: 'us-east-1',
    },
    {
      name: 'environment',
      type: 'string',
      description: 'Deployment environment name',
      defaultValue: 'dev',
    },
    {
      name: 'project_name',
      type: 'string',
      description: 'Project name prefix used in generated resources',
      defaultValue: sanitizeName(projectName) || 'archviz',
    },
    {
      name: 'vpc_cidr',
      type: 'string',
      description: 'CIDR block for the VPC',
      defaultValue: '10.0.0.0/16',
    },
    {
      name: 'public_subnet_cidrs',
      type: 'list(string)',
      description: 'CIDR blocks for public subnets',
      defaultValue: buildSubnetCidrs('10.0', publicSubnetCount, 1),
    },
    {
      name: 'private_subnet_cidrs',
      type: 'list(string)',
      description: 'CIDR blocks for private subnets',
      defaultValue: buildSubnetCidrs('10.0', privateSubnetCount, 101),
    },
  ]);

  const resources: string[] = [
    renderTerraformHeader(),
    ['provider "aws" {', '  region = var.aws_region', '}'].join('\n'),
    [
      'data "aws_availability_zones" "available" {}',
      '',
      'resource "aws_vpc" "main" {',
      '  cidr_block           = var.vpc_cidr',
      '  enable_dns_hostnames = true',
      '  enable_dns_support   = true',
      '',
      '  tags = {',
      '    Name        = "${var.project_name}-vpc"',
      '    Environment = var.environment',
      '    ManagedBy   = "archviz"',
      '  }',
      '}',
      '',
      'resource "aws_internet_gateway" "main" {',
      '  vpc_id = aws_vpc.main.id',
      '',
      '  tags = {',
      '    Name = "${var.project_name}-igw"',
      '  }',
      '}',
    ].join('\n'),
    renderSubnets(publicSubnetCount, privateSubnetCount),
  ];

  const outputs: TerraformOutput[] = [
    { name: 'vpc_id', description: 'ID of the generated VPC', value: 'aws_vpc.main.id' },
    { name: 'public_subnet_ids', description: 'IDs of public subnets', value: 'aws_subnet.public[*].id' },
    { name: 'private_subnet_ids', description: 'IDs of private subnets', value: 'aws_subnet.private[*].id' },
  ];

  let firstAlbName: string | undefined;
  let firstRdsName: string | undefined;
  let firstEksName: string | undefined;
  let firstRedisName: string | undefined;

  for (const node of activeNodes) {
    const type = node.data.componentType;
    const name = names.get(node.id) ?? sanitizeName(node.data.label);

    if (isUnsupportedNonAwsType(type)) {
      const mapping = getUnsupportedMapping(type);
      resources.push([
        `# WARNING: UNSUPPORTED: "${node.data.label}" (${type}) has no AWS Terraform provider equivalent.`,
        '# You must configure this resource manually using its own provider:',
        '# - Pinecone -> pinecone-community/pinecone',
        '# - DataDog  -> DataDog/datadog',
        '# - Auth0    -> auth0/auth0',
        '# - Cloudflare -> cloudflare/cloudflare',
        '# - Snowflake -> Snowflake-Labs/snowflake',
        mapping ? `# Suggested provider for this node: ${mapping.display} -> ${mapping.provider}` : '# Suggested provider: configure an external provider manually.',
      ].join('\n'));
      continue;
    }

    if (isExternalClientType(type)) {
      resources.push(`# External dependency placeholder: ${node.data.label} (${type})`);
      continue;
    }

    if (!isSupportedAwsType(type)) {
      resources.push(`# No Terraform generator mapping implemented for ${node.data.label} (${type}).`);
      continue;
    }

    resources.push(renderSecurityGroup(node, name, edges, nodes, names));

    if (isEc2Type(type)) {
      const variableName = `${name}_instance_type`;
      variables.ensure({
        name: variableName,
        type: 'string',
        description: `Instance type for ${node.data.label}`,
        defaultValue: node.data.tier.label.includes('.') ? node.data.tier.label : 't3.medium',
      });
      variables.ensure({
        name: `${name}_port`,
        type: 'number',
        description: `Application port for ${node.data.label}`,
        defaultValue: getNodeSetting(node, ['port', 'servicePort'], getDefaultPort(type)),
      });
      resources.push(renderEc2Resources(node, name, variableName));
      continue;
    }

    if (type === 'lambda') {
      resources.push(renderLambdaResources(node, name));
      continue;
    }

    if (type === 'ecs-fargate') {
      resources.push(renderEcsResources(node, name, variables));
      continue;
    }

    if (type === 'kubernetes-cluster') {
      resources.push(renderEksResources(name));
      if (!firstEksName) {
        firstEksName = name;
      }
      continue;
    }

    if (type === 'postgresql' || type === 'mysql') {
      resources.push(renderRdsResources(node, name, variables));
      if (!firstRdsName) {
        firstRdsName = name;
      }
      continue;
    }

    if (type === 'redis') {
      resources.push(renderRedisResources(node, name, variables));
      if (!firstRedisName) {
        firstRedisName = name;
      }
      continue;
    }

    if (type === 's3') {
      resources.push(renderS3Resources(node, name));
      continue;
    }

    if (type === 'load-balancer') {
      resources.push(renderAlbResources(name, variables));
      if (!firstAlbName) {
        firstAlbName = name;
      }
      continue;
    }

    resources.push(renderGenericAwsResource(node, name));
  }

  if (firstAlbName) {
    outputs.push({
      name: 'alb_dns_name',
      description: 'DNS name for the first generated application load balancer',
      value: `aws_lb.${firstAlbName}.dns_name`,
    });
  }

  if (firstRdsName) {
    outputs.push({
      name: 'rds_endpoint',
      description: 'Endpoint address for the first generated RDS instance',
      value: `aws_db_instance.${firstRdsName}.address`,
    });
  }

  if (firstEksName) {
    outputs.push({
      name: 'eks_cluster_endpoint',
      description: 'Endpoint for the generated EKS cluster',
      value: `aws_eks_cluster.${firstEksName}.endpoint`,
    });
    outputs.push({
      name: 'eks_cluster_name',
      description: 'Name of the generated EKS cluster',
      value: `aws_eks_cluster.${firstEksName}.name`,
    });
  }

  if (firstRedisName) {
    outputs.push({
      name: 'elasticache_endpoint',
      description: 'Primary endpoint for the generated ElastiCache cluster',
      value: `aws_elasticache_cluster.${firstRedisName}.cache_nodes[0].address`,
    });
  }

  for (const node of activeNodes.filter(item => isDatabaseType(item.data.componentType))) {
    const upstream = dependencies.get(node.id) ?? [];
    if (upstream.length > 0) {
      resources.push(`# ${node.data.label} depends on ${upstream.map(sourceId => names.get(sourceId)).filter(Boolean).join(', ')} in the architecture graph.`);
    }
  }

  return {
    mainTf: resources.join('\n\n'),
    variablesTf: renderVariableBlocks(variables.all),
    outputsTf: renderOutputBlocks(outputs),
  };
}

function renderTerraformHeader(): string {
  return [
    'terraform {',
    '  required_version = ">= 1.5.0"',
    '  required_providers {',
    '    aws = {',
    '      source  = "hashicorp/aws"',
    '      version = "~> 5.0"',
    '    }',
    '  }',
    '',
    '  # Uncomment and configure to enable remote state:',
    '  # backend "s3" {',
    '  #   bucket         = "your-terraform-state-bucket"',
    '  #   key            = "archviz/terraform.tfstate"',
    '  #   region         = var.aws_region',
    '  #   dynamodb_table = "terraform-state-lock"',
    '  #   encrypt        = true',
    '  # }',
    '}',
  ].join('\n');
}

function renderSubnets(publicSubnetCount: number, privateSubnetCount: number): string {
  return [
    'resource "aws_subnet" "public" {',
    `  count                   = ${publicSubnetCount}`,
    '  vpc_id                  = aws_vpc.main.id',
    '  cidr_block              = var.public_subnet_cidrs[count.index]',
    '  availability_zone       = data.aws_availability_zones.available.names[count.index]',
    '  map_public_ip_on_launch = true',
    '',
    '  tags = {',
    '    Name = "${var.project_name}-public-${count.index + 1}"',
    '  }',
    '}',
    '',
    'resource "aws_subnet" "private" {',
    `  count             = ${privateSubnetCount}`,
    '  vpc_id            = aws_vpc.main.id',
    '  cidr_block        = var.private_subnet_cidrs[count.index]',
    '  availability_zone = data.aws_availability_zones.available.names[count.index]',
    '',
    '  tags = {',
    '    Name = "${var.project_name}-private-${count.index + 1}"',
    '  }',
    '}',
  ].join('\n');
}

function renderSecurityGroup(
  node: ArchNode,
  name: string,
  edges: ArchEdge[],
  nodes: ArchNode[],
  names: Map<string, string>,
): string {
  const isDatabase = isDatabaseType(node.data.componentType);
  const ingressLines: string[] = [];

  if (isDatabase) {
    const incoming = edges.filter(edge => edge.target === node.id);
    for (const edge of incoming) {
      const sourceNode = nodes.find(candidate => candidate.id === edge.source);
      const sourceName = names.get(edge.source);
      if (!sourceNode || !sourceName) {
        continue;
      }
      const port = getDefaultPort(node.data.componentType);
      ingressLines.push([
        '  ingress {',
        `    from_port       = ${port}`,
        `    to_port         = ${port}`,
        '    protocol        = "tcp"',
        `    security_groups = [aws_security_group.${sourceName}_sg.id]`,
        `    description     = "Allow ${sourceNode.data.label} to reach ${node.data.label}"`,
        '  }',
      ].join('\n'));
    }
  } else {
    ingressLines.push([
      '  ingress {',
      '    from_port   = 0',
      '    to_port     = 65535',
      '    protocol    = "tcp"',
      '    cidr_blocks = [var.vpc_cidr]',
      '    description = "Allow internal VPC traffic"',
      '  }',
    ].join('\n'));
  }

  if (node.data.componentType === 'load-balancer') {
    ingressLines.push([
      '  ingress {',
      '    from_port   = var.alb_listener_port',
      '    to_port     = var.alb_listener_port',
      '    protocol    = "tcp"',
      '    cidr_blocks = ["0.0.0.0/0"]',
      '    description = "Public HTTPS access"',
      '  }',
    ].join('\n'));
  }

  if (ingressLines.length === 0) {
    ingressLines.push('  # No ingress rules inferred from the architecture graph.');
  }

  return [
    `resource "aws_security_group" "${name}_sg" {`,
    `  name        = "${name}-sg"`,
    '  description = "Security group generated for architecture node"',
    '  vpc_id      = aws_vpc.main.id',
    '',
    ...ingressLines,
    '',
    '  egress {',
    '    from_port   = 0',
    '    to_port     = 0',
    '    protocol    = "-1"',
    '    cidr_blocks = ["0.0.0.0/0"]',
    '  }',
    '}',
  ].join('\n');
}

function renderEc2Resources(node: ArchNode, name: string, instanceVariableName: string): string {
  return [
    `resource "aws_instance" "${name}" {`,
    '  ami                    = "ami-1234567890abcdef0"',
    `  instance_type          = var.${instanceVariableName}`,
    '  subnet_id              = aws_subnet.private[0].id',
    `  vpc_security_group_ids = [aws_security_group.${name}_sg.id]`,
    '',
    '  tags = {',
    `    Name        = "${node.data.label}"`,
    '    Environment = var.environment',
    '  }',
    '}',
  ].join('\n');
}

function renderLambdaResources(node: ArchNode, name: string): string {
  const memorySize = parseLambdaMemory(node.data.tier.label);

  return [
    `resource "aws_iam_role" "${name}_lambda_role" {`,
    `  name               = "${name}-lambda-role"`,
    '  assume_role_policy = jsonencode({',
    '    Version = "2012-10-17"',
    '    Statement = [{',
    '      Action    = "sts:AssumeRole"',
    '      Effect    = "Allow"',
    '      Principal = { Service = "lambda.amazonaws.com" }',
    '    }]',
    '  })',
    '}',
    '',
    `resource "aws_iam_role_policy_attachment" "${name}_lambda_basic" {`,
    `  role       = aws_iam_role.${name}_lambda_role.name`,
    '  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"',
    '}',
    '',
    `resource "aws_lambda_function" "${name}" {`,
    `  function_name = "${name}"`,
    `  role          = aws_iam_role.${name}_lambda_role.arn`,
    '  runtime       = "nodejs20.x"',
    '  handler       = "index.handler"',
    `  memory_size   = ${memorySize}`,
    '  timeout       = 30',
    '',
    '  filename         = "lambda_payload.zip"',
    '  source_code_hash = filebase64sha256("lambda_payload.zip")',
    '',
    '  environment {',
    '    variables = {',
    '      ENVIRONMENT = var.environment',
    '    }',
    '  }',
    '',
    '  tags = {',
    `    Name = "${node.data.label}"`,
    '  }',
    '}',
  ].join('\n');
}

function renderEcsResources(node: ArchNode, name: string, variables: VariableRegistry): string {
  variables.ensure({
    name: `${name}_container_port`,
    type: 'number',
    description: `Container port for ${node.data.label}`,
    defaultValue: getNodeSetting(node, ['port', 'containerPort'], 8080),
  });

  return [
    `resource "aws_iam_role" "${name}_task_role" {`,
    `  name               = "${name}-task-role"`,
    '  assume_role_policy = jsonencode({',
    '    Version = "2012-10-17"',
    '    Statement = [{',
    '      Action    = "sts:AssumeRole"',
    '      Effect    = "Allow"',
    '      Principal = { Service = "ecs-tasks.amazonaws.com" }',
    '    }]',
    '  })',
    '}',
    '',
    `resource "aws_ecs_cluster" "${name}" {`,
    `  name = "${name}"`,
    '}',
    '',
    `resource "aws_ecs_task_definition" "${name}" {`,
    `  family                   = "${name}"`,
    '  network_mode             = "awsvpc"',
    '  requires_compatibilities = ["FARGATE"]',
    '  cpu                      = "256"',
    '  memory                   = "512"',
    `  task_role_arn            = aws_iam_role.${name}_task_role.arn`,
    `  execution_role_arn       = aws_iam_role.${name}_task_role.arn`,
    '  container_definitions    = jsonencode([{',
    `    name      = "${name}"`,
    '    image     = "public.ecr.aws/docker/library/nginx:latest"',
    '    essential = true',
    `    portMappings = [{ containerPort = var.${name}_container_port, hostPort = var.${name}_container_port, protocol = "tcp" }]`,
    '  }])',
    '}',
    '',
    `resource "aws_ecs_service" "${name}" {`,
    `  name            = "${name}"`,
    `  cluster         = aws_ecs_cluster.${name}.id`,
    `  task_definition = aws_ecs_task_definition.${name}.arn`,
    '  desired_count   = 1',
    '  launch_type     = "FARGATE"',
    '',
    '  network_configuration {',
    '    subnets          = aws_subnet.private[*].id',
    `    security_groups  = [aws_security_group.${name}_sg.id]`,
    '    assign_public_ip = false',
    '  }',
    '}',
  ].join('\n');
}

function renderEksResources(name: string): string {
  return [
    `resource "aws_iam_role" "${name}_cluster_role" {`,
    `  name               = "${name}-cluster-role"`,
    '  assume_role_policy = jsonencode({',
    '    Version = "2012-10-17"',
    '    Statement = [{',
    '      Action    = "sts:AssumeRole"',
    '      Effect    = "Allow"',
    '      Principal = { Service = "eks.amazonaws.com" }',
    '    }]',
    '  })',
    '}',
    '',
    `resource "aws_iam_role" "${name}_node_role" {`,
    `  name               = "${name}-node-role"`,
    '  assume_role_policy = jsonencode({',
    '    Version = "2012-10-17"',
    '    Statement = [{',
    '      Action    = "sts:AssumeRole"',
    '      Effect    = "Allow"',
    '      Principal = { Service = "ec2.amazonaws.com" }',
    '    }]',
    '  })',
    '}',
    '',
    `resource "aws_eks_cluster" "${name}" {`,
    `  name     = "${name}"`,
    `  role_arn = aws_iam_role.${name}_cluster_role.arn`,
    '',
    '  vpc_config {',
    '    subnet_ids = concat(aws_subnet.public[*].id, aws_subnet.private[*].id)',
    '  }',
    '}',
    '',
    `resource "aws_eks_node_group" "${name}_default" {`,
    `  cluster_name    = aws_eks_cluster.${name}.name`,
    `  node_group_name = "${name}-default"`,
    `  node_role_arn   = aws_iam_role.${name}_node_role.arn`,
    '  subnet_ids      = aws_subnet.private[*].id',
    '',
    '  scaling_config {',
    '    desired_size = 2',
    '    max_size     = 3',
    '    min_size     = 1',
    '  }',
    '}',
  ].join('\n');
}

function renderRdsResources(node: ArchNode, name: string, variables: VariableRegistry): string {
  const engine = node.data.componentType === 'postgresql' ? 'postgres' : 'mysql';
  const port = getNodeSetting(node, ['port', 'dbPort'], getDefaultPort(node.data.componentType));

  variables.ensure({
    name: `${name}_instance_type`,
    type: 'string',
    description: `Database instance class for ${node.data.label}`,
    defaultValue: node.data.tier.label.startsWith('db.') ? node.data.tier.label : 'db.t3.medium',
  });
  variables.ensure({
    name: 'db_username',
    type: 'string',
    description: 'Master username for relational databases',
    defaultValue: getNodeSetting(node, ['dbUsername', 'username', 'masterUsername'], 'appuser'),
  });
  variables.ensure({
    name: 'db_password',
    type: 'string',
    description: 'Master password for relational databases',
    sensitive: true,
  });
  variables.ensure({
    name: 'db_port',
    type: 'number',
    description: 'Port for relational database access',
    defaultValue: port,
  });

  return [
    `resource "aws_db_subnet_group" "${name}" {`,
    `  name       = "${name}-subnets"`,
    '  subnet_ids = aws_subnet.private[*].id',
    '}',
    '',
    `resource "aws_db_instance" "${name}" {`,
    `  identifier             = "${name}"`,
    `  engine                 = "${engine}"`,
    `  instance_class         = var.${name}_instance_type`,
    '  allocated_storage      = 20',
    `  db_subnet_group_name   = aws_db_subnet_group.${name}.name`,
    '  username               = var.db_username',
    '  password               = var.db_password',
    '  port                   = var.db_port',
    `  vpc_security_group_ids = [aws_security_group.${name}_sg.id]`,
    '  skip_final_snapshot    = true',
    '  publicly_accessible    = false',
    '  multi_az               = false',
    '}',
  ].join('\n');
}

function renderRedisResources(node: ArchNode, name: string, variables: VariableRegistry): string {
  variables.ensure({
    name: `${name}_node_type`,
    type: 'string',
    description: `ElastiCache node type for ${node.data.label}`,
    defaultValue: node.data.tier.label.startsWith('cache.') ? node.data.tier.label : 'cache.t3.micro',
  });
  variables.ensure({
    name: 'redis_port',
    type: 'number',
    description: 'Port for Redis/ElastiCache',
    defaultValue: getNodeSetting(node, ['port', 'redisPort'], 6379),
  });

  return [
    `resource "aws_elasticache_subnet_group" "${name}" {`,
    `  name       = "${name}-subnets"`,
    '  subnet_ids = aws_subnet.private[*].id',
    '}',
    '',
    `resource "aws_elasticache_cluster" "${name}" {`,
    `  cluster_id           = "${name}"`,
    '  engine               = "redis"',
    `  node_type            = var.${name}_node_type`,
    '  num_cache_nodes      = 1',
    '  parameter_group_name = "default.redis7"',
    '  port                 = var.redis_port',
    `  subnet_group_name    = aws_elasticache_subnet_group.${name}.name`,
    `  security_group_ids   = [aws_security_group.${name}_sg.id]`,
    '}',
  ].join('\n');
}

function renderS3Resources(_node: ArchNode, name: string): string {
  return [
    `resource "aws_s3_bucket" "${name}" {`,
    `  bucket = "${name}-\${var.environment}"`,
    '}',
  ].join('\n');
}

function renderAlbResources(name: string, variables: VariableRegistry): string {
  variables.ensure({
    name: 'alb_listener_port',
    type: 'number',
    description: 'HTTPS listener port for the application load balancer',
    defaultValue: 443,
  });
  variables.ensure({
    name: 'app_port',
    type: 'number',
    description: 'Default target application port behind the load balancer',
    defaultValue: 80,
  });
  variables.ensure({
    name: 'certificate_arn',
    type: 'string',
    description: 'ACM certificate ARN for HTTPS listeners',
  });

  return [
    `resource "aws_lb" "${name}" {`,
    `  name               = "${name}"`,
    '  internal           = false',
    '  load_balancer_type = "application"',
    '  subnets            = aws_subnet.public[*].id',
    `  security_groups    = [aws_security_group.${name}_sg.id]`,
    '}',
    '',
    `resource "aws_lb_target_group" "${name}_tg" {`,
    `  name     = "${name}-tg"`,
    '  port     = var.app_port',
    '  protocol = "HTTP"',
    '  vpc_id   = aws_vpc.main.id',
    '}',
    '',
    `resource "aws_lb_listener" "${name}_listener" {`,
    `  load_balancer_arn = aws_lb.${name}.arn`,
    '  port              = var.alb_listener_port',
    '  protocol          = "HTTPS"',
    '  certificate_arn   = var.certificate_arn',
    '',
    '  default_action {',
    '    type             = "forward"',
    `    target_group_arn = aws_lb_target_group.${name}_tg.arn`,
    '  }',
    '}',
  ].join('\n');
}

function renderGenericAwsResource(node: ArchNode, name: string): string {
  return [
    `resource "null_resource" "${name}" {`,
    '  triggers = {',
    `    component_label = "${node.data.label}"`,
    `    component_type  = "${node.data.componentType}"`,
    '    environment     = var.environment',
    '  }',
    '}',
  ].join('\n');
}

function parseLambdaMemory(label: string): number {
  const match = label.match(/(\d+)/);
  if (!match) {
    return 512;
  }
  return Number.parseInt(match[1], 10);
}

function isEc2Type(type: string): boolean {
  return [
    'api-server',
    'web-server',
    'worker',
    'websocket-server',
    'graphql-server',
    'game-server',
    'ml-worker',
  ].includes(type);
}

function createVariableRegistry(seed: TerraformVariable[]): VariableRegistry {
  const variableMap = new Map<string, TerraformVariable>();
  for (const variable of seed) {
    variableMap.set(variable.name, variable);
  }

  const registry: VariableRegistry = {
    all: Array.from(variableMap.values()),
    ensure(variable: TerraformVariable) {
      if (!variableMap.has(variable.name)) {
        variableMap.set(variable.name, variable);
        registry.all = Array.from(variableMap.values());
      }
      return `var.${variable.name}`;
    },
  };

  return registry;
}
