import type { ArchEdge, ArchNode } from '../types';
import { getComponentDefinition } from '../data/componentLibrary';
import { generateCloudFormation } from './cloudformationGenerator';
import { sanitizeName } from './iacUtils';
import { generateKubernetesManifestsFull, generateHelmChartFiles } from './helmGenerator';

export { generateCloudFormation, sanitizeName };

export interface TerraformArtifacts {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
}

interface DownloadFile {
  filename: string;
  content: string;
  mimeType: string;
}

type TerraformDownloadMode = 'files' | 'zip';

interface TerraformVariableDefinition {
  name: string;
  description: string;
  type: 'string' | 'number';
  defaultValue?: string | number;
}

interface TerraformOutputDefinition {
  name: string;
  description: string;
  value: string;
}

interface TerraformContext {
  names: Map<string, string>;
  nodeById: Map<string, ArchNode>;
  variables: Map<string, TerraformVariableDefinition>;
  outputs: TerraformOutputDefinition[];
  hasEc2Compute: boolean;
}

export function generateTerraform(nodes: ArchNode[], _edges: ArchEdge[], projectName: string): TerraformArtifacts {
  const activeNodes = nodes.filter(node => node.data.componentType !== 'groupNode');
  const names = buildUniqueTerraformNames(activeNodes);
  const context: TerraformContext = {
    names,
    nodeById: new Map(activeNodes.map(node => [node.id, node])),
    variables: new Map(),
    outputs: [
      { name: 'public_subnet_id', description: 'Public subnet ID', value: 'aws_subnet.public.id' },
      { name: 'vpc_id', description: 'VPC ID', value: 'aws_vpc.main.id' },
    ],
    hasEc2Compute: activeNodes.some(node => ['api-server', 'web-server', 'worker'].includes(node.data.componentType)),
  };

  registerVariable(context, { name: 'aws_region', description: 'AWS region to deploy resources', type: 'string', defaultValue: 'us-east-1' });
  registerVariable(context, { name: 'private_route_cidr', description: 'CIDR block for private subnet egress routing', type: 'string', defaultValue: '0.0.0.0/0' });
  registerVariable(context, { name: 'private_subnet_cidr', description: 'Private subnet CIDR block', type: 'string', defaultValue: '10.0.2.0/24' });
  registerVariable(context, { name: 'project_name', description: 'Project name prefix', type: 'string', defaultValue: sanitizeName(projectName) || 'archviz' });
  registerVariable(context, { name: 'public_route_cidr', description: 'CIDR block for public internet access', type: 'string', defaultValue: '0.0.0.0/0' });
  registerVariable(context, { name: 'public_subnet_cidr', description: 'Public subnet CIDR block', type: 'string', defaultValue: '10.0.1.0/24' });
  registerVariable(context, { name: 'vpc_cidr', description: 'CIDR block for the VPC', type: 'string', defaultValue: '10.0.0.0/16' });

  const computeResources: string[] = [];
  const storageResources: string[] = [];
  const networkResources: string[] = [];
  const messagingResources: string[] = [];
  const observabilityResources: string[] = [];

  for (const node of activeNodes) {
    const rendered = renderTerraformNode(node, context);
    if (!rendered) {
      continue;
    }

    switch (rendered.section) {
      case 'compute':
        computeResources.push(rendered.content);
        break;
      case 'storage':
        storageResources.push(rendered.content);
        break;
      case 'network':
        networkResources.push(rendered.content);
        break;
      case 'messaging':
        messagingResources.push(rendered.content);
        break;
      case 'observability':
        observabilityResources.push(rendered.content);
        break;
    }
  }

  const mainSections = [
    renderTerraformBlock(),
    renderProviderBlock(),
    context.hasEc2Compute ? renderSsmAmiDataBlock() : '',
    renderBaseNetworkingBlock(),
    computeResources.length > 0 ? `# Compute\n\n${computeResources.join('\n\n')}` : '',
    storageResources.length > 0 ? `# Storage\n\n${storageResources.join('\n\n')}` : '',
    networkResources.length > 0 ? `# Network Services\n\n${networkResources.join('\n\n')}` : '',
    messagingResources.length > 0 ? `# Messaging\n\n${messagingResources.join('\n\n')}` : '',
    observabilityResources.length > 0 ? `# Observability\n\n${observabilityResources.join('\n\n')}` : '',
  ].filter(Boolean);

  return {
    mainTf: enhanceUnsupportedComments(mainSections.join('\n\n')),
    variablesTf: renderVariablesSection(context.variables),
    outputsTf: renderOutputsSection(context.outputs),
  };
}

function renderTerraformBlock(): string {
  return [
    'terraform {',
    '  required_providers {',
    '    aws = {',
    '      source  = "hashicorp/aws"',
    '      version = "~> 5.0"',
    '    }',
    '  }',
    '}',
  ].join('\n');
}

function renderProviderBlock(): string {
  return [
    'provider "aws" {',
    '  region = var.aws_region',
    '}',
  ].join('\n');
}

function renderSsmAmiDataBlock(): string {
  return [
    'data "aws_ssm_parameter" "amazon_linux_ami" {',
    '  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-hvm-x86_64-gp2"',
    '}',
  ].join('\n');
}

function renderBaseNetworkingBlock(): string {
  return [
    'resource "aws_vpc" "main" {',
    '  cidr_block           = var.vpc_cidr',
    '  enable_dns_support   = true',
    '  enable_dns_hostnames = true',
    '  tags = {',
    '    Name      = "${var.project_name}-vpc"',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
    '}',
    '',
    'resource "aws_subnet" "public" {',
    '  vpc_id                  = aws_vpc.main.id',
    '  cidr_block              = var.public_subnet_cidr',
    '  availability_zone       = "${var.aws_region}a"',
    '  map_public_ip_on_launch = true',
    '  tags = {',
    '    Name      = "${var.project_name}-public-subnet"',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
    '}',
    '',
    'resource "aws_subnet" "private" {',
    '  vpc_id            = aws_vpc.main.id',
    '  cidr_block        = var.private_subnet_cidr',
    '  availability_zone = "${var.aws_region}b"',
    '  tags = {',
    '    Name      = "${var.project_name}-private-subnet"',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
    '}',
    '',
    'resource "aws_internet_gateway" "main" {',
    '  vpc_id = aws_vpc.main.id',
    '  tags = {',
    '    Name      = "${var.project_name}-igw"',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
    '}',
    '',
    'resource "aws_route_table" "public" {',
    '  vpc_id = aws_vpc.main.id',
    '  route {',
    '    cidr_block = var.public_route_cidr',
    '    gateway_id = aws_internet_gateway.main.id',
    '  }',
    '  tags = {',
    '    Name      = "${var.project_name}-public-rt"',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
    '}',
    '',
    'resource "aws_route_table_association" "public" {',
    '  subnet_id      = aws_subnet.public.id',
    '  route_table_id = aws_route_table.public.id',
    '}',
    '',
    'resource "aws_eip" "nat" {',
    '  domain     = "vpc"',
    '  depends_on = [aws_internet_gateway.main]',
    '  tags = {',
    '    Name      = "${var.project_name}-nat-eip"',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
    '}',
    '',
    'resource "aws_nat_gateway" "main" {',
    '  allocation_id = aws_eip.nat.id',
    '  subnet_id     = aws_subnet.public.id',
    '  depends_on    = [aws_internet_gateway.main]',
    '  tags = {',
    '    Name      = "${var.project_name}-nat"',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
    '}',
    '',
    'resource "aws_route_table" "private" {',
    '  vpc_id = aws_vpc.main.id',
    '  route {',
    '    cidr_block     = var.private_route_cidr',
    '    nat_gateway_id = aws_nat_gateway.main.id',
    '  }',
    '  tags = {',
    '    Name      = "${var.project_name}-private-rt"',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
    '}',
    '',
    'resource "aws_route_table_association" "private" {',
    '  subnet_id      = aws_subnet.private.id',
    '  route_table_id = aws_route_table.private.id',
    '}',
  ].join('\n');
}

function renderTerraformNode(
  node: ArchNode,
  context: TerraformContext,
): { section: 'compute' | 'storage' | 'network' | 'messaging' | 'observability'; content: string } | null {
  const name = context.names.get(node.id) ?? sanitizeName(node.data.label);
  const type = node.data.componentType;

  switch (type) {
    case 'api-server':
    case 'web-server':
    case 'worker':
      registerVariable(context, { name: `${name}_instance_type`, description: `${node.data.label} EC2 instance type`, type: 'string', defaultValue: node.data.tier.label.includes('.') ? node.data.tier.label : 't3.micro' });
      return {
        section: 'compute',
        content: [
          `resource "aws_instance" "${name}" {`,
          '  ami           = data.aws_ssm_parameter.amazon_linux_ami.value',
          `  instance_type = var.${name}_instance_type`,
          '  subnet_id     = aws_subnet.public.id',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'lambda':
      registerVariable(context, { name: `${name}_memory`, description: `${node.data.label} memory size in MB`, type: 'number', defaultValue: node.data.lambdaMemory || 512 });
      registerVariable(context, { name: `${name}_timeout`, description: `${node.data.label} timeout in seconds`, type: 'number', defaultValue: node.data.lambdaTimeout || 15 });
      registerVariable(context, { name: `${name}_concurrency`, description: `${node.data.label} reserved concurrency`, type: 'number', defaultValue: node.data.lambdaConcurrency || 100 });
      return {
        section: 'compute',
        content: [
          `resource "aws_iam_role" "${name}_lambda_role" {`,
          `  name = "${name}-lambda-role"`,
          '  assume_role_policy = jsonencode({',
          '    Version = "2012-10-17"',
          '    Statement = [{',
          '      Action = "sts:AssumeRole"',
          '      Effect = "Allow"',
          '      Principal = { Service = "lambda.amazonaws.com" }',
          '    }]',
          '  })',
          '}',
          '',
          `resource "aws_lambda_function" "${name}" {`,
          `  function_name    = "${name}"`,
          '  role             = aws_iam_role.' + `${name}_lambda_role.arn`,
          `  runtime          = "${node.data.lambdaRuntime || 'nodejs20.x'}"`,
          '  handler          = "index.handler"',
          '  filename         = "lambda_payload.zip"',
          `  memory_size      = var.${name}_memory`,
          `  timeout          = var.${name}_timeout`,
          `  reserved_concurrent_executions = var.${name}_concurrency`,
          '',
          ...(node.data.lambdaVpcAttached ? [
            '  vpc_config {',
            '    subnet_ids         = [aws_subnet.private.id]',
            '    security_group_ids = []  # Add your security groups',
            '  }',
            '',
          ] : []),
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'ecs-fargate':
      return {
        section: 'compute',
        content: [
          `resource "aws_ecs_cluster" "${name}" {`,
          `  name = "${name}"`,
          '',
          renderTagsBlock(),
          '}',
          '',
          `resource "aws_ecs_task_definition" "${name}" {`,
          `  family                   = "${name}"`,
          '  network_mode             = "awsvpc"',
          '  requires_compatibilities = ["FARGATE"]',
          '  cpu                      = "256"',
          '  memory                   = "512"',
          '  container_definitions    = jsonencode([{ name = "' + `${name}` + '", image = "public.ecr.aws/docker/library/nginx:latest", essential = true }])',
          '}',
        ].join('\n'),
      };
    case 'kubernetes-cluster':
      registerVariable(context, { name: `${name}_node_type`, description: `${node.data.label} worker node instance type`, type: 'string', defaultValue: node.data.k8sNodeInstanceType || 't3.large' });
      registerVariable(context, { name: `${name}_min_nodes`, description: `${node.data.label} minimum node count`, type: 'number', defaultValue: node.data.k8sMinNodes || 2 });
      registerVariable(context, { name: `${name}_max_nodes`, description: `${node.data.label} maximum node count`, type: 'number', defaultValue: node.data.k8sMaxNodes || 10 });
      return {
        section: 'compute',
        content: [
          `resource "aws_iam_role" "${name}_eks_role" {`,
          `  name = "${name}-eks-role"`,
          '  assume_role_policy = jsonencode({',
          '    Version = "2012-10-17"',
          '    Statement = [{',
          '      Action = "sts:AssumeRole"',
          '      Effect = "Allow"',
          '      Principal = { Service = "eks.amazonaws.com" }',
          '    }]',
          '  })',
          '}',
          '',
          `resource "aws_eks_cluster" "${name}" {`,
          `  name     = "${name}"`,
          `  role_arn = aws_iam_role.${name}_eks_role.arn`,
          '  vpc_config {',
          '    subnet_ids = [aws_subnet.public.id, aws_subnet.private.id]',
          '  }',
          '',
          renderTagsBlock(),
          '}',
          '',
          `resource "aws_eks_node_group" "${name}_nodes" {`,
          `  cluster_name    = aws_eks_cluster.${name}.name`,
          `  node_group_name = "${name}-workers"`,
          `  node_role_arn   = aws_iam_role.${name}_eks_role.arn`,
          '  subnet_ids      = [aws_subnet.private.id]',
          `  instance_types  = [var.${name}_node_type]`,
          '',
          '  scaling_config {',
          `    desired_size = var.${name}_min_nodes`,
          `    min_size     = var.${name}_min_nodes`,
          `    max_size     = var.${name}_max_nodes`,
          '  }',
          '}',
          ...(node.data.k8sFargateEnabled ? [
            '',
            `resource "aws_eks_fargate_profile" "${name}_fargate" {`,
            `  cluster_name           = aws_eks_cluster.${name}.name`,
            `  fargate_profile_name   = "${name}-fargate"`,
            `  pod_execution_role_arn = aws_iam_role.${name}_eks_role.arn`,
            '  subnet_ids             = [aws_subnet.private.id]',
            '',
            '  selector {',
            `    namespace = "${node.data.k8sNamespace || 'default'}"`,
            '  }',
            '}',
          ] : []),
        ].join('\n'),
      };
    case 'app-runner':
      return {
        section: 'compute',
        content: [
          `resource "aws_apprunner_service" "${name}" {`,
          `  service_name = "${name}"`,
          '  source_configuration {',
          '    image_repository {',
          '      image_repository_type = "ECR_PUBLIC"',
          '      image_identifier      = "public.ecr.aws/docker/library/nginx:latest"',
          '      image_configuration {',
          '        port = "80"',
          '      }',
          '    }',
          '  }',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'postgresql':
    case 'mysql':
      registerVariable(context, { name: `${name}_engine_version`, description: `${node.data.label} engine version`, type: 'string', defaultValue: node.data.componentType === 'postgresql' ? '15.4' : '8.0' });
      registerVariable(context, { name: `${name}_instance_class`, description: `${node.data.label} database instance class`, type: 'string', defaultValue: node.data.tier.label.startsWith('db.') ? node.data.tier.label : 'db.t3.micro' });
      registerVariable(context, { name: `${name}_storage_size`, description: `${node.data.label} allocated storage`, type: 'number', defaultValue: 20 });
      return {
        section: 'storage',
        content: [
          `resource "aws_db_instance" "${name}" {`,
          `  identifier         = "${name}"`,
          `  engine             = "${node.data.componentType === 'postgresql' ? 'postgres' : 'mysql'}"`,
          `  engine_version     = var.${name}_engine_version`,
          `  instance_class     = var.${name}_instance_class`,
          `  allocated_storage  = var.${name}_storage_size`,
          '  skip_final_snapshot = true',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'dynamodb':
      return {
        section: 'storage',
        content: [
          `resource "aws_dynamodb_table" "${name}" {`,
          `  name         = "${name}"`,
          '  billing_mode = "PAY_PER_REQUEST"',
          '  hash_key     = "id"',
          '  attribute {',
          '    name = "id"',
          '    type = "S"',
          '  }',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'mongodb':
      return {
        section: 'storage',
        content: [
          '# Comment: Use MongoDB Atlas or DocumentDB',
          renderUnsupportedResourceComment(
            node.data.label,
            'MongoDB has no direct first-party AWS Terraform resource mapping.',
            'Use aws_docdb_cluster for an AWS-managed document database, or MongoDB Atlas for native MongoDB compatibility.',
          ),
        ].join('\n'),
      };
    case 'redis':
      return {
        section: 'storage',
        content: [
          `resource "aws_elasticache_cluster" "${name}" {`,
          `  cluster_id           = "${name}"`,
          '  engine               = "redis"',
          '  node_type            = "cache.t3.micro"',
          '  num_cache_nodes      = 1',
          '  parameter_group_name = "default.redis7"',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 's3':
      return {
        section: 'storage',
        content: [
          `resource "aws_s3_bucket" "${name}" {`,
          `  bucket = "${name}-${'${var.project_name}'}"`,
          '',
          renderTagsBlock(),
          '}',
          '',
          ...(node.data.s3Versioning ? [
            `resource "aws_s3_bucket_versioning" "${name}_versioning" {`,
            `  bucket = aws_s3_bucket.${name}.id`,
            '  versioning_configuration {',
            '    status = "Enabled"',
            '  }',
            '}',
            '',
          ] : []),
          ...(node.data.s3PublicAccessBlock !== false ? [
            `resource "aws_s3_bucket_public_access_block" "${name}_public_access" {`,
            `  bucket = aws_s3_bucket.${name}.id`,
            '  block_public_acls       = true',
            '  block_public_policy     = true',
            '  ignore_public_acls      = true',
            '  restrict_public_buckets = true',
            '}',
            '',
          ] : []),
          ...(node.data.encryption !== false ? [
            `resource "aws_s3_bucket_server_side_encryption_configuration" "${name}_sse" {`,
            `  bucket = aws_s3_bucket.${name}.id`,
            '  rule {',
            '    apply_server_side_encryption_by_default {',
            '      sse_algorithm = "AES256"',
            '    }',
            '  }',
            '}',
            '',
          ] : []),
          ...((node.data.s3LifecycleGlacierDays && node.data.s3LifecycleGlacierDays > 0) ? [
            `resource "aws_s3_bucket_lifecycle_configuration" "${name}_lifecycle" {`,
            `  bucket = aws_s3_bucket.${name}.id`,
            '  rule {',
            '    id     = "glacier-transition"',
            '    status = "Enabled"',
            '    transition {',
            `      days          = ${node.data.s3LifecycleGlacierDays}`,
            '      storage_class = "GLACIER"',
            '    }',
            '  }',
            '}',
          ] : []),
        ].join('\n'),
      };
    case 'elasticsearch':
      return {
        section: 'storage',
        content: [
          `resource "aws_elasticsearch_domain" "${name}" {`,
          `  domain_name           = "${name}"`,
          '  elasticsearch_version = "7.10"',
          '  cluster_config {',
          '    instance_type = "t3.small.elasticsearch"',
          '  }',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'load-balancer':
    case 'alb':
      context.outputs.push({ name: `${name}_dns_name`, description: `${node.data.label} DNS name`, value: `aws_lb.${name}.dns_name` });
      return {
        section: 'network',
        content: [
          `resource "aws_lb" "${name}" {`,
          `  name               = "${name}"`,
          '  internal           = false',
          '  load_balancer_type = "application"',
          '  subnets            = [aws_subnet.public.id]',
          '',
          renderTagsBlock(),
          '}',
          '',
          `resource "aws_lb_target_group" "${name}_tg" {`,
          `  name     = "${name}-tg"`,
          '  port     = 80',
          '  protocol = "HTTP"',
          '  vpc_id   = aws_vpc.main.id',
          '}',
          '',
          `resource "aws_lb_listener" "${name}_listener" {`,
          `  load_balancer_arn = aws_lb.${name}.arn`,
          '  port              = 80',
          '  protocol          = "HTTP"',
          '  default_action {',
          '    type             = "forward"',
          `    target_group_arn = aws_lb_target_group.${name}_tg.arn`,
          '  }',
          '}',
        ].join('\n'),
      };
    case 'cdn':
    case 'cloudfront':
      return {
        section: 'network',
        content: [
          `resource "aws_cloudfront_distribution" "${name}" {`,
          '  enabled = true',
          '  origin {',
          '    domain_name = aws_s3_bucket.' + `${findFirstMappedName(context, ['s3']) ?? name}.bucket_regional_domain_name`,
          `    origin_id   = "${name}-origin"`,
          '  }',
          '  default_cache_behavior {',
          `    target_origin_id       = "${name}-origin"`,
          '    viewer_protocol_policy = "redirect-to-https"',
          '    allowed_methods        = ["GET", "HEAD"]',
          '    cached_methods         = ["GET", "HEAD"]',
          '    forwarded_values {',
          '      query_string = false',
          '      cookies { forward = "none" }',
          '    }',
          '  }',
          '  restrictions {',
          '    geo_restriction { restriction_type = "none" }',
          '  }',
          '  viewer_certificate { cloudfront_default_certificate = true }',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'api-gateway':
      registerVariable(context, { name: `${name}_rate_limit`, description: `${node.data.label} rate limit (req/s)`, type: 'number', defaultValue: node.data.apigwRateLimit || 10000 });
      registerVariable(context, { name: `${name}_burst`, description: `${node.data.label} throttle burst`, type: 'number', defaultValue: node.data.apigwThrottleBurst || 5000 });
      return {
        section: 'network',
        content: [
          `resource "aws_api_gateway_rest_api" "${name}" {`,
          `  name = "${name}"`,
          '',
          renderTagsBlock(),
          '}',
          '',
          `resource "aws_api_gateway_method_settings" "${name}_settings" {`,
          `  rest_api_id = aws_api_gateway_rest_api.${name}.id`,
          '  stage_name  = "prod"',
          '  method_path = "*/*"',
          '  settings {',
          `    throttling_rate_limit  = var.${name}_rate_limit`,
          `    throttling_burst_limit = var.${name}_burst`,
          '  }',
          '}',
          ...(node.data.apigwAuthType === 'jwt' ? [
            '',
            `resource "aws_api_gateway_authorizer" "${name}_jwt" {`,
            `  rest_api_id = aws_api_gateway_rest_api.${name}.id`,
            `  name        = "${name}-jwt-authorizer"`,
            '  type        = "TOKEN"',
            '}',
          ] : []),
          ...(node.data.apigwCorsEnabled ? [
            '',
            `# CORS enabled for ${name} — configure Access-Control-Allow-Origin headers`,
          ] : []),
        ].join('\n'),
      };
    case 'nat-gateway':
      return null;
    case 'dns':
    case 'route53':
      return {
        section: 'network',
        content: [
          `resource "aws_route53_zone" "${name}" {`,
          `  name = "${name}.example.com"`,
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'waf':
      return {
        section: 'network',
        content: [
          `resource "aws_wafv2_web_acl" "${name}" {`,
          `  name  = "${name}"`,
          '  scope = "REGIONAL"',
          '  default_action { allow {} }',
          '  visibility_config {',
          '    cloudwatch_metrics_enabled = true',
          `    metric_name                = "${name}"`,
          '    sampled_requests_enabled   = true',
          '  }',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'security-group':
      return {
        section: 'network',
        content: [
          `resource "aws_security_group" "${name}" {`,
          `  name   = "${name}"`,
          '  vpc_id = aws_vpc.main.id',
          '',
          '  ingress {',
          '    description = "Allow HTTP from within the VPC"',
          '    from_port   = 80',
          '    to_port     = 80',
          '    protocol    = "tcp"',
          '    cidr_blocks = [var.vpc_cidr]',
          '  }',
          '',
          '  ingress {',
          '    description = "Allow HTTPS from within the VPC"',
          '    from_port   = 443',
          '    to_port     = 443',
          '    protocol    = "tcp"',
          '    cidr_blocks = [var.vpc_cidr]',
          '  }',
          '',
          '  ingress {',
          '    description = "Allow SSH from within the VPC"',
          '    from_port   = 22',
          '    to_port     = 22',
          '    protocol    = "tcp"',
          '    cidr_blocks = [var.vpc_cidr]',
          '  }',
          '',
          '  egress {',
          '    description = "Allow outbound traffic"',
          '    from_port   = 0',
          '    to_port     = 0',
          '    protocol    = "-1"',
          '    cidr_blocks = ["0.0.0.0/0"]',
          '  }',
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'aws-cognito':
    case 'cognito':
      return {
        section: 'network',
        content: [
          `resource "aws_cognito_user_pool" "${name}" {`,
          `  name = "${name}"`,
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'sqs':
      return { section: 'messaging', content: [`resource "aws_sqs_queue" "${name}" {`, `  name = "${name}"`, '', renderTagsBlock(), '}'].join('\n') };
    case 'sns':
      return { section: 'messaging', content: [`resource "aws_sns_topic" "${name}" {`, `  name = "${name}"`, '', renderTagsBlock(), '}'].join('\n') };
    case 'kafka':
    case 'msk':
      return {
        section: 'messaging',
        content: [
          `resource "aws_msk_cluster" "${name}" {`,
          `  cluster_name           = "${name}"`,
          '  kafka_version          = "3.5.1"',
          `  number_of_broker_nodes = ${Math.max(2, node.data.kafkaReplicationFactor || 3)}`,
          '  broker_node_group_info {',
          '    instance_type  = "kafka.t3.small"',
          '    client_subnets = [aws_subnet.public.id, aws_subnet.private.id]',
          '  }',
          '',
          '  # Bespoke Kafka Configuration',
          `  # Partitions per topic:     ${node.data.kafkaPartitions || 6}`,
          `  # Retention period:          ${node.data.kafkaRetentionDays || 7} days`,
          `  # Replication factor:        ${node.data.kafkaReplicationFactor || 3}`,
          `  # Auto-create topics:        ${node.data.kafkaAutoCreateTopics ? 'enabled' : 'disabled'}`,
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'eventbridge':
      return {
        section: 'messaging',
        content: [
          `resource "aws_cloudwatch_event_bus" "${name}" {`,
          `  name = "${name}"`,
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'cloudwatch':
      return {
        section: 'observability',
        content: [
          `resource "aws_cloudwatch_log_group" "${name}" {`,
          `  name = "/archviz/${name}"`,
          '',
          renderTagsBlock(),
          '}',
        ].join('\n'),
      };
    case 'vpc':
    case 'subnet':
    case 'subnet-public':
    case 'subnet-private':
      return null;
    default:
      return { section: 'observability', content: `# ${node.data.label} — no direct Terraform resource mapping. Configure manually.` };
  }
}

function enhanceUnsupportedComments(terraform: string): string {
  return terraform.replace(
    /^# (.+?) â€” no direct Terraform resource mapping\. Configure manually\.$/gm,
    (_match, label: string) =>
      renderUnsupportedResourceComment(
        label,
        'This service is not currently supported by this Terraform generator.',
        'Configure the service manually or replace it with the closest supported AWS-managed service.',
      ),
  );
}

function renderUnsupportedResourceComment(label: string, reason: string, suggestion: string): string {
  return [
    `# ${label} â€” no direct Terraform resource mapping. Configure manually.`,
    `# Reason: ${reason}`,
    `# Suggestion: ${suggestion}`,
  ].join('\n');
}

function renderTagsBlock(): string {
  return [
    '  tags = {',
    '    Project   = var.project_name',
    '    ManagedBy = "archviz"',
    '  }',
  ].join('\n');
}

function registerVariable(context: TerraformContext, definition: TerraformVariableDefinition): void {
  if (!context.variables.has(definition.name)) {
    context.variables.set(definition.name, definition);
  }
}

function renderVariablesSection(variables: Map<string, TerraformVariableDefinition>): string {
  return Array.from(variables.values())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(variable => {
      const lines = [
        `variable "${variable.name}" {`,
        `  description = ${JSON.stringify(variable.description)}`,
        `  type        = ${variable.type}`,
      ];
      if (variable.defaultValue !== undefined) {
        lines.push(`  default     = ${typeof variable.defaultValue === 'string' ? JSON.stringify(variable.defaultValue) : variable.defaultValue}`);
      }
      lines.push('}');
      return lines.join('\n');
    })
    .join('\n\n');
}

function renderOutputsSection(outputs: TerraformOutputDefinition[]): string {
  return outputs
    .map(output => [
      `output "${output.name}" {`,
      `  description = ${JSON.stringify(output.description)}`,
      `  value       = ${output.value}`,
      '}',
    ].join('\n'))
    .join('\n\n');
}

function buildUniqueTerraformNames(nodes: ArchNode[]): Map<string, string> {
  const names = new Map<string, string>();
  const seen = new Set<string>();
  for (const node of nodes) {
    let name = sanitizeName(node.data.label);
    if (seen.has(name)) {
      name = `${name}_${sanitizeName(node.id).slice(-4)}`;
    }
    seen.add(name);
    names.set(node.id, name);
  }
  return names;
}

function findFirstMappedName(context: TerraformContext, types: string[]): string | undefined {
  for (const [id, node] of context.nodeById.entries()) {
    if (types.includes(node.data.componentType)) {
      return context.names.get(id);
    }
  }
  return undefined;
}

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

export function generateKubernetesManifests(nodes: ArchNode[], edges: ArchEdge[], projectName: string): string {
  return generateKubernetesManifestsFull(nodes, edges, projectName);
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

export function downloadHelmChart(nodes: ArchNode[], edges: ArchEdge[], projectName: string): void {
  const chartFiles = generateHelmChartFiles(nodes, edges, projectName);
  const downloadFiles = chartFiles.map(f => ({
    filename: f.path,
    content: f.content,
    mimeType: 'text/yaml',
  }));
  const blob = createZipBlob(downloadFiles);
  const chartName = sanitizeName(projectName).replace(/_/g, '-') || 'archviz-app';
  triggerDownload({ filename: `${chartName}-helm-chart.zip`, content: '', mimeType: 'application/zip' }, blob);
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
