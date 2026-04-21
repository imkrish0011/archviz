import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArchStore } from '../store/useArchStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  Save, Upload, Clock, LayoutTemplate, Play, ChevronDown,
  Zap, ServerCrash, Trash2, CloudOff, DatabaseZap, XCircle,
  PanelLeft, Undo2, Redo2, Download, Image, Maximize, Keyboard,
  BrainCircuit, ShieldAlert, FileCode, LayoutGrid, Leaf, MapPin,
  FileText, Container, MoreHorizontal, Activity, LogIn,
  LayoutDashboard, CheckSquare, Square, TrendingUp
} from 'lucide-react';
import { downloadTerraform, validateArchitecture } from '../engine/hclGenerator';
import { downloadCloudFormation, downloadDockerCompose, downloadKubernetesManifests, downloadHelmChart } from '../engine/terraformGenerator';
import { generateArchitectureReport } from '../engine/reportGenerator';
import { runSimulation } from '../engine/simulator';
import { toastBus } from './ToastSystem';
import { useAuth } from '../hooks/useAuth';
import { saveProject, updateProject } from '../services/projectService';
import { calculateTotalCost, formatCost } from '../engine/costEngine';
import { parseTfState } from '../engine/terraformGenerator';
import CostProjectionModal from './CostProjectionModal';

/** Wrap any export action with an auth check. If not logged in, opens the
 *  login modal and stores the action as a pending export to fire after login. */
function withAuth(action: () => void, label: string): void {
  const { user, openLoginModal } = useAuthStore.getState();
  if (user) {
    action();
  } else {
    openLoginModal(`Sign in to export: ${label}`, action);
  }
}

export default function TopBar() {
  const projectName = useArchStore(s => s.projectName);
  const setProjectName = useArchStore(s => s.setProjectName);
  const simulationConfig = useArchStore(s => s.simulationConfig);
  const setSimulationConfig = useArchStore(s => s.setSimulationConfig);
  const saveToLocalStorage = useArchStore(s => s.saveToLocalStorage);
  const loadFromLocalStorage = useArchStore(s => s.loadFromLocalStorage);
  const toggleVersionHistory = useArchStore(s => s.toggleVersionHistory);
  const toggleTemplatePicker = useArchStore(s => s.toggleTemplatePicker);
  const setActiveSimulationEvent = useArchStore(s => s.setActiveSimulationEvent);
  const toggleLeftSidebar = useArchStore(s => s.toggleLeftSidebar);
  const leftSidebarOpen = useArchStore(s => s.leftSidebarOpen);
  const clearCanvas = useArchStore(s => s.clearCanvas);
  const nodes = useArchStore(s => s.nodes);
  const edges = useArchStore(s => s.edges);
  const setNodes = useArchStore(s => s.setNodes);
  const setEdges = useArchStore(s => s.setEdges);
  const undo = useArchStore(s => s.undo);
  const redo = useArchStore(s => s.redo);
  const undoStack = useArchStore(s => s.undoStack);
  const redoStack = useArchStore(s => s.redoStack);
  const toggleSecurityPanel = useArchStore(s => s.toggleSecurityPanel);
  const toggleGreenOpsHeatmap = useArchStore(s => s.toggleGreenOpsHeatmap);
  const greenOpsHeatmap = useArchStore(s => s.greenOpsHeatmap);
  const setOutageRegionId = useArchStore(s => s.setOutageRegionId);
  const runAutoLayout = useArchStore(s => s.runAutoLayout);
  const isTracing = useArchStore(s => s.isTracing);
  const toggleTrace = useArchStore(s => s.toggleTrace);
  const navigate = useNavigate();
  
  const [showSimDropdown, setShowSimDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [showCostProjection, setShowCostProjection] = useState(false);
  const simRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const cloudProvider = useArchStore(s => s.cloudProvider);
  const isWhiteLabelReport = useArchStore(s => s.isWhiteLabelReport);
  const toggleWhiteLabelReport = useArchStore(s => s.toggleWhiteLabelReport);

  const { user, signOut } = useAuth();
  const openLoginModal = useAuthStore(s => s.openLoginModal);
  
  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (simRef.current && !simRef.current.contains(e.target as Node)) {
        setShowSimDropdown(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMoreDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  
  const userSteps = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 10000000];
  const currentStepIndex = userSteps.findIndex(s => s >= simulationConfig.concurrentUsers);
  
  const formatUsers = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };
  
  const handleSave = useCallback(async () => {
    // Always save locally
    saveToLocalStorage();

    if (!user) {
      openLoginModal('Sign in to save your project to the cloud', async () => {
        // re-run after login
        handleSave();
      });
      return;
    }

    setIsSaving(true);
    try {
      const edges = useArchStore.getState().edges;
      const simCfg = useArchStore.getState().simulationConfig;
      if (cloudProjectId) {
        await updateProject(cloudProjectId, nodes, edges, simCfg, projectName);
      } else {
        const id = await saveProject(user.uid, projectName, nodes, edges, simCfg);
        setCloudProjectId(id);
      }
      toastBus.emit('Project saved to cloud ☁️', 'success');
    } catch (err) {
      console.error('Cloud save failed:', err);
      toastBus.emit('Cloud save failed — check Firestore rules', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [saveToLocalStorage, user, cloudProjectId, nodes, projectName, openLoginModal]);
  
  const handleLoad = useCallback(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);
  
  const handleClearAll = useCallback(() => {
    if (nodes.length === 0) return;
    if (showClearConfirm) {
      clearCanvas();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  }, [nodes.length, showClearConfirm, clearCanvas]);
  
  const triggerEvent = (event: 'serverCrash' | 'removeCache' | 'trafficSpike' | 'cdnFailure' | 'dbFailover' | 'regionOutage') => {
    setActiveSimulationEvent(event);
    setShowSimDropdown(false);
  };
  
  const triggerRegionOutage = () => {
    // Find group nodes that could be regions
    const groupNodes = nodes.filter(n => n.type === 'groupNode' || n.data.isGroup);
    if (groupNodes.length > 0) {
      setOutageRegionId(groupNodes[0].id);
    }
    triggerEvent('regionOutage');
  };
  
  const handleExportReport = async () => {
    if (nodes.length === 0) {
      toastBus.emit('Add components to canvas first', 'warning');
      return;
    }
    const { metrics } = runSimulation(nodes, useArchStore.getState().edges, simulationConfig, null);
    await generateArchitectureReport({
      nodes,
      edges: useArchStore.getState().edges,
      metrics,
      projectName,
      isWhiteLabel: isWhiteLabelReport,
      cloudProvider
    });
    setShowExportDropdown(false);
  };

  const currentCost = calculateTotalCost(nodes, edges);
  const rps = Math.round(simulationConfig.concurrentUsers * simulationConfig.rpsMultiplier);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportTfState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const { nodes: parsedNodes, edges: parsedEdges } = parseTfState(json);
        if (parsedNodes.length === 0) {
          toastBus.emit('No compatible AWS resources found in tfstate', 'warning');
          return;
        }
        setNodes(parsedNodes);
        setEdges(parsedEdges);
        toastBus.emit(`Imported ${parsedNodes.length} resources from tfstate`, 'success');
        // Give React a tick to update the DOM, then auto-layout
        setTimeout(() => runAutoLayout('LR'), 50);
      } catch (err) {
        toastBus.emit('Invalid terraform.tfstate file', 'error');
        console.error(err);
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowExportDropdown(false);
  };
  
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button 
          className="topbar-logo" 
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', padding: 0 }}
          title="Return to Landing Page"
        >
          <BrainCircuit size={20} className="logo-icon" />
          <span>ArchViz</span>
          <span className="beta-sign">β</span>
        </button>
        <div className="topbar-divider" />
        <button 
          className={`btn-icon ${!leftSidebarOpen ? 'active' : ''}`} 
          onClick={toggleLeftSidebar} 
          title={leftSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          <PanelLeft size={16} />
        </button>
        <div className="topbar-divider" />
        <input
          className="topbar-project-name"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          spellCheck={false}
        />
      </div>
      
      <div className="topbar-center">
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Users</span>
        <input
          type="range"
          className="form-range"
          min={0}
          max={userSteps.length - 1}
          value={currentStepIndex >= 0 ? currentStepIndex : 2}
          onChange={e => setSimulationConfig({ concurrentUsers: userSteps[Number(e.target.value)] })}
          style={{ width: 80 }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', minWidth: 40 }}>
          {formatUsers(simulationConfig.concurrentUsers)}
        </span>
        <div className="topbar-divider" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--accent)' }}>
          {rps.toLocaleString()} rps
        </span>
        <div className="topbar-divider" />
        <button
          onClick={() => setShowCostProjection(true)}
          title="Open Cost Projection Chart"
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: '#34d399', fontWeight: 'bold',
            background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)',
            borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.14)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.06)'; }}
        >
          {formatCost(currentCost)}/mo
          <TrendingUp size={11} />
        </button>
      </div>
      
      <div className="topbar-right">
        {/* Auto-Layout */}
        <button
          className="btn-icon"
          onClick={() => runAutoLayout('LR')}
          title="Auto-Layout (Organize Nodes)"
          style={nodes.length < 2 ? { opacity: 0.3, pointerEvents: 'none' as const } : {}}
        >
          <LayoutGrid size={16} />
        </button>
        <div className="topbar-divider" />
        {/* Undo / Redo */}
        <button
          className="btn-icon"
          onClick={undo}
          title="Undo (Ctrl+Z)"
          style={undoStack.length === 0 ? { opacity: 0.3, pointerEvents: 'none' as const } : {}}
        >
          <Undo2 size={16} />
        </button>
        <button
          className="btn-icon"
          onClick={redo}
          title="Redo (Ctrl+Y)"
          style={redoStack.length === 0 ? { opacity: 0.3, pointerEvents: 'none' as const } : {}}
        >
          <Redo2 size={16} />
        </button>
        
        <div className="topbar-divider" />
        
        <button className="btn" onClick={() => toggleTemplatePicker()}>
          <LayoutTemplate size={14} />
          Templates
        </button>
        
        <div className="topbar-divider" />
        
        {/* Simulate Dropdown */}
        <div className="sim-dropdown" ref={simRef}>
          <button className="btn" onClick={() => setShowSimDropdown(!showSimDropdown)}>
            <Play size={14} />
            Simulate
            <ChevronDown size={12} />
          </button>
          
          {showSimDropdown && (
            <div className="sim-dropdown-menu">
              <button className="sim-dropdown-item" onClick={() => triggerEvent('serverCrash')}>
                <ServerCrash size={16} />
                Server Crash
              </button>
              <button className="sim-dropdown-item" onClick={() => triggerEvent('removeCache')}>
                <Trash2 size={16} />
                Remove Cache
              </button>
              <button className="sim-dropdown-item" onClick={() => triggerEvent('trafficSpike')}>
                <Zap size={16} />
                Traffic Spike (10x)
              </button>
              <button className="sim-dropdown-item" onClick={() => triggerEvent('cdnFailure')}>
                <CloudOff size={16} />
                CDN Failure
              </button>
              <button className="sim-dropdown-item" onClick={() => triggerEvent('dbFailover')}>
                <DatabaseZap size={16} />
                Database Failover
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button className="sim-dropdown-item" onClick={triggerRegionOutage} style={{ color: '#ef4444' }}>
                <MapPin size={16} />
                Regional Outage (DR)
              </button>
            </div>
          )}
        </div>
        
        <div className="topbar-divider" />
        
        {/* Trace Request Flow */}
        <button
          className={`btn ${isTracing ? 'btn-trace-active' : ''}`}
          onClick={toggleTrace}
          title={isTracing ? 'Stop Tracing' : 'Trace Request Flow'}
          style={{
            background: isTracing ? 'rgba(94, 234, 212, 0.12)' : undefined,
            color: isTracing ? '#5eead4' : undefined,
            borderColor: isTracing ? 'rgba(94, 234, 212, 0.3)' : undefined,
            boxShadow: isTracing ? '0 0 12px rgba(94, 234, 212, 0.15)' : undefined,
          }}
        >
          <Activity size={14} style={isTracing ? { animation: 'pulse 1.5s ease-in-out infinite' } : undefined} />
          {isTracing ? 'Tracing...' : 'Trace Flow'}
        </button>
        
        {/* Export Dropdown — all actions gated behind auth */}
        <div className="sim-dropdown" ref={exportRef}>
          <button className="btn" onClick={() => setShowExportDropdown(!showExportDropdown)}>
            <Download size={14} />
            Export
            <ChevronDown size={12} />
          </button>
          
          {showExportDropdown && (
            <div className="sim-dropdown-menu" style={{ minWidth: '240px', padding: '8px', right: 0 }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', padding: '4px 8px 8px', fontWeight: 600 }}>
                Reports & Media
              </div>
              
              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                withAuth(() => handleExportReport(), 'PDF Report');
              }} style={{ fontWeight: 'bold', color: 'var(--accent)', background: 'var(--accent-subtle)', borderRadius: '6px' }}>
                <FileText size={16} />
                Premium Report (PDF)
              </button>
              
              <button className="sim-dropdown-item" onClick={() => toggleWhiteLabelReport()}>
                {isWhiteLabelReport ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} />}
                <span style={{ opacity: isWhiteLabelReport ? 1 : 0.7 }}>White-label PDF Export</span>
              </button>
              
              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                withAuth(() => { (window as unknown as Record<string, () => void>).__archviz_exportPNG?.(); }, 'PNG Image');
              }}>
                <Image size={16} />
                Export as PNG
              </button>
              
              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                withAuth(() => { (window as unknown as Record<string, () => void>).__archviz_exportJSON?.(); }, 'JSON');
              }}>
                <Download size={16} />
                Export as JSON
              </button>
              
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', padding: '4px 8px 8px', fontWeight: 600 }}>
                Infrastructure as Code
              </div>
              
              <button className="sim-dropdown-item" onClick={() => fileInputRef.current?.click()} style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.08)', borderRadius: '6px' }}>
                <Upload size={16} />
                Import terraform.tfstate
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                style={{ display: 'none' }}
                accept=".tfstate,.json"
                onChange={handleImportTfState} 
              />
              
              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                if (nodes.length === 0) { toastBus.emit('Add components to canvas first', 'warning'); return; }
                const errors = validateArchitecture(nodes, useArchStore.getState().edges);
                if (errors.length > 0) {
                  errors.forEach(err => toastBus.emit(err, 'error'));
                  return;
                }
                withAuth(() => { downloadTerraform(nodes, useArchStore.getState().edges, projectName, 'files'); toastBus.emit('Terraform files exported!', 'success'); }, 'Terraform');
              }}>
                <FileCode size={16} />
                Export Terraform Files
              </button>

              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                if (nodes.length === 0) { toastBus.emit('Add components to canvas first', 'warning'); return; }
                const errors = validateArchitecture(nodes, useArchStore.getState().edges);
                if (errors.length > 0) {
                  errors.forEach(err => toastBus.emit(err, 'error'));
                  return;
                }
                withAuth(() => { downloadTerraform(nodes, useArchStore.getState().edges, projectName, 'zip'); toastBus.emit('Terraform ZIP exported!', 'success'); }, 'Terraform ZIP');
              }}>
                <FileCode size={16} />
                Export Terraform ZIP
              </button>
              
              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                if (nodes.length === 0) { toastBus.emit('Add components to canvas first', 'warning'); return; }
                withAuth(() => { downloadCloudFormation(nodes, useArchStore.getState().edges, projectName); toastBus.emit('CloudFormation (.yaml) exported!', 'success'); }, 'CloudFormation');
              }}>
                <FileCode size={16} />
                Export to CloudFormation
              </button>
              
              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                if (nodes.length === 0) { toastBus.emit('Add components to canvas first', 'warning'); return; }
                withAuth(() => { downloadKubernetesManifests(nodes, useArchStore.getState().edges, projectName); toastBus.emit('K8s Manifests exported!', 'success'); }, 'Kubernetes Manifests');
              }}>
                <Container size={16} />
                Export K8s Manifests
              </button>

              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                if (nodes.length === 0) { toastBus.emit('Add components to canvas first', 'warning'); return; }
                withAuth(() => { downloadHelmChart(nodes, useArchStore.getState().edges, projectName); toastBus.emit('Helm Chart ZIP exported!', 'success'); }, 'Helm Chart');
              }} style={{ color: '#34d399', background: 'rgba(52,211,153,0.05)', borderRadius: '6px' }}>
                <Container size={16} />
                Export Helm Chart ZIP
              </button>
              
              <button className="sim-dropdown-item" onClick={() => {
                setShowExportDropdown(false);
                if (nodes.length === 0) { toastBus.emit('Add components to canvas first', 'warning'); return; }
                withAuth(() => { downloadDockerCompose(nodes, useArchStore.getState().edges, projectName); toastBus.emit('Docker Compose exported!', 'success'); }, 'Docker Compose');
              }}>
                <FileCode size={16} />
                Export Docker Compose
              </button>
            </div>
          )}
        </div>
        
        <div className="topbar-divider" />
        
        {/* Security Scan */}
        <button className="btn" onClick={toggleSecurityPanel} title="Security Scanner">
          <ShieldAlert size={14} />
          Security
        </button>
        
        {/* GreenOps Heatmap */}
        <button 
          className={`btn ${greenOpsHeatmap ? 'btn-active-green' : ''}`}
          onClick={toggleGreenOpsHeatmap} 
          title="GreenOps Carbon Heatmap"
          style={greenOpsHeatmap ? { background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' } : {}}
        >
          <Leaf size={14} />
          GreenOps
        </button>
        
        <div className="topbar-divider" />
        
        {/* More Actions Dropdown */}
        <div className="sim-dropdown" ref={moreRef}>
          <button className="btn-icon" onClick={() => setShowMoreDropdown(!showMoreDropdown)} title="More Actions">
            <MoreHorizontal size={16} />
          </button>
          
          {showMoreDropdown && (
            <div className="sim-dropdown-menu" style={{ right: 0, minWidth: '180px' }}>
              <button className="sim-dropdown-item" onClick={() => { handleSave(); setShowMoreDropdown(false); }}>
                <Save size={16} /> {isSaving ? 'Saving…' : 'Save Project'}
              </button>
              <button className="sim-dropdown-item" onClick={() => { handleLoad(); setShowMoreDropdown(false); }}>
                <Upload size={16} /> Load Project
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button className="sim-dropdown-item" onClick={() => { toggleVersionHistory(); setShowMoreDropdown(false); }}>
                <Clock size={16} /> Version History
              </button>
              <button className="sim-dropdown-item" onClick={() => { (window as unknown as Record<string, () => void>).__archviz_toggleFullscreen?.(); setShowMoreDropdown(false); }}>
                <Maximize size={16} /> Fullscreen
              </button>
              <button className="sim-dropdown-item" onClick={() => { (window as unknown as Record<string, () => void>).__archviz_toggleShortcuts?.(); setShowMoreDropdown(false); }}>
                <Keyboard size={16} /> Shortcuts
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button 
                className="sim-dropdown-item" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                  if (showClearConfirm) setShowMoreDropdown(false);
                }} 
                style={showClearConfirm ? { color: 'var(--danger)', background: 'var(--danger-muted)' } : { color: 'var(--danger)' }}
              >
                <XCircle size={16} /> 
                {showClearConfirm ? 'Click again to clear' : 'Clear Canvas'}
              </button>
            </div>
          )}
        </div>

        <div className="topbar-divider" />

        {/* User Auth area */}
        {user ? (
          <div className="topbar-user">
            <button
              className="topbar-user-btn"
              onClick={() => navigate('/dashboard')}
              title="My Projects (Dashboard)"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="topbar-avatar" />
              ) : (
                <div className="topbar-avatar-placeholder">
                  {(user.displayName ?? 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </button>
            <div className="topbar-user-dropdown">
              <button className="sim-dropdown-item" onClick={() => navigate('/dashboard')}>
                <LayoutDashboard size={14} /> My Projects
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button className="sim-dropdown-item" style={{ color: 'var(--danger)' }} onClick={async () => { await signOut(); navigate('/'); }}>
                <LogIn size={14} /> Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn"
            onClick={() => openLoginModal('Sign in to save and export your architecture')}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600 }}
          >
            <LogIn size={14} /> Sign In
          </button>
        )}
      </div>

      {/* Cost Projection Modal */}
      {showCostProjection && (
        <CostProjectionModal
          currentMonthlyCost={currentCost}
          currentRps={rps}
          onClose={() => setShowCostProjection(false)}
        />
      )}
    </div>
  );
}
