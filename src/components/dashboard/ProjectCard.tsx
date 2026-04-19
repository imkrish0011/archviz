import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreVertical, Trash2, Edit2, ExternalLink, Copy,
  BrainCircuit, Check, X, Clock, Server
} from 'lucide-react';
import type { CloudProject } from '../../types';
import { timeAgo } from '../../services/projectService';

interface ProjectCardProps {
  project: CloudProject;
  view?: 'grid' | 'list';
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  confirmingDelete?: boolean; // true = waiting for second click to confirm
}

/* ─── Context menu rendered in a portal at click coordinates ─── */
function ContextMenu({
  x, y,
  onOpen, onRename, onDelete, onDuplicate, onClose, confirmingDelete,
}: {
  x: number; y: number;
  onOpen: () => void; onRename: () => void;
  onDelete: () => void; onDuplicate: () => void;
  onClose: () => void;
  confirmingDelete?: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const MENU_W = 158;
  const MENU_H = 152;

  // Clamp so it never goes off-screen
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top  = y + MENU_H > window.innerHeight ? y - MENU_H : y;

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    // slight delay so the triggering click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handle); };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="pc-context-menu"
      style={{ position: 'fixed', top, left, zIndex: 99999 }}
      onClick={e => e.stopPropagation()}
    >
      <button className="pc-context-item" onClick={() => { onOpen(); onClose(); }}>
        <ExternalLink size={13} /> Open
      </button>
      <button className="pc-context-item" onClick={() => { onRename(); onClose(); }}>
        <Edit2 size={13} /> Rename
      </button>
      <button className="pc-context-item" onClick={() => { onDuplicate(); onClose(); }}>
        <Copy size={13} /> Duplicate
      </button>
      <div className="pc-context-sep" />
      <button
        className={`pc-context-item ${confirmingDelete ? 'pc-context-item--confirming' : 'pc-context-item--danger'}`}
        onClick={() => { onDelete(); if (confirmingDelete) onClose(); }}
      >
        <Trash2 size={13} />
        {confirmingDelete ? 'Click again to confirm' : 'Delete'}
      </button>
    </div>,
    document.body
  );
}

export default function ProjectCard({
  project, view = 'grid',
  onOpen, onDelete, onRename, onDuplicate, confirmingDelete
}: ProjectCardProps) {
  const [menuPos, setMenuPos]   = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    setMenuPos({ x: r.left, y: r.bottom + 4 });
  };

  const submitRename = () => {
    if (nameInput.trim() && nameInput.trim() !== project.name)
      onRename(project.id, nameInput.trim());
    setRenaming(false);
  };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submitRename();
    if (e.key === 'Escape') { setNameInput(project.name); setRenaming(false); }
  };

  const menu = menuPos ? (
    <ContextMenu
      x={menuPos.x} y={menuPos.y}
      onOpen={() => onOpen(project.id)}
      onRename={() => setRenaming(true)}
      onDuplicate={() => onDuplicate(project.id)}
      onDelete={() => onDelete(project.id)}
      onClose={() => setMenuPos(null)}
      confirmingDelete={confirmingDelete}
    />
  ) : null;

  /* ── LIST ROW ── */
  if (view === 'list') {
    return (
      <>
        <div className="pc-list-row" onDoubleClick={() => onOpen(project.id)}>
          <div className="pc-list-icon">
            {project.thumbnail
              ? <img src={project.thumbnail} alt="" className="pc-list-thumb" />
              : <BrainCircuit size={15} />
            }
          </div>
          <div className="pc-list-name-col">
            {renaming ? (
              <div className="pc-rename-row">
                <input className="pc-rename-input" value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={handleKey} autoFocus />
                <button className="pc-rename-btn" onClick={submitRename}><Check size={12}/></button>
                <button className="pc-rename-btn" onClick={() => { setNameInput(project.name); setRenaming(false); }}><X size={12}/></button>
              </div>
            ) : (
              <span className="pc-list-name">{project.name}</span>
            )}
          </div>
          <div className="pc-list-meta"><Clock size={11}/> {timeAgo(project.updatedAt)}</div>
          <div className="pc-list-meta"><Server size={11}/> {project.nodeCount} nodes</div>
          <div className="pc-list-actions">
            <button className="pc-action-btn" onClick={() => onOpen(project.id)} title="Open">
              <ExternalLink size={13}/>
            </button>
            <button className="pc-action-btn" onClick={openMenu}>
              <MoreVertical size={13}/>
            </button>
          </div>
        </div>
        {menu}
      </>
    );
  }

  /* ── GRID CARD ── */
  return (
    <>
      <div className="pc-card" onDoubleClick={() => onOpen(project.id)}>
        <div className="pc-thumb" onClick={() => onOpen(project.id)}>
          {project.thumbnail
            ? <img src={project.thumbnail} alt={project.name} className="pc-thumb-img"/>
            : (
              <div className="pc-thumb-placeholder">
                <BrainCircuit size={24} className="pc-thumb-icon"/>
                <div className="pc-thumb-nodes">{project.nodeCount} nodes</div>
              </div>
            )
          }
          <div className="pc-thumb-overlay">
            <div className="pc-open-pill"><ExternalLink size={12}/> Open</div>
          </div>
        </div>

        <div className="pc-footer">
          <div className="pc-footer-info">
            {renaming ? (
              <div className="pc-rename-row">
                <input className="pc-rename-input" value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={handleKey} autoFocus
                  onClick={e => e.stopPropagation()}/>
                <button className="pc-rename-btn" onClick={submitRename}><Check size={12}/></button>
                <button className="pc-rename-btn" onClick={() => { setNameInput(project.name); setRenaming(false); }}><X size={12}/></button>
              </div>
            ) : (
              <p className="pc-name">{project.name}</p>
            )}
            <div className="pc-meta">
              <Clock size={10}/> <span>{timeAgo(project.updatedAt)}</span>
              <span className="pc-dot">·</span>
              <Server size={10}/> <span>{project.nodeCount}</span>
            </div>
          </div>
          <button className="pc-menu-btn" onClick={openMenu}>
            <MoreVertical size={14}/>
          </button>
        </div>
      </div>
      {menu}
    </>
  );
}
