import { describe, it, expect } from 'vitest';
import {
  instancesSchema,
  maxConnectionsSchema,
  readReplicasSchema,
  connectionTimeoutSchema,
  storageGBSchema,
  backupRetentionSchema,
  scaleUpThresholdSchema,
  scaleDownThresholdSchema,
  cooldownPeriodSchema,
  projectNameSchema,
  edgeLabelSchema,
  validateField,
} from '../utils/validationSchemas';

describe('instancesSchema', () => {
  it('accepts valid instance counts', () => {
    expect(validateField(instancesSchema, 1)).toBeNull();
    expect(validateField(instancesSchema, 10)).toBeNull();
    expect(validateField(instancesSchema, 20)).toBeNull();
  });

  it('rejects 0 instances', () => {
    expect(validateField(instancesSchema, 0)).toContain('Minimum');
  });

  it('rejects more than 20 instances', () => {
    expect(validateField(instancesSchema, 21)).toContain('Maximum');
  });

  it('rejects non-integers', () => {
    expect(validateField(instancesSchema, 3.5)).toContain('whole');
  });
});

describe('maxConnectionsSchema', () => {
  it('accepts valid ranges', () => {
    expect(validateField(maxConnectionsSchema, 10)).toBeNull();
    expect(validateField(maxConnectionsSchema, 500)).toBeNull();
    expect(validateField(maxConnectionsSchema, 10000)).toBeNull();
  });

  it('rejects below 10', () => {
    expect(validateField(maxConnectionsSchema, 5)).toContain('Minimum');
  });

  it('rejects above 10000', () => {
    expect(validateField(maxConnectionsSchema, 99999)).toContain('Maximum');
  });
});

describe('readReplicasSchema', () => {
  it('accepts 0-5', () => {
    expect(validateField(readReplicasSchema, 0)).toBeNull();
    expect(validateField(readReplicasSchema, 5)).toBeNull();
  });

  it('rejects above 5', () => {
    expect(validateField(readReplicasSchema, 6)).toContain('Maximum');
  });
});

describe('connectionTimeoutSchema', () => {
  it('accepts valid timeouts', () => {
    expect(validateField(connectionTimeoutSchema, 100)).toBeNull();
    expect(validateField(connectionTimeoutSchema, 5000)).toBeNull();
    expect(validateField(connectionTimeoutSchema, 30000)).toBeNull();
  });

  it('rejects below 100ms', () => {
    expect(validateField(connectionTimeoutSchema, 50)).toContain('Minimum');
  });

  it('rejects above 30000ms', () => {
    expect(validateField(connectionTimeoutSchema, 31000)).toContain('Maximum');
  });
});

describe('storageGBSchema', () => {
  it('accepts valid storage sizes', () => {
    expect(validateField(storageGBSchema, 10)).toBeNull();
    expect(validateField(storageGBSchema, 1000)).toBeNull();
    expect(validateField(storageGBSchema, 16000)).toBeNull();
  });

  it('rejects below 10 GB', () => {
    expect(validateField(storageGBSchema, 5)).toContain('Minimum');
  });

  it('rejects above 16000 GB', () => {
    expect(validateField(storageGBSchema, 20000)).toContain('Maximum');
  });
});

describe('backupRetentionSchema', () => {
  it('accepts 0-35 days', () => {
    expect(validateField(backupRetentionSchema, 0)).toBeNull();
    expect(validateField(backupRetentionSchema, 35)).toBeNull();
  });

  it('rejects above 35 days', () => {
    expect(validateField(backupRetentionSchema, 36)).toContain('Maximum');
  });
});

describe('scaleUpThresholdSchema', () => {
  it('accepts 40-95%', () => {
    expect(validateField(scaleUpThresholdSchema, 40)).toBeNull();
    expect(validateField(scaleUpThresholdSchema, 95)).toBeNull();
  });

  it('rejects below 40%', () => {
    expect(validateField(scaleUpThresholdSchema, 30)).toContain('Minimum');
  });
});

describe('scaleDownThresholdSchema', () => {
  it('accepts 10-50%', () => {
    expect(validateField(scaleDownThresholdSchema, 10)).toBeNull();
    expect(validateField(scaleDownThresholdSchema, 50)).toBeNull();
  });

  it('rejects above 50%', () => {
    expect(validateField(scaleDownThresholdSchema, 60)).toContain('Maximum');
  });
});

describe('cooldownPeriodSchema', () => {
  it('accepts 30-600 seconds', () => {
    expect(validateField(cooldownPeriodSchema, 30)).toBeNull();
    expect(validateField(cooldownPeriodSchema, 600)).toBeNull();
  });

  it('rejects below 30 seconds', () => {
    expect(validateField(cooldownPeriodSchema, 10)).toContain('Minimum');
  });
});

describe('projectNameSchema', () => {
  it('accepts valid project names', () => {
    expect(validateField(projectNameSchema, 'My Project')).toBeNull();
    expect(validateField(projectNameSchema, 'test-project_v2')).toBeNull();
    expect(validateField(projectNameSchema, 'App (v3.1)')).toBeNull();
  });

  it('rejects empty names', () => {
    expect(validateField(projectNameSchema, '')).toContain('required');
  });

  it('rejects names over 64 characters', () => {
    expect(validateField(projectNameSchema, 'a'.repeat(65))).toContain('64');
  });

  it('rejects special characters', () => {
    expect(validateField(projectNameSchema, 'test@project!')).toBeTruthy();
  });
});

describe('edgeLabelSchema', () => {
  it('accepts valid labels', () => {
    expect(validateField(edgeLabelSchema, 'REST API')).toBeNull();
    expect(validateField(edgeLabelSchema, '')).toBeNull();
    expect(validateField(edgeLabelSchema, undefined)).toBeNull();
  });

  it('rejects labels over 50 characters', () => {
    expect(validateField(edgeLabelSchema, 'a'.repeat(51))).toContain('50');
  });
});

describe('validateField helper', () => {
  it('returns null for valid values', () => {
    expect(validateField(instancesSchema, 5)).toBeNull();
  });

  it('returns error message for invalid values', () => {
    const msg = validateField(instancesSchema, -1);
    expect(msg).toBeTypeOf('string');
    expect(msg!.length).toBeGreaterThan(0);
  });
});
