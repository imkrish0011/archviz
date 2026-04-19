import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Plus, Search, LogOut, Grid, Clock, SortAsc, Loader2, FolderOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { listProjects, deleteProject, renameProject, saveProject } from '../../services/projectService';
import type { CloudProject } from '../../types';
import ProjectCard from './ProjectCard';

type SortMode = 'updated' | 'created' | 'name';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('updated');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listProjects(user.uid);
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleNewProject = () => {
    navigate('/app');
  };

  const handleOpen = (id: string) => {
    navigate(`/app/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await renameProject(id, name);
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    } catch (err) {
      console.error('Rename failed', err);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!user) return;
    const original = projects.find((p) => p.id === id);
    if (!original) return;
    try {
      const newId = await saveProject(
        user.uid,
        `${original.name} (copy)`,
        [], [], // nodes/edges not in list view — open then duplicate later
        { concurrentUsers: 1000, rpsMultiplier: 0.1, cacheHitRate: 0.6 },
        original.thumbnail
      );
      // Refresh list
      fetchProjects();
      navigate(`/app/${newId}`);
    } catch (err) {
      console.error('Duplicate failed', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Filtered + sorted
  const filtered = projects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'created') return b.createdAt.getTime() - a.createdAt.getTime();
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="dashboard">
      {/* ── Sidebar ── */}
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-logo">
          <BrainCircuit size={22} className="logo-icon" />
          <span>ArchViz</span>
        </div>
        <nav className="dashboard-sidebar-nav">
          <button className="dashboard-nav-item active">
            <Grid size={16} /> All Projects
          </button>
          <button className="dashboard-nav-item">
            <Clock size={16} /> Recent
          </button>
        </nav>
        <div className="dashboard-sidebar-footer">
          <div className="dashboard-user-chip">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="dashboard-avatar" />
            ) : (
              <div className="dashboard-avatar-placeholder">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="dashboard-user-info">
              <span className="dashboard-user-name">{user?.displayName ?? 'User'}</span>
              <span className="dashboard-user-email">{user?.email}</span>
            </div>
          </div>
          <button className="dashboard-signout-btn" onClick={handleSignOut} title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="dashboard-main">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Good to see you, {firstName} 👋</h1>
            <p className="dashboard-subtitle">
              {projects.length > 0
                ? `You have ${projects.length} architecture project${projects.length !== 1 ? 's' : ''}`
                : 'Start by creating your first architecture diagram'}
            </p>
          </div>
          <button className="dashboard-new-btn" onClick={handleNewProject}>
            <Plus size={16} /> New Project
          </button>
        </div>

        {/* Toolbar */}
        <div className="dashboard-toolbar">
          <div className="dashboard-search-wrap">
            <Search size={15} className="dashboard-search-icon" />
            <input
              className="dashboard-search"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="dashboard-sort">
            <SortAsc size={14} />
            <select
              className="dashboard-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="updated">Last edited</option>
              <option value="created">Created</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading your projects...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dashboard-empty">
            <FolderOpen size={52} className="dashboard-empty-icon" />
            <h3 className="dashboard-empty-title">
              {search ? 'No projects match your search' : 'No projects yet'}
            </h3>
            <p className="dashboard-empty-sub">
              {search ? 'Try a different search term' : 'Create your first architecture diagram to get started'}
            </p>
            {!search && (
              <button className="dashboard-new-btn" onClick={handleNewProject}>
                <Plus size={16} /> Create first project
              </button>
            )}
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* "New Project" card always first */}
            <div className="project-card project-card--new" onClick={handleNewProject}>
              <div className="project-card-new-inner">
                <div className="project-card-new-icon">
                  <Plus size={28} />
                </div>
                <span>New Project</span>
              </div>
            </div>

            {filtered.map((project) => (
              <div key={project.id} style={{ opacity: deleting === project.id ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                <ProjectCard
                  project={project}
                  onOpen={handleOpen}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
