import { describe, it, expect } from 'vitest';
import { generateTerraform, generateCloudFormation } from '../engine/terraformGenerator';
import type { ArchNode } from '../types';

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

function makeGroupNode(category: string, label: string, id = 'group-1'): ArchNode {
  return {
    id,
    type: 'groupNode',
    position: { x: 0, y: 0 },
    data: {
      componentType: 'groupNode',
      label,
      category,
      icon: 'Box',
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

describe('generateTerraform', () => {
  it('returns an object containing main.tf, variables.tf, and outputs.tf', () => {
    const tf = generateTerraform([], [], 'Test Project');
    expect(tf).toHaveProperty('main.tf');
    expect(tf).toHaveProperty('variables.tf');
    expect(tf).toHaveProperty('outputs.tf');
  });

  it('generates valid terraform header with provider block in main.tf', () => {
    const tf = generateTerraform([], [], 'Test Project');
    expect(tf['main.tf']).toContain('terraform {');
    expect(tf['main.tf']).toContain('provider "aws"');
    expect(tf['main.tf']).toContain('required_version');
    expect(tf['main.tf']).toContain('Test Project');
  });

  it('includes variables block in variables.tf', () => {
    const tf = generateTerraform([], [], 'My App');
    expect(tf['variables.tf']).toContain('variable "aws_region"');
    expect(tf['variables.tf']).toContain('variable "environment"');
    expect(tf['variables.tf']).toContain('variable "project_name"');
  });

  it('generates modular networking scaffold (VPC module) in main.tf', () => {
    const tf = generateTerraform([], [], 'Test');
    expect(tf['main.tf']).toContain('module "vpc" {');
    expect(tf['main.tf']).toContain('source  = "terraform-aws-modules/vpc/aws"');
  });

  it('maps group nodes to public and private subnets', () => {
    const nodes = [
      makeGroupNode('subnet-public', 'Public Subnet A', 'g1'),
      makeGroupNode('subnet-private', 'Private Subnet A', 'g2'),
      makeGroupNode('subnet-private', 'Private Subnet B', 'g3'),
    ];
    const tf = generateTerraform(nodes, [], 'Test');
    // Since there is 1 public and 2 private subnets, it dynamically parses numPub=1, numPriv=2
    expect(tf['main.tf']).toContain('if k < 1');
    expect(tf['main.tf']).toContain('if k < 2');
  });

  it('generates EC2 modules for api-server nodes', () => {
    const nodes = [makeNode('api-server', 'API Server', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf['main.tf']).toContain('module "ec2_instance_api_server" {');
    expect(tf['main.tf']).toContain('source  = "terraform-aws-modules/ec2-instance/aws"');
    expect(tf['main.tf']).toContain('instance_type');
  });

  it('generates RDS resources for postgresql nodes and registers an output', () => {
    const nodes = [makeNode('postgresql', 'Main DB', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf['main.tf']).toContain('resource "aws_db_instance"');
    expect(tf['main.tf']).toContain('engine');
    expect(tf['main.tf']).toContain('postgres');
    expect(tf['outputs.tf']).toContain('output "rds_endpoint_main_db"');
  });

  it('generates Lambda resources', () => {
    const nodes = [makeNode('lambda', 'Auth Lambda', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf['main.tf']).toContain('resource "aws_lambda_function"');
    expect(tf['main.tf']).toContain('runtime');
  });

  it('generates S3 resources with encryption', () => {
    const nodes = [makeNode('s3', 'Assets Bucket', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf['main.tf']).toContain('resource "aws_s3_bucket"');
    expect(tf['main.tf']).toContain('aws_s3_bucket_server_side_encryption_configuration');
    expect(tf['main.tf']).toContain('aws:kms');
  });

  it('generates security groups for each resource', () => {
    const nodes = [
      makeNode('api-server', 'API', 'n1'),
      makeNode('redis', 'Cache', 'n2'),
    ];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf['main.tf']).toContain('resource "aws_security_group"');
    const sgCount = (tf['main.tf'].match(/resource "aws_security_group"/g) || []).length;
    expect(sgCount).toBe(2); 
  });

  it('generates basic outputs section', () => {
    const tf = generateTerraform([], [], 'Test');
    expect(tf['outputs.tf']).toContain('output "vpc_id"');
    expect(tf['outputs.tf']).toContain('output "architecture_summary"');
  });

  it('skips external client nodes gracefully', () => {
    const nodes = [makeNode('client-browser', 'User Browser', 'n1')];
    const tf = generateTerraform(nodes, [], 'Test');
    expect(tf['main.tf']).toContain('External client');
    expect(tf['main.tf']).not.toContain('module "ec2_instance_user_browser"');
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
