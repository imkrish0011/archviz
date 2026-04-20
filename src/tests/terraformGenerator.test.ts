import { describe, expect, it } from 'vitest';
import { generateCloudFormation, generateTerraform, sanitizeName } from '../engine/terraformGenerator';
import type { ArchEdge, ArchNode } from '../types';

function makeNode(type: string, label: string, id = 'node-1', extraData: Record<string, unknown> = {}): ArchNode {
  return {
    id,
    type: 'archNode',
    position: { x: 0, y: 0 },
    data: {
      componentType: type,
      label,
      category: 'compute',
      icon: 'Server',
      tier: { id: 'tier-1', label: 't3.medium', monthlyCost: 100, capacity: 1000, latency: 5 },
      tierIndex: 0,
      instances: 1,
      scalingType: 'horizontal',
      reliability: 0.999,
      scalingFactor: 1,
      healthStatus: 'healthy',
      loadPercent: 0,
      ...extraData,
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

  it('includes required providers and an s3 backend', () => {
    const result = generateTerraform([], [], 'Test Project');
    expect(result.mainTf).toContain('required_providers');
    expect(result.mainTf).toContain('backend "s3"');
    expect(result.mainTf).toContain('hashicorp/aws');
    expect(result.mainTf).toContain('hashicorp/random');
  });

  it('uses a dynamic aws_ami lookup instead of a fake ami id', () => {
    const result = generateTerraform([makeNode('api-server', 'API', 'api-1')], [], 'App');
    expect(result.mainTf).toContain('data "aws_ami" "latest_amazon_linux"');
    expect(result.mainTf).toContain('ami                         = data.aws_ami.latest_amazon_linux.id');
    expect(result.mainTf).not.toContain('ami-1234567890abcdef0');
  });

  it('creates public and private routing with nat gateways', () => {
    const result = generateTerraform([], [], 'Networking');
    expect(result.mainTf).toContain('resource "aws_nat_gateway" "main"');
    expect(result.mainTf).toContain('resource "aws_route_table" "public"');
    expect(result.mainTf).toContain('resource "aws_route_table" "private"');
    expect(result.mainTf).toContain('gateway_id = aws_internet_gateway.main.id');
    expect(result.mainTf).toContain('nat_gateway_id = aws_nat_gateway.main[count.index % length(aws_nat_gateway.main)].id');
  });

  it('adds a sensitive per-database password variable', () => {
    const result = generateTerraform([makeNode('postgresql', 'Main DB', 'db-1')], [], 'App');
    expect(result.variablesTf).toContain('variable "main_db_password"');
    expect(result.variablesTf).toContain('sensitive = true');
  });

  it('includes output vpc_id', () => {
    const result = generateTerraform([], [], 'App');
    expect(result.outputsTf).toContain('output "vpc_id"');
  });

  it('generates lambda IAM role resources', () => {
    const result = generateTerraform([makeNode('lambda', 'Auth Lambda', 'lambda-1')], [], 'App');
    expect(result.mainTf).toContain('resource "aws_iam_role" "auth_lambda_lambda_role"');
    expect(result.mainTf).toContain('resource "aws_iam_role_policy_attachment" "auth_lambda_lambda_basic"');
    expect(result.mainTf).toContain('data "archive_file" "auth_lambda_lambda_zip"');
  });

  it('maps cdn, api-gateway, kafka, and cassandra to concrete aws resources', () => {
    const nodes = [
      makeNode('cdn', 'CDN Edge', 'cdn-1'),
      makeNode('api-gateway', 'Public API', 'api-1'),
      makeNode('kafka', 'Event Stream', 'kafka-1'),
      makeNode('cassandra', 'Wide Column', 'cass-1'),
    ];
    const result = generateTerraform(nodes, [], 'Mappings');
    expect(result.mainTf).toContain('resource "aws_cloudfront_distribution" "cdn_edge"');
    expect(result.mainTf).toContain('resource "aws_apigatewayv2_api" "public_api"');
    expect(result.mainTf).toContain('resource "aws_msk_cluster" "event_stream"');
    expect(result.mainTf).toContain('resource "aws_keyspaces_keyspace" "wide_column"');
    expect(result.mainTf).not.toContain('null_resource');
  });

  it('generates unique s3 bucket naming with random_string', () => {
    const result = generateTerraform([makeNode('s3', 'Assets Bucket', 's3-1')], [], 'Buckets');
    expect(result.mainTf).toContain('resource "random_string" "bucket_suffix"');
    expect(result.mainTf).toContain('random_string.bucket_suffix.result');
  });

  it('does not emit overly permissive 0-65535 security group rules', () => {
    const result = generateTerraform([makeNode('api-server', 'API', 'api-1')], [], 'Security');
    expect(result.mainTf).not.toContain('to_port     = 65535');
    expect(result.mainTf).not.toContain('from_port   = 0\n    to_port     = 65535');
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
