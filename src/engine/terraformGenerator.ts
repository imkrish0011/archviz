import type { ArchNode, ArchEdge } from '../types';

/**
 * Terraform / CloudFormation Generator
 * Maps ArchViz canvas components to real AWS IaC resource blocks.
 */

// ── Component → Terraform Resource Mapping ──
const tfResourceMap: Record<string, { resource: string; service: string }> = {
  // Compute
  'api-server':          { resource: 'aws_instance',              service: 'EC2' },
  'web-server':          { resource: 'aws_instance',              service: 'EC2' },
  'worker':              { resource: 'aws_instance',              service: 'EC2' },
  'websocket-server':    { resource: 'aws_instance',              service: 'EC2' },
  'lambda':              { resource: 'aws_lambda_function',       service: 'Lambda' },
  'ecs-fargate':         { resource: 'aws_ecs_service',           service: 'ECS' },
  'app-runner':          { resource: 'aws_apprunner_service',     service: 'App Runner' },
  'kubernetes-cluster':  { resource: 'aws_eks_cluster',           service: 'EKS' },
  'cloudflare-workers':  { resource: 'cloudflare_worker_script',  service: 'Cloudflare' },
  'graphql-server':      { resource: 'aws_instance',              service: 'EC2' },
  'game-server':         { resource: 'aws_instance',              service: 'EC2' },
  'ml-worker':           { resource: 'aws_instance',              service: 'EC2 (GPU)' },
  'batch':               { resource: 'aws_batch_job_definition',  service: 'Batch' },

  // Storage
  'postgresql':          { resource: 'aws_db_instance',           service: 'RDS' },
  'mysql':               { resource: 'aws_db_instance',           service: 'RDS' },
  'mongodb':             { resource: 'aws_docdb_cluster',         service: 'DocumentDB' },
  'cassandra':           { resource: 'aws_keyspaces_table',       service: 'Keyspaces' },
  'dynamodb':            { resource: 'aws_dynamodb_table',        service: 'DynamoDB' },
  'aurora-serverless':   { resource: 'aws_rds_cluster',           service: 'Aurora' },
  'redis':               { resource: 'aws_elasticache_cluster',   service: 'ElastiCache' },
  's3':                  { resource: 'aws_s3_bucket',             service: 'S3' },
  'elasticsearch':       { resource: 'aws_elasticsearch_domain',  service: 'OpenSearch' },
  'bigtable':            { resource: 'aws_dynamodb_table',        service: 'DynamoDB' },
  'pinecone':            { resource: 'aws_instance',              service: 'Self-hosted Vector DB' },
  'snowflake':           { resource: 'snowflake_warehouse',       service: 'Snowflake' },

  // Network
  'load-balancer':       { resource: 'aws_lb',                    service: 'ALB' },
  'cdn':                 { resource: 'aws_cloudfront_distribution', service: 'CloudFront' },
  'api-gateway':         { resource: 'aws_apigatewayv2_api',      service: 'API Gateway' },
  'nat-gateway':         { resource: 'aws_nat_gateway',           service: 'NAT GW' },
  'dns':                 { resource: 'aws_route53_zone',          service: 'Route 53' },
  'waf':                 { resource: 'aws_wafv2_web_acl',         service: 'WAF' },
  'aws-waf':             { resource: 'aws_wafv2_web_acl',         service: 'WAF' },
  'transit-gateway':     { resource: 'aws_ec2_transit_gateway',   service: 'Transit GW' },

  // Messaging
  'sqs':                 { resource: 'aws_sqs_queue',             service: 'SQS' },
  'amazon-sqs':          { resource: 'aws_sqs_queue',             service: 'SQS' },
  'sns':                 { resource: 'aws_sns_topic',             service: 'SNS' },
  'kafka':               { resource: 'aws_msk_cluster',           service: 'MSK' },
  'message-queue':       { resource: 'aws_mq_broker',             service: 'Amazon MQ' },
  'rabbitmq':            { resource: 'aws_mq_broker',             service: 'Amazon MQ' },

  // Observability
  'cloudwatch':          { resource: 'aws_cloudwatch_log_group',  service: 'CloudWatch' },
  'datadog':             { resource: 'aws_instance',              service: 'DataDog Agent' },

  // Auth / Client (external — comments only)
  'auth0':               { resource: 'auth0_client',              service: 'Auth0' },
  'aws-cognito':         { resource: 'aws_cognito_user_pool',     service: 'Cognito' },
  'hashicorp-vault':     { resource: 'vault_mount',               service: 'Vault' },
};

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
}

function getTierComment(node: ArchNode): string {
  return `# Tier: ${node.data.tier.label} | ${node.data.tier.cpu || ''} ${node.data.tier.ram || ''} | $${node.data.tier.monthlyCost}/mo`.trim();
}

function getInstanceType(node: ArchNode): string {
  // Map tier labels to AWS instance types
  const label = node.data.tier.label.toLowerCase();
  if (label.includes('t3') || label.includes('t4g')) return `"${node.data.tier.label}"`;
  if (label.includes('m5') || label.includes('m6')) return `"${node.data.tier.label}"`;
  if (label.includes('r6g') || label.includes('r5')) return `"${node.data.tier.label}"`;
  if (label.includes('c6') || label.includes('c5')) return `"${node.data.tier.label}"`;
  if (label.includes('g4') || label.includes('p4')) return `"${node.data.tier.label}"`;
  if (label.includes('db.')) return `"${node.data.tier.label}"`;
  if (label.includes('cache.')) return `"${node.data.tier.label}"`;
  return `"t3.medium"  # Mapped from: ${node.data.tier.label}`;
}

function generateEC2Block(node: ArchNode, name: string): string {
  const count = node.data.scalingType === 'horizontal' ? node.data.instances : 1;
  const az = node.data.multiAZ ? '\n  availability_zone = var.az_primary\n' : '';
  const pricing = node.data.pricingModel === 'spot'
    ? `\n  instance_market_options {\n    market_type = "spot"\n    spot_options {\n      max_price = "${(node.data.tier.monthlyCost * 0.4 / 730).toFixed(4)}"\n    }\n  }`
    : '';

  return `
${getTierComment(node)}
resource "${tfResourceMap[node.data.componentType]?.resource || 'aws_instance'}" "${name}" {
  count         = ${count}
  ami           = var.ami_id
  instance_type = ${getInstanceType(node)}
  subnet_id     = aws_subnet.private[count.index % length(aws_subnet.private)].id
  vpc_security_group_ids = [aws_security_group.${name}_sg.id]${az}${pricing}

  tags = {
    Name        = "${node.data.label}-\${count.index + 1}"
    Environment = var.environment
    ManagedBy   = "archviz-terraform"
  }
}`;
}

function generateRDSBlock(node: ArchNode, name: string): string {
  const engine = node.data.componentType === 'postgresql' ? 'postgres' : 'mysql';
  const multiAZ = node.data.multiAZ ? 'true' : 'false';
  const replicas = (node.data as any).readReplicas || 0;
  const storage = node.data.volumeType === 'io1' ? 'io1' : node.data.volumeType === 'magnetic' ? 'standard' : 'gp3';

  let block = `
${getTierComment(node)}
resource "aws_db_instance" "${name}" {
  identifier           = "${sanitize(node.data.label)}"
  engine               = "${engine}"
  engine_version       = "${engine === 'postgres' ? '15.4' : '8.0.35'}"
  instance_class       = ${getInstanceType(node)}
  allocated_storage    = 100
  storage_type         = "${storage}"
  multi_az             = ${multiAZ}
  db_subnet_group_name = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.${name}_sg.id]
  storage_encrypted    = ${node.data.strictTls ? 'true' : 'true'}
  skip_final_snapshot  = true

  tags = {
    Name        = "${node.data.label}"
    Environment = var.environment
    ManagedBy   = "archviz-terraform"
  }
}`;

  if (replicas > 0) {
    block += `

resource "aws_db_instance" "${name}_replica" {
  count                = ${replicas}
  replicate_source_db  = aws_db_instance.${name}.identifier
  instance_class       = ${getInstanceType(node)}
  skip_final_snapshot  = true

  tags = {
    Name = "${node.data.label}-replica-\${count.index + 1}"
  }
}`;
  }
  return block;
}

function generateLambdaBlock(node: ArchNode, name: string): string {
  const memStr = node.data.tier.label.replace(/\s/g, '');
  const memMB = parseInt(memStr) || 512;
  return `
${getTierComment(node)}
resource "aws_lambda_function" "${name}" {
  function_name = "${sanitize(node.data.label)}"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  memory_size   = ${memMB}
  timeout       = 30
  role          = aws_iam_role.lambda_exec.arn

  filename         = "lambda_payload.zip"
  source_code_hash = filebase64sha256("lambda_payload.zip")

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}`;
}

function generateElastiCacheBlock(node: ArchNode, name: string): string {
  return `
${getTierComment(node)}
resource "aws_elasticache_cluster" "${name}" {
  cluster_id           = "${sanitize(node.data.label)}"
  engine               = "redis"
  node_type            = ${getInstanceType(node)}
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.${name}_sg.id]

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}`;
}

function generateS3Block(node: ArchNode, name: string): string {
  return `
${getTierComment(node)}
resource "aws_s3_bucket" "${name}" {
  bucket = "\${var.project_name}-${sanitize(node.data.label)}"

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "${name}_enc" {
  bucket = aws_s3_bucket.${name}.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "${name}_ver" {
  bucket = aws_s3_bucket.${name}.id
  versioning_configuration {
    status = "Enabled"
  }
}`;
}

function generateALBBlock(node: ArchNode, name: string): string {
  return `
${getTierComment(node)}
resource "aws_lb" "${name}" {
  name               = "${sanitize(node.data.label)}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.${name}_sg.id]
  subnets            = aws_subnet.public[*].id

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}

resource "aws_lb_listener" "${name}_listener" {
  load_balancer_arn = aws_lb.${name}.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.${name}_tg.arn
  }
}`;
}

function generateGenericBlock(node: ArchNode, name: string): string {
  const mapping = tfResourceMap[node.data.componentType];
  if (!mapping) {
    return `\n# ${node.data.label} — No Terraform mapping available (external service)`;
  }
  return `
${getTierComment(node)}
resource "${mapping.resource}" "${name}" {
  # ${mapping.service}: ${node.data.label}
  # Configure according to ${mapping.service} documentation

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}`;
}

// ── Main Generator ──
export function generateTerraform(nodes: ArchNode[], edges: ArchEdge[], projectName: string): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ═══════════════════════════════════════════════════════════════
# Terraform Configuration — ${projectName}
# Generated by ArchViz (https://archviz.app)
# Date: ${new Date().toISOString()}
# ═══════════════════════════════════════════════════════════════
#
# IMPORTANT: This is a starting-point scaffold. Review and customize
# before applying to production. Replace placeholder values (var.*)
# with your actual configuration.
#
# Components: ${nodes.length}
# Connections: ${edges.length}
# ═══════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Variables ──────────────────────────────────────────────────

variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

variable "project_name" {
  default = "${sanitize(projectName)}"
}

variable "ami_id" {
  description = "AMI ID for EC2 instances"
  default     = "ami-0c02fb55956c7d316"  # Amazon Linux 2023
}

variable "az_primary" {
  default = "us-east-1a"
}

variable "certificate_arn" {
  description = "ACM Certificate ARN for HTTPS"
  default     = ""
}

# ── Networking ─────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "\${var.project_name}-vpc"
  }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = "\${var.aws_region}\${count.index == 0 ? "a" : "b"}"
  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.project_name}-public-\${count.index + 1}"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = "\${var.aws_region}\${count.index == 0 ? "a" : "b"}"

  tags = {
    Name = "\${var.project_name}-private-\${count.index + 1}"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-igw"
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "\${var.project_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "\${var.project_name}-cache-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_iam_role" "lambda_exec" {
  name = "\${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}
`);

  // ── Per-component resources ──
  lines.push('# ── Resources ──────────────────────────────────────────────────\n');

  const usedNames = new Set<string>();

  for (const node of nodes) {
    let name = sanitize(node.data.label);
    if (usedNames.has(name)) { name = `${name}_${node.id.slice(-4)}`; }
    usedNames.add(name);

    const type = node.data.componentType;

    // Security group for each resource
    lines.push(`
resource "aws_security_group" "${name}_sg" {
  name_prefix = "${name}-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${name}-sg"
  }
}`);

    // Generate resource block based on type
    if (['api-server', 'web-server', 'worker', 'websocket-server', 'graphql-server', 'game-server', 'ml-worker'].includes(type)) {
      lines.push(generateEC2Block(node, name));
    } else if (['postgresql', 'mysql'].includes(type)) {
      lines.push(generateRDSBlock(node, name));
    } else if (type === 'lambda') {
      lines.push(generateLambdaBlock(node, name));
    } else if (type === 'redis') {
      lines.push(generateElastiCacheBlock(node, name));
    } else if (type === 's3') {
      lines.push(generateS3Block(node, name));
    } else if (type === 'load-balancer') {
      lines.push(generateALBBlock(node, name));
    } else if (['client-browser', 'mobile-app', 'external-api', 'stripe-api', 'openai-api'].includes(type)) {
      lines.push(`\n# ${node.data.label} — External client (no infrastructure required)`);
    } else {
      lines.push(generateGenericBlock(node, name));
    }
  }

  // ── Outputs ──
  lines.push(`

# ── Outputs ────────────────────────────────────────────────────

output "vpc_id" {
  value = aws_vpc.main.id
}

output "architecture_summary" {
  value = {
    total_components = ${nodes.length}
    total_connections = ${edges.length}
    generated_by     = "ArchViz"
  }
}
`);

  return lines.join('\n');
}

// ── CloudFormation Generator ──
export function generateCloudFormation(nodes: ArchNode[], _edges: ArchEdge[], projectName: string): string {
  const resources: Record<string, any> = {};

  for (const node of nodes) {
    const name = sanitize(node.data.label).replace(/_/g, '');
    const type = node.data.componentType;

    if (['api-server', 'web-server', 'worker', 'websocket-server'].includes(type)) {
      const count = node.data.scalingType === 'horizontal' ? node.data.instances : 1;
      for (let i = 0; i < count; i++) {
        resources[`${name}${i > 0 ? i + 1 : ''}`] = {
          Type: 'AWS::EC2::Instance',
          Properties: {
            InstanceType: node.data.tier.label.includes('.') ? node.data.tier.label : 't3.medium',
            ImageId: '!Ref LatestAmiId',
            Tags: [{ Key: 'Name', Value: `${node.data.label}-${i + 1}` }],
          },
        };
      }
    } else if (['postgresql', 'mysql'].includes(type)) {
      resources[name] = {
        Type: 'AWS::RDS::DBInstance',
        Properties: {
          Engine: type === 'postgresql' ? 'postgres' : 'mysql',
          DBInstanceClass: node.data.tier.label.startsWith('db.') ? node.data.tier.label : 'db.t3.medium',
          AllocatedStorage: 100,
          MultiAZ: !!node.data.multiAZ,
          StorageEncrypted: true,
        },
      };
    } else if (type === 's3') {
      resources[name] = {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketEncryption: {
            ServerSideEncryptionConfiguration: [{
              ServerSideEncryptionByDefault: { SSEAlgorithm: 'aws:kms' },
            }],
          },
        },
      };
    } else if (type === 'load-balancer') {
      resources[name] = {
        Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        Properties: { Scheme: 'internet-facing', Type: 'application' },
      };
    } else if (type === 'redis') {
      resources[name] = {
        Type: 'AWS::ElastiCache::CacheCluster',
        Properties: { Engine: 'redis', CacheNodeType: 'cache.t3.micro', NumCacheNodes: 1 },
      };
    } else if (type === 'lambda') {
      resources[name] = {
        Type: 'AWS::Lambda::Function',
        Properties: {
          Runtime: 'nodejs20.x', Handler: 'index.handler',
          MemorySize: parseInt(node.data.tier.label) || 512,
        },
      };
    }
  }

  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `CloudFormation template for ${projectName} — Generated by ArchViz`,
    Parameters: {
      LatestAmiId: {
        Type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
        Default: '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64',
      },
    },
    Resources: resources,
  };

  return JSON.stringify(template, null, 2);
}

// ── Download helpers ──
export function downloadTerraform(nodes: ArchNode[], edges: ArchEdge[], projectName: string) {
  const content = generateTerraform(nodes, edges, projectName);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${sanitize(projectName)}.tf`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCloudFormation(nodes: ArchNode[], edges: ArchEdge[], projectName: string) {
  const content = generateCloudFormation(nodes, edges, projectName);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${sanitize(projectName)}-cfn.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
