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
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import './styles/index.css';
import './styles/reactflow.css';

import { useArchStore } from './store/useArchStore';
import { useSimulation } from './hooks/useSimulation';
import { useSimulationEvents } from './hooks/useSimulationEvents';
import { useDeploymentSimulator } from './hooks/useDeploymentSimulator';

import ArchNodeComponent from './components/nodes/ArchNode';
import GroupNode from './components/nodes/GroupNode';
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
import { ToastProvider, useToastBus } from './components/ToastSystem';
import { ContextMenu, SearchOverlay, ShortcutsOverlay } from './components/InteractiveOverlays';
import { toastBus } from './components/ToastSystem';
import { ErrorBoundary, CanvasErrorBoundary } from './components/ErrorBoundary';

const nodeTypes = { archNode: ArchNodeComponent, groupNode: GroupNode };
const edgeTypes = { default: ArchEdge, custom: ArchEdge };

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
    const componentType = event.dataTransfer.getData('application/archviz-component');
    if (!componentType) return;
    
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    addNode(componentType, position);
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
    <div className="canvas-wrapper" style={{ position: 'relative' }}>
      <CanvasErrorBoundary>
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
function exportCanvasAsPNG() {
  const rfContainer = document.querySelector('.react-flow') as HTMLElement;
  if (!rfContainer) { toastBus.emit('No canvas to export', 'error'); return; }
  
  import('html-to-image').then(mod => {
    // We explicitly set font embed options to prevent font-loading from hiding nodes.
    mod.toPng(rfContainer, { 
      backgroundColor: '#0a0a0a',
      pixelRatio: 2,
      skipFonts: true, // Prevents html-to-image from failing on system fonts
      filter: (node: HTMLElement) => {
        // Only safely check elements
        if (node?.nodeType !== 1) return true;
        const cls = node.classList;
        if (!cls || typeof cls.contains !== 'function') return true;
        
        // Hide UI controls but KEEP the background grid!
        if (cls.contains('react-flow__controls') || 
            cls.contains('react-flow__minimap') || 
            cls.contains('react-flow__attribution') ||
            cls.contains('arch-node-failed-overlay')
           ) return false;
        return true;
      },
    }).then(dataUrl => {
      const link = document.createElement('a');
      link.download = `${useArchStore.getState().projectName || 'architecture'}.png`;
      link.href = dataUrl;
      link.click();
      toastBus.emit('Exported as PNG', 'success');
    }).catch((err) => {
      console.error('PNG export error', err);
      toastBus.emit('PNG export failed — try JSON export', 'error');
    });
  }).catch(() => {
    exportAsJSON();
    toastBus.emit('PNG library not found. Exported as JSON instead.', 'warning');
  });
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
(window as any).__archviz_exportPNG = exportCanvasAsPNG;
(window as any).__archviz_exportJSON = exportAsJSON;
(window as any).__archviz_toggleFullscreen = toggleFullscreen;

function WorkspaceView() {
  // Bridge bus → toast context
  useToastBus();
  
  const rightPanelOpen = useArchStore(s => s.rightPanelOpen);
  const leftSidebarOpen = useArchStore(s => s.leftSidebarOpen);
  const loadFromLocalStorage = useArchStore(s => s.loadFromLocalStorage);
  
  // Initialize simulation events
  useSimulationEvents();
  useDeploymentSimulator();
  
  // Load saved state on mount
  useEffect(() => {
    loadFromLocalStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const layoutClasses = [
    'app-layout',
    rightPanelOpen ? 'right-panel-open' : '',
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
    </div>
  );
}

function LandingView() {
  useToastBus();
  const navigate = useNavigate();
  return <LandingPage onLaunch={() => navigate('/app')} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/app" element={<WorkspaceView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </ErrorBoundary>
  );
}
