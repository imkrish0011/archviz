import { useState, useCallback, useRef, useEffect } from 'react';
import { getAllCategories, getComponentsByCategory, getCategoryLabel } from '../data/componentLibrary';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useArchStore } from '../store/useArchStore';
import { useReactFlow } from '@xyflow/react';
import { snippetTemplates } from '../data/templates/snippets';

function getIcon(name: string): React.ComponentType<{ size?: number; className?: string }> {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    return icon as React.ComponentType<{ size?: number; className?: string }>;
  }
  return Icons.Box;
}

export default function LeftSidebar() {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addNode = useArchStore(s => s.addNode);
  const reactFlowInstance = useReactFlow();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const categories = getAllCategories();
  
  const onDragStart = useCallback((event: React.DragEvent, componentType: string) => {
    event.dataTransfer.setData('application/archviz-component', componentType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onSnippetDragStart = useCallback((event: React.DragEvent, snippetId: string) => {
    event.dataTransfer.setData('application/archviz-snippet', snippetId);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDoubleClick = useCallback((componentType: string) => {
    // Get center of current viewport
    const { x, y, zoom } = reactFlowInstance.getViewport();
    const canvasEl = document.querySelector('.react-flow') as HTMLElement;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const centerX = (rect.width / 2 - x) / zoom;
    const centerY = (rect.height / 2 - y) / zoom;
    // Add slight random offset to prevent stacking
    const offsetX = (Math.random() - 0.5) * 120;
    const offsetY = (Math.random() - 0.5) * 80;
    addNode(componentType, { x: centerX + offsetX, y: centerY + offsetY });
  }, [reactFlowInstance, addNode]);
  
  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };
  
  return (
    <div className="left-sidebar">
      <div className="sidebar-search">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-disabled)' }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, paddingRight: 40 }}
          />
          <div style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: '10px', color: 'var(--text-disabled)', background: 'var(--bg-active)',
            padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)',
            pointerEvents: 'none', fontFamily: 'var(--font-mono)'
          }}>
            ⌘K
          </div>
        </div>
      </div>
      
      {categories.map(cat => {
        const components = getComponentsByCategory(cat).filter(c => 
          search === '' || c.label.toLowerCase().includes(search.toLowerCase()) || c.type.toLowerCase().includes(search.toLowerCase())
        );
        
        if (components.length === 0) return null;
        
        const isCollapsed = collapsed[cat];
        
        return (
          <div key={cat} className="sidebar-category">
            <div className="sidebar-category-header" onClick={() => toggleCategory(cat)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className={`sidebar-category-dot ${cat}`} />
                <span className="sidebar-category-title">{getCategoryLabel(cat)}</span>
              </div>
              <span className="sidebar-category-count">{components.length}</span>
            </div>
            
            {!isCollapsed && (
              <div className="sidebar-grid">
                {components.map(comp => {
                  const IconComp = getIcon(comp.icon);
                  return (
                    <div
                      key={comp.type}
                      className="sidebar-grid-item"
                      data-category={cat}
                      draggable
                      onDragStart={e => onDragStart(e, comp.type)}
                      onDoubleClick={() => handleDoubleClick(comp.type)}
                      title={`${comp.label}\nLat: ${comp.baseLatency}ms\n\n${comp.description}\n\nDrag or double-click to add`}
                    >
                      <div className="sidebar-grid-icon">
                        <IconComp size={16} />
                      </div>
                      <span>{comp.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Snippets Section */}
      <div className="sidebar-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />
      <div className="sidebar-category">
        <div className="sidebar-category-header" onClick={() => toggleCategory('snippets')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {collapsed['snippets'] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span className="sidebar-category-title" style={{ color: 'var(--accent)' }}>Architecture Snippets</span>
          </div>
          <span className="sidebar-category-count" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
            {snippetTemplates.length}
          </span>
        </div>
        
        {!collapsed['snippets'] && (
          <div className="sidebar-grid" style={{ gridTemplateColumns: '1fr' }}>
            {snippetTemplates.filter(s => search === '' || s.name.toLowerCase().includes(search.toLowerCase())).map(snippet => (
              <div
                key={snippet.id}
                className="sidebar-grid-item"
                style={{ flexDirection: 'row', justifyContent: 'flex-start', padding: '8px 12px' }}
                draggable
                onDragStart={e => onSnippetDragStart(e, snippet.id)}
                title={`${snippet.name}\n${snippet.description}\nDrag to add this pattern to your canvas`}
              >
                <div className="sidebar-grid-icon" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  <Icons.LayoutTemplate size={16} />
                </div>
                <div style={{ display: 'flex', flex: '1', flexDirection: 'column', gap: 2, textAlign: 'left', overflow: 'hidden' }}>
                  <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{snippet.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{snippet.nodeCount} components</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
