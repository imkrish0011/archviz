import { create } from 'zustand';
import type { ArchNode, ArchEdge, SimulationConfig, Snapshot, SimulationEvent, EdgeConfig } from '../types';
import { getComponentDefinition } from '../data/componentLibrary';
import type { Connection } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { NodeChange, EdgeChange } from '@xyflow/react';
import { toastBus } from '../components/ToastSystem';
import { validateConnection } from '../engine/connectionValidator';
import { applyAutoLayout } from '../engine/autoLayout';
import type { LayoutDirection } from '../engine/autoLayout';
import { INITIAL_DEPLOYMENT_STATE, createDeploymentClones } from '../engine/deploymentSimulator';
import type { DeploymentState } from '../engine/deploymentSimulator';
import type { CloudProvider } from '../types';

interface HistoryEntry {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

interface ArchStore {
  // ── Graph State ──
  nodes: ArchNode[];
  edges: ArchEdge[];
  
  // ── Simulation Config ──
  simulationConfig: SimulationConfig;
  
  // ── UI State ──
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  rightPanelOpen: boolean;
  versionHistoryOpen: boolean;
  recommendationPanelOpen: boolean;
  templatePickerOpen: boolean;
  activeSimulationEvent: SimulationEvent | null;
  showOnboarding: boolean;
  leftSidebarOpen: boolean;
  securityPanelOpen: boolean;
  projectName: string;
  greenOpsHeatmap: boolean;
  outageRegionId: string | null;
  cloudProvider: CloudProvider;
  isWhiteLabelReport: boolean;
  isTracing: boolean;
  computedSecurityReport: any | null;
  
  // ── Snapshots ──
  snapshots: Snapshot[];
  compareSnapshots: [string, string] | null;
  
  // ── Deployment ──
  deploymentState: DeploymentState;
  
  // ── Undo/Redo ──
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  
  // ── Smart Guides ──
  alignmentLines: { x?: number; y?: number } | null;
  
  // ── Actions ──
  onNodesChange: (changes: NodeChange<ArchNode>[]) => void;
  handleNodeDrag: (nodeId: string, position: { x: number; y: number }) => void;
  handleNodeDragStop: (nodeId: string, position: { x: number; y: number }) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (componentType: string, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<ArchNode['data']>) => void;
  changeNodeType: (nodeId: string, newComponentType: string) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  setSimulationConfig: (config: Partial<SimulationConfig>) => void;
  setProjectName: (name: string) => void;
  
  // UI toggles
  toggleVersionHistory: () => void;
  toggleRecommendationPanel: () => void;
  toggleTemplatePicker: () => void;
  toggleLeftSidebar: () => void;
  toggleSecurityPanel: () => void;
  toggleGreenOpsHeatmap: () => void;
  setOutageRegionId: (id: string | null) => void;
  dismissOnboarding: () => void;
  setActiveSimulationEvent: (event: SimulationEvent | null) => void;
  setCompareSnapshots: (ids: [string, string] | null) => void;
  setCloudProvider: (provider: CloudProvider) => void;
  toggleWhiteLabelReport: () => void;
  toggleTrace: () => void;
  setSecurityReport: (report: any) => void;
  
  // Deployment actions
  startDeployment: (sourceNodeId: string) => void;
  updateDeploymentState: (state: Partial<DeploymentState>) => void;
  completeDeployment: () => void;
  cancelDeployment: () => void;
  
  // Snapshot actions
  takeSnapshot: (label?: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  
  // Template actions
  loadTemplate: (nodes: ArchNode[], edges: ArchEdge[]) => void;
  clearCanvas: () => void;
  
  // Bulk updates
  setNodes: (nodes: ArchNode[]) => void;
  setEdges: (edges: ArchEdge[]) => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  
  // Auto-layout
  runAutoLayout: (direction?: LayoutDirection) => void;
  
  // Edge config
  updateEdgeConfig: (edgeId: string, config: Partial<EdgeConfig>) => void;
  
  // Save/Load
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
}

let nodeIdCounter = 0;
function genNodeId() {
  return `node_${++nodeIdCounter}_${Date.now()}`;
}

function genEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useArchStore = create<ArchStore>((set, get) => ({
  // ── Initial State ──
  nodes: [],
  edges: [],
  simulationConfig: {
    concurrentUsers: 1000,
    rpsMultiplier: 0.1,
    cacheHitRate: 0.6,
  },
  selectedNodeId: null,
  selectedEdgeId: null,
  rightPanelOpen: false,
  versionHistoryOpen: false,
  recommendationPanelOpen: false,
  templatePickerOpen: false,
  activeSimulationEvent: null,
  showOnboarding: !localStorage.getItem('archviz-onboarded'),
  leftSidebarOpen: true,
  securityPanelOpen: false,
  projectName: 'Untitled Architecture',
  snapshots: [],
  compareSnapshots: null,
  undoStack: [],
  redoStack: [],
  alignmentLines: null,
  greenOpsHeatmap: false,
  outageRegionId: null,
  deploymentState: INITIAL_DEPLOYMENT_STATE,
  cloudProvider: 'aws',
  isWhiteLabelReport: false,
  isTracing: false,
  computedSecurityReport: null,
  
  // ── React Flow handlers ──
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  
  handleNodeDrag: (nodeId, position) => {
    const { nodes } = get();
    let snappedX: number | undefined;
    let snappedY: number | undefined;
    
    // Configurable snapping threshold
    const threshold = 10;
    
    nodes.forEach(n => {
      if (n.id === nodeId || n.data.isGroup) return; // Don't snap to self or background groups during free drag
      
      // Check X alignment
      if (Math.abs(n.position.x - position.x) < threshold) {
        snappedX = n.position.x;
      }
      // Check Y alignment
      if (Math.abs(n.position.y - position.y) < threshold) {
        snappedY = n.position.y;
      }
    });

    set({ alignmentLines: { x: snappedX, y: snappedY } });
  },

  handleNodeDragStop: (nodeId, position) => {
    const { nodes, alignmentLines } = get();
    const draggedNode = nodes.find(n => n.id === nodeId);
    if (!draggedNode) return;

    // Apply any snapped position definitively if it was close
    let finalX = alignmentLines?.x !== undefined ? alignmentLines.x : position.x;
    let finalY = alignmentLines?.y !== undefined ? alignmentLines.y : position.y;

    // Clear alignment visual lines
    set({ alignmentLines: null });

    // Group intersection logic
    let targetParentId: string | undefined = undefined;
    let targetSecurityContext: string | undefined = undefined;

    // Standard node dimensions (approx) to check center intersection
    const nodeCenterX = finalX + 75;
    const nodeCenterY = finalY + 40;

    // Find the smallest group that contains the node center
    const groups = nodes.filter(n => n.data.isGroup && n.id !== nodeId);
    
    groups.forEach(group => {
      // Basic bounds check assuming standard sizes / custom sizes
      const { x, y } = group.position;
      const w = Number(group.style?.width) || 350;
      const h = Number(group.style?.height) || 250;
      
      if (
        nodeCenterX > x && nodeCenterX < x + w &&
        nodeCenterY > y && nodeCenterY < y + h
      ) {
        targetParentId = group.id;
        targetSecurityContext = group.data.securityContext || group.data.componentType;
      }
    });

    // Update the dropped node with potential snapping, grouping, and security context
    set({
      nodes: get().nodes.map(n => {
        if (n.id === nodeId) {
          const updatedNode = { ...n, position: { x: finalX, y: finalY } };
          // If we attach to a parent group, adjust position to be relative to the parent
          // ReactFlow handles parent nesting by making child positions relative.
          if (targetParentId && n.parentId !== targetParentId) {
            const parent = nodes.find(p => p.id === targetParentId);
            if (parent) {
              updatedNode.parentId = targetParentId;
              updatedNode.extent = 'parent';
              updatedNode.position = {
                x: finalX - parent.position.x,
                y: finalY - parent.position.y
              };
              updatedNode.data = { ...updatedNode.data, securityContext: targetSecurityContext };
              toastBus.emit(`Attached to ${parent.data.label}`, 'success');
            }
          } else if (!targetParentId && n.parentId) {
            // Dragged outside, decouple from parent
            const parent = nodes.find(p => p.id === n.parentId);
            if (parent) {
               // Convert relative to absolute coordinates
               updatedNode.position = {
                 x: n.position.x + parent.position.x,
                 y: n.position.y + parent.position.y
               };
            }
            delete updatedNode.parentId;
            delete updatedNode.extent;
            updatedNode.data = { ...updatedNode.data, securityContext: undefined };
            toastBus.emit('Detached from group', 'info');
          }
          return updatedNode;
        }
        return n;
      })
    });
  },
  
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) as ArchEdge[] });
  },
  
  onConnect: (connection) => {
    const sourceNode = get().nodes.find(n => n.id === connection.source);
    const targetNode = get().nodes.find(n => n.id === connection.target);

    if (sourceNode && targetNode) {
      const srcCat = sourceNode.data.category;
      const tgtCat = targetNode.data.category;
      
      // Category-level validation
      const allowedTargets: Record<string, string[]> = {
        client: ['network', 'compute', 'storage'],
        network: ['compute', 'storage', 'network', 'observability'],
        compute: ['compute', 'storage', 'messaging', 'network', 'observability'],
        storage: ['compute', 'messaging', 'observability'],
        messaging: ['compute', 'storage', 'observability', 'network'],
        observability: ['observability'],
        boundary: ['boundary', 'compute', 'storage', 'network', 'messaging', 'observability', 'client'],
      };

      if (!allowedTargets[srcCat]?.includes(tgtCat)) {
        const allowedNames = allowedTargets[srcCat]
          .map(c => c.charAt(0).toUpperCase() + c.slice(1))
          .join(', ');
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('archviz-toast', { 
            detail: { message: `${srcCat.toUpperCase()} can only attach to: ${allowedNames}`, type: 'error' } 
          });
          window.dispatchEvent(event);
        }
        return;
      }

      // Component-level anti-pattern validation
      const validation = validateConnection(sourceNode.data, targetNode.data);
      if (!validation.allowed) {
        toastBus.emit(validation.message, 'error');
        if (validation.suggestion) {
          setTimeout(() => toastBus.emit(`➔ ${validation.suggestion}`, 'info'), 400);
        }
        return;
      }
      if (validation.level === 'warning' && validation.message) {
        toastBus.emit(validation.message, 'warning');
        if (validation.suggestion) {
          setTimeout(() => toastBus.emit(`➔ ${validation.suggestion}`, 'info'), 400);
        }
      }
    }

    const newEdge: ArchEdge = {
      id: genEdgeId(),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      animated: true,
    };
    get().pushHistory();
    set({ edges: [...get().edges, newEdge], redoStack: [] });
    // Auto snapshot
    setTimeout(() => get().takeSnapshot(), 100);
  },
  
  // ── Node Actions ──
  addNode: (componentType, position) => {
    const def = getComponentDefinition(componentType);
    if (!def) return;
    
    const isBoundary = def.category === 'boundary';
    const isMeta = def.category === 'meta';
    const tier = def.tiers[def.defaultTierIndex];
    
    let nodeFlowType: string = 'archNode';
    if (isBoundary) nodeFlowType = 'groupNode';
    else if (isMeta) nodeFlowType = 'stickyNote';
    
    const newNode: ArchNode = {
      id: genNodeId(),
      type: nodeFlowType,
      position,
      ...(isBoundary ? {
        style: { width: 350, height: 250 },
      } : {}),
      data: {
        componentType: def.type,
        label: def.label,
        category: def.category,
        icon: def.icon,
        tier,
        tierIndex: def.defaultTierIndex,
        instances: 1,
        scalingType: def.scalingType,
        reliability: def.reliability,
        scalingFactor: def.scalingFactor,
        healthStatus: 'healthy',
        loadPercent: 0,
        architecturalNote: isMeta ? 'Double-click to edit note...' : undefined,
        ...(isBoundary ? { isGroup: true } : {}),
      },
    };
    
    get().pushHistory();
    set({ nodes: [...get().nodes, newNode], redoStack: [] });
    // Auto snapshot
    setTimeout(() => get().takeSnapshot(), 100);
  },
  
  removeNode: (nodeId) => {
    get().pushHistory();
    set({
      nodes: get().nodes.filter(n => n.id !== nodeId),
      edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      rightPanelOpen: get().selectedNodeId === nodeId ? false : get().rightPanelOpen,
      redoStack: [],
    });
    setTimeout(() => get().takeSnapshot(), 100);
  },
  
  removeEdge: (edgeId) => {
    get().pushHistory();
    set({
      edges: get().edges.filter(e => e.id !== edgeId),
      selectedEdgeId: null,
      redoStack: [],
    });
    toastBus.emit('Connection removed', 'info');
    setTimeout(() => get().takeSnapshot(), 100);
  },
  
  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    });
  },
  
  selectNode: (nodeId) => {
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      rightPanelOpen: nodeId !== null,
    });
  },
  
  selectEdge: (edgeId) => {
    set({
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      rightPanelOpen: edgeId !== null,
    });
  },
  
  // ── Change Component Type ──
  changeNodeType: (nodeId, newComponentType) => {
    const def = getComponentDefinition(newComponentType);
    if (!def) return;
    get().pushHistory();
    const tier = def.tiers[def.defaultTierIndex];
    set({
      nodes: get().nodes.map(n =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                componentType: def.type,
                label: def.label,
                category: def.category,
                icon: def.icon,
                tier,
                tierIndex: def.defaultTierIndex,
                scalingType: def.scalingType,
                reliability: def.reliability,
                scalingFactor: def.scalingFactor,
              },
            }
          : n
      ),
      redoStack: [],
    });
    toastBus.emit(`Changed to ${def.label}`, 'success');
    setTimeout(() => get().takeSnapshot(), 100);
  },
  
  // ── Simulation Config ──
  setSimulationConfig: (config) => {
    set({
      simulationConfig: { ...get().simulationConfig, ...config },
    });
  },
  
  setProjectName: (name) => set({ projectName: name }),
  
  // ── UI Toggles ──
  toggleVersionHistory: () => set({ versionHistoryOpen: !get().versionHistoryOpen }),
  toggleRecommendationPanel: () => set({ recommendationPanelOpen: !get().recommendationPanelOpen }),
  toggleTemplatePicker: () => set({ templatePickerOpen: !get().templatePickerOpen }),
  toggleLeftSidebar: () => set({ leftSidebarOpen: !get().leftSidebarOpen }),
  toggleSecurityPanel: () => set({ securityPanelOpen: !get().securityPanelOpen }),
  toggleGreenOpsHeatmap: () => set({ greenOpsHeatmap: !get().greenOpsHeatmap }),
  setOutageRegionId: (id) => set({ outageRegionId: id }),
  dismissOnboarding: () => {
    localStorage.setItem('archviz-onboarded', 'true');
    set({ showOnboarding: false });
  },
  setActiveSimulationEvent: (event) => set({ activeSimulationEvent: event }),
  setCompareSnapshots: (ids) => set({ compareSnapshots: ids }),
  setCloudProvider: (provider) => set({ cloudProvider: provider }),
  toggleWhiteLabelReport: () => set({ isWhiteLabelReport: !get().isWhiteLabelReport }),
  toggleTrace: () => set({ isTracing: !get().isTracing }),
  setSecurityReport: (report) => set({ computedSecurityReport: report }),
  
  // ── Snapshots ──
  takeSnapshot: (label) => {
    const { nodes, edges, simulationConfig, snapshots } = get();
    if (nodes.length === 0) return;
    
    const autoLabel = label || generateSnapshotLabel(nodes, edges, snapshots);
    
    const snapshot: Snapshot = {
      id: `snap_${Date.now()}`,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now(),
      label: autoLabel,
      healthScore: 0,  // Will be recalculated
      monthlyCost: 0,  // Will be recalculated
      simulationConfig: { ...simulationConfig },
    };
    
    const newSnapshots = [...snapshots, snapshot].slice(-20); // Keep last 20
    set({ snapshots: newSnapshots });
  },
  
  restoreSnapshot: (snapshotId) => {
    const snapshot = get().snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return;
    
    set({
      nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
      edges: JSON.parse(JSON.stringify(snapshot.edges)),
      simulationConfig: { ...snapshot.simulationConfig },
        selectedNodeId: null,
      rightPanelOpen: false,
    });
  },
  
  // ── Deployment Logic ──
  startDeployment: (sourceNodeId: string) => {
    const state = get();
    const sourceNode = state.nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return;
    
    // If it's a boundary node, get inner nodes if needed, or just clone the node.
    const nodesToClone = sourceNode.type === 'groupNode' || sourceNode.data.isGroup 
      ? state.nodes.filter(n => n.parentId === sourceNodeId || n.id === sourceNodeId)
      : [sourceNode];
      
    const { updatedSources, clones } = createDeploymentClones(nodesToClone);
    
    // Update existing nodes with the modified sources
    const newNodes = state.nodes.map(n => {
      const up = updatedSources.find(u => u.id === n.id);
      return up ? up : n;
    });
    
    // Create new edges targeting clones
    const sourceIds = nodesToClone.map(n => n.id);
    const cloneIds = clones.map(c => c.id);
    const newEdges = [...state.edges];
    
    state.edges.forEach(edge => {
      if (sourceIds.includes(edge.target)) {
        // incoming edge, clone it to point to green node
        const targetIndex = sourceIds.indexOf(edge.target);
        if (targetIndex !== -1) {
          const greenTargetId = clones[targetIndex].id;
          newEdges.push({
            ...edge,
            id: `edge_v2_${edge.id}_${Date.now()}`,
            target: greenTargetId,
            data: {
              ...edge.data,
              config: {
                ...((edge.data as any)?.config || {}),
                trafficWeight: 0,
                edgeLabel: undefined,
              }
            }
          });
        }
      }
    });
    
    set({
      nodes: [...newNodes, ...clones],
      edges: newEdges,
      deploymentState: {
        isActive: true,
        phase: 'canary',
        trafficWeightV2: 0,
        sourceNodeIds: sourceIds,
        cloneNodeIds: cloneIds,
        startedAt: Date.now(),
        targetNodeType: sourceNode.data.componentType
      }
    });
  },
  
  updateDeploymentState: (partial) => {
    set({ deploymentState: { ...get().deploymentState, ...partial } });
  },
  
  completeDeployment: () => {
    const { nodes, edges, deploymentState } = get();
    if (!deploymentState.isActive) return;
    
    // Make clones permanent, remove Blue nodes
    const finalNodes = nodes
      .filter(n => !deploymentState.sourceNodeIds.includes(n.id))
      .map(n => {
        if (deploymentState.cloneNodeIds.includes(n.id)) {
          return {
            ...n,
            data: {
              ...n.data,
              isDeploymentClone: false,
              appVersion: undefined,
              label: n.data.label.replace(' (Green)', ''),
            }
          };
        }
        return n;
      });
      
    // Keep edges targeting clones, remove edges targeting original blue nodes
    const finalEdges = edges.filter(e => !deploymentState.sourceNodeIds.includes(e.target));
    
    // Clear trafficWeight overrides
    const cleanEdges = finalEdges.map(e => {
      if (deploymentState.cloneNodeIds.includes(e.target)) {
        const config = { ...((e.data as any)?.config || {}) };
        delete config.trafficWeight;
        return {
          ...e,
          data: {
            ...e.data,
            config,
          }
        };
      }
      return e;
    });
    
    set({
      nodes: finalNodes,
      edges: cleanEdges,
      deploymentState: INITIAL_DEPLOYMENT_STATE,
    });
    
    toastBus.emit('Deployment Successful: Cutover complete', 'success');
  },
  
  cancelDeployment: () => {
    const { nodes, edges, deploymentState } = get();
    if (!deploymentState.isActive) return;
    
    // Reset to before: remove clones, restore Blue nodes label
    const finalNodes = nodes
      .filter(n => !deploymentState.cloneNodeIds.includes(n.id))
      .map(n => {
        if (deploymentState.sourceNodeIds.includes(n.id)) {
          return {
            ...n,
            data: {
              ...n.data,
              appVersion: undefined,
              label: n.data.label.replace(' (Blue)', ''),
            }
          };
        }
        return n;
      });
      
    // remove edges targeting clones, reset traffic weights on original
    const finalEdges = edges
      .filter(e => !deploymentState.cloneNodeIds.includes(e.target))
      .map(e => {
        if (deploymentState.sourceNodeIds.includes(e.target)) {
          const config = { ...((e.data as any)?.config || {}) };
          delete config.trafficWeight;
          return {
            ...e,
            data: { ...e.data, config }
          };
        }
        return e;
      });
      
    set({
      nodes: finalNodes,
      edges: finalEdges,
      deploymentState: INITIAL_DEPLOYMENT_STATE,
    });
    
    toastBus.emit('Deployment Cancelled: Rolled back to v1', 'info');
  },

  // ── Templates ──
  loadTemplate: (nodes, edges) => {
    set({
      nodes,
      edges,
      selectedNodeId: null,
      rightPanelOpen: false,
      templatePickerOpen: false,
      undoStack: [],   // clear history — new project context
      redoStack: [],
    });
    setTimeout(() => get().takeSnapshot('Template loaded'), 200);
  },
  
  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      rightPanelOpen: false,
      undoStack: [],   // wipe history so Undo can't resurrect a previous project
      redoStack: [],
    });
  },
  
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  
  // ── Undo / Redo ──
  pushHistory: () => {
    const { nodes, edges, undoStack } = get();
    const entry: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    set({ undoStack: [...undoStack.slice(-30), entry] });
  },
  
  // ── Auto Layout ──
  runAutoLayout: (direction = 'LR') => {
    const { nodes, edges } = get();
    if (nodes.length === 0) return;
    get().pushHistory();
    const layouted = applyAutoLayout(nodes, edges, { direction });
    set({ nodes: layouted, redoStack: [] });
    toastBus.emit('Layout organized', 'success');
  },

  
  undo: () => {
    const { undoStack, nodes, edges } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const current: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, current],
      selectedNodeId: null,
      rightPanelOpen: false,
    });
    toastBus.emit('Undo', 'info');
  },
  
  redo: () => {
    const { redoStack, nodes, edges } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const current: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    set({
      nodes: next.nodes,
      edges: next.edges,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, current],
      selectedNodeId: null,
      rightPanelOpen: false,
    });
    toastBus.emit('Redo', 'info');
  },
  
  // ── Edge Config ──
  updateEdgeConfig: (edgeId, config) => {
    get().pushHistory();
    set({
      edges: get().edges.map(e => {
        if (e.id === edgeId) {
          const baseData = e.data || {};
          const prevConfig = (baseData as any).config || (e as any).config || {};
          const mergedConfig = { ...prevConfig, ...config };
          
          let animation = e.animated;
          let newStyle = { ...e.style };
          
          if (config.connectionType === 'sync-http') {
            animation = false;
            newStyle.strokeDasharray = undefined;
          } else if (config.connectionType === 'async-event') {
            animation = true;
            newStyle.strokeDasharray = '5 5';
          } else if (config.connectionType === 'default') {
             animation = true;
             newStyle.strokeDasharray = undefined;
          } else if (config.connectionType === 'firewall-boundary') {
             animation = false;
             newStyle.strokeDasharray = '2 8'; // Dotted
             newStyle.strokeWidth = 3;
          }

          return {
            ...e,
            config: mergedConfig,
            label: mergedConfig.edgeLabel ?? e.label,
            animated: animation,
            style: newStyle,
            data: {
              ...baseData,
              config: mergedConfig
            }
          };
        }
        return e;
      })
    });
  },

  // ── Persistence ──
  saveToLocalStorage: () => {
    const { nodes, edges, simulationConfig, projectName, snapshots } = get();
    const data = { nodes, edges, simulationConfig, projectName, snapshots };
    localStorage.setItem('archviz-state', JSON.stringify(data));
    toastBus.emit('Project saved', 'success');
  },
  
  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem('archviz-state');
      if (!raw) return false;
      const data = JSON.parse(raw);
      
      // Fix cache dimension issues by stripping React Flow internal measurements
      const rawNodes = data.nodes || [];
      const cleanNodes = rawNodes.map((n: any) => ({
        ...n,
        measured: undefined,
        width: undefined,
        height: undefined,
        selected: false,
      }));

      set({
        nodes: cleanNodes,
        edges: data.edges || [],
        simulationConfig: data.simulationConfig || { concurrentUsers: 1000, rpsMultiplier: 0.1, cacheHitRate: 0.6 },
        projectName: data.projectName || 'Untitled Architecture',
        snapshots: data.snapshots || [],
      });
      return true;
    } catch {
      return false;
    }
  },
}));

// ── Snapshot Label Generator ──
function generateSnapshotLabel(
  nodes: ArchNode[],
  edges: ArchEdge[],
  prevSnapshots: Snapshot[]
): string {
  if (prevSnapshots.length === 0) return 'Initial architecture';
  
  const prev = prevSnapshots[prevSnapshots.length - 1];
  const prevNodeIds = new Set(prev.nodes.map(n => n.id));
  const currNodeIds = new Set(nodes.map(n => n.id));
  const prevEdgeIds = new Set(prev.edges.map(e => e.id));
  const currEdgeIds = new Set(edges.map(e => e.id));
  
  const addedNodes = nodes.filter(n => !prevNodeIds.has(n.id));
  const removedNodes = prev.nodes.filter(n => !currNodeIds.has(n.id));
  const addedEdges = edges.filter(e => !prevEdgeIds.has(e.id));
  const removedEdges = prev.edges.filter(e => !currEdgeIds.has(e.id));
  
  const totalChanges = addedNodes.length + removedNodes.length + addedEdges.length + removedEdges.length;
  
  if (totalChanges === 0) return 'Configuration changed';
  
  if (addedNodes.length === 1 && removedNodes.length === 0 && addedEdges.length <= 1) {
    return `Added ${addedNodes[0].data.label}`;
  }
  
  if (removedNodes.length === 1 && addedNodes.length === 0) {
    return `Removed ${removedNodes[0].data.label}`;
  }
  
  if (addedEdges.length === 1 && addedNodes.length === 0 && removedNodes.length === 0) {
    const edge = addedEdges[0];
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    if (src && tgt) {
      return `Connected ${src.data.label} → ${tgt.data.label}`;
    }
  }
  
  return `Modified architecture (+${totalChanges} changes)`;
}
