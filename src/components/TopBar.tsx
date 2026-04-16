import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArchStore } from '../store/useArchStore';
import {
  Save, Upload, Clock, LayoutTemplate, Play, ChevronDown,
  Zap, ServerCrash, Trash2, CloudOff, DatabaseZap, XCircle,
  PanelLeft, Undo2, Redo2, Download, Image, Maximize, Keyboard,
  BrainCircuit, ShieldAlert, FileCode, LayoutGrid,
} from 'lucide-react';
import { downloadTerraform, downloadCloudFormation } from '../engine/terraformGenerator';
import { toastBus } from './ToastSystem';

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
  const undo = useArchStore(s => s.undo);
  const redo = useArchStore(s => s.redo);
  const undoStack = useArchStore(s => s.undoStack);
  const redoStack = useArchStore(s => s.redoStack);
  const toggleSecurityPanel = useArchStore(s => s.toggleSecurityPanel);
  const runAutoLayout = useArchStore(s => s.runAutoLayout);
  const navigate = useNavigate();
  
  const [showSimDropdown, setShowSimDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const simRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  
  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (simRef.current && !simRef.current.contains(e.target as Node)) {
        setShowSimDropdown(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false);
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
  
  const handleSave = useCallback(() => {
    saveToLocalStorage();
  }, [saveToLocalStorage]);
  
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
  
  const triggerEvent = (event: 'serverCrash' | 'removeCache' | 'trafficSpike' | 'cdnFailure' | 'dbFailover') => {
    setActiveSimulationEvent(event);
    setShowSimDropdown(false);
  };
  
  const rps = Math.round(simulationConfig.concurrentUsers * simulationConfig.rpsMultiplier);
  
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
          style={{ width: 120 }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', minWidth: 40 }}>
          {formatUsers(simulationConfig.concurrentUsers)}
        </span>
        <div className="topbar-divider" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--accent)' }}>
          {rps.toLocaleString()} rps
        </span>
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
            </div>
          )}
        </div>
        
        <div className="topbar-divider" />
        
        {/* Export Dropdown */}
        <div className="sim-dropdown" ref={exportRef}>
          <button className="btn" onClick={() => setShowExportDropdown(!showExportDropdown)}>
            <Download size={14} />
            Export
            <ChevronDown size={12} />
          </button>
          
          {showExportDropdown && (
            <div className="sim-dropdown-menu">
              <button className="sim-dropdown-item" onClick={() => { (window as any).__archviz_exportPNG?.(); setShowExportDropdown(false); }}>
                <Image size={16} />
                Export as PNG
              </button>
              <button className="sim-dropdown-item" onClick={() => { (window as any).__archviz_exportJSON?.(); setShowExportDropdown(false); }}>
                <Download size={16} />
                Export as JSON
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button className="sim-dropdown-item" onClick={() => {
                if (nodes.length === 0) { toastBus.emit('Add components to canvas first', 'warning'); }
                else { downloadTerraform(nodes, useArchStore.getState().edges, projectName); toastBus.emit('Terraform (.tf) exported!', 'success'); }
                setShowExportDropdown(false);
              }}>
                <FileCode size={16} />
                Export to Terraform
              </button>
              <button className="sim-dropdown-item" onClick={() => {
                if (nodes.length === 0) { toastBus.emit('Add components to canvas first', 'warning'); }
                else { downloadCloudFormation(nodes, useArchStore.getState().edges, projectName); toastBus.emit('CloudFormation (.json) exported!', 'success'); }
                setShowExportDropdown(false);
              }}>
                <FileCode size={16} />
                Export to CloudFormation
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
        
        <div className="topbar-divider" />
        
        {/* Clear All */}
        <button 
          className="btn-icon" 
          onClick={handleClearAll} 
          title={showClearConfirm ? 'Click again to confirm' : 'Clear canvas'}
          style={showClearConfirm ? { color: 'var(--danger)', background: 'var(--danger-muted)' } : nodes.length === 0 ? { opacity: 0.3, pointerEvents: 'none' as const } : {}}
        >
          <XCircle size={16} />
        </button>
        
        <button className="btn-icon" onClick={handleSave} title="Save (Ctrl+S)">
          <Save size={16} />
        </button>
        <button className="btn-icon" onClick={handleLoad} title="Load">
          <Upload size={16} />
        </button>
        <button className="btn-icon" onClick={toggleVersionHistory} title="Version History">
          <Clock size={16} />
        </button>
        <button className="btn-icon" onClick={() => (window as any).__archviz_toggleFullscreen?.()} title="Fullscreen (F11)">
          <Maximize size={16} />
        </button>
        <button className="btn-icon" title="Shortcuts (?)" onClick={() => (window as any).__archviz_toggleShortcuts?.()}>
          <Keyboard size={16} />
        </button>
      </div>
    </div>
  );
}
