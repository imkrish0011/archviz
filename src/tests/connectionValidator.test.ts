import { describe, it, expect } from 'vitest';
import { validateConnection } from '../engine/connectionValidator';
import type { ArchNodeData } from '../types';

/** Helper to create minimal node data for testing */
function makeData(overrides: Partial<ArchNodeData> = {}): ArchNodeData {
  return {
    componentType: 'api-server',
    label: 'Test Node',
    category: 'compute',
    icon: 'Server',
    tier: { id: 'tier-1', label: 'default', monthlyCost: 100, capacity: 1000, latency: 5 },
    tierIndex: 0,
    instances: 1,
    scalingType: 'horizontal',
    reliability: 0.999,
    scalingFactor: 1,
    healthStatus: 'healthy',
    loadPercent: 0,
    ...overrides,
  };
}

describe('validateConnection', () => {
  it('allows valid compute → storage connections', () => {
    const source = makeData({ componentType: 'api-server', category: 'compute' });
    const target = makeData({ componentType: 'redis', category: 'storage' });
    const result = validateConnection(source, target);
    expect(result.allowed).toBe(true);
  });

  it('allows self-type connections', () => {
    const source = makeData({ componentType: 'api-server' });
    const target = makeData({ componentType: 'api-server' });
    const result = validateConnection(source, target);
    expect(result.allowed).toBe(true);
    expect(result.level).toBe('info');
  });

  it('blocks frontend → database direct connection', () => {
    const source = makeData({ componentType: 'web-frontend', category: 'client' });
    const target = makeData({ componentType: 'rds-postgres', category: 'storage' });
    const result = validateConnection(source, target);
    expect(result.allowed).toBe(false);
    expect(result.level).toBe('error');
    expect(result.message).toContain('database');
  });

  it('blocks frontend → queue direct connection', () => {
    const source = makeData({ componentType: 'mobile-client', category: 'client' });
    const target = makeData({ componentType: 'sqs-queue', category: 'messaging' });
    const result = validateConnection(source, target);
    expect(result.allowed).toBe(false);
    expect(result.level).toBe('error');
    expect(result.message).toContain('queue');
  });

  it('warns on Lambda → RDS (VPC required)', () => {
    const source = makeData({ componentType: 'lambda', category: 'compute' });
    const target = makeData({ componentType: 'rds-postgres', category: 'storage' });
    const result = validateConnection(source, target);
    expect(result.allowed).toBe(true); // warning, not blocked
    expect(result.level).toBe('warning');
    expect(result.message).toContain('VPC');
  });

  it('warns on Glacier connections (latency)', () => {
    const source = makeData({ componentType: 'api-server', category: 'compute' });
    const target = makeData({ componentType: 'amazon-glacier', category: 'storage' });
    const result = validateConnection(source, target);
    expect(result.allowed).toBe(true);
    expect(result.level).toBe('warning');
    expect(result.message).toContain('Glacier');
  });

  it('blocks cache → client direct connection', () => {
    const source = makeData({ componentType: 'redis', category: 'storage' });
    const target = makeData({ componentType: 'web-frontend', category: 'client' });
    const result = validateConnection(source, target);
    expect(result.allowed).toBe(false);
    expect(result.level).toBe('error');
    expect(result.message).toContain('Cache');
  });

  it('allows connections with no matching anti-pattern', () => {
    const source = makeData({ componentType: 'load-balancer', category: 'network' });
    const target = makeData({ componentType: 'api-server', category: 'compute' });
    const result = validateConnection(source, target);
    expect(result.allowed).toBe(true);
    expect(result.level).toBe('info');
    expect(result.message).toBe('');
  });
});
