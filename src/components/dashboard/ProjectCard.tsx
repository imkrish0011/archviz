import { useState } from 'react';
import { MoreVertical, Trash2, Edit2, ExternalLink, Copy, BrainCircuit, Check, X } from 'lucide-react';
import type { CloudProject } from '../../types';
import { timeAgo } from '../../services/projectService';

interface ProjectCardProps {
  project: CloudProject;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
}

export default function ProjectCard({ project, onOpen, onDelete, onRename, onDuplicate }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);

  const handleRenameSubmit = () => {
    if (nameInput.trim() && nameInput.trim() !== project.name) {
      onRename(project.id, nameInput.trim());
    }
    setRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') { setNameInput(project.name); setRenaming(false); }
  };

  return (
    <div className="project-card" onDoubleClick={() => onOpen(project.id)}>
      {/* Thumbnail */}
      <div className="project-card-thumb" onClick={() => onOpen(project.id)}>
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} className="project-card-thumb-img" />
        ) : (
          <div className="project-card-thumb-placeholder">
            <BrainCircuit size={32} className="project-card-thumb-icon" />
            <span className="project-card-thumb-label">{project.nodeCount} nodes</span>
          </div>
        )}
        <div className="project-card-thumb-overlay">
          <span className="project-card-open-hint">
            <ExternalLink size={14} /> Open
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="project-card-footer">
        <div className="project-card-info">
          {renaming ? (
            <div className="project-card-rename">
              <input
                className="project-card-rename-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button className="project-card-rename-btn" onClick={handleRenameSubmit} title="Confirm">
                <Check size={13} />
              </button>
              <button className="project-card-rename-btn" onClick={() => { setNameInput(project.name); setRenaming(false); }} title="Cancel">
                <X size={13} />
              </button>
            </div>
          ) : (
            <p className="project-card-name" title={project.name}>{project.name}</p>
          )}
          <div className="project-card-meta">
            <span>{timeAgo(project.updatedAt)}</span>
            <span className="project-card-dot">·</span>
            <span>{project.nodeCount} nodes</span>
          </div>
        </div>

        {/* Context menu */}
        <div className="project-card-menu-wrap">
          <button
            className="project-card-menu-btn"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            title="Options"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="project-card-menu" onClick={(e) => e.stopPropagation()}>
              <button className="project-card-menu-item" onClick={() => { onOpen(project.id); setMenuOpen(false); }}>
                <ExternalLink size={14} /> Open
              </button>
              <button className="project-card-menu-item" onClick={() => { setRenaming(true); setMenuOpen(false); }}>
                <Edit2 size={14} /> Rename
              </button>
              <button className="project-card-menu-item" onClick={() => { onDuplicate(project.id); setMenuOpen(false); }}>
                <Copy size={14} /> Duplicate
              </button>
              <div className="project-card-menu-sep" />
              <button className="project-card-menu-item danger" onClick={() => { onDelete(project.id); setMenuOpen(false); }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
