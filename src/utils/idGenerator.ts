/**
 * Centralized ID generator — pure, deterministic, no Math.random() or Date.now() in render paths.
 * Uses a monotonically increasing counter + high-resolution timestamp for uniqueness.
 */

let counter = 0;

export function generateNodeId(): string {
  return `node_${++counter}_${performance.now().toString(36).replace('.', '')}`;
}

export function generateEdgeId(): string {
  return `edge_${++counter}_${performance.now().toString(36).replace('.', '')}`;
}

export function generateSnapshotId(): string {
  return `snap_${++counter}_${performance.now().toString(36).replace('.', '')}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${++counter}_${performance.now().toString(36).replace('.', '')}`;
}

/**
 * Generate a batch prefix for template instantiation.
 * Returns a stable prefix that can be combined with an index.
 */
export function generateBatchPrefix(): string {
  return `${++counter}_${performance.now().toString(36).replace('.', '')}`;
}
