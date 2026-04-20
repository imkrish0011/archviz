/* eslint-disable no-useless-escape */
import type { ArchNode, ArchEdge } from '../types';
import { getComponentDefinition } from '../data/componentLibrary';

/**
 * Terraform / CloudFormation Generator
 * Maps ArchViz canvas components to real AWS IaC resource blocks.
 */

// ── Component → Terraform Resource Mapping ──
const tfResourceMap: Record<string, { resource: string; service: string }> = {
  // Compute
  'api-server':          { resource: 'ec2_instance',              service: 'EC2' },
  'web-server':          { resource: 'ec2_instance',              service: 'EC2' },
  'worker':              { resource: 'ec2_instance',              service: 'EC2' },
  'websocket-server':    { resource: 'ec2_instance',              service: 'EC2' },
  'lambda':              { resource: 'aws_lambda_function',       service: 'Lambda' },
  'ecs-fargate':         { resource: 'aws_ecs_service',           service: 'ECS' },
  'app-runner':          { resource: 'aws_apprunner_service',     service: 'App Runner' },
  'kubernetes-cluster':  { resource: 'aws_eks_cluster',           service: 'EKS' },
  'cloudflare-workers':  { resource: 'cloudflare_worker_script',  service: 'Cloudflare' },
  'graphql-server':      { resource: 'ec2_instance',              service: 'EC2' },
  'game-server':         { resource: 'ec2_instance',              service: 'EC2' },
  'ml-worker':           { resource: 'ec2_instance',              service: 'EC2 (GPU)' },
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

  // Auth / Client
  'auth0':               { resource: 'auth0_client',              service: 'Auth0' },
  'aws-cognito':         { resource: 'aws_cognito_user_pool',     service: 'Cognito' },
  'hashicorp-vault':     { resource: 'vault_mount',               service: 'Vault' },

  // Frontend & PaaS
  'nextjs':              { resource: 'vercel_project',            service: 'Vercel' },
  'react':               { resource: 'aws_s3_bucket_website_configuration', service: 'S3 Website' },
  'vue':                 { resource: 'aws_s3_bucket_website_configuration', service: 'S3 Website' },
  'vercel':              { resource: 'vercel_project',            service: 'Vercel' },
  'netlify':             { resource: 'netlify_site',              service: 'Netlify' },
  'cloudflare-pages':    { resource: 'cloudflare_pages_project',  service: 'Cloudflare Pages' },
  'supabase':            { resource: 'supabase_project',          service: 'Supabase' },
  'planetscale':         { resource: 'planetscale_database',      service: 'PlanetScale' },
  'firebase':            { resource: 'google_firebase_project',   service: 'Firebase' },
};

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
}

function getTierComment(node: ArchNode): string {
  return `# Tier: ${node.data.tier.label} | ${node.data.tier.cpu || ''} ${node.data.tier.ram || ''} | $${node.data.tier.monthlyCost}/mo`.trim();
}

function getInstanceType(node: ArchNode): string {
  const label = node.data.tier.label.toLowerCase();
  if (label.includes('t3') || label.includes('t4g')) return `"${node.data.tier.label}"`;
  if (label.includes('m5') || label.includes('m6')) return `"${node.data.tier.label}"`;
  if (label.includes('r6g') || label.includes('r5')) return `"${node.data.tier.label}"`;
  if (label.includes('c6') || label.includes('c5')) return `"${node.data.tier.label}"`;
  if (label.includes('g4') || label.includes('p4')) return `"${node.data.tier.label}"`;
  if (label.includes('db.')) return `"${node.data.tier.label}"`;
  if (label.includes('cache.')) return `"${node.data.tier.label}"`;
  return `"t3.medium"`;
}

interface NodeContext {
  name: string;
  envVars: string[];
  iamStatements: string;
}

function generateEC2RoleBlock(name: string, statements: string): string {
  if (!statements) return '';
  return `
resource "aws_iam_role" "${name}_role" {
  name = "${name}-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "${name}_policy" {
  name = "${name}-policy"
  role = aws_iam_role.${name}_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
${statements}
    ]
  })
}

resource "aws_iam_instance_profile" "${name}_profile" {
  name = "${name}-profile"
  role = aws_iam_role.${name}_role.name
}
`;
}

function generateLambdaRoleBlock(name: string, statements: string): string {
  return `
resource "aws_iam_role" "${name}_lambda_role" {
  name = "${name}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "${name}_lambda_logs" {
  role       = aws_iam_role.${name}_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

${statements ? `
resource "aws_iam_role_policy" "${name}_lambda_custom_policy" {
  name = "${name}-custom-policy"
  role = aws_iam_role.${name}_lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
${statements}
    ]
  })
}
` : ''}
`;
}

function generateEC2Block(node: ArchNode, ctx: NodeContext): string {
  const count = node.data.scalingType === 'horizontal' ? node.data.instances : 1;
  const roleBlock = generateEC2RoleBlock(ctx.name, ctx.iamStatements);
  
  const userData = ctx.envVars.length > 0 ? `
  user_data = <<-EOF
    #!/bin/bash
    echo "# Injected env vars via ArchViz Edge Relationships" >> /etc/profile
    ${ctx.envVars.map(v => `echo "export ${v}" >> /etc/profile`).join('\n    ')}
  EOF` : '';

  let block = roleBlock + `
${getTierComment(node)}
module "ec2_instance_${ctx.name}" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "~> 5.6.0"

  name = "${node.data.label}"
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = ${getInstanceType(node)}
  vpc_security_group_ids = [aws_security_group.${ctx.name}_sg.id]
  subnet_id              = module.vpc.private_subnets[0]
${ctx.iamStatements ? `  iam_instance_profile   = aws_iam_instance_profile.${ctx.name}_profile.name` : ''}${userData}
`;

  if (count > 1) {
    block = roleBlock + `
${getTierComment(node)}
module "ec2_instance_${ctx.name}" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "~> 5.6.0"
  
  for_each = toset([for i in range(${count}) : tostring(i)])

  name = "${node.data.label}-\$\{each.key}"
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = ${getInstanceType(node)}
  vpc_security_group_ids = [aws_security_group.${ctx.name}_sg.id]
  subnet_id              = element(module.vpc.private_subnets, tonumber(each.key))
${ctx.iamStatements ? `  iam_instance_profile   = aws_iam_instance_profile.${ctx.name}_profile.name` : ''}${userData}
`;
  }

  if (node.data.pricingModel === 'spot') {
    block += `
  create_spot_instance = true
  spot_price           = "${(node.data.tier.monthlyCost * 0.4 / 730).toFixed(4)}"
  spot_type            = "persistent"
`;
  }

  block += `
  tags = {
    Environment = var.environment
    ManagedBy   = "archviz-terraform"
  }
}`;
  return block;
}

function generateRDSBlock(node: ArchNode, ctx: NodeContext): string {
  const engine = node.data.componentType === 'postgresql' ? 'postgres' : 'mysql';
  const multiAZ = node.data.multiAZ ? 'true' : 'false';
  const replicas = ('readReplicas' in node.data) ? (node.data as {readReplicas?: number}).readReplicas || 0 : 0;
  const storage = node.data.volumeType === 'io1' ? 'io1' : node.data.volumeType === 'magnetic' ? 'standard' : 'gp3';
  
  const customVer = (node.data as Record<string, unknown>).engineVersion;
  const tfVersion = customVer ? `"${customVer}"` : (engine === 'postgres' ? 'local.postgres_version' : 'local.mysql_version');

  let block = `
${getTierComment(node)}
resource "aws_db_instance" "${ctx.name}" {
  identifier           = "${sanitize(node.data.label)}"
  engine               = "${engine}"
  engine_version       = ${tfVersion}
  instance_class       = ${getInstanceType(node)}
  allocated_storage    = 100
  storage_type         = "${storage}"
  multi_az             = ${multiAZ}
  db_subnet_group_name = module.vpc.database_subnet_group
  vpc_security_group_ids = [aws_security_group.${ctx.name}_sg.id]
  storage_encrypted    = true
  skip_final_snapshot  = true

  tags = {
    Name        = "${node.data.label}"
    Environment = var.environment
    ManagedBy   = "archviz-terraform"
  }
}`;

  if (replicas > 0) {
    block += `

resource "aws_db_instance" "${ctx.name}_replica" {
  count                = ${replicas}
  replicate_source_db  = aws_db_instance.${ctx.name}.identifier
  instance_class       = ${getInstanceType(node)}
  skip_final_snapshot  = true

  tags = {
    Name = "${node.data.label}-replica-\$\{count.index + 1}"
  }
}`;
  }
  return block;
}

function generateLambdaBlock(node: ArchNode, ctx: NodeContext): string {
  const memStr = node.data.tier.label.replace(/\s/g, '');
  const memMB = parseInt(memStr) || 512;
  const roleBlock = generateLambdaRoleBlock(ctx.name, ctx.iamStatements);
  
  const customVer = (node.data as Record<string, unknown>).engineVersion;
  const runtime = customVer ? `"${customVer}"` : `local.node_version`;

  return roleBlock + `
${getTierComment(node)}
resource "aws_lambda_function" "${ctx.name}" {
  function_name = "${sanitize(node.data.label)}"
  runtime       = ${runtime}
  handler       = "index.handler"
  memory_size   = ${memMB}
  timeout       = 30
  role          = aws_iam_role.${ctx.name}_lambda_role.arn

  filename         = "lambda_payload.zip"
  source_code_hash = filebase64sha256("lambda_payload.zip")

  environment {
    variables = {
      ENVIRONMENT = var.environment
${ctx.envVars.map(v => {
      const parts = v.split('=');
      const key = parts[0];
      const val = parts.slice(1).join('=');
      return `      ${key} = "${val}"`;
    }).join('\n')}
    }
  }

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}`;
}

function generateElastiCacheBlock(node: ArchNode, ctx: NodeContext): string {
  return `
${getTierComment(node)}
resource "aws_elasticache_cluster" "${ctx.name}" {
  cluster_id           = "${sanitize(node.data.label)}"
  engine               = "redis"
  node_type            = ${getInstanceType(node)}
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = module.vpc.elasticache_subnet_group_name
  security_group_ids   = [aws_security_group.${ctx.name}_sg.id]

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}`;
}

function generateS3Block(node: ArchNode, ctx: NodeContext): string {
  return `
${getTierComment(node)}
resource "aws_s3_bucket" "${ctx.name}" {
  bucket = "\$\{var.project_name}-${sanitize(node.data.label)}"

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "${ctx.name}_enc" {
  bucket = aws_s3_bucket.${ctx.name}.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "${ctx.name}_ver" {
  bucket = aws_s3_bucket.${ctx.name}.id
  versioning_configuration {
    status = "Enabled"
  }
}`;
}

function generateALBBlock(node: ArchNode, ctx: NodeContext): string {
  return `
${getTierComment(node)}
resource "aws_lb" "${ctx.name}" {
  name               = "${sanitize(node.data.label)}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.${ctx.name}_sg.id]
  subnets            = module.vpc.public_subnets

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}

resource "aws_lb_listener" "${ctx.name}_listener" {
  load_balancer_arn = aws_lb.${ctx.name}.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.${ctx.name}_tg.arn
  }
}

resource "aws_lb_target_group" "${ctx.name}_tg" {
  name     = "${ctx.name}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id
}`;
}

function generateGenericBlock(node: ArchNode, ctx: NodeContext): string {
  const mapping = tfResourceMap[node.data.componentType];
  if (!mapping) {
    return `\n# ${node.data.label} — No Terraform mapping available (external service)\n`;
  }
  return `
${getTierComment(node)}
resource "${mapping.resource}" "${ctx.name}" {
  # ${mapping.service}: ${node.data.label}
  # Configure according to ${mapping.service} documentation

  tags = {
    Name      = "${node.data.label}"
    ManagedBy = "archviz-terraform"
  }
}`;
}

// ── Main Generator ──
export function generateTerraform(nodes: ArchNode[], edges: ArchEdge[], _projectName: string): Record<string, string> {
  const mainLines: string[] = [];
  const outputsLines: string[] = [];

  const publicSubnets = nodes.filter(n => n.data.componentType === 'groupNode' && n.data.label.toLowerCase().includes('public'));
  const privateSubnets = nodes.filter(n => n.data.componentType === 'groupNode' && n.data.label.toLowerCase().includes('private'));
  const numPub = Math.max(1, publicSubnets.length);
  const numPriv = Math.max(1, privateSubnets.length);

  const nodeNames = new Map<string, string>();
  const usedNames = new Set<string>();
  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') continue;
    let name = sanitize(node.data.label);
    if (usedNames.has(name)) { name = `${name}_${node.id.slice(-4)}`; }
    usedNames.add(name);
    nodeNames.set(node.id, name);
  }

  const contextMap = new Map<string, NodeContext>();
  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') continue;
    const name = nodeNames.get(node.id)!;
    const envVars: string[] = [];
    let iamStatements = "";
    
    const outgoing = edges.filter(e => e.source === node.id);
    outgoing.forEach(e => {
        const tgt = nodes.find(n => n.id === e.target);
        if (!tgt) return;
        const tgtName = nodeNames.get(tgt.id)!;
        const tgtType = tgt.data.componentType;
        
        if (['postgresql', 'mysql'].includes(tgtType)) {
            envVars.push(`DB_URL=\$\{aws_db_instance.${tgtName}.endpoint}`);
        } else if (tgtType === 'redis') {
            envVars.push(`REDIS_URL=\$\{aws_elasticache_cluster.${tgtName}.cache_nodes[0].address}`);
        } else if (tgtType === 's3') {
            envVars.push(`S3_BUCKET=\$\{aws_s3_bucket.${tgtName}.bucket}`);
            iamStatements += `
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = [
          aws_s3_bucket.${tgtName}.arn,
          "\$\{aws_s3_bucket.${tgtName}.arn}/*"
        ]
      },`;
        } else if (tgtType === 'dynamodb') {
            envVars.push(`DYNAMODB_TABLE=\$\{aws_dynamodb_table.${tgtName}.name}`);
            iamStatements += `
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Effect   = "Allow"
        Resource = [aws_dynamodb_table.${tgtName}.arn]
      },`;
        }
    });
    
    contextMap.set(node.id, { name, envVars, iamStatements });
  }

  const variablesContent = `# ═══════════════════════════════════════════════════════════════
# Variables Configuration
# ═══════════════════════════════════════════════════════════════

locals {
  postgres_version = "15.4"
  mysql_version    = "8.0.35"
  node_version     = "nodejs20.x"
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment Environment"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project Name"
  type        = string
  default     = "${sanitize(_projectName)}"
}

variable "certificate_arn" {
  description = "ACM Certificate ARN for HTTPS listeners"
  type        = string
  default     = ""
}
`;

  mainLines.push(`# ═══════════════════════════════════════════════════════════════
# Terraform Configuration — ${_projectName}
# Generated by ArchViz
# Date: ${new Date().toISOString()}
# ═══════════════════════════════════════════════════════════════
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

# ── Dynamic AMI Fetching ───────────────────────────────────────
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

# ── Networking Module ──────────────────────────────────────────
data "aws_availability_zones" "available" {}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "\$\{var.project_name}-vpc"
  cidr = "10.0.0.0/16"

  azs             = slice(data.aws_availability_zones.available.names, 0, ${Math.max(numPub, numPriv)})
  public_subnets  = [for k, v in data.aws_availability_zones.available.names : cidrsubnet("10.0.0.0/16", 8, k) if k < ${numPub}]
  private_subnets = [for k, v in data.aws_availability_zones.available.names : cidrsubnet("10.0.0.0/16", 8, k + 10) if k < ${numPriv}]

  enable_nat_gateway = true
  single_nat_gateway = true
  create_database_subnet_group = true
  create_elasticache_subnet_group = true

  tags = {
    Environment = var.environment
    ManagedBy   = "archviz-terraform"
  }
}
`);

  mainLines.push('# ── Resources ──────────────────────────────────────────────────\n');

  outputsLines.push(`# ═══════════════════════════════════════════════════════════════
# Output Configuration
# ═══════════════════════════════════════════════════════════════

output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "architecture_summary" {
  description = "Architecture Metadata Summary"
  value = {
    total_components = ${nodes.length}
    total_connections = ${edges.length}
    generated_by     = "ArchViz"
  }
}
`);

  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') continue;

    const ctx = contextMap.get(node.id)!;
    const type = node.data.componentType;
    const isDB = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'aurora-serverless', 'dynamodb'].includes(type) || ['redis', 'elasticsearch'].includes(type);

    let sgIngress = "";
    
    if (isDB) {
      const incomingEdges = edges.filter(e => e.target === node.id);
      const sourceNodes = incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean) as ArchNode[];
      
      if (sourceNodes.length > 0) {
        sourceNodes.forEach(src => {
            const srcName = nodeNames.get(src.id)!;
            const portMap: Record<string, number> = { 'postgresql': 5432, 'mysql': 3306, 'mongodb': 27017, 'redis': 6379, 'elasticsearch': 9200 };
            const port = portMap[type] || 443;
            sgIngress += `
  ingress {
    from_port       = ${port}
    to_port         = ${port}
    protocol        = "tcp"
    security_groups = [aws_security_group.${srcName}_sg.id]
    description     = "Allow traffic from ${srcName}"
  }`;
        });
      } else {
        sgIngress += `
  # Warning: No incoming connections defined in architecture for this DB
  # Restricting all ingress by default. Override if needed.`;
      }
    } else {
      sgIngress += `
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Internal VPC traffic"
  }`;
      if (type === 'load-balancer') {
          sgIngress += `
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Public HTTP"
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Public HTTPS"
  }`;
      }
    }

    mainLines.push(`
resource "aws_security_group" "${ctx.name}_sg" {
  name_prefix = "${ctx.name}-sg-"
  vpc_id      = module.vpc.vpc_id
${sgIngress}

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${ctx.name}-sg"
  }
}`);

    if (['api-server', 'web-server', 'worker', 'websocket-server', 'graphql-server', 'game-server', 'ml-worker'].includes(type)) {
      mainLines.push(generateEC2Block(node, ctx));
    } else if (['postgresql', 'mysql'].includes(type)) {
      mainLines.push(generateRDSBlock(node, ctx));
      outputsLines.push(`
output "rds_endpoint_${ctx.name}" {
  description = "RDS Endpoint for ${ctx.name}"
  value       = aws_db_instance.${ctx.name}.endpoint
}`);
    } else if (type === 'lambda') {
      mainLines.push(generateLambdaBlock(node, ctx));
    } else if (type === 'redis') {
      mainLines.push(generateElastiCacheBlock(node, ctx));
    } else if (type === 's3') {
      mainLines.push(generateS3Block(node, ctx));
    } else if (type === 'load-balancer') {
      mainLines.push(generateALBBlock(node, ctx));
      outputsLines.push(`
output "alb_dns_${ctx.name}" {
  description = "DNS connection point for Load Balancer: ${ctx.name}"
  value       = aws_lb.${ctx.name}.dns_name
}`);
    } else if (['client-browser', 'mobile-app', 'external-api', 'stripe-api', 'openai-api'].includes(type)) {
      mainLines.push(`\n# ${node.data.label} — External client (no infrastructure required)`);
    } else {
      mainLines.push(generateGenericBlock(node, ctx));
    }
  }

  return {
    'main.tf': mainLines.join('\n'),
    'variables.tf': variablesContent,
    'outputs.tf': outputsLines.join('\n')
  };
}

export function parseTfState(stateJson: { resources?: Array<{ mode?: string; type?: string; name?: string; instances?: Array<{ attributes?: Record<string, unknown> }> }> } | null): { nodes: ArchNode[], edges: ArchEdge[] } {
  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  
  if (!stateJson || !Array.isArray(stateJson.resources)) return { nodes, edges };

  let yOffset = 0;
  
  for (const resource of stateJson.resources) {
    if (resource.mode !== 'managed') continue;
    let compType = '';
    
    switch (resource.type) {
      case 'aws_instance': compType = 'api-server'; break;
      case 'aws_db_instance': compType = 'postgresql'; break;
      case 'aws_lb': case 'aws_elb': case 'aws_alb': compType = 'load-balancer'; break;
      case 'aws_s3_bucket': compType = 's3'; break;
      case 'aws_lambda_function': compType = 'lambda'; break;
      case 'aws_elasticache_cluster': case 'aws_elasticache_replication_group': compType = 'redis'; break;
      case 'aws_ecs_service': compType = 'ecs-fargate'; break;
      case 'aws_eks_cluster': compType = 'kubernetes-cluster'; break;
      case 'aws_cloudfront_distribution': compType = 'cdn'; break;
      case 'aws_apigatewayv2_api': case 'aws_api_gateway_rest_api': compType = 'api-gateway'; break;
      case 'aws_sqs_queue': compType = 'sqs'; break;
      case 'aws_sns_topic': compType = 'sns'; break;
      case 'aws_route53_zone': compType = 'dns'; break;
      case 'aws_dynamodb_table': compType = 'dynamodb'; break;
      default: continue;
    }
    
    const def = getComponentDefinition(compType);
    if (!def) continue;

    const instName = resource.name || resource.type;
    const instanceCount = Array.isArray(resource.instances) ? resource.instances.length : 1;
    const tier = def.tiers[def.defaultTierIndex];
    
    const newNode: ArchNode = {
      id: `tf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'archNode',
      position: { x: 100 + (Math.random() * 50), y: 100 + yOffset },
      data: {
        componentType: def.type, label: instName, category: def.category, icon: def.icon,
        tier, tierIndex: def.defaultTierIndex, instances: instanceCount > 0 ? instanceCount : 1,
        scalingType: def.scalingType, reliability: def.reliability, scalingFactor: def.scalingFactor,
        healthStatus: 'healthy', loadPercent: 0,
      },
    };
    
    nodes.push(newNode);
    yOffset += 100;
  }
  return { nodes, edges };
}

export function generateCloudFormation(nodes: ArchNode[], _edges: ArchEdge[], projectName: string): string {
  const resources: Record<string, unknown> = {};

  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') continue;
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
          AllocatedStorage: 100, MultiAZ: !!node.data.multiAZ, StorageEncrypted: true,
        },
      };
    } else if (type === 's3') {
      resources[name] = {
        Type: 'AWS::S3::Bucket',
        Properties: { BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'aws:kms' } }] } },
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
        Properties: { Runtime: 'nodejs20.x', Handler: 'index.handler', MemorySize: parseInt(node.data.tier.label) || 512 },
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

export function downloadTerraform(nodes: ArchNode[], edges: ArchEdge[], projectName: string) {
  const fileContents = generateTerraform(nodes, edges, projectName);
  for (const [filename, content] of Object.entries(fileContents)) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${sanitize(projectName)}-${filename}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
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

interface DockerService {
  image?: string;
  ports?: string[];
  environment?: string[];
  volumes?: string[];
  command?: string;
  working_dir?: string;
  deploy?: { replicas: number; };
}

export function generateDockerCompose(nodes: ArchNode[], _edges: ArchEdge[], projectName: string): string {
  const services: Record<string, DockerService> = {};

  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') continue;

    const name = sanitize(node.data.label);
    const type = node.data.componentType;

    if (['api-server', 'web-server', 'worker', 'websocket-server', 'graphql-server'].includes(type)) {
      services[name] = {
        image: `my-registry.local/${name}:latest`,
        ports: ['8080:8080'],
        environment: ['NODE_ENV=development'],
        deploy: { replicas: node.data.scalingType === 'horizontal' ? node.data.instances : 1 }
      };
    } else if (['postgresql'].includes(type)) {
      services[name] = {
        image: 'postgres:15',
        environment: ['POSTGRES_USER=\$\{POSTGRES_USER:-admin}', 'POSTGRES_PASSWORD=\$\{POSTGRES_PASSWORD:-secret}', 'POSTGRES_DB=\$\{POSTGRES_DB:-mydb}'],
        ports: ['5432:5432'],
        volumes: [`${name}_data:/var/lib/postgresql/data`]
      };
    } else if (['mysql'].includes(type)) {
      services[name] = {
        image: 'mysql:8',
        environment: ['MYSQL_ROOT_PASSWORD=\$\{MYSQL_ROOT_PASSWORD:-secret}', 'MYSQL_DATABASE=\$\{MYSQL_DATABASE:-mydb}'],
        ports: ['3306:3306'],
        volumes: [`${name}_data:/var/lib/mysql`]
      };
    } else if (['redis'].includes(type)) {
      services[name] = { image: 'redis:7-alpine', ports: ['6379:6379'] };
    } else if (['s3'].includes(type)) {
      services[name] = { image: 'minio/minio', command: 'server /data', ports: ['9000:9000'] };
    } else if (['mongodb'].includes(type)) {
      services[name] = { image: 'mongo:6', ports: ['27017:27017'], volumes: [`${name}_data:/data/db`] };
    } else if (['cassandra'].includes(type)) {
      services[name] = { image: 'cassandra:4', ports: ['9042:9042'], volumes: [`${name}_data:/var/lib/cassandra`] };
    } else if (['elasticsearch'].includes(type)) {
      services[name] = { image: 'elasticsearch:8.10.2', environment: ['discovery.type=single-node'], ports: ['9200:9200', '9300:9300'], volumes: [`${name}_data:/usr/share/elasticsearch/data`] };
    } else if (['kafka'].includes(type)) {
      services[name] = { image: 'confluentinc/cp-kafka:latest', ports: ['9092:9092'], environment: ['KAFKA_BROKER_ID=1', 'KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181', 'KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092', 'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1'] };
    } else if (['rabbitmq', 'message-queue'].includes(type)) {
      services[name] = { image: 'rabbitmq:3-management-alpine', ports: ['5672:5672', '15672:15672'] };
    } else if (['nextjs', 'react', 'vue'].includes(type)) {
      services[name] = { image: 'node:20-alpine', command: 'npm run dev', ports: ['3000:3000'], volumes: ['./frontend:/app'], working_dir: '/app' };
    }
  }

  const volumeNames = Object.keys(services).filter(k => (services[k] as {volumes?: string[]}).volumes).map(k => `${k}_data`);

  let yaml = `# NOTE: Ensure you use a .env file to inject actual values for interpolations (e.g. POSTGRES_PASSWORD)\nversion: '3.8'\nname: ${sanitize(projectName)}\n\nservices:\n`;

  for (const [sName, sDef] of Object.entries(services)) {
    yaml += `  ${sName}:\n`;
    if (sDef.image) yaml += `    image: ${sDef.image}\n`;
    if (sDef.command) yaml += `    command: ${sDef.command}\n`;
    if (sDef.ports) {
      yaml += `    ports:\n`;
      (sDef.ports as string[]).forEach((p: string) => yaml += `      - "${p}"\n`);
    }
    if (sDef.environment) {
      yaml += `    environment:\n`;
      (sDef.environment as string[]).forEach((e: string) => yaml += `      - ${e}\n`);
    }
    if (sDef.volumes) {
      yaml += `    volumes:\n`;
      (sDef.volumes as string[]).forEach((v: string) => yaml += `      - ${v}\n`);
    }
    if (sDef.deploy) {
      yaml += `    deploy:\n      replicas: ${sDef.deploy.replicas}\n`;
    }
  }

  if (volumeNames.length > 0) {
    yaml += `\nvolumes:\n`;
    volumeNames.forEach(v => yaml += `  ${v}:\n`);
  }

  return yaml;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateKubernetesManifests(nodes: ArchNode[], edges: ArchEdge[], _projectName: string): string {
  let manifests = '';

  for (const node of nodes) {
    if (node.data.componentType === 'groupNode') continue;
    if (!['api-server', 'web-server', 'worker', 'websocket-server', 'redis', 'postgresql', 'mysql'].includes(node.data.componentType)) continue;

    const name = sanitize(node.data.label).replace(/_/g, '-');
    const replicas = node.data.scalingType === 'horizontal' ? node.data.instances : 1;
    
    // Deployment
    manifests += `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\n  namespace: default\n  labels:\n    app: ${name}\n`;
    manifests += `spec:\n  replicas: ${replicas}\n  selector:\n    matchLabels:\n      app: ${name}\n`;
    manifests += `  template:\n    metadata:\n      labels:\n        app: ${name}\n`;
    manifests += `    spec:\n      containers:\n      - name: ${name}\n        image: ${name}:latest\n`;
    manifests += `        ports:\n        - containerPort: 8080\n---\n`;

    const isCompute = ['api-server', 'web-server', 'websocket-server', 'graphql-server'].includes(node.data.componentType);
    const incomingEdges = edges.filter(e => e.target === node.id);
    const isBehindLb = incomingEdges.some(e => {
        const srcNode = nodes.find(n => n.id === e.source);
        return srcNode && srcNode.data.componentType === 'load-balancer';
    });

    const svcType = (isCompute && !isBehindLb) ? 'LoadBalancer' : 'ClusterIP';

    // Service
    manifests += `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${name}-svc\n  namespace: default\n`;
    manifests += `spec:\n  selector:\n    app: ${name}\n  ports:\n    - protocol: TCP\n      port: 80\n      targetPort: 8080\n`;
    manifests += `  type: ${svcType}\n---\n`;
  }

  return manifests || '# No applicable workloads found for Kubernetes manifest generation.';
}

export function downloadDockerCompose(nodes: ArchNode[], edges: ArchEdge[], projectName: string) {
  const content = generateDockerCompose(nodes, edges, projectName);
  const blob = new Blob([content], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = "docker-compose.yml";
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadKubernetesManifests(nodes: ArchNode[], edges: ArchEdge[], projectName: string) {
  const content = generateKubernetesManifests(nodes, edges, projectName);
  const blob = new Blob([content], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = "k8s-manifests.yaml";
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
