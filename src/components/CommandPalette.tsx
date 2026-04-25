import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, Plus, Undo2, Redo2, Download, Image, Layout, Trash2, Eye, Layers, Keyboard, Play, Settings } from 'lucide-react';
import { useArchStore } from '../store/useArchStore';
import componentLibrary from '../data/componentLibrary';
import type { ComponentDefinition } from '../types';

/* ─────────────────────────────────────────────────────────
 *  Command Palette — Ctrl+K
 *  Figma-style command search with fuzzy matching
 * ───────────────────────────────────────────────────────── */

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ComponentType<{ size?: number }>;
  category: 'action' | 'component' | 'navigation';
  action: () => void;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Store actions
  const undo = useArchStore(s => s.undo);
  const redo = useArchStore(s => s.redo);
  const clearCanvas = useArchStore(s => s.clearCanvas);
  const autoLayout = useArchStore(s => s.runAutoLayout);
  const toggleTemplatePicker = useArchStore(s => s.toggleTemplatePicker);
  const addNode = useArchStore(s => s.addNode);
  const toggleTracing = useArchStore(s => s.toggleTrace);
  const toggleRecommendationPanel = useArchStore(s => s.toggleRecommendationPanel);

  // Open / close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Build commands list
  const commands = useMemo<Command[]>(() => {
    const actionCommands: Command[] = [
      { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: Undo2, category: 'action', action: () => { undo(); setOpen(false); } },
      { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', icon: Redo2, category: 'action', action: () => { redo(); setOpen(false); } },
      { id: 'clear', label: 'Clear Canvas', icon: Trash2, category: 'action', action: () => { clearCanvas(); setOpen(false); } },
      { id: 'layout', label: 'Auto Layout', icon: Layout, category: 'action', action: () => { autoLayout('TB'); setOpen(false); } },
      { id: 'templates', label: 'Open Templates', icon: Layers, category: 'navigation', action: () => { toggleTemplatePicker(); setOpen(false); } },
      { id: 'trace', label: 'Toggle Data Tracing', shortcut: 'T', icon: Play, category: 'action', action: () => { toggleTracing(); setOpen(false); } },
      { id: 'export-png', label: 'Export as PNG', shortcut: 'Ctrl+E', icon: Image, category: 'action', action: () => {
        window.dispatchEvent(new CustomEvent('archviz-export-png'));
        setOpen(false);
      }},
      { id: 'export-json', label: 'Export as JSON', icon: Download, category: 'action', action: () => {
        window.dispatchEvent(new CustomEvent('archviz-export-json'));
        setOpen(false);
      }},
      { id: 'recommendations', label: 'View Recommendations', icon: Eye, category: 'navigation', action: () => { toggleRecommendationPanel(); setOpen(false); } },
      { id: 'shortcuts', label: 'Keyboard Shortcuts', shortcut: '?', icon: Keyboard, category: 'navigation', action: () => {
        const fn = (window as unknown as Record<string, unknown>).__archviz_toggleShortcuts;
        if (typeof fn === 'function') fn();
        setOpen(false);
      }},
      { id: 'fullscreen', label: 'Toggle Fullscreen', shortcut: 'F11', icon: Settings, category: 'action', action: () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
        setOpen(false);
      }},
    ];

    // Add components as commands
    const componentCommands: Command[] = componentLibrary.map((comp: ComponentDefinition) => ({
      id: `add-${comp.type}`,
      label: `Add ${comp.label}`,
      icon: Plus,
      category: 'component' as const,
      action: () => {
        addNode(comp.type, { x: 400 + Math.random() * 200, y: 300 + Math.random() * 200 });
        setOpen(false);
      },
    }));

    return [...actionCommands, ...componentCommands];
  }, [undo, redo, clearCanvas, autoLayout, toggleTemplatePicker, addNode, toggleTracing, toggleRecommendationPanel]);

  // Filter commands
  const filtered = useMemo(() => {
    if (!query) return commands.filter(c => c.category !== 'component').slice(0, 12);
    const q = query.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q)).slice(0, 15);
  }, [query, commands]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    }
  }, [filtered, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Search size={16} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a command or search components..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <kbd className="cmd-esc">ESC</kbd>
          <button className="btn-icon" onClick={() => setOpen(false)}>
            <X size={14} />
          </button>
        </div>
        
        <div className="cmd-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="cmd-empty">No commands found</div>
          )}
          {filtered.map((cmd, idx) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                className={`cmd-item ${idx === selectedIndex ? 'cmd-item-active' : ''}`}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="cmd-item-left">
                  <Icon size={14} />
                  <span className="cmd-item-label">{cmd.label}</span>
                  {cmd.category === 'component' && (
                    <span className="cmd-item-badge">Component</span>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="cmd-shortcut">{cmd.shortcut}</kbd>
                )}
              </button>
            );
          })}
        </div>

        <div className="cmd-footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
