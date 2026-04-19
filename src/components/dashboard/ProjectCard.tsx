import { useState } from 'react';
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
}

export default function ProjectCard({
  project, view = 'grid',
  onOpen, onDelete, onRename, onDuplicate
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);

  const handleRenameSubmit = () => {
    if (nameInput.trim() && nameInput.trim() !== project.name) onRename(project.id, nameInput.trim());
    setRenaming(false);
  };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') { setNameInput(project.name); setRenaming(false); }
  };

  if (view === 'list') {
    return (
      <div className="pc-list-row" onDoubleClick={() => onOpen(project.id)}>
        {/* Icon */}
        <div className="pc-list-icon">
          {project.thumbnail
            ? <img src={project.thumbnail} alt="" className="pc-list-thumb" />
            : <BrainCircuit size={16} />
          }
        </div>
        {/* Name */}
        <div className="pc-list-name-col">
          {renaming ? (
            <div className="pc-rename-row">
              <input className="pc-rename-input" value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={handleKey} autoFocus />
              <button className="pc-rename-btn" onClick={handleRenameSubmit}><Check size={12} /></button>
              <button className="pc-rename-btn" onClick={() => { setNameInput(project.name); setRenaming(false); }}><X size={12} /></button>
            </div>
          ) : (
            <span className="pc-list-name">{project.name}</span>
          )}
        </div>
        {/* Meta */}
        <div className="pc-list-meta">
          <Clock size={11} /> {timeAgo(project.updatedAt)}
        </div>
        <div className="pc-list-meta">
          <Server size={11} /> {project.nodeCount} nodes
        </div>
        {/* Actions */}
        <div className="pc-list-actions">
          <button className="pc-action-btn" onClick={() => onOpen(project.id)} title="Open">
            <ExternalLink size={13} />
          </button>
          <div className="pc-menu-wrap">
            <button className="pc-action-btn" onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
              <MoreVertical size={13} />
            </button>
            {menuOpen && <ContextMenu project={project} onRename={() => { setRenaming(true); setMenuOpen(false); }} onDelete={() => { onDelete(project.id); setMenuOpen(false); }} onDuplicate={() => { onDuplicate(project.id); setMenuOpen(false); }} onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </div>
    );
  }

  /* ─── GRID CARD ─── */
  return (
    <div className="pc-card" onDoubleClick={() => onOpen(project.id)}>
      {/* Thumbnail */}
      <div className="pc-thumb" onClick={() => onOpen(project.id)}>
        {project.thumbnail
          ? <img src={project.thumbnail} alt={project.name} className="pc-thumb-img" />
          : (
            <div className="pc-thumb-placeholder">
              <BrainCircuit size={28} className="pc-thumb-icon" />
              <div className="pc-thumb-nodes">{project.nodeCount} nodes</div>
            </div>
          )
        }
        {/* Hover overlay */}
        <div className="pc-thumb-overlay">
          <div className="pc-open-pill">
            <ExternalLink size={12} /> Open
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="pc-footer">
        <div className="pc-footer-info">
          {renaming ? (
            <div className="pc-rename-row">
              <input className="pc-rename-input" value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={handleKey} autoFocus onClick={e => e.stopPropagation()} />
              <button className="pc-rename-btn" onClick={handleRenameSubmit}><Check size={12} /></button>
              <button className="pc-rename-btn" onClick={() => { setNameInput(project.name); setRenaming(false); }}><X size={12} /></button>
            </div>
          ) : (
            <p className="pc-name">{project.name}</p>
          )}
          <div className="pc-meta">
            <Clock size={10} />
            <span>{timeAgo(project.updatedAt)}</span>
            <span className="pc-dot">·</span>
            <Server size={10} />
            <span>{project.nodeCount}</span>
          </div>
        </div>
        <div className="pc-menu-wrap">
          <button className="pc-menu-btn" onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
            <MoreVertical size={14} />
          </button>
          {menuOpen && <ContextMenu project={project} onRename={() => { setRenaming(true); setMenuOpen(false); }} onDelete={() => { onDelete(project.id); setMenuOpen(false); }} onDuplicate={() => { onDuplicate(project.id); setMenuOpen(false); }} onClose={() => setMenuOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

function ContextMenu({ project, onRename, onDelete, onDuplicate, onClose }: {
  project: CloudProject;
  onRename: () => void; onDelete: () => void;
  onDuplicate: () => void; onClose: () => void;
}) {
  return (
    <div className="pc-context-menu" onClick={e => e.stopPropagation()}>
      <button className="pc-context-item" onClick={() => { onClose(); }}>
        <ExternalLink size={13} /> Open
      </button>
      <button className="pc-context-item" onClick={onRename}>
        <Edit2 size={13} /> Rename
      </button>
      <button className="pc-context-item" onClick={onDuplicate}>
        <Copy size={13} /> Duplicate
      </button>
      <div className="pc-context-sep" />
      <button className="pc-context-item pc-context-item--danger" onClick={onDelete}>
        <Trash2 size={13} /> Delete
      </button>
    </div>
  );
}
