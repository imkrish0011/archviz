import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ArchNode, ArchEdge, SimulationConfig, CloudProject } from '../types';

const PROJECTS_COLLECTION = 'projects';

// ─── Save a new project ────────────────────────────────────────
export async function saveProject(
  uid: string,
  name: string,
  nodes: ArchNode[],
  edges: ArchEdge[],
  simulationConfig: SimulationConfig,
  thumbnail?: string
): Promise<string> {
  const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
    uid,
    name,
    nodes: JSON.stringify(nodes),
    edges: JSON.stringify(edges),
    simulationConfig,
    thumbnail: thumbnail ?? '',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    isPublic: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ─── Update an existing project ────────────────────────────────
export async function updateProject(
  projectId: string,
  nodes: ArchNode[],
  edges: ArchEdge[],
  simulationConfig: SimulationConfig,
  name: string,
  thumbnail?: string
): Promise<void> {
  const ref = doc(db, PROJECTS_COLLECTION, projectId);
  const updateData: Record<string, unknown> = {
    nodes: JSON.stringify(nodes),
    edges: JSON.stringify(edges),
    simulationConfig,
    name,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    updatedAt: serverTimestamp(),
  };
  if (thumbnail !== undefined) {
    updateData.thumbnail = thumbnail;
  }
  await updateDoc(ref, updateData);
}

// ─── Load a single project ─────────────────────────────────────
export async function loadProject(projectId: string): Promise<{
  nodes: ArchNode[];
  edges: ArchEdge[];
  simulationConfig: SimulationConfig;
  name: string;
  thumbnail: string;
} | null> {
  const ref = doc(db, PROJECTS_COLLECTION, projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    nodes: JSON.parse(data.nodes || '[]'),
    edges: JSON.parse(data.edges || '[]'),
    simulationConfig: data.simulationConfig,
    name: data.name,
    thumbnail: data.thumbnail ?? '',
  };
}

// ─── List all projects for a user ──────────────────────────────
export async function listProjects(uid: string): Promise<CloudProject[]> {
  try {
    // Attempt ordered query (requires composite index in Firestore)
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('uid', '==', uid),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: data.uid,
        name: data.name,
        thumbnail: data.thumbnail ?? '',
        nodeCount: data.nodeCount ?? 0,
        edgeCount: data.edgeCount ?? 0,
        isPublic: data.isPublic ?? false,
        createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
      };
    });
  } catch (err: any) {
    // Fallback: no orderBy (avoids missing-index error), sort client-side
    console.warn('listProjects ordered query failed, falling back:', err?.message);
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('uid', '==', uid)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: data.uid,
        name: data.name,
        thumbnail: data.thumbnail ?? '',
        nodeCount: data.nodeCount ?? 0,
        edgeCount: data.edgeCount ?? 0,
        isPublic: data.isPublic ?? false,
        createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
      };
    });
    return docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}

// ─── Delete a project ──────────────────────────────────────────
export async function deleteProject(projectId: string): Promise<void> {
  await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
}

// ─── Rename a project ──────────────────────────────────────────
export async function renameProject(projectId: string, name: string): Promise<void> {
  await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
    name,
    updatedAt: serverTimestamp(),
  });
}

// ─── Time formatter ────────────────────────────────────────────
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
