import { useState, useEffect, useRef } from 'react';
import { Copy, Trash2, Power, PowerOff, Eye, Search as SearchIcon, X, Scissors, Rocket } from 'lucide-react';
import { useArchStore } from '../store/useArchStore';
import { generateNodeId } from '../utils/idGenerator';
import { getTrafficShiftSchedule, updateEdgeTrafficWeights } from '../engine/deploymentSimulator';

/* ─────────────────────────────────────────────────────────
 *  Right-Click Context Menu for Canvas Nodes & Edges
 * ───────────────────────────────────────────────────────── */

interface CtxMenuState {
  x: number;
  y: number;
  type: 'node' | 'edge';
  targetId: string;
}

export function ContextMenu() {
  const [menu, setMenu] = useState<CtxMenuState | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const selectNode = useArchStore(s => s.selectNode);
  const removeNode = useArchStore(s => s.removeNode);
  const removeEdge = useArchStore(s => s.removeEdge);
  const updateNodeData = useArchStore(s => s.updateNodeData);
  const nodes = useArchStore(s => s.nodes);
  const edges = useArchStore(s => s.edges);

  useEffect(() => {
    function handleContext(e: MouseEvent) {
      const target = e.target as HTMLElement;
      
      // Check for edge click (SVG path in react-flow__edge)
      const edgeEl = target.closest('.react-flow__edge');
      if (edgeEl) {
        const edgeId = edgeEl.getAttribute('data-id');
        if (edgeId) {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, type: 'edge', targetId: edgeId });
          return;
        }
      }
      
      // Check for bulk selection box click
      const selectionEl = target.closest('.react-flow__nodesselection, .react-flow__nodesselection-rect');
      if (selectionEl) {
        const selectedNodes = useArchStore.getState().nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, type: 'node', targetId: selectedNodes[0].id });
          return;
        }
      }
      
      // Check for single node click
      const nodeEl = target.closest('[data-id]');
      if (!nodeEl) { setMenu(null); return; }
      const nodeId = nodeEl.getAttribute('data-id');
      if (!nodeId) return;
      // Don't treat edge group as node
      if (nodeEl.closest('.react-flow__edge')) return;
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, type: 'node', targetId: nodeId });
    }
    function handleClick() { setMenu(null); }
    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const close = () => setMenu(null);

  if (!menu) return null;

  /* ── Edge context menu ── */
  if (menu.type === 'edge') {
    const edge = edges.find(e => e.id === menu.targetId);
    if (!edge) return null;
    const srcNode = nodes.find(n => n.id === edge.source);
    const tgtNode = nodes.find(n => n.id === edge.target);
    return (
      <div ref={ref} className="ctx-menu" style={{ left: menu.x, top: menu.y }}>
        <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-disabled)', borderBottom: '1px solid var(--border-subtle)' }}>
          {srcNode?.data.label || '?'} → {tgtNode?.data.label || '?'}
        </div>
        <button className="ctx-item ctx-danger" onClick={() => { removeEdge(menu.targetId); close(); }}>
          <Scissors size={14} /> Remove Connection
        </button>
      </div>
    );
  }

  /* ── Node context menu ── */
  const node = nodes.find(n => n.id === menu.targetId);
  if (!node) return null;

  const selectedNodes = nodes.filter(n => n.selected);
  const isBulkMenu = selectedNodes.length > 1 && selectedNodes.some(n => n.id === menu.targetId);

  const handleDuplicate = () => {
    if (isBulkMenu) {
      useArchStore.getState().duplicateSelected();
    } else {
      // Just duplicate this single node
      const newNodeId = generateNodeId();
      const newNode = { ...node, id: newNodeId, position: { x: node.position.x + 60, y: node.position.y + 60 } };
      useArchStore.getState().setNodes([...nodes, newNode]);
      useArchStore.getState().takeSnapshot('Duplicated component');
      selectNode(newNodeId);
    }
    close();
  };

  const handleDelete = () => { 
    if (isBulkMenu) {
      useArchStore.getState().deleteSelected();
    } else {
      removeNode(menu.targetId); 
    }
    close(); 
  };
  
  const handleInspect = () => { selectNode(menu.targetId); close(); };
  const handleToggle = () => {
    updateNodeData(menu.targetId, { isDisabled: !node.data.isDisabled });
    close();
  };

  // Compute types that support Blue/Green deployment
  const COMPUTE_TYPES = ['api-server', 'web-server', 'worker', 'lambda', 'websocket-server', 'ecs-fargate', 'app-runner', 'kubernetes-cluster', 'graphql-server', 'game-server', 'ml-worker'];
  const isCompute = COMPUTE_TYPES.includes(node.data.componentType);
  const deploymentActive = useArchStore.getState().deploymentState.isActive;

  const handleDeployRollout = () => {
    const store = useArchStore.getState();
    store.startDeployment(menu.targetId);
    close();
    
    // Animate the traffic shift over 10 seconds
    const schedule = getTrafficShiftSchedule();
    schedule.forEach(({ delayMs, weightV2 }) => {
      setTimeout(() => {
        const s = useArchStore.getState();
        if (!s.deploymentState.isActive) return;
        
        // Update edge traffic labels
        const updatedEdges = updateEdgeTrafficWeights(
          s.edges,
          s.deploymentState.sourceNodeIds,
          s.deploymentState.cloneNodeIds,
          weightV2
        );
        
        // Update Green node load to match traffic weight
        const updatedNodes = s.nodes.map(n => {
          if (s.deploymentState.cloneNodeIds.includes(n.id)) {
            return { ...n, data: { ...n.data, loadPercent: weightV2 * 0.6 } };
          }
          if (s.deploymentState.sourceNodeIds.includes(n.id)) {
            return { ...n, data: { ...n.data, loadPercent: (100 - weightV2) * 0.6 } };
          }
          return n;
        });
        
        const phase = weightV2 < 25 ? 'canary' : weightV2 < 100 ? 'shifting' : 'draining';
        
        useArchStore.setState({
          edges: updatedEdges,
          nodes: updatedNodes,
          deploymentState: {
            ...s.deploymentState,
            trafficWeightV2: weightV2,
            phase,
          },
        });
      }, delayMs);
    });
    
    // Auto-complete after rollout finishes
    setTimeout(() => {
      const s = useArchStore.getState();
      if (s.deploymentState.isActive) {
        s.completeDeployment();
      }
    }, 11500);
  };

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {!isBulkMenu && (
        <>
          <button className="ctx-item" onClick={handleInspect}>
            <Eye size={14} /> Inspect
          </button>
          <button className="ctx-item" onClick={handleToggle}>
            {node.data.isDisabled ? <Power size={14} /> : <PowerOff size={14} />}
            {node.data.isDisabled ? 'Enable' : 'Disable'}
          </button>
          {isCompute && !deploymentActive && (
            <button className="ctx-item" onClick={handleDeployRollout} style={{ color: '#818cf8' }}>
              <Rocket size={14} /> Simulate Rollout
            </button>
          )}
        </>
      )}
      <button className="ctx-item" onClick={handleDuplicate}>
        <Copy size={14} /> {isBulkMenu ? `Duplicate (${selectedNodes.length})` : 'Duplicate'}
      </button>
      <div className="ctx-divider" />
      <button className="ctx-item ctx-danger" onClick={handleDelete}>
        <Trash2 size={14} /> {isBulkMenu ? `Delete (${selectedNodes.length})` : 'Delete'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 *  Search Overlay (Ctrl+F)
 * ───────────────────────────────────────────────────────── */

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useArchStore(s => s.nodes);
  const selectNode = useArchStore(s => s.selectNode);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Only on canvas (not in input)
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  const results = query.length > 0
    ? nodes.filter(n =>
        n.data.label.toLowerCase().includes(query.toLowerCase()) ||
        n.data.componentType.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleSelect = (nodeId: string) => {
    selectNode(nodeId);
    setOpen(false);
    setQuery('');
  };

  if (!open) return null;

  return (
    <div className="search-overlay" onClick={() => { setOpen(false); setQuery(''); }}>
      <div className="search-panel" onClick={e => e.stopPropagation()}>
        <div className="search-input-row">
          <SearchIcon size={16} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search components…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
            autoFocus
          />
          <button className="btn-icon" onClick={() => { setOpen(false); setQuery(''); }}>
            <X size={14} />
          </button>
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map(n => (
              <button key={n.id} className="search-result-item" onClick={() => handleSelect(n.id)}>
                <span className="sr-name">{n.data.label}</span>
                <span className="sr-type">{n.data.componentType}</span>
              </button>
            ))}
          </div>
        )}
        {query.length > 0 && results.length === 0 && (
          <div className="search-empty">No components found</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 *  Keyboard Shortcuts Overlay (press ? or Ctrl+/)
 * ───────────────────────────────────────────────────────── */

const SHORTCUTS = [
  { keys: 'Ctrl + Z', desc: 'Undo' },
  { keys: 'Ctrl + Y', desc: 'Redo' },
  { keys: 'Ctrl + S', desc: 'Save project' },
  { keys: 'Ctrl + D', desc: 'Duplicate selected nodes' },
  { keys: 'Ctrl + F', desc: 'Search components' },
  { keys: 'F11', desc: 'Fullscreen mode' },
  { keys: 'Delete', desc: 'Remove selected items' },
  { keys: 'Escape', desc: 'Deselect / Close panel' },
  { keys: 'Ctrl + E', desc: 'Export as PNG' },
  { keys: 'Right Click', desc: 'Context menu (incl. Rollout)' },
  { keys: '?', desc: 'Show shortcuts' },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Expose global toggle for TopBar button
    (window as unknown as Record<string, unknown>).__archviz_toggleShortcuts = () => setOpen(v => !v);
    
    function handleKey(e: KeyboardEvent) {
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA' ||
          document.activeElement?.tagName === 'SELECT') return;
      // ? is Shift+/ on most keyboards
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(v => !v);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="search-overlay" onClick={() => setOpen(false)}>
      <div className="shortcuts-panel" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <span>Keyboard Shortcuts</span>
          <button className="btn-icon" onClick={() => setOpen(false)}><X size={14} /></button>
        </div>
        <div className="shortcuts-list">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="shortcut-row">
              <kbd className="shortcut-key">{s.keys}</kbd>
              <span className="shortcut-desc">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
