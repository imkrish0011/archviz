import type { ArchEdge, ArchNode } from '../types';
import {
  buildSubnetCidrs,
  buildUniqueNames,
  getDefaultPort,
  getNodeSetting,
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
  const publicSubnetCount = Math.max(
    2,
    nodes.filter(node => node.data.componentType === 'groupNode' && node.data.label.toLowerCase().includes('public')).length,
  );
  const privateSubnetCount = Math.max(
    2,
    nodes.filter(node => node.data.componentType === 'groupNode' && node.data.label.toLowerCase().includes('private')).length,
  );
  const resourceIndex = new Map(activeNodes.map((node, index) => [node.id, index]));
  const namesByType = buildNamesByType(activeNodes, names);

  const variables = createVariableRegistry([
    { name: 'aws_region', type: 'string', description: 'AWS region for all generated resources', defaultValue: 'us-east-1' },
    { name: 'environment', type: 'string', description: 'Deployment environment name', defaultValue: 'dev' },
    { name: 'project_name', type: 'string', description: 'Project prefix for generated resources', defaultValue: sanitizeName(projectName) || 'archviz' },
    { name: 'vpc_cidr', type: 'string', description: 'CIDR range for the VPC', defaultValue: '10.0.0.0/16' },
    { name: 'public_subnet_cidrs', type: 'list(string)', description: 'Public subnet CIDR blocks across multiple AZs', defaultValue: buildSubnetCidrs('10.0', publicSubnetCount, 1) },
    { name: 'private_subnet_cidrs', type: 'list(string)', description: 'Private subnet CIDR blocks across multiple AZs', defaultValue: buildSubnetCidrs('10.0', privateSubnetCount, 101) },
    { name: 'alb_ingress_cidr_blocks', type: 'list(string)', description: 'Allowed ingress CIDR blocks for public load balancers', defaultValue: ['0.0.0.0/0'] },
    { name: 'admin_cidr_blocks', type: 'list(string)', description: 'Administrative CIDR blocks for control plane access', defaultValue: ['10.0.0.0/16'] },
  ]);

  const resources: string[] = [
    renderTerraformHeader(projectName),
    renderProviderAndDataSources(),
    renderNetworking(publicSubnetCount, privateSubnetCount),
  ];

  const outputs: TerraformOutput[] = [
    { name: 'vpc_id', description: 'Generated VPC ID', value: 'aws_vpc.main.id' },
    { name: 'public_subnet_ids', description: 'Public subnet IDs', value: 'aws_subnet.public[*].id' },
    { name: 'private_subnet_ids', description: 'Private subnet IDs', value: 'aws_subnet.private[*].id' },
    { name: 'nat_gateway_public_ips', description: 'Elastic IPs attached to NAT gateways', value: 'aws_eip.nat[*].public_ip' },
  ];

  const ec2Names: string[] = [];
  const apiGatewayNames: string[] = [];
  const cdnNames: string[] = [];
  const albNames: string[] = [];
  const rdsNames: string[] = [];
  const redisNames: string[] = [];
  const eksNames: string[] = [];
  const lambdaNames: string[] = [];

  for (const node of activeNodes) {
    const effectiveType = resolveEffectiveType(node.data.componentType);
    const name = names.get(node.id) ?? sanitizeName(node.data.label);
    const dependencyNames = getDependencyNames(node.id, edges, names, resourceIndex);

    if (needsSecurityGroup(effectiveType)) {
      resources.push(renderSecurityGroup(node, name, effectiveType, dependencyNames, variables));
    }

    switch (effectiveType) {
      case 'ec2':
        resources.push(renderEc2Resources(node, name, variables));
        ec2Names.push(name);
        break;
      case 'lambda':
        resources.push(renderLambdaResources(node, name, variables));
        lambdaNames.push(name);
        break;
      case 'ecs':
        resources.push(renderEcsResources(node, name, variables));
        break;
      case 'eks':
        resources.push(renderEksResources(node, name));
        eksNames.push(name);
        break;
      case 'rds':
        resources.push(renderRdsResources(node, name, variables));
        rdsNames.push(name);
        break;
      case 'redis':
        resources.push(renderRedisResources(node, name, variables));
        redisNames.push(name);
        break;
      case 's3':
        resources.push(renderS3Resources(name));
        break;
      case 'alb':
        resources.push(renderAlbResources(node, name, variables));
        albNames.push(name);
        break;
      case 'cloudfront':
        resources.push(renderCloudFrontResources(name));
        cdnNames.push(name);
        break;
      case 'apigateway':
        resources.push(renderApiGatewayResources(name, namesByType.lambda?.[0]));
        apiGatewayNames.push(name);
        break;
      case 'msk':
        resources.push(renderMskResources(node, name, variables));
        break;
      case 'keyspaces':
        resources.push(renderKeyspacesResources(name));
        break;
      case 'dynamodb':
        resources.push(renderDynamoDbResources(name));
        break;
      case 'mq':
        resources.push(renderAmazonMqResources(name));
        break;
      case 'cognito':
        resources.push(renderCognitoResources(name));
        break;
      case 'sns':
        resources.push(renderSnsResources(name));
        break;
      case 'sqs':
        resources.push(renderSqsResources(name));
        break;
      case 'route53':
        resources.push(renderRoute53Resources(name, variables));
        break;
      case 'cloudwatch':
        resources.push(renderCloudWatchResources(name));
        break;
      case 'opensearch':
        resources.push(renderOpenSearchResources(name));
        break;
      case 'redshift':
        resources.push(renderRedshiftResources(name));
        break;
      default:
        resources.push(renderSecretsManagerResources(node, name));
        break;
    }
  }

  if (ec2Names.length > 0) {
    outputs.push({ name: 'ec2_private_ips', description: 'Private IP addresses for generated EC2 instances', value: `[${ec2Names.map(name => `aws_instance.${name}.private_ip`).join(', ')}]` });
  }
  if (albNames.length > 0) {
    outputs.push({ name: 'alb_dns_name', description: 'DNS name for the first generated application load balancer', value: `aws_lb.${albNames[0]}.dns_name` });
    outputs.push({ name: 'alb_url', description: 'HTTP URL for the first generated application load balancer', value: `format("http://%s", aws_lb.${albNames[0]}.dns_name)` });
  }
  if (rdsNames.length > 0) {
    outputs.push({ name: 'rds_endpoint', description: 'Endpoint address for the first generated RDS instance', value: `aws_db_instance.${rdsNames[0]}.address` });
  }
  if (redisNames.length > 0) {
    outputs.push({ name: 'elasticache_endpoint', description: 'Primary endpoint for the first generated ElastiCache replication group', value: `aws_elasticache_replication_group.${redisNames[0]}.primary_endpoint_address` });
  }
  if (eksNames.length > 0) {
    outputs.push({ name: 'eks_cluster_endpoint', description: 'Endpoint for the generated EKS cluster', value: `aws_eks_cluster.${eksNames[0]}.endpoint` });
    outputs.push({ name: 'eks_cluster_name', description: 'Name of the generated EKS cluster', value: `aws_eks_cluster.${eksNames[0]}.name` });
  }
  if (apiGatewayNames.length > 0) {
    outputs.push({ name: 'api_gateway_url', description: 'Invoke URL for the first generated API Gateway stage', value: `aws_apigatewayv2_stage.${apiGatewayNames[0]}_stage.invoke_url` });
  }
  if (cdnNames.length > 0) {
    outputs.push({ name: 'cloudfront_domain_name', description: 'Distribution domain name for the first generated CloudFront distribution', value: `aws_cloudfront_distribution.${cdnNames[0]}.domain_name` });
  }
  if (lambdaNames.length > 0) {
    outputs.push({ name: 'lambda_function_names', description: 'Names of generated Lambda functions', value: `[${lambdaNames.map(name => `aws_lambda_function.${name}.function_name`).join(', ')}]` });
  }

  return {
    mainTf: resources.join('\n\n'),
    variablesTf: renderVariableBlocks(variables.all),
    outputsTf: renderOutputBlocks(outputs),
  };
}

function renderTerraformHeader(projectName: string): string {
  const sanitizedProject = sanitizeName(projectName) || 'archviz';

  return [
    'terraform {',
    '  required_version = ">= 1.5.0"',
    '  required_providers {',
    '    aws = {',
    '      source  = "hashicorp/aws"',
    '      version = "~> 5.0"',
    '    }',
    '    random = {',
    '      source  = "hashicorp/random"',
    '      version = "~> 3.6"',
    '    }',
    '    archive = {',
    '      source  = "hashicorp/archive"',
    '      version = "~> 2.4"',
    '    }',
    '  }',
    '',
    '  backend "s3" {',
    `    bucket         = "${sanitizedProject}-terraform-state"`,
    `    key            = "${sanitizedProject}/terraform.tfstate"`,
    '    region         = "us-east-1"',
    '    encrypt        = true',
    `    dynamodb_table = "${sanitizedProject}-terraform-locks"`,
    '  }',
    '}',
  ].join('\n');
}

function renderProviderAndDataSources(): string {
  return [
    'provider "aws" {',
    '  region = var.aws_region',
    '}',
    '',
    'data "aws_availability_zones" "available" {',
    '  state = "available"',
    '}',
    '',
    'data "aws_ami" "latest_amazon_linux" {',
    '  most_recent = true',
    '  owners      = ["amazon"]',
    '',
    '  filter {',
    '    name   = "name"',
    '    values = ["al2023-ami-2023.*-x86_64"]',
    '  }',
    '}',
    '',
    'data "aws_caller_identity" "current" {}',
    '',
    'locals {',
    '  common_tags = {',
    '    Project     = var.project_name',
    '    Environment = var.environment',
    '    ManagedBy   = "archviz"',
    '  }',
    '}',
    '',
    'resource "random_string" "bucket_suffix" {',
    '  length  = 6',
    '  lower   = true',
    '  upper   = false',
    '  special = false',
    '  numeric = true',
    '}',
  ].join('\n');
}

function renderNetworking(publicSubnetCount: number, privateSubnetCount: number): string {
  return [
    'resource "aws_vpc" "main" {',
    '  cidr_block           = var.vpc_cidr',
    '  enable_dns_hostnames = true',
    '  enable_dns_support   = true',
    '',
    '  tags = merge(local.common_tags, {',
    '    Name = "${var.project_name}-vpc"',
    '  })',
    '}',
    '',
    'resource "aws_internet_gateway" "main" {',
    '  vpc_id = aws_vpc.main.id',
    '',
    '  tags = merge(local.common_tags, {',
    '    Name = "${var.project_name}-igw"',
    '  })',
    '}',
    '',
    'resource "aws_subnet" "public" {',
    `  count                   = ${publicSubnetCount}`,
    '  vpc_id                  = aws_vpc.main.id',
    '  cidr_block              = var.public_subnet_cidrs[count.index]',
    '  availability_zone       = data.aws_availability_zones.available.names[count.index]',
    '  map_public_ip_on_launch = true',
    '',
    '  tags = merge(local.common_tags, {',
    '    Name = "${var.project_name}-public-${count.index + 1}"',
    '    Tier = "public"',
    '  })',
    '}',
    '',
    'resource "aws_subnet" "private" {',
    `  count             = ${privateSubnetCount}`,
    '  vpc_id            = aws_vpc.main.id',
    '  cidr_block        = var.private_subnet_cidrs[count.index]',
    '  availability_zone = data.aws_availability_zones.available.names[count.index]',
    '',
    '  tags = merge(local.common_tags, {',
    '    Name = "${var.project_name}-private-${count.index + 1}"',
    '    Tier = "private"',
    '  })',
    '}',
    '',
    'resource "aws_route_table" "public" {',
    '  vpc_id = aws_vpc.main.id',
    '',
    '  route {',
    '    cidr_block = "0.0.0.0/0"',
    '    gateway_id = aws_internet_gateway.main.id',
    '  }',
    '',
    '  tags = merge(local.common_tags, {',
    '    Name = "${var.project_name}-public-rt"',
    '  })',
    '}',
    '',
    'resource "aws_route_table_association" "public" {',
    `  count          = ${publicSubnetCount}`,
    '  subnet_id      = aws_subnet.public[count.index].id',
    '  route_table_id = aws_route_table.public.id',
    '}',
    '',
    'resource "aws_eip" "nat" {',
    `  count  = ${publicSubnetCount}`,
    '  domain = "vpc"',
    '',
    '  tags = merge(local.common_tags, {',
    '    Name = "${var.project_name}-nat-eip-${count.index + 1}"',
    '  })',
    '}',
    '',
    'resource "aws_nat_gateway" "main" {',
    `  count         = ${publicSubnetCount}`,
    '  allocation_id = aws_eip.nat[count.index].id',
    '  subnet_id     = aws_subnet.public[count.index].id',
    '  depends_on    = [aws_internet_gateway.main]',
    '',
    '  tags = merge(local.common_tags, {',
    '    Name = "${var.project_name}-nat-${count.index + 1}"',
    '  })',
    '}',
    '',
    'resource "aws_route_table" "private" {',
    `  count  = ${privateSubnetCount}`,
    '  vpc_id = aws_vpc.main.id',
    '',
    '  route {',
    '    cidr_block     = "0.0.0.0/0"',
    '    nat_gateway_id = aws_nat_gateway.main[count.index % length(aws_nat_gateway.main)].id',
    '  }',
    '',
    '  tags = merge(local.common_tags, {',
    '    Name = "${var.project_name}-private-rt-${count.index + 1}"',
    '  })',
    '}',
    '',
    'resource "aws_route_table_association" "private" {',
    `  count          = ${privateSubnetCount}`,
    '  subnet_id      = aws_subnet.private[count.index].id',
    '  route_table_id = aws_route_table.private[count.index].id',
    '}',
  ].join('\n');
}

function renderSecurityGroup(
  node: ArchNode,
  name: string,
  effectiveType: string,
  dependencyNames: string[],
  variables: VariableRegistry,
): string {
  const appPortVariable = `${name}_port`;
  const appPortRef = ensureAppPortVariable(node, name, variables);
  const ingressBlocks: string[] = [];

  if (effectiveType === 'alb') {
    ingressBlocks.push(renderCidrIngressBlock(80, 'var.alb_ingress_cidr_blocks', 'Public HTTP ingress'));
    ingressBlocks.push(renderCidrIngressBlock(443, 'var.alb_ingress_cidr_blocks', 'Public HTTPS ingress'));
  } else if (effectiveType === 'eks') {
    ingressBlocks.push(renderCidrIngressBlock(443, 'var.admin_cidr_blocks', 'Administrative cluster access'));
  } else if (['rds', 'redis', 'msk', 'mq'].includes(effectiveType)) {
    const targetPort = getPortReferenceForType(effectiveType, name, appPortRef);
    if (dependencyNames.length > 0) {
      for (const dependencyName of dependencyNames) {
        ingressBlocks.push(renderSecurityGroupIngressBlock(targetPort, dependencyName, `Dependency access from ${dependencyName}`));
      }
    } else {
      ingressBlocks.push(renderVpcIngressBlock(targetPort, `Application access for ${name}`));
    }
  } else if (['ec2', 'ecs'].includes(effectiveType)) {
    const loadBalancerSources = dependencyNames.filter(source => source.includes('load') || source.includes('alb'));
    if (loadBalancerSources.length > 0) {
      for (const dependencyName of loadBalancerSources) {
        ingressBlocks.push(renderSecurityGroupIngressBlock(appPortRef, dependencyName, `Load balancer traffic from ${dependencyName}`));
      }
    } else {
      ingressBlocks.push(renderVpcIngressBlock(appPortRef, `Internal application traffic for ${name}`));
    }
  }

  return [
    `resource "aws_security_group" "${name}_sg" {`,
    `  name        = "${name}-sg"`,
    '  description = "Managed security group for generated resource"',
    '  vpc_id      = aws_vpc.main.id',
    '',
    ...ingressBlocks,
    '',
    '  egress {',
    '    from_port   = 0',
    '    to_port     = 0',
    '    protocol    = "-1"',
    '    cidr_blocks = ["0.0.0.0/0"]',
    '    description = "Allow outbound traffic"',
    '  }',
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${name}-sg"`,
    '  })',
    '}',
  ].join('\n');

  function ensureAppPortVariable(currentNode: ArchNode, currentName: string, registry: VariableRegistry): string {
    registry.ensure({
      name: appPortVariable,
      type: 'number',
      description: `Primary listener or application port for ${currentNode.data.label}`,
      defaultValue: getNodeSetting(currentNode, ['port', 'servicePort', 'containerPort'], getDefaultPort(currentNode.data.componentType)),
    });
    return `var.${currentName}_port`;
  }
}

function renderEc2Resources(node: ArchNode, name: string, variables: VariableRegistry): string {
  variables.ensure({
    name: `${name}_instance_type`,
    type: 'string',
    description: `EC2 instance type for ${node.data.label}`,
    defaultValue: node.data.tier.label.includes('.') ? node.data.tier.label : 't3.medium',
  });
  variables.ensure({
    name: `${name}_root_volume_size`,
    type: 'number',
    description: `Root volume size in GB for ${node.data.label}`,
    defaultValue: 30,
  });

  return [
    `resource "aws_instance" "${name}" {`,
    '  ami                         = data.aws_ami.latest_amazon_linux.id',
    `  instance_type               = var.${name}_instance_type`,
    '  subnet_id                   = aws_subnet.private[0].id',
    `  vpc_security_group_ids      = [aws_security_group.${name}_sg.id]`,
    '  associate_public_ip_address = false',
    '  depends_on                  = [aws_route_table_association.private]',
    '',
    '  root_block_device {',
    `    volume_size           = var.${name}_root_volume_size`,
    '    volume_type           = "gp3"',
    '    encrypted             = true',
    '    delete_on_termination = true',
    '  }',
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${node.data.label}"`,
    '  })',
    '}',
  ].join('\n');
}

function renderLambdaResources(node: ArchNode, name: string, variables: VariableRegistry): string {
  variables.ensure({
    name: `${name}_memory_size`,
    type: 'number',
    description: `Lambda memory size for ${node.data.label}`,
    defaultValue: parseLambdaMemory(node.data.tier.label),
  });
  variables.ensure({
    name: `${name}_timeout`,
    type: 'number',
    description: `Lambda timeout in seconds for ${node.data.label}`,
    defaultValue: 30,
  });

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
    `data "archive_file" "${name}_lambda_zip" {`,
    '  type                    = "zip"',
    '  source_content          = "exports.handler = async () => ({ statusCode: 200, body: \\"ok\\" });"',
    '  source_content_filename = "index.js"',
    `  output_path             = "${'${path.module}'}\\\\${name}.zip"`,
    '}',
    '',
    `resource "aws_cloudwatch_log_group" "${name}" {`,
    `  name              = "/aws/lambda/${name}"`,
    '  retention_in_days = 30',
    '}',
    '',
    `resource "aws_lambda_function" "${name}" {`,
    `  function_name    = "${name}"`,
    `  role             = aws_iam_role.${name}_lambda_role.arn`,
    '  runtime          = "nodejs20.x"',
    '  handler          = "index.handler"',
    `  memory_size      = var.${name}_memory_size`,
    `  timeout          = var.${name}_timeout`,
    `  filename         = data.archive_file.${name}_lambda_zip.output_path`,
    `  source_code_hash = data.archive_file.${name}_lambda_zip.output_base64sha256`,
    '',
    '  environment {',
    '    variables = {',
    '      ENVIRONMENT = var.environment',
    '    }',
    '  }',
    '',
    `  depends_on = [aws_cloudwatch_log_group.${name}]`,
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${node.data.label}"`,
    '  })',
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
    `resource "aws_cloudwatch_log_group" "${name}_ecs" {`,
    `  name              = "/ecs/${name}"`,
    '  retention_in_days = 30',
    '}',
    '',
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
    `resource "aws_iam_role_policy_attachment" "${name}_task_execution" {`,
    `  role       = aws_iam_role.${name}_task_role.name`,
    '  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"',
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
    '    image     = "public.ecr.aws/docker/library/nginx:stable-alpine"',
    '    essential = true',
    `    portMappings = [{ containerPort = var.${name}_container_port, hostPort = var.${name}_container_port, protocol = "tcp" }]`,
    '    logConfiguration = {',
    '      logDriver = "awslogs"',
    '      options = {',
    `        awslogs-group         = aws_cloudwatch_log_group.${name}_ecs.name`,
    '        awslogs-region        = var.aws_region',
    '        awslogs-stream-prefix = "ecs"',
    '      }',
    '    }',
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
    '',
    `  depends_on = [aws_route_table_association.private, aws_iam_role_policy_attachment.${name}_task_execution]`,
    '}',
  ].join('\n');
}

function renderEksResources(node: ArchNode, name: string): string {
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
    `resource "aws_iam_role_policy_attachment" "${name}_cluster_policy" {`,
    `  role       = aws_iam_role.${name}_cluster_role.name`,
    '  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"',
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
    `resource "aws_iam_role_policy_attachment" "${name}_node_worker" {`,
    `  role       = aws_iam_role.${name}_node_role.name`,
    '  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"',
    '}',
    '',
    `resource "aws_iam_role_policy_attachment" "${name}_node_cni" {`,
    `  role       = aws_iam_role.${name}_node_role.name`,
    '  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"',
    '}',
    '',
    `resource "aws_iam_role_policy_attachment" "${name}_node_ecr" {`,
    `  role       = aws_iam_role.${name}_node_role.name`,
    '  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"',
    '}',
    '',
    `resource "aws_eks_cluster" "${name}" {`,
    `  name     = "${name}"`,
    `  role_arn = aws_iam_role.${name}_cluster_role.arn`,
    '',
    '  vpc_config {',
    '    subnet_ids              = concat(aws_subnet.public[*].id, aws_subnet.private[*].id)',
    '    endpoint_private_access = true',
    '    endpoint_public_access  = true',
    '    public_access_cidrs     = var.admin_cidr_blocks',
    '  }',
    '',
    `  depends_on = [aws_iam_role_policy_attachment.${name}_cluster_policy]`,
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${node.data.label}"`,
    '  })',
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
    '',
    `  depends_on = [aws_iam_role_policy_attachment.${name}_node_worker, aws_iam_role_policy_attachment.${name}_node_cni, aws_iam_role_policy_attachment.${name}_node_ecr]`,
    '}',
  ].join('\n');
}

function renderRdsResources(node: ArchNode, name: string, variables: VariableRegistry): string {
  const engine = node.data.componentType === 'postgresql' ? 'postgres' : 'mysql';
  const defaultClass = node.data.tier.label.startsWith('db.') ? node.data.tier.label : 'db.t3.medium';
  const defaultPort = node.data.componentType === 'postgresql' ? 5432 : 3306;

  variables.ensure({ name: `${name}_instance_class`, type: 'string', description: `RDS instance class for ${node.data.label}`, defaultValue: defaultClass });
  variables.ensure({ name: `${name}_allocated_storage`, type: 'number', description: `Allocated storage in GB for ${node.data.label}`, defaultValue: 50 });
  variables.ensure({ name: `${name}_db_name`, type: 'string', description: `Database name for ${node.data.label}`, defaultValue: name.replace(/_/g, '') });
  variables.ensure({ name: `${name}_username`, type: 'string', description: `Master username for ${node.data.label}`, defaultValue: getNodeSetting(node, ['dbUsername', 'username', 'masterUsername'], 'appuser') });
  variables.ensure({ name: `${name}_password`, type: 'string', description: `Master password for ${node.data.label}`, sensitive: true });
  variables.ensure({ name: `${name}_port`, type: 'number', description: `Database port for ${node.data.label}`, defaultValue: getNodeSetting(node, ['port', 'dbPort'], defaultPort) });

  return [
    `resource "aws_db_subnet_group" "${name}" {`,
    `  name       = "${name}-subnets"`,
    '  subnet_ids = aws_subnet.private[*].id',
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${name}-subnet-group"`,
    '  })',
    '}',
    '',
    `resource "aws_db_instance" "${name}" {`,
    `  identifier                 = "${name}"`,
    `  engine                     = "${engine}"`,
    `  instance_class             = var.${name}_instance_class`,
    `  allocated_storage          = var.${name}_allocated_storage`,
    `  db_name                    = var.${name}_db_name`,
    `  username                   = var.${name}_username`,
    `  password                   = var.${name}_password`,
    `  port                       = var.${name}_port`,
    `  db_subnet_group_name       = aws_db_subnet_group.${name}.name`,
    `  vpc_security_group_ids     = [aws_security_group.${name}_sg.id]`,
    '  storage_encrypted          = true',
    '  backup_retention_period    = 7',
    '  skip_final_snapshot        = true',
    '  deletion_protection        = false',
    '  publicly_accessible        = false',
    '  multi_az                   = true',
    '  auto_minor_version_upgrade = true',
    '  depends_on                 = [aws_route_table_association.private]',
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${node.data.label}"`,
    '  })',
    '}',
  ].join('\n');
}

function renderRedisResources(node: ArchNode, name: string, variables: VariableRegistry): string {
  variables.ensure({ name: `${name}_node_type`, type: 'string', description: `ElastiCache node type for ${node.data.label}`, defaultValue: node.data.tier.label.startsWith('cache.') ? node.data.tier.label : 'cache.t3.micro' });
  variables.ensure({ name: `${name}_port`, type: 'number', description: `Redis port for ${node.data.label}`, defaultValue: getNodeSetting(node, ['port', 'redisPort'], 6379) });

  return [
    `resource "aws_elasticache_subnet_group" "${name}" {`,
    `  name       = "${name}-subnets"`,
    '  subnet_ids = aws_subnet.private[*].id',
    '}',
    '',
    `resource "aws_elasticache_replication_group" "${name}" {`,
    `  replication_group_id       = "${name}"`,
    `  description                = "Replication group for ${name}"`,
    '  engine                     = "redis"',
    `  node_type                  = var.${name}_node_type`,
    '  num_cache_clusters         = 2',
    '  automatic_failover_enabled = true',
    '  multi_az_enabled           = true',
    `  port                       = var.${name}_port`,
    `  subnet_group_name          = aws_elasticache_subnet_group.${name}.name`,
    `  security_group_ids         = [aws_security_group.${name}_sg.id]`,
    '  at_rest_encryption_enabled = true',
    '  transit_encryption_enabled = true',
    '  apply_immediately          = true',
    '  depends_on                 = [aws_route_table_association.private]',
    '}',
  ].join('\n');
}

function renderS3Resources(name: string): string {
  return [
    `resource "aws_s3_bucket" "${name}" {`,
    `  bucket = lower("${name}-${'${var.environment}'}-${'${random_string.bucket_suffix.result}'}")`,
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${name}"`,
    '  })',
    '}',
    '',
    `resource "aws_s3_bucket_versioning" "${name}_versioning" {`,
    `  bucket = aws_s3_bucket.${name}.id`,
    '',
    '  versioning_configuration {',
    '    status = "Enabled"',
    '  }',
    '}',
    '',
    `resource "aws_s3_bucket_server_side_encryption_configuration" "${name}_encryption" {`,
    `  bucket = aws_s3_bucket.${name}.id`,
    '',
    '  rule {',
    '    apply_server_side_encryption_by_default {',
    '      sse_algorithm = "AES256"',
    '    }',
    '  }',
    '}',
    '',
    `resource "aws_s3_bucket_public_access_block" "${name}_public_access" {`,
    `  bucket = aws_s3_bucket.${name}.id`,
    '',
    '  block_public_acls       = true',
    '  block_public_policy     = true',
    '  ignore_public_acls      = true',
    '  restrict_public_buckets = true',
    '}',
  ].join('\n');
}

function renderAlbResources(node: ArchNode, name: string, variables: VariableRegistry): string {
  variables.ensure({ name: `${name}_target_port`, type: 'number', description: `Target group port for ${node.data.label}`, defaultValue: 80 });

  return [
    `resource "aws_lb" "${name}" {`,
    `  name               = substr("${name}", 0, 32)`,
    '  internal           = false',
    '  load_balancer_type = "application"',
    '  subnets            = aws_subnet.public[*].id',
    `  security_groups    = [aws_security_group.${name}_sg.id]`,
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${node.data.label}"`,
    '  })',
    '}',
    '',
    `resource "aws_lb_target_group" "${name}_tg" {`,
    `  name        = substr("${name}-tg", 0, 32)`,
    `  port        = var.${name}_target_port`,
    '  protocol    = "HTTP"',
    '  target_type = "ip"',
    '  vpc_id      = aws_vpc.main.id',
    '',
    '  health_check {',
    '    enabled             = true',
    '    healthy_threshold   = 2',
    '    interval            = 30',
    '    matcher             = "200-399"',
    '    path                = "/"',
    '    protocol            = "HTTP"',
    '    timeout             = 5',
    '    unhealthy_threshold = 2',
    '  }',
    '}',
    '',
    `resource "aws_lb_listener" "${name}_http" {`,
    `  load_balancer_arn = aws_lb.${name}.arn`,
    '  port              = 80',
    '  protocol          = "HTTP"',
    '',
    '  default_action {',
    '    type             = "forward"',
    `    target_group_arn = aws_lb_target_group.${name}_tg.arn`,
    '  }',
    '}',
  ].join('\n');
}

function renderCloudFrontResources(name: string): string {
  return [
    `resource "aws_s3_bucket" "${name}_origin" {`,
    `  bucket = lower("${name}-origin-${'${var.environment}'}-${'${random_string.bucket_suffix.result}'}")`,
    '}',
    '',
    `resource "aws_s3_bucket_server_side_encryption_configuration" "${name}_origin_encryption" {`,
    `  bucket = aws_s3_bucket.${name}_origin.id`,
    '',
    '  rule {',
    '    apply_server_side_encryption_by_default {',
    '      sse_algorithm = "AES256"',
    '    }',
    '  }',
    '}',
    '',
    `resource "aws_s3_bucket_public_access_block" "${name}_origin_access" {`,
    `  bucket = aws_s3_bucket.${name}_origin.id`,
    '',
    '  block_public_acls       = true',
    '  block_public_policy     = true',
    '  ignore_public_acls      = true',
    '  restrict_public_buckets = true',
    '}',
    '',
    `resource "aws_cloudfront_origin_access_control" "${name}" {`,
    `  name                              = "${name}-oac"`,
    '  description                       = "Origin access control for generated CloudFront distribution"',
    '  origin_access_control_origin_type = "s3"',
    '  signing_behavior                  = "always"',
    '  signing_protocol                  = "sigv4"',
    '}',
    '',
    `resource "aws_cloudfront_distribution" "${name}" {`,
    '  enabled             = true',
    '  default_root_object = "index.html"',
    '',
    '  origin {',
    `    domain_name              = aws_s3_bucket.${name}_origin.bucket_regional_domain_name`,
    `    origin_id                = "${name}-origin"`,
    `    origin_access_control_id = aws_cloudfront_origin_access_control.${name}.id`,
    '  }',
    '',
    '  default_cache_behavior {',
    `    target_origin_id       = "${name}-origin"`,
    '    viewer_protocol_policy = "redirect-to-https"',
    '    allowed_methods        = ["GET", "HEAD", "OPTIONS"]',
    '    cached_methods         = ["GET", "HEAD"]',
    '    compress               = true',
    '',
    '    forwarded_values {',
    '      query_string = false',
    '      cookies {',
    '        forward = "none"',
    '      }',
    '    }',
    '  }',
    '',
    '  restrictions {',
    '    geo_restriction {',
    '      restriction_type = "none"',
    '    }',
    '  }',
    '',
    '  viewer_certificate {',
    '    cloudfront_default_certificate = true',
    '  }',
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${name}"`,
    '  })',
    '}',
  ].join('\n');
}

function renderApiGatewayResources(name: string, lambdaDependency?: string): string {
  const blocks = [
    `resource "aws_apigatewayv2_api" "${name}" {`,
    `  name          = "${name}"`,
    '  protocol_type = "HTTP"',
    '}',
    '',
    `resource "aws_apigatewayv2_stage" "${name}_stage" {`,
    `  api_id      = aws_apigatewayv2_api.${name}.id`,
    '  name        = "$default"',
    '  auto_deploy = true',
    '}',
  ];

  if (lambdaDependency) {
    blocks.push(
      '',
      `resource "aws_lambda_permission" "${name}_invoke_permission" {`,
      '  statement_id  = "AllowExecutionFromApiGateway"',
      '  action        = "lambda:InvokeFunction"',
      `  function_name = aws_lambda_function.${lambdaDependency}.function_name`,
      '  principal     = "apigateway.amazonaws.com"',
      `  source_arn    = format("%s/*/*", aws_apigatewayv2_api.${name}.execution_arn)`,
      '}',
      '',
      `resource "aws_apigatewayv2_integration" "${name}_integration" {`,
      `  api_id                 = aws_apigatewayv2_api.${name}.id`,
      '  integration_type       = "AWS_PROXY"',
      `  integration_uri        = aws_lambda_function.${lambdaDependency}.invoke_arn`,
      '  payload_format_version = "2.0"',
      '}',
      '',
      `resource "aws_apigatewayv2_route" "${name}_route" {`,
      `  api_id    = aws_apigatewayv2_api.${name}.id`,
      '  route_key = "ANY /{proxy+}"',
      `  target    = format("integrations/%s", aws_apigatewayv2_integration.${name}_integration.id)`,
      '}',
    );
  }

  return blocks.join('\n');
}

function renderMskResources(node: ArchNode, name: string, variables: VariableRegistry): string {
  variables.ensure({
    name: `${name}_instance_type`,
    type: 'string',
    description: `Broker instance type for ${node.data.label}`,
    defaultValue: node.data.tier.label.includes('.') ? node.data.tier.label : 'kafka.m5.large',
  });

  return [
    `resource "aws_msk_cluster" "${name}" {`,
    `  cluster_name           = "${name}"`,
    '  kafka_version          = "3.6.0"',
    '  number_of_broker_nodes = 2',
    '',
    '  broker_node_group_info {',
    `    instance_type   = var.${name}_instance_type`,
    '    client_subnets  = slice(aws_subnet.private[*].id, 0, 2)',
    `    security_groups = [aws_security_group.${name}_sg.id]`,
    '    storage_info {',
    '      ebs_storage_info {',
    '        volume_size = 100',
    '      }',
    '    }',
    '  }',
    '',
    '  encryption_info {',
    '    encryption_in_transit {',
    '      client_broker = "TLS"',
    '      in_cluster    = true',
    '    }',
    '  }',
    '',
    '  depends_on = [aws_route_table_association.private]',
    '}',
  ].join('\n');
}

function renderKeyspacesResources(name: string): string {
  return [
    `resource "aws_keyspaces_keyspace" "${name}" {`,
    `  name = "${name}"`,
    '}',
    '',
    `resource "aws_keyspaces_table" "${name}" {`,
    `  keyspace_name = aws_keyspaces_keyspace.${name}.name`,
    `  table_name    = "${name}"`,
    '',
    '  partition_key {',
    '    name = "id"',
    '  }',
    '',
    '  schema_definition {',
    '    column_name = "id"',
    '    type        = "text"',
    '  }',
    '',
    '  capacity_specification {',
    '    throughput_mode = "PAY_PER_REQUEST"',
    '  }',
    '}',
  ].join('\n');
}

function renderDynamoDbResources(name: string): string {
  return [
    `resource "aws_dynamodb_table" "${name}" {`,
    `  name         = "${name}"`,
    '  billing_mode = "PAY_PER_REQUEST"',
    '  hash_key     = "id"',
    '',
    '  attribute {',
    '    name = "id"',
    '    type = "S"',
    '  }',
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${name}"`,
    '  })',
    '}',
  ].join('\n');
}

function renderAmazonMqResources(name: string): string {
  return [
    `resource "aws_mq_broker" "${name}" {`,
    `  broker_name                = "${name}"`,
    '  engine_type                = "RabbitMQ"',
    '  engine_version             = "3.11.20"',
    '  host_instance_type         = "mq.t3.micro"',
    '  deployment_mode            = "SINGLE_INSTANCE"',
    '  subnet_ids                 = [aws_subnet.private[0].id]',
    `  security_groups            = [aws_security_group.${name}_sg.id]`,
    '  publicly_accessible        = false',
    '  auto_minor_version_upgrade = true',
    '',
    '  user {',
    '    username = "mqadmin"',
    '    password = "TempPassword123!"',
    '  }',
    '',
    '  depends_on = [aws_route_table_association.private]',
    '}',
  ].join('\n');
}

function renderCognitoResources(name: string): string {
  return [
    `resource "aws_cognito_user_pool" "${name}" {`,
    `  name = "${name}"`,
    '}',
    '',
    `resource "aws_cognito_user_pool_client" "${name}_client" {`,
    `  name            = "${name}-client"`,
    `  user_pool_id    = aws_cognito_user_pool.${name}.id`,
    '  generate_secret = true',
    '}',
  ].join('\n');
}

function renderSnsResources(name: string): string {
  return [`resource "aws_sns_topic" "${name}" {`, `  name = "${name}"`, '}'].join('\n');
}

function renderSqsResources(name: string): string {
  return [`resource "aws_sqs_queue" "${name}" {`, `  name = "${name}"`, '}'].join('\n');
}

function renderRoute53Resources(name: string, variables: VariableRegistry): string {
  variables.ensure({ name: `${name}_zone_name`, type: 'string', description: `Hosted zone name for ${name}`, defaultValue: `${name}.example.com` });
  return [`resource "aws_route53_zone" "${name}" {`, `  name = var.${name}_zone_name`, '}'].join('\n');
}

function renderCloudWatchResources(name: string): string {
  return [
    `resource "aws_cloudwatch_log_group" "${name}" {`,
    `  name              = "/archviz/${name}"`,
    '  retention_in_days = 30',
    '}',
  ].join('\n');
}

function renderOpenSearchResources(name: string): string {
  return [
    `resource "aws_opensearch_domain" "${name}" {`,
    `  domain_name    = "${name}"`,
    '  engine_version = "OpenSearch_2.11"',
    '',
    '  cluster_config {',
    '    instance_type  = "t3.small.search"',
    '    instance_count = 2',
    '  }',
    '',
    '  ebs_options {',
    '    ebs_enabled = true',
    '    volume_size = 20',
    '    volume_type = "gp3"',
    '  }',
    '',
    '  encrypt_at_rest {',
    '    enabled = true',
    '  }',
    '',
    '  node_to_node_encryption {',
    '    enabled = true',
    '  }',
    '',
    '  domain_endpoint_options {',
    '    enforce_https = true',
    '  }',
    '',
    '  vpc_options {',
    '    subnet_ids         = slice(aws_subnet.private[*].id, 0, 2)',
    `    security_group_ids = [aws_security_group.${name}_sg.id]`,
    '  }',
    '',
    '  depends_on = [aws_route_table_association.private]',
    '}',
  ].join('\n');
}

function renderRedshiftResources(name: string): string {
  return [
    `resource "aws_redshiftserverless_namespace" "${name}" {`,
    `  namespace_name      = "${name}"`,
    '  db_name             = "analytics"',
    '  admin_username      = "adminuser"',
    '  admin_user_password = "TempPassword123!"',
    '}',
    '',
    `resource "aws_redshiftserverless_workgroup" "${name}" {`,
    `  workgroup_name      = "${name}"`,
    `  namespace_name      = aws_redshiftserverless_namespace.${name}.namespace_name`,
    '  base_capacity       = 32',
    '  subnet_ids          = aws_subnet.private[*].id',
    `  security_group_ids  = [aws_security_group.${name}_sg.id]`,
    '  publicly_accessible = false',
    '  depends_on          = [aws_route_table_association.private]',
    '}',
  ].join('\n');
}

function renderSecretsManagerResources(node: ArchNode, name: string): string {
  return [
    `resource "aws_secretsmanager_secret" "${name}" {`,
    `  name = "${name}"`,
    '',
    '  tags = merge(local.common_tags, {',
    `    Name = "${node.data.label}"`,
    '  })',
    '}',
    '',
    `resource "aws_secretsmanager_secret_version" "${name}" {`,
    `  secret_id     = aws_secretsmanager_secret.${name}.id`,
    `  secret_string = jsonencode({ component_type = "${node.data.componentType}", label = "${node.data.label}" })`,
    '}',
  ].join('\n');
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

function parseLambdaMemory(label: string): number {
  const match = label.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 512;
}

function buildNamesByType(nodes: ArchNode[], names: Map<string, string>): Record<string, string[]> {
  return nodes.reduce<Record<string, string[]>>((accumulator, node) => {
    const effectiveType = resolveEffectiveType(node.data.componentType);
    const name = names.get(node.id);
    if (!name) {
      return accumulator;
    }
    accumulator[effectiveType] = accumulator[effectiveType] ?? [];
    accumulator[effectiveType].push(name);
    return accumulator;
  }, {});
}

function resolveEffectiveType(type: string): string {
  if (['api-server', 'web-server', 'worker', 'websocket-server', 'graphql-server', 'game-server', 'ml-worker'].includes(type)) return 'ec2';
  if (type === 'lambda' || type === 'cloudflare-workers') return 'lambda';
  if (type === 'ecs-fargate') return 'ecs';
  if (type === 'kubernetes-cluster') return 'eks';
  if (type === 'postgresql' || type === 'mysql') return 'rds';
  if (type === 'redis') return 'redis';
  if (type === 's3') return 's3';
  if (type === 'load-balancer') return 'alb';
  if (type === 'cdn' || type === 'cloudflare-pages') return 'cloudfront';
  if (type === 'api-gateway') return 'apigateway';
  if (type === 'kafka') return 'msk';
  if (type === 'cassandra') return 'keyspaces';
  if (type === 'dynamodb' || type === 'bigtable' || type === 'spanner') return 'dynamodb';
  if (type === 'message-queue' || type === 'rabbitmq') return 'mq';
  if (type === 'aws-cognito' || type === 'auth0') return 'cognito';
  if (type === 'sns') return 'sns';
  if (type === 'sqs') return 'sqs';
  if (type === 'dns') return 'route53';
  if (type === 'datadog') return 'cloudwatch';
  if (type === 'pinecone') return 'opensearch';
  if (type === 'snowflake' || type === 'snowflake-dwh') return 'redshift';
  if (type === 'hashicorp-vault' || type === 'openai-api' || type === 'stripe-api' || type === 'external-api') return 'secretsmanager';
  return 'secretsmanager';
}

function needsSecurityGroup(effectiveType: string): boolean {
  return ['ec2', 'ecs', 'eks', 'rds', 'redis', 'alb', 'msk', 'mq', 'opensearch', 'redshift'].includes(effectiveType);
}

function getDependencyNames(
  nodeId: string,
  edges: ArchEdge[],
  names: Map<string, string>,
  resourceIndex: Map<string, number>,
): string[] {
  return edges
    .filter(edge => edge.target === nodeId)
    .sort((left, right) => (resourceIndex.get(left.source) ?? 0) - (resourceIndex.get(right.source) ?? 0))
    .map(edge => names.get(edge.source))
    .filter((value): value is string => Boolean(value));
}

function renderCidrIngressBlock(port: number, cidrExpression: string, description: string): string {
  return [
    '  ingress {',
    `    from_port   = ${port}`,
    `    to_port     = ${port}`,
    '    protocol    = "tcp"',
    `    cidr_blocks = ${cidrExpression}`,
    `    description = "${description}"`,
    '  }',
  ].join('\n');
}

function renderSecurityGroupIngressBlock(portReference: string, sourceName: string, description: string): string {
  return [
    '  ingress {',
    `    from_port       = ${portReference}`,
    `    to_port         = ${portReference}`,
    '    protocol        = "tcp"',
    `    security_groups = [aws_security_group.${sourceName}_sg.id]`,
    `    description     = "${description}"`,
    '  }',
  ].join('\n');
}

function renderVpcIngressBlock(portReference: string, description: string): string {
  return [
    '  ingress {',
    `    from_port   = ${portReference}`,
    `    to_port     = ${portReference}`,
    '    protocol    = "tcp"',
    '    cidr_blocks = [var.vpc_cidr]',
    `    description = "${description}"`,
    '  }',
  ].join('\n');
}

function getPortReferenceForType(effectiveType: string, name: string, defaultRef: string): string {
  if (effectiveType === 'rds' || effectiveType === 'redis') return `var.${name}_port`;
  if (effectiveType === 'msk') return '9092';
  if (effectiveType === 'mq') return '5671';
  return defaultRef;
}
