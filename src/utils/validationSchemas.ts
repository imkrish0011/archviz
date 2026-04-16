import { z } from 'zod';

/**
 * Zod validation schemas for RightPanel configuration fields.
 * Each schema defines the allowed range and produces a human-readable error.
 * 
 * NOTE: Zod v4 uses `{ message: '...' }` instead of `{ invalid_type_error: '...' }`.
 */

// ── General ──
export const projectNameSchema = z
  .string()
  .min(1, 'Project name is required')
  .max(64, 'Max 64 characters')
  .regex(/^[a-zA-Z0-9 _\-().]+$/, 'Only letters, numbers, spaces, and -_().'); 

// ── Instance Configuration ──
export const instancesSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(1, 'Minimum 1 instance')
  .max(20, 'Maximum 20 instances');

export const minInstancesSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(1, 'Minimum 1 instance')
  .max(50, 'Maximum 50 instances');

export const maxInstancesSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(1, 'Minimum 1 instance')
  .max(50, 'Maximum 50 instances');

// ── Database Settings ──
export const maxConnectionsSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(10, 'Minimum 10 connections')
  .max(10000, 'Maximum 10,000 connections');

export const readReplicasSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(0, 'Minimum 0 replicas')
  .max(5, 'Maximum 5 replicas');

export const connectionTimeoutSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(100, 'Minimum 100ms')
  .max(30000, 'Maximum 30,000ms');

export const storageGBSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(10, 'Minimum 10 GB')
  .max(16000, 'Maximum 16,000 GB (16 TB)');

export const backupRetentionSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(0, 'Minimum 0 days')
  .max(35, 'Maximum 35 days');

// ── Auto-Scaling ──
export const scaleUpThresholdSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(40, 'Minimum 40%')
  .max(95, 'Maximum 95%');

export const scaleDownThresholdSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(10, 'Minimum 10%')
  .max(50, 'Maximum 50%');

export const cooldownPeriodSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(30, 'Minimum 30 seconds')
  .max(600, 'Maximum 600 seconds');

// ── Cache Settings ──
export const ttlSchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(1, 'Minimum 1 second')
  .max(86400, 'Maximum 86,400 seconds (24 hours)');

export const maxMemorySchema = z
  .number({ message: 'Must be a number' })
  .int('Must be a whole number')
  .min(64, 'Minimum 64 MB')
  .max(65536, 'Maximum 65,536 MB (64 GB)');

// ── Edge Label ──
export const edgeLabelSchema = z
  .string()
  .max(50, 'Max 50 characters')
  .optional()
  .or(z.literal(''));

// ── Bandwidth ──
export const bandwidthSchema = z
  .string()
  .max(30, 'Max 30 characters')
  .optional()
  .or(z.literal(''));

/**
 * Helper: validate a single value against a schema.
 * Returns null on success or the first error message on failure.
 */
export function validateField<T>(schema: z.ZodType<T>, value: unknown): string | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? 'Invalid value';
}
