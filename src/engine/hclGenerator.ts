import type { ArchEdge, ArchNode } from '../types';
import { calculateSystemReliability, findSinglePointsOfFailure } from './failureModel';
import {
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

interface DownloadFile {
  filename: string;
  content: string;
  mimeType: string;
}

/**
 * Architectural Validation Layer
 * Checks for critical errors before generating IaC.
 */
export function validateArchitecture(nodes: ArchNode[], edges: ArchEdge[]): string[] {
  const errors: string[] = [];
  const activeNodes = nodes.filter(n => n.data.componentType !== 'groupNode');

  const computeNodes = activeNodes.filter(n => ['api-server', 'web-server', 'worker'].includes(n.data.componentType));
  for (const node of computeNodes) {
    if (node.data.instances > 1) {
      const hasLB = edges.some(e => {
        const source = activeNodes.find(s => s.id === e.source);
        return e.target === node.id && (source?.data.componentType === 'load-balancer' || source?.data.componentType === 'alb');
      });
      if (!hasLB) {
        errors.push(`Node "${node.data.label}" has multiple instances but no Load Balancer routing traffic to it.`);
      }
    }
  }

  const dbNodes = activeNodes.filter(n => ['postgresql', 'mysql', 'mongodb', 'rds', 'dynamodb'].includes(n.data.componentType));
  for (const db of dbNodes) {
    const hasIncoming = edges.some(e => e.target === db.id);
    if (!hasIncoming) {
      errors.push(`Database "${db.data.label}" has no incoming connections.`);
    }
  }

  return errors;
}

function validateTerraformResource(resource: string, type: string, label: string): void {
  const assertContains = (field: string) => {
    if (!resource.includes(field)) {
      throw new Error(`CRITICAL GENERATOR ERROR: Resource '${label}' (${type}) is missing required field: '${field}'`);
    }
  };

  if (['postgresql', 'mysql', 'rds'].includes(type)) {
    assertContains('engine');
    assertContains('engine_version');
    assertContains('instance_class');
    assertContains('allocated_storage');
    assertContains('username');
    assertContains('password');
    assertContains('db_subnet_group_name');
    assertContains('vpc_security_group_ids');
    assertContains('multi_az');
    assertContains('skip_final_snapshot');
  } else if (['api-server', 'web-server', 'worker', 'compute'].includes(type)) {
    assertContains('aws_launch_template');
    assertContains('aws_autoscaling_group');
    assertContains('vpc_zone_identifier');
    assertContains('launch_template');
  } else if (['load-balancer', 'alb'].includes(type)) {
    assertContains('subnets');
    assertContains('security_groups');
  }
}

function runSanityChecks(terraform: string): void {
  const lines = terraform.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/=\s*$/)) {
      throw new Error(`CRITICAL GENERATOR ERROR: Terraform contains empty assignments on line ${i + 1}: "${line}"`);
    }
    if (line.includes('${undefined}') || line.includes('${null}')) {
      throw new Error(`CRITICAL GENERATOR ERROR: Terraform contains undefined interpolations on line ${i + 1}: "${line}"`);
    }
  }
}

export function generateTerraform(nodes: ArchNode[], edges: ArchEdge[], projectName: string): TerraformArtifacts {
  const activeNodes = nodes.filter(node => node.data.componentType !== 'groupNode');
  const names = buildUniqueNames(activeNodes);
  const spofs = findSinglePointsOfFailure(nodes, edges);

  const variables = createVariableRegistry([
    { name: 'aws_region', type: 'string', description: 'AWS region', defaultValue: 'us-east-1' },
    { name: 'environment', type: 'string', description: 'Deployment environment', defaultValue: 'prod' },
    { name: 'project_name', type: 'string', description: 'Project name prefix', defaultValue: sanitizeName(projectName) || 'archviz' },
    { name: 'vpc_cidr', type: 'string', description: 'CIDR block for the VPC', defaultValue: '10.0.0.0/16' },
    { name: 'db_username', type: 'string', description: 'Database master username', defaultValue: 'dbadmin' },
    { name: 'db_password', type: 'string', description: 'Database master password', defaultValue: 'ReplaceMeWithSecurePassword123!', sensitive: true },
  ]);

  const resources: string[] = [
    renderTerraformHeader(projectName),
    renderProviderAndDataSources(),
    renderNetworking(variables),
  ];

  const outputs: TerraformOutput[] = [
    { name: 'vpc_id', description: 'VPC ID', value: 'aws_vpc.main.id' },
    { name: 'public_subnet_ids', description: 'Public Subnet IDs', value: 'aws_subnet.public[*].id' },
    { name: 'private_subnet_ids', description: 'Private Subnet IDs', value: 'aws_subnet.private[*].id' },
  ];

  const nodeTargetGroups = new Map<string, string>();

  // Pass 1: Load Balancers
  for (const node of activeNodes) {
    const type = node.data.componentType;
    if (['load-balancer', 'alb'].includes(type)) {
      const name = names.get(node.id)!;
      const albHcl = renderAlbResources(node, name, variables);
      validateTerraformResource(albHcl, type, node.data.label);
      resources.push(albHcl);
      
      const outgoingEdges = edges.filter(e => e.source === node.id);
      outgoingEdges.forEach(edge => {
        nodeTargetGroups.set(edge.target, `aws_lb_target_group.${name}_tg.arn`);
      });
      
      outputs.push({ name: `${name}_dns_name`, description: `${node.data.label} DNS Name`, value: `aws_lb.${name}.dns_name` });
    }
  }

  // Pass 2: Other Resources
  for (const node of activeNodes) {
    const type = node.data.componentType;
    if (['load-balancer', 'alb'].includes(type)) continue;

    const name = names.get(node.id)!;
    const incomingDeps = edges.filter(e => e.target === node.id).map(e => names.get(e.source)).filter(Boolean) as string[];
    const isHA = node.data.reliability < 0.95 || spofs.includes(node.id) || node.data.multiAZ;

    const sgHcl = renderSecurityGroup(node, name, incomingDeps, variables);
    resources.push(sgHcl);

    let resourceHcl = '';
    if (['api-server', 'web-server', 'worker', 'compute'].includes(type)) {
      const targetGroupArn = nodeTargetGroups.get(node.id);
      resourceHcl = renderComputeResources(node, name, variables, isHA, targetGroupArn);
    } else if (['postgresql', 'mysql', 'rds'].includes(type)) {
      resourceHcl = renderRdsResources(node, name, variables, isHA);
    } else if (type === 's3') {
      resourceHcl = renderS3Resources(name, variables);
    } else if (type === 'lambda') {
      resourceHcl = renderLambdaResources(node, name, variables);
    } else if (type === 'dynamodb') {
      resourceHcl = renderDynamoDbResources(name);
    } else {
      resourceHcl = `# Resource: ${node.data.label} (${type})\n# No direct Terraform mapping. Configure manually.`;
    }

    validateTerraformResource(resourceHcl, type, node.data.label);
    resources.push(resourceHcl);
  }

  const mainTf = resources.join('\n\n');
  runSanityChecks(mainTf);

  return {
    mainTf,
    variablesTf: renderVariableBlocks(variables.all),
    outputsTf: renderOutputBlocks(outputs),
  };
}

function renderTerraformHeader(projectName: string): string {
  const prefix = sanitizeName(projectName) || 'archviz';
  return `terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}`;
}

function renderProviderAndDataSources(): string {
  return `provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "latest_amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "archviz"
  }
}`;
}

function renderNetworking(vars: VariableRegistry): string {
  vars.ensure({ name: 'public_subnet_cidrs', type: 'list(string)', description: 'Public subnet CIDRs', defaultValue: ['10.0.1.0/24', '10.0.2.0/24'] });
  vars.ensure({ name: 'private_subnet_cidrs', type: 'list(string)', description: 'Private subnet CIDRs', defaultValue: ['10.0.11.0/24', '10.0.12.0/24'] });

  return `resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = merge(local.common_tags, { Name = "\${var.project_name}-vpc" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "\${var.project_name}-igw" })
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = merge(local.common_tags, { Name = "\${var.project_name}-public-\${count.index}" })
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = merge(local.common_tags, { Name = "\${var.project_name}-private-\${count.index}" })
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "\${var.project_name}-nat-eip" })
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]
  tags          = merge(local.common_tags, { Name = "\${var.project_name}-nat" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = merge(local.common_tags, { Name = "\${var.project_name}-public-rt" })
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  tags = merge(local.common_tags, { Name = "\${var.project_name}-private-rt" })
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}`;
}

function renderComputeResources(node: ArchNode, name: string, vars: VariableRegistry, ha: boolean, targetGroupArn?: string): string {
  const instances = ha ? Math.max(2, node.data.instances) : Math.max(1, node.data.instances);
  const instanceType = vars.ensure({ name: `${name}_instance_type`, type: 'string', description: `Instance type for ${node.data.label}`, defaultValue: 't3.medium' });

  return `resource "aws_launch_template" "${name}" {
  name_prefix   = "${name}-"
  image_id      = data.aws_ami.latest_amazon_linux.id
  instance_type = var.${instanceType}

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [aws_security_group.${name}_sg.id]
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo "Starting service ${node.data.label}..."
    EOF
  )

  monitoring { enabled = true }

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.common_tags, { Name = "${node.data.label}" })
  }
}

resource "aws_autoscaling_group" "${name}" {
  name                = "${name}-asg"
  vpc_zone_identifier = aws_subnet.private[*].id
  desired_capacity    = ${instances}
  max_size            = ${instances * 2}
  min_size            = ${ha ? 2 : 1}
  
  target_group_arns = ${targetGroupArn ? `[${targetGroupArn}]` : '[]'}

  launch_template {
    id      = aws_launch_template.${name}.id
    version = "$Latest"
  }
}`;
}

function renderRdsResources(node: ArchNode, name: string, vars: VariableRegistry, ha: boolean): string {
  const engineRaw = node.data.componentType;
  const engine = engineRaw === 'mysql' ? 'mysql' : 'postgres';
  const defaultVersion = engine === 'mysql' ? '8.0' : '15.4';
  const port = engine === 'mysql' ? 3306 : 5432;
  const instanceClass = vars.ensure({ name: `${name}_instance_class`, type: 'string', description: `Instance class for ${node.data.label}`, defaultValue: 'db.t3.medium' });

  return `resource "aws_db_subnet_group" "${name}" {
  name       = "${name}-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.common_tags
}

resource "aws_db_instance" "${name}" {
  identifier             = "${name}"
  engine                 = "${engine}"
  engine_version         = "${defaultVersion}"
  instance_class         = var.${instanceClass}
  allocated_storage      = 20
  db_subnet_group_name   = aws_db_subnet_group.${name}.name
  vpc_security_group_ids = [aws_security_group.${name}_sg.id]
  
  username               = var.db_username
  password               = var.db_password
  port                   = ${port}

  multi_az               = ${ha ? 'true' : 'false'}
  storage_encrypted      = true
  skip_final_snapshot    = true
  
  tags = merge(local.common_tags, { Name = "${node.data.label}" })
}`;
}

function renderSecurityGroup(node: ArchNode, name: string, deps: string[], vars: VariableRegistry): string {
  const port = getDefaultPort(node.data.componentType);
  const ingress = deps.map(dep => `  ingress {
    from_port       = ${port}
    to_port         = ${port}
    protocol        = "tcp"
    security_groups = [aws_security_group.${dep}_sg.id]
  }`).join('\n');

  const isLB = ['load-balancer', 'alb'].includes(node.data.componentType);
  const publicIngress = isLB ? `  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }` : '';

  return `resource "aws_security_group" "${name}_sg" {
  name   = "${name}-sg"
  vpc_id = aws_vpc.main.id

${publicIngress}
${ingress}

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${name}-sg" })
}`;
}

function renderS3Resources(name: string, vars: VariableRegistry): string {
  return `resource "aws_s3_bucket" "${name}" {
  bucket = lower("\${var.project_name}-${name}-\${var.environment}")
  tags   = local.common_tags
}`;
}

function renderLambdaResources(node: ArchNode, name: string, vars: VariableRegistry): string {
  return `resource "aws_iam_role" "${name}_role" {
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

resource "aws_lambda_function" "${name}" {
  function_name = "${name}"
  role          = aws_iam_role.${name}_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "function.zip"

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.${name}_sg.id]
  }
}`;
}

function renderDynamoDbResources(name: string): string {
  return `resource "aws_dynamodb_table" "${name}" {
  name           = "${name}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  attribute { name = "id"; type = "S" }
  tags           = local.common_tags
}`;
}

function renderAlbResources(node: ArchNode, name: string, vars: VariableRegistry): string {
  return `resource "aws_lb" "${name}" {
  name               = "${name}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.${name}_sg.id]
}

resource "aws_lb_target_group" "${name}_tg" {
  name        = "${name}-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"
}

resource "aws_lb_listener" "${name}_http" {
  load_balancer_arn = aws_lb.${name}.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.${name}_tg.arn
  }
}`;
}

function createVariableRegistry(defaults: TerraformVariable[]): VariableRegistry {
  const all = [...defaults];
  return {
    all,
    ensure: (v) => {
      if (!all.find(x => x.name === v.name)) all.push(v);
      return v.name;
    }
  };
}

export function downloadTerraform(nodes: ArchNode[], edges: ArchEdge[], projectName: string, mode: 'files' | 'zip' = 'files'): void {
  try {
    const artifacts = generateTerraform(nodes, edges, projectName);
    const prefix = sanitizeName(projectName) || 'archviz';
    const files: DownloadFile[] = [
      { filename: `${prefix}-main.tf`, content: artifacts.mainTf, mimeType: 'text/plain' },
      { filename: `${prefix}-variables.tf`, content: artifacts.variablesTf, mimeType: 'text/plain' },
      { filename: `${prefix}-outputs.tf`, content: artifacts.outputsTf, mimeType: 'text/plain' },
    ];

    files.forEach(f => {
      const blob = new Blob([f.content], { type: f.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = f.filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  } catch (err: any) {
    console.error('Terraform generation failed:', err);
    throw err;
  }
}
