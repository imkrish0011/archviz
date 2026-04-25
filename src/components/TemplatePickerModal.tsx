import { useState, useRef, useCallback } from 'react';
import { useArchStore } from '../store/useArchStore';
import { gameTemplates, nonGameFamousTemplates } from '../data/templates/famousSystemTemplates';
import { starterTemplates } from '../data/templates/starterTemplates';
import { instantiateTemplate, loadTemplateWithAnimation } from '../utils/templateLoader';
import { X, Server, Rocket, Gamepad2 } from 'lucide-react';
import type { Template } from '../types';

export default function TemplatePickerModal() {
  const open = useArchStore(s => s.templatePickerOpen);
  const toggle = useArchStore(s => s.toggleTemplatePicker);
  const nodes = useArchStore(s => s.nodes);
  const loadTemplate = useArchStore(s => s.loadTemplate);
  const clearCanvas = useArchStore(s => s.clearCanvas);
  const setNodes = useArchStore(s => s.setNodes);
  const setEdges = useArchStore(s => s.setEdges);
  
  const [tab, setTab] = useState<'famous' | 'game' | 'starter'>('famous');
  const [confirmTemplate, setConfirmTemplate] = useState<Template | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // Declared BEFORE handleSelect to avoid 'accessed before declaration' error
  const applyTemplate = useCallback((template: Template) => {
    // Clean up any previous animation
    cleanupRef.current?.();
    
    // Load with staggered animation
    cleanupRef.current = loadTemplateWithAnimation(
      template,
      setNodes,
      setEdges,
      () => {
        // After animation completes, snapshot
        const { nodes: finalNodes, edges: finalEdges } = instantiateTemplate(template);
        loadTemplate(finalNodes, finalEdges);
      }
    );
    
    toggle();
    setConfirmTemplate(null);
  }, [setNodes, setEdges, loadTemplate, toggle]);
  
  const handleSelect = useCallback((template: Template) => {
    if (nodes.length > 0) {
      setConfirmTemplate(template);
    } else {
      applyTemplate(template);
    }
  }, [nodes.length, applyTemplate]);
  
  const handleConfirmReplace = useCallback(() => {
    if (confirmTemplate) {
      clearCanvas();
      setTimeout(() => applyTemplate(confirmTemplate), 50);
    }
  }, [confirmTemplate, clearCanvas, applyTemplate]);
  
  if (!open) return null;
  
  const templates = tab === 'famous' ? nonGameFamousTemplates : tab === 'game' ? gameTemplates : starterTemplates;
  
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) toggle(); }}>
      {confirmTemplate ? (
        <div className="modal" style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <span className="modal-title">Replace current architecture?</span>
            <button className="btn-icon" onClick={() => setConfirmTemplate(null)}>
              <X size={16} />
            </button>
          </div>
          <div className="modal-body" style={{ padding: 'var(--space-5)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Loading <strong style={{ color: 'var(--text-primary)' }}>{confirmTemplate.name}</strong> will replace your current canvas. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirmTemplate(null)}>Cancel</button>
              <button className="btn btn-accent" onClick={handleConfirmReplace}>Replace</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">Architecture Templates</span>
            <button className="btn-icon" onClick={toggle}>
              <X size={16} />
            </button>
          </div>
          
          <div className="modal-tabs">
            <button 
              className={`modal-tab ${tab === 'famous' ? 'active' : ''}`}
              onClick={() => setTab('famous')}
            >
              <Server size={14} style={{ marginRight: 6 }} />
              Famous Systems
            </button>
            <button 
              className={`modal-tab modal-tab-game ${tab === 'game' ? 'active' : ''}`}
              onClick={() => setTab('game')}
            >
              <Gamepad2 size={14} style={{ marginRight: 6 }} />
              Games
            </button>
            <button 
              className={`modal-tab ${tab === 'starter' ? 'active' : ''}`}
              onClick={() => setTab('starter')}
            >
              <Rocket size={14} style={{ marginRight: 6 }} />
              Starter Templates
            </button>
          </div>
          
          <div className="modal-body">
            <div className="template-grid">
              {templates.map(template => (
                <div 
                  key={template.id} 
                  className="template-card"
                  onClick={() => handleSelect(template)}
                >
                  <div className="template-card-name">{template.name}</div>
                  <div className="template-card-desc">{template.description}</div>
                  <div className="template-card-meta">
                    <span>{template.nodeCount} nodes</span>
                    <span className="template-card-cost">~${template.baselineCost}/mo</span>
                  </div>
                </div>
              ))}
            </div>
            
            {tab === 'famous' && (
              <p style={{ 
                marginTop: 'var(--space-4)', 
                fontSize: 'var(--text-xs)', 
                color: 'var(--text-tertiary)', 
                textAlign: 'center',
                lineHeight: 1.6
              }}>
                Click any template to load it. Each node includes real architectural reasoning — click a node to read why each technology was chosen.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
