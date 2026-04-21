import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  ConnectionLineType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';

import './styles/index.css';
import './styles/reactflow.css';
import './styles/auth-dashboard.css';

import { useArchStore } from './store/useArchStore';
import { useSimulation } from './hooks/useSimulation';
import { useSimulationEvents } from './hooks/useSimulationEvents';
import { useDeploymentSimulator } from './hooks/useDeploymentSimulator';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/useAuthStore';

import ArchNodeComponent from './components/nodes/ArchNode';
import GroupNode from './components/nodes/GroupNode';
import { ZoneNode } from './components/workspace/ZoneNode';
import StickyNoteNode from './components/nodes/StickyNoteNode';
import ArchEdge from './components/edges/ArchEdge';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import RightPanel from './components/RightPanel';
import BottomInsightBar from './components/BottomInsightBar';
import RecommendationPanel from './components/RecommendationPanel';
import TemplatePickerModal from './components/TemplatePickerModal';
import VersionHistoryDrawer from './components/VersionHistoryDrawer';
import SimulationOverlay from './components/SimulationOverlay';
import OnboardingOverlay from './components/OnboardingOverlay';
import SecurityPanel from './components/SecurityPanel';
import LandingPage from './components/LandingPage';
import { ToastProvider, useToastBus, toastBus } from './components/ToastSystem';
import { ContextMenu, SearchOverlay, ShortcutsOverlay } from './components/InteractiveOverlays';
import { ErrorBoundary, CanvasErrorBoundary } from './components/ErrorBoundary';
import { runSecurityScan } from './engine/securityScanner';
import { captureArchitectureAsImage } from './engine/exportRenderer';
import { getTemplateById, instantiateTemplate } from './utils/templateLoader';
import LoginModal from './components/auth/LoginModal';
import Dashboard from './components/dashboard/Dashboard';
import { loadProject } from './services/projectService';
import { Loader2 } from 'lucide-react';

const nodeTypes = { archNode: ArchNodeComponent, groupNode: GroupNode, zoneNode: ZoneNode, stickyNote: StickyNoteNode };
const edgeTypes = { default: ArchEdge, custom: ArchEdge };

// ── Auth guards ────────────────────────────────────────────────
function SmartHomeRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a0f)', gap: 12 }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent, #6366f1)' }} />
        <span style={{ color: 'var(--text-secondary, #888)', fontFamily: 'system-ui' }}>Loading...</span>
      </div>
    );
  }
  if (user) return null; // redirecting
  return <LandingView />;
}

function AuthRequired({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a0f)', gap: 12 }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent, #6366f1)' }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function FlowCanvas() {
  const nodes = useArchStore(s => s.nodes);
  const edges = useArchStore(s => s.edges);
  const onNodesChange = useArchStore(s => s.onNodesChange);
  const onEdgesChange = useArchStore(s => s.onEdgesChange);
  const onConnect = useArchStore(s => s.onConnect);
  const selectNode = useArchStore(s => s.selectNode);
  const selectedNodeId = useArchStore(s => s.selectedNodeId);
  const selectEdge = useArchStore(s => s.selectEdge);
  const addNode = useArchStore(s => s.addNode);
  const removeNode = useArchStore(s => s.removeNode);
  const removeEdge = useArchStore(s => s.removeEdge);
  const selectedEdgeId = useArchStore(s => s.selectedEdgeId);
  const handleNodeDrag = useArchStore(s => s.handleNodeDrag);
  const handleNodeDragStop = useArchStore(s => s.handleNodeDragStop);
  const alignmentLines = useArchStore(s => s.alignmentLines);
  const { nodeHealth } = useSimulation();
  const reactFlowInstance = useReactFlow();
  
  // Expose instance for export utilities
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__archviz_rfInstance = reactFlowInstance;
  }, [reactFlowInstance]);
  
  // Update node health status on every simulation tick
  useEffect(() => {
    const updateNodeData = useArchStore.getState().updateNodeData;
    const updateEdges = useArchStore.getState().setEdges;
    
    for (const node of nodes) {
      const health = nodeHealth.get(node.id);
      if (health && (node.data.loadPercent !== health.loadPercent || node.data.healthStatus !== health.status)) {
        updateNodeData(node.id, {
          loadPercent: health.loadPercent,
          healthStatus: health.status as 'healthy' | 'warning' | 'critical',
        });
      }
    }
    
    // Process edges to display traffic health
    let edgesChanged = false;
    const newEdges = edges.map(edge => {
      const sourceHealth = nodeHealth.get(edge.source)?.status || 'healthy';
      const targetHealth = nodeHealth.get(edge.target)?.status || 'healthy';
      
      let edgeClass = 'edge-healthy';
      if (sourceHealth === 'critical' || targetHealth === 'critical') {
        edgeClass = 'edge-critical';
      } else if (sourceHealth === 'warning' || targetHealth === 'warning') {
        edgeClass = 'edge-warning';
      }
      
      if (edge.className !== edgeClass) {
        edgesChanged = true;
        return { ...edge, className: edgeClass };
      }
      return edge;
    });
    
    if (edgesChanged) {
      // Small timeout to avoid immediate state updates during render phase
      setTimeout(() => updateEdges(newEdges), 0);
    }
  }, [nodeHealth]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Handle drag & drop from sidebar
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    const componentType = event.dataTransfer.getData('application/archviz-component');
    if (componentType) {
      addNode(componentType, position);
      return;
    }
    
    const snippetId = event.dataTransfer.getData('application/archviz-snippet');
    if (snippetId) {
      const template = getTemplateById(snippetId);
      if (!template) return;
      
      const { nodes: newNodes, edges: newEdges } = instantiateTemplate(template);
      if (newNodes.length === 0) return;
      
      // Calculate offset from first node
      const firstNode = newNodes[0];
      const offsetX = position.x - firstNode.position.x;
      const offsetY = position.y - firstNode.position.y;
      
      const idMap = new Map<string, string>();
      const timePrefix = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      
      const processedNodes = newNodes.map((n, i) => {
        const newId = `node-${timePrefix}-${i}`;
        idMap.set(n.id, newId);
        return {
          ...n,
          id: newId,
          position: {
            x: n.position.x + offsetX,
            y: n.position.y + offsetY
          }
        };
      });
      
      const processedEdges = newEdges.map((e, i) => {
        return {
          ...e,
          id: `edge-${timePrefix}-${i}`,
          source: idMap.get(e.source) || e.source,
          target: idMap.get(e.target) || e.target,
        };
      });
      
      const store = useArchStore.getState();
      store.pushHistory();
      store.setNodes([...store.nodes, ...processedNodes]);
      store.setEdges([...store.edges, ...processedEdges]);
    }
  }, [reactFlowInstance, addNode]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const isInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isInput) {
          if (selectedNodeId) {
            removeNode(selectedNodeId);
          } else if (selectedEdgeId) {
            removeEdge(selectedEdgeId);
          }
        }
      }
      if (e.key === 'Escape') {
        selectNode(null);
        selectEdge(null);
      }
      
      // Ctrl+S — Save
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useArchStore.getState().saveToLocalStorage();
      }
      
      // Ctrl+Z — Undo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        useArchStore.getState().undo();
      }
      
      // Ctrl+Y or Ctrl+Shift+Z — Redo
      if (
        (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault();
        useArchStore.getState().redo();
      }
      
      // Ctrl+E — Export PNG
      if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        exportCanvasAsPNG();
      }
      
      // F11 — Fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, removeNode, removeEdge, selectNode, selectEdge]);
  
  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    selectNode(node.id);
  }, [selectNode]);
  
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: { id: string }) => {
    selectEdge(edge.id);
  }, [selectEdge]);
  
  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);
  
  const onNodeDragFn = useCallback((_: React.MouseEvent, node: { id: string, position: { x: number, y: number } }) => {
    handleNodeDrag(node.id, node.position);
  }, [handleNodeDrag]);

  const onNodeDragStopFn = useCallback((_: React.MouseEvent, node: { id: string, position: { x: number, y: number } }) => {
    handleNodeDragStop(node.id, node.position);
  }, [handleNodeDragStop]);

  return (
    <div 
      className="canvas-wrapper" 
      style={{ position: 'relative' }}
      tabIndex={0}
      role="application"
      aria-label="Architecture Canvas. Use arrow keys to navigate nodes when selected."
    >
      <CanvasErrorBoundary>
        <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
          <defs>
            <filter id="tracer-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onNodeDrag={onNodeDragFn}
          onNodeDragStop={onNodeDragStopFn}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{ animated: true, type: 'default' }}
          connectionLineType={ConnectionLineType.SmoothStep}
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          maxZoom={2}
          edgesReconnectable
          deleteKeyCode={null}
          snapToGrid={true}
          snapGrid={[20, 20]}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1a1a1a" />
          <Controls showInteractive={false} />
          <MiniMap 
            nodeStrokeWidth={2}
            pannable 
            zoomable
            style={{ width: 140, height: 90 }}
          />
        </ReactFlow>

        {/* Alignment Guide Lines Overlay */}
        {alignmentLines?.x !== undefined && (
          <div
            className="alignment-line vertical"
            style={{
               // We need to map flow coordinates to screen position here if we want exact alignment inside the DOM.
               // React flow handles node positioning deeply, so projecting canvas coordinates to viewport bounds is needed...
               // However, an easier approach is to render alignment lines INSIDE React Flow using absolute nodes or
               // just calculate using the reactFlowInstance.flowToScreenPosition(alignmentLines).
               transform: `translateX(${reactFlowInstance.flowToScreenPosition({ x: alignmentLines.x, y: 0 }).x}px)` 
            }}
          />
        )}
        {alignmentLines?.y !== undefined && (
          <div
            className="alignment-line horizontal"
            style={{
               transform: `translateY(${reactFlowInstance.flowToScreenPosition({ x: 0, y: alignmentLines.y }).y}px)` 
            }}
          />
        )}

      </CanvasErrorBoundary>
    </div>
  );
}

/* ── Export helpers ── */
async function exportCanvasAsPNG() {
  const state = useArchStore.getState();
  if (state.nodes.length === 0) { toastBus.emit('No canvas to export', 'error'); return; }
  
  try {
    toastBus.emit('Rendering Architecture...', 'info');
    const dataUrl = await captureArchitectureAsImage(state.nodes as unknown as import('./types').ArchNode[], state.edges as unknown as import('./types').ArchEdge[]);
    
    const link = document.createElement('a');
    link.download = `${state.projectName || 'architecture'}.png`;
    link.href = dataUrl;
    link.click();
    toastBus.emit('Exported as PNG', 'success');
  } catch (err) {
    console.error('PNG export error', err);
    toastBus.emit('PNG export failed', 'error');
  }
}

function exportAsJSON() {
  const { nodes, edges, projectName, simulationConfig } = useArchStore.getState();
  const data = { projectName, nodes, edges, simulationConfig, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${projectName || 'architecture'}.archviz.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  toastBus.emit('Exported as JSON', 'success');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    toastBus.emit('Fullscreen — press F11 to exit', 'info');
  } else {
    document.exitFullscreen();
  }
}

// Expose globally for TopBar buttons
(window as unknown as Record<string, unknown>).__archviz_exportPNG = exportCanvasAsPNG;
(window as unknown as Record<string, unknown>).__archviz_exportJSON = exportAsJSON;
(window as unknown as Record<string, unknown>).__archviz_toggleFullscreen = toggleFullscreen;

function WorkspaceView() {
  // Bridge bus → toast context
  useToastBus();
  const { projectId } = useParams<{ projectId?: string }>();
  const location = useLocation();

  const rightPanelOpen    = useArchStore(s => s.rightPanelOpen);
  const leftSidebarOpen   = useArchStore(s => s.leftSidebarOpen);
  const selectedNodeId    = useArchStore(s => s.selectedNodeId);
  const clearCanvas       = useArchStore(s => s.clearCanvas);
  const setNodes          = useArchStore(s => s.setNodes);
  const setEdges          = useArchStore(s => s.setEdges);
  const setProjectName    = useArchStore(s => s.setProjectName);
  const nodes             = useArchStore(s => s.nodes);
  const edges             = useArchStore(s => s.edges);
  const setSecurityReport = useArchStore(s => s.setSecurityReport);

  useEffect(() => {
    setSecurityReport(runSecurityScan(nodes, edges));
  }, [nodes, edges, setSecurityReport]);

  // Initialize simulation events
  useSimulationEvents();
  useDeploymentSimulator();

  // On mount: either start fresh or load the cloud project
  useEffect(() => {
    if (!projectId) {
      // NEW project — always start with a clean canvas unless loading a template
      if (!location.state?.fromTemplate) {
        clearCanvas();
        setProjectName('Untitled Architecture');
      }
    } else {
      // OPEN existing — load from Firestore
      loadProject(projectId).then(data => {
        if (data) {
          setNodes(data.nodes as unknown as import('./types').ArchNode[]);
          setEdges(data.edges as unknown as import('./types').ArchEdge[]);
          setProjectName(data.name);
        } else {
          // Project not found — clear and show fresh canvas
          clearCanvas();
          setProjectName('Untitled Architecture');
          toastBus.emit('Project not found — starting fresh', 'warning');
        }
      }).catch(() => {
        clearCanvas();
        setProjectName('Untitled Architecture');
        toastBus.emit('Failed to load project', 'error');
      });
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const layoutClasses = [
    'app-layout',
    rightPanelOpen  ? 'right-panel-open'   : '',
    !leftSidebarOpen ? 'left-sidebar-hidden' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      <TopBar />
      {leftSidebarOpen && <LeftSidebar />}
      <FlowCanvas />
      {rightPanelOpen && <RightPanel />}
      <BottomInsightBar />

      {/* Overlays */}
      <RecommendationPanel />
      <TemplatePickerModal />
      <VersionHistoryDrawer />
      <SimulationOverlay />
      <OnboardingOverlay />
      <SecurityPanel />
      <ContextMenu />
      <SearchOverlay />
      <ShortcutsOverlay />

      {/* A11y */}
      <div aria-live="polite" className="sr-only"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        {selectedNodeId ? 'Node selected.' : ''}
      </div>
    </div>
  );
}

function LandingView() {
  useToastBus();
  const navigate = useNavigate();
  return <LandingPage onLaunch={(isTemplate?: boolean) => navigate('/app', { state: { fromTemplate: isTemplate } })} />;
}

function DashboardView() {
  useToastBus();
  return <Dashboard />;
}

// Initialise auth listener at the top level (runs once globally)
function AuthInitializer() {
  useAuth(); // subscribes to onAuthStateChanged
  const loginModalOpen = useAuthStore(s => s.loginModalOpen);
  return loginModalOpen ? <LoginModal /> : null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthInitializer />
        <Routes>
          <Route path="/"          element={<SmartHomeRoute />} />
          <Route path="/dashboard" element={<AuthRequired><DashboardView /></AuthRequired>} />
          <Route path="/app"             element={<WorkspaceView />} />
          <Route path="/app/:projectId"  element={<WorkspaceView />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </ErrorBoundary>
  );
}

