import { describe, it, expect } from 'vitest';
import { getComponentCost, calculateTotalCost, formatCost, formatCostFull } from '../engine/costEngine';
import type { ArchNode } from '../types';

/** Helper to create a minimal ArchNode for testing */
function makeNode(overrides: Partial<ArchNode['data']> = {}, nodeOverrides: Partial<ArchNode> = {}): ArchNode {
  return {
    id: 'test-node-1',
    type: 'archNode',
    position: { x: 0, y: 0 },
    data: {
      componentType: 'api-server',
      label: 'Test Server',
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
      ...overrides,
    },
    ...nodeOverrides,
  } as ArchNode;
}

describe('getComponentCost', () => {
  it('returns base tier cost for a single instance', () => {
    const node = makeNode({ instances: 1 });
    expect(getComponentCost(node)).toBe(100);
  });

  it('scales cost with horizontal instances', () => {
    const node = makeNode({ instances: 3 });
    expect(getComponentCost(node)).toBe(300);
  });

  it('does not multiply instances for vertical scaling', () => {
    const node = makeNode({ scalingType: 'vertical', instances: 5 });
    // Vertical scaling = 1 instance, so cost = 100 * 1
    expect(getComponentCost(node)).toBe(100);
  });

  it('applies io1 volume type multiplier', () => {
    const node = makeNode({ instances: 1, volumeType: 'io1' });
    expect(getComponentCost(node)).toBe(250); // 100 * 2.5
  });

  it('applies magnetic volume type multiplier', () => {
    const node = makeNode({ instances: 1, volumeType: 'magnetic' });
    expect(getComponentCost(node)).toBe(60); // 100 * 0.6
  });

  it('applies Multi-AZ premium', () => {
    const node = makeNode({ instances: 1, multiAZ: true } as any);
    expect(getComponentCost(node)).toBe(150); // 100 * 1.5
  });

  it('applies savings-1yr pricing model (-30%)', () => {
    const node = makeNode({ instances: 1, pricingModel: 'savings-1yr' });
    expect(getComponentCost(node)).toBe(70); // 100 * 0.70
  });

  it('applies reserved-3yr pricing model (-50%)', () => {
    const node = makeNode({ instances: 1, pricingModel: 'reserved-3yr' });
    expect(getComponentCost(node)).toBe(50); // 100 * 0.50
  });

  it('applies spot pricing model (-70%)', () => {
    const node = makeNode({ instances: 1, pricingModel: 'spot' });
    expect(getComponentCost(node)).toBe(30); // 100 * 0.30
  });

  it('adds read replica cost for database nodes', () => {
    const node = makeNode({
      componentType: 'postgresql',
      category: 'storage',
      instances: 1,
      readReplicas: 2,
    } as any);
    // instances = 1 + (2 * 0.7) = 2.4
    // cost = 100 * 2.4 = 240
    expect(getComponentCost(node)).toBe(240);
  });
});

describe('calculateTotalCost', () => {
  it('sums costs of all enabled nodes', () => {
    const nodes = [
      makeNode({ instances: 1 }, { id: 'a' } as any),
      makeNode({ instances: 2 }, { id: 'b' } as any),
    ];
    expect(calculateTotalCost(nodes)).toBe(300); // 100 + 200
  });

  it('excludes disabled nodes', () => {
    const nodes = [
      makeNode({ instances: 1 }, { id: 'a' } as any),
      makeNode({ instances: 2, isDisabled: true }, { id: 'b' } as any),
    ];
    expect(calculateTotalCost(nodes)).toBe(100); // only node a
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotalCost([])).toBe(0);
  });
});

describe('formatCost', () => {
  it('formats small costs as dollars', () => {
    expect(formatCost(42)).toBe('$42');
    expect(formatCost(999)).toBe('$999');
  });

  it('formats thousands as k', () => {
    expect(formatCost(1000)).toBe('$1.0k');
    expect(formatCost(2500)).toBe('$2.5k');
  });
});

describe('formatCostFull', () => {
  it('formats with two decimal places and /mo suffix', () => {
    expect(formatCostFull(42)).toBe('$42.00/mo');
    expect(formatCostFull(1234.5)).toBe('$1234.50/mo');
  });
});
