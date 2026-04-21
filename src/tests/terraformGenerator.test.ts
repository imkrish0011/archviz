import { describe, expect, it } from 'vitest';
import { generateCloudFormation, generateTerraform, sanitizeName } from '../engine/terraformGenerator';
import type { ArchEdge, ArchNode } from '../types';

function makeNode(type: string, label: string, id = 'node-1'): ArchNode {
  return {
    id,
    type: 'archNode',
    position: { x: 0, y: 0 },
    data: {
      componentType: type,
      label,
      category: 'compute',
      icon: 'Server',
      tier: { id: 'tier-1', label: 't3.micro', monthlyCost: 100, capacity: 1000, latency: 5 },
      tierIndex: 0,
      instances: 1,
      scalingType: 'horizontal',
      reliability: 0.999,
      scalingFactor: 1,
      healthStatus: 'healthy',
      loadPercent: 0,
    },
  } as ArchNode;
}

describe('generateTerraform', () => {
  it('returns mainTf, variablesTf, and outputsTf', () => {
    const result = generateTerraform([], [], 'Test Project');
    expect(result).toHaveProperty('mainTf');
    expect(result).toHaveProperty('variablesTf');
    expect(result).toHaveProperty('outputsTf');
  });

  it('includes required_providers and provider aws block', () => {
    const result = generateTerraform([], [], 'Test Project');
    expect(result.mainTf).toContain('terraform {');
    expect(result.mainTf).toContain('required_providers');
    expect(result.mainTf).toContain('provider "aws" {');
    expect(result.mainTf).toContain('region = var.aws_region');
  });

  it('uses a single aws_ssm_parameter ami lookup for ec2 compute nodes', () => {
    const result = generateTerraform([
      makeNode('api-server', 'API Server', 'api-1'),
      makeNode('web-server', 'Web Server', 'web-1'),
    ], [], 'App');
    expect(result.mainTf).toContain('data "aws_ssm_parameter" "amazon_linux_ami"');
    expect(result.mainTf).toContain('data.aws_ssm_parameter.amazon_linux_ami.value');
    expect((result.mainTf.match(/data "aws_ssm_parameter" "amazon_linux_ami"/g) || []).length).toBe(1);
  });

  it('extracts region, cidrs, and instance types into variables', () => {
    const result = generateTerraform([makeNode('api-server', 'API Server', 'api-1')], [], 'App');
    expect(result.variablesTf).toContain('variable "aws_region"');
    expect(result.variablesTf).toContain('variable "project_name"');
    expect(result.variablesTf).toContain('variable "public_subnet_cidr"');
    expect(result.variablesTf).toContain('variable "private_subnet_cidr"');
    expect(result.variablesTf).toContain('variable "api_server_instance_type"');
  });

  it('always includes base networking resources', () => {
    const result = generateTerraform([], [], 'App');
    expect(result.mainTf).toContain('resource "aws_vpc" "main"');
    expect(result.mainTf).toContain('resource "aws_subnet" "public"');
    expect(result.mainTf).toContain('resource "aws_subnet" "private"');
    expect(result.mainTf).toContain('resource "aws_internet_gateway" "main"');
    expect(result.mainTf).toContain('resource "aws_route_table" "public"');
    expect(result.mainTf).toContain('resource "aws_route_table_association" "public"');
  });

  it('does not duplicate the base vpc when a vpc node exists', () => {
    const result = generateTerraform([makeNode('vpc', 'AWS VPC', 'vpc-1')], [], 'App');
    expect((result.mainTf.match(/resource "aws_vpc" "main"/g) || []).length).toBe(1);
  });

  it('maps compute and storage nodes to real terraform resources', () => {
    const nodes = [
      makeNode('api-server', 'API Server', 'api-1'),
      makeNode('lambda', 'Auth Lambda', 'lambda-1'),
      makeNode('postgresql', 'Main DB', 'db-1'),
      makeNode('redis', 'Cache', 'redis-1'),
      makeNode('s3', 'Assets', 's3-1'),
    ];
    const result = generateTerraform(nodes, [], 'App');
    expect(result.mainTf).toContain('resource "aws_instance" "api_server"');
    expect(result.mainTf).toContain('resource "aws_lambda_function" "auth_lambda"');
    expect(result.mainTf).toContain('resource "aws_db_instance" "main_db"');
    expect(result.mainTf).toContain('resource "aws_elasticache_cluster" "cache"');
    expect(result.mainTf).toContain('resource "aws_s3_bucket" "assets"');
  });

  it('maps network, messaging, and observability nodes to real terraform resources', () => {
    const nodes = [
      makeNode('load-balancer', 'Public ALB', 'alb-1'),
      makeNode('cdn', 'CDN Edge', 'cdn-1'),
      makeNode('api-gateway', 'Public API', 'api-1'),
      makeNode('kafka', 'Stream', 'kafka-1'),
      makeNode('eventbridge', 'Events', 'events-1'),
      makeNode('cloudwatch', 'Logs', 'logs-1'),
    ];
    const result = generateTerraform(nodes, [], 'App');
    expect(result.mainTf).toContain('resource "aws_lb" "public_alb"');
    expect(result.mainTf).toContain('resource "aws_cloudfront_distribution" "cdn_edge"');
    expect(result.mainTf).toContain('resource "aws_api_gateway_rest_api" "public_api"');
    expect(result.mainTf).toContain('resource "aws_msk_cluster" "stream"');
    expect(result.mainTf).toContain('resource "aws_cloudwatch_event_bus" "events"');
    expect(result.mainTf).toContain('resource "aws_cloudwatch_log_group" "logs"');
  });

  it('replaces any placeholder mapping with a comment instead of null_resource', () => {
    const result = generateTerraform([makeNode('unknown-service', 'Unknown Service', 'x-1')], [], 'App');
    expect(result.mainTf).toContain('# Unknown Service — no direct Terraform resource mapping. Configure manually.');
    expect(result.mainTf).not.toContain('null_resource');
  });

  it('uses the mongodb manual comment path', () => {
    const result = generateTerraform([makeNode('mongodb', 'Mongo', 'mongo-1')], [], 'App');
    expect(result.mainTf).toContain('# Comment: Use MongoDB Atlas or DocumentDB');
  });

  it('emits outputs for core networking and alb dns names', () => {
    const result = generateTerraform([makeNode('load-balancer', 'Public ALB', 'alb-1')], [], 'App');
    expect(result.outputsTf).toContain('output "vpc_id"');
    expect(result.outputsTf).toContain('output "public_subnet_id"');
    expect(result.outputsTf).toContain('output "public_alb_dns_name"');
  });

  it('sanitizes resource names to lowercase letters, digits, and underscores', () => {
    const node = makeNode('api-server', '123 API Gateway!', 'compute-1');
    const result = generateTerraform([node], [], 'App');
    const resourceNames = Array.from(result.mainTf.matchAll(/resource "[^"]+" "([^"]+)"/g)).map(match => match[1]);
    expect(sanitizeName('123 API Gateway!')).toBe('_123_api_gateway_');
    expect(resourceNames.every(name => /^[a-z0-9_]+$/.test(name))).toBe(true);
  });
});

describe('generateCloudFormation', () => {
  it('returns YAML with a Parameters section', () => {
    const yaml = generateCloudFormation([], [], 'Test Project');
    expect(yaml).toContain('Parameters:');
    expect(yaml).toContain('Resources:');
    expect(yaml).not.toContain('{\n');
  });

  it('adds DependsOn when graph edges exist', () => {
    const nodes = [
      makeNode('api-server', 'API', 'api-1'),
      makeNode('postgresql', 'DB', 'db-1'),
    ];
    const edges: ArchEdge[] = [{ id: 'edge-1', source: 'api-1', target: 'db-1' } as ArchEdge];
    const yaml = generateCloudFormation(nodes, edges, 'DependsOn Test');
    expect(yaml).toContain('DependsOn:');
    expect(yaml).toContain('Api');
  });
});
