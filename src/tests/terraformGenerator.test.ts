import { describe, it, expect } from 'vitest';
import { generateTerraform, generateCloudFormation } from '../engine/terraformGenerator';
import type { ArchNode, ArchEdge } from '../types';

/** Helper to create a minimal ArchNode */
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
      tier: { id: 't3-medium', label: 't3.medium', monthlyCost: 100, capacity: 1000, latency: 5 },
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

function makeEdge(source: string, target: string): ArchEdge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    animated: true,
  } as ArchEdge;
}

describe('generateTerraform', () => {
  it('generates valid terraform header with provider block', () => {
    const tf = generateTerraform([], [], 'Test Project');
    expect(tf).toContain('terraform {');
    expect(tf).toContain('provider "aws"');
    expect(tf).toContain('required_version');
    expect(tf).toContain('Test Project');
  });

  it('includes variables block', () => {
    const tf = generateTerraform([], [], 'My App');
    expect(tf).toContain('variable "aws_region"');
    expect(tf).toContain('variable "environment"');
    expect(tf).toContain('variable "project_name"');
  });

  it('generates networking scaffold (VPC, subnets, IGW)', () => {
    const tf = generateTerraform([], [], 'Test');
    expect(tf).toContain('aws_vpc');
    expect(tf).toContain('aws_subnet');
    expect(tf).toContain('aws_internet_gateway');
  });

  it('generates EC2 resources for api-server nodes', () => {
    const nodes = [makeNode('api-server', 'API Server', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf).toContain('resource "aws_instance"');
    expect(tf).toContain('api_server');
    expect(tf).toContain('instance_type');
  });

  it('generates RDS resources for postgresql nodes', () => {
    const nodes = [makeNode('postgresql', 'Main DB', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf).toContain('resource "aws_db_instance"');
    expect(tf).toContain('engine');
    expect(tf).toContain('postgres');
  });

  it('generates Lambda resources', () => {
    const nodes = [makeNode('lambda', 'Auth Lambda', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf).toContain('resource "aws_lambda_function"');
    expect(tf).toContain('runtime');
  });

  it('generates S3 resources with encryption', () => {
    const nodes = [makeNode('s3', 'Assets Bucket', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf).toContain('resource "aws_s3_bucket"');
    expect(tf).toContain('aws_s3_bucket_server_side_encryption_configuration');
    expect(tf).toContain('aws:kms');
  });

  it('generates security groups for each resource', () => {
    const nodes = [
      makeNode('api-server', 'API', 'n1'),
      makeNode('redis', 'Cache', 'n2'),
    ];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf).toContain('resource "aws_security_group"');
    // Should have at least 2 SGs
    const sgCount = (tf.match(/aws_security_group/g) || []).length;
    expect(sgCount).toBeGreaterThanOrEqual(4); // 2 resources + 2 references
  });

  it('generates outputs section', () => {
    const tf = generateTerraform([], [], 'Test');
    expect(tf).toContain('output "vpc_id"');
    expect(tf).toContain('output "architecture_summary"');
  });

  it('counts components and connections in header', () => {
    const nodes = [makeNode('api-server', 'API', 'n1'), makeNode('redis', 'Redis', 'n2')];
    const edges = [makeEdge('n1', 'n2')];
    const tf = generateTerraform(nodes, edges, 'Test');
    expect(tf).toContain('Components: 2');
    expect(tf).toContain('Connections: 1');
  });

  it('skips external client nodes gracefully', () => {
    const nodes = [makeNode('client-browser', 'User Browser', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf).toContain('External client');
    expect(tf).not.toContain('resource "aws_instance" "user_browser"');
  });
});

describe('generateCloudFormation', () => {
  it('generates valid CloudFormation JSON structure', () => {
    const cfn = generateCloudFormation([], [], 'Test Project');
    const parsed = JSON.parse(cfn);
    expect(parsed.AWSTemplateFormatVersion).toBe('2010-09-09');
    expect(parsed.Description).toContain('Test Project');
    expect(parsed.Parameters).toBeDefined();
    expect(parsed.Resources).toBeDefined();
  });

  it('generates EC2 instances for server nodes', () => {
    const nodes = [makeNode('api-server', 'API Server', 'n1')];
    const cfn = JSON.parse(generateCloudFormation(nodes, [], 'Test'));
    const resources = cfn.Resources;
    const resourceNames = Object.keys(resources);
    expect(resourceNames.length).toBeGreaterThan(0);
    // Find the EC2 resource
    const ec2Resource = Object.values(resources).find((r: any) => r.Type === 'AWS::EC2::Instance');
    expect(ec2Resource).toBeDefined();
  });

  it('generates RDS resource for postgresql', () => {
    const nodes = [makeNode('postgresql', 'Main DB', 'n1')];
    const cfn = JSON.parse(generateCloudFormation(nodes, [], 'Test'));
    const rds = Object.values(cfn.Resources).find((r: any) => r.Type === 'AWS::RDS::DBInstance');
    expect(rds).toBeDefined();
    expect((rds as any).Properties.Engine).toBe('postgres');
  });
});
