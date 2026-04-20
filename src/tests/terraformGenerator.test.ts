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

  it('includes the required_providers terraform header block', () => {
    const result = generateTerraform([], [], 'Test Project');
    expect(result.mainTf).toContain('required_providers');
    expect(result.mainTf).toContain('required_version = ">= 1.5.0"');
    expect(result.mainTf).toContain('hashicorp/aws');
  });

  it('adds a sensitive db_password variable', () => {
    const result = generateTerraform([makeNode('postgresql', 'Main DB', 'db-1')], [], 'App');
    expect(result.variablesTf).toContain('variable "db_password"');
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
  });

  it('emits unsupported comments for non-AWS components', () => {
    const result = generateTerraform([makeNode('pinecone', 'Vector Search', 'pc-1')], [], 'App');
    expect(result.mainTf).toContain('UNSUPPORTED');
    expect(result.mainTf).toContain('pinecone-community/pinecone');
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
