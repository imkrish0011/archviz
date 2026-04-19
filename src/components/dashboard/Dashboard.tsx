import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainCircuit, Plus, Search, LogOut, Grid3X3, Clock,
  Loader2, FolderOpen, Server, MoreVertical, ArrowRight,
  Zap, Activity, Star, Calendar, Layout, Sparkles
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { listProjects, deleteProject, renameProject, saveProject } from '../../services/projectService';
import type { CloudProject } from '../../types';
import ProjectCard from './ProjectCard';

type SortMode = 'updated' | 'created' | 'name';
type ViewMode = 'grid' | 'list';

/* ── Intersection Observer for scroll animations ── */
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function AnimatedEntry({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>
      {children}
    </div>
  );
}

/* ── Stats pill ── */
function StatPill({ icon: Icon, value, label }: { icon: any; value: string | number; label: string }) {
  return (
    <div className="db-stat-pill">
      <div className="db-stat-icon"><Icon size={14} /></div>
      <div>
        <div className="db-stat-value">{value}</div>
        <div className="db-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('updated');
  const [view, setView] = useState<ViewMode>('grid');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleNewProject = () => navigate('/app');
  const handleOpen = (id: string) => navigate(`/app/${id}`);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) { console.error(err); }
    finally { setDeleting(null); }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await renameProject(id, name);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    } catch (err) { console.error(err); }
  };

  const handleDuplicate = async (id: string) => {
    if (!user) return;
    const original = projects.find(p => p.id === id);
    if (!original) return;
    try {
      await saveProject(user.uid, `${original.name} (copy)`, [], [],
        { concurrentUsers: 1000, rpsMultiplier: 0.1, cacheHitRate: 0.6 }, original.thumbnail);
      fetchProjects();
    } catch (err) { console.error(err); }
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const filtered = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'created') return b.createdAt.getTime() - a.createdAt.getTime();
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  const firstName = user?.displayName?.split(' ')[0] ?? 'there';
  const totalNodes = projects.reduce((s, p) => s + p.nodeCount, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="db-root">
      {/* ── Background ── */}
      <div className="db-bg-grid" />
      <div className="db-bg-orb db-bg-orb-1" />
      <div className="db-bg-orb db-bg-orb-2" />

      {/* ══════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════ */}
      <aside className="db-sidebar">
        {/* Logo */}
        <div className="db-sidebar-logo">
          <div className="db-sidebar-logo-icon">
            <BrainCircuit size={18} />
          </div>
          <span className="db-sidebar-logo-text">ArchViz</span>
          <div className="db-sidebar-logo-dot" />
        </div>

        {/* Nav */}
        <nav className="db-sidebar-nav">
          <div className="db-nav-section-label">Workspace</div>
          <button className="db-nav-item db-nav-item--active">
            <Grid3X3 size={15} />
            <span>All Projects</span>
          </button>
          <button className="db-nav-item">
            <Clock size={15} />
            <span>Recent</span>
          </button>
          <button className="db-nav-item">
            <Star size={15} />
            <span>Starred</span>
          </button>

          <div className="db-nav-divider" />
          <div className="db-nav-section-label">Quick Start</div>

          <button className="db-nav-item db-nav-item--accent" onClick={handleNewProject}>
            <Plus size={15} />
            <span>New Project</span>
          </button>
        </nav>

        {/* Stats */}
        <div className="db-sidebar-stats">
          <StatPill icon={Layout} value={projects.length} label="Projects" />
          <StatPill icon={Server} value={totalNodes} label="Total Nodes" />
        </div>

        {/* User */}
        <div className="db-sidebar-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
          <div className="db-user-avatar-wrap">
            {user?.photoURL
              ? <img src={user.photoURL} alt="avatar" className="db-user-avatar" />
              : <div className="db-user-avatar-placeholder">{firstName.charAt(0).toUpperCase()}</div>
            }
            <div className="db-user-status-dot" />
          </div>
          <div className="db-user-info">
            <span className="db-user-name">{user?.displayName ?? 'User'}</span>
            <span className="db-user-role">Pro Account</span>
          </div>
          <MoreVertical size={14} className="db-user-more" />

          {userMenuOpen && (
            <div className="db-user-menu" onClick={e => e.stopPropagation()}>
              <button className="db-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                <Activity size={13} /> Account
              </button>
              <div className="db-user-menu-sep" />
              <button className="db-user-menu-item db-user-menu-item--danger" onClick={handleSignOut}>
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════ */}
      <main className="db-main">

        {/* ── Top bar ── */}
        <header className="db-topbar">
          <div />
          <div className="db-topbar-search-wrap">
            <Search size={14} className="db-topbar-search-icon" />
            <input
              className="db-topbar-search"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="db-topbar-actions">
            <button
              className={`db-view-btn ${view === 'grid' ? 'active' : ''}`}
              onClick={() => setView('grid')}
              title="Grid view"
            >
              <Grid3X3 size={14} />
            </button>
            <button
              className={`db-view-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
              title="List view"
            >
              <Layout size={14} />
            </button>
            <select
              className="db-sort-select"
              value={sort}
              onChange={e => setSort(e.target.value as SortMode)}
            >
              <option value="updated">Last edited</option>
              <option value="created">Date created</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </header>

        {/* ── Hero greeting ── */}
        <AnimatedEntry delay={0}>
          <section className="db-hero">
            <div className="db-hero-text">
              <div className="db-hero-badge">
                <Sparkles size={12} />
                {greeting}, {firstName}
              </div>
              <h1 className="db-hero-title">
                Your Architecture <br />
                <span className="db-hero-title-accent">Command Center</span>
              </h1>
              <p className="db-hero-sub">
                {projects.length > 0
                  ? `${projects.length} project${projects.length !== 1 ? 's' : ''} · ${totalNodes} components designed`
                  : 'Start designing your first cloud architecture.'
                }
              </p>
            </div>
            <button className="db-hero-cta" onClick={handleNewProject}>
              <Plus size={16} />
              New Project
              <ArrowRight size={14} style={{ opacity: 0.6 }} />
            </button>
          </section>
        </AnimatedEntry>

        {/* ── Projects section ── */}
        <section className="db-projects-section">
          <AnimatedEntry delay={0.05}>
            <div className="db-section-header">
              <div className="db-section-title-wrap">
                <h2 className="db-section-title">Projects</h2>
                {!loading && (
                  <span className="db-section-count">{filtered.length}</span>
                )}
              </div>
            </div>
          </AnimatedEntry>

          {/* ── Content ── */}
          {loading ? (
            <div className="db-loading">
              <div className="db-loading-spinner">
                <Loader2 size={28} className="db-spin" />
              </div>
              <p className="db-loading-text">Loading your projects...</p>
            </div>

          ) : filtered.length === 0 && search ? (
            <AnimatedEntry delay={0.1}>
              <div className="db-empty">
                <div className="db-empty-icon-wrap">
                  <Search size={28} />
                </div>
                <h3 className="db-empty-title">No results for "{search}"</h3>
                <p className="db-empty-sub">Try a different search term</p>
                <button className="db-empty-clear" onClick={() => setSearch('')}>Clear search</button>
              </div>
            </AnimatedEntry>

          ) : filtered.length === 0 ? (
            <AnimatedEntry delay={0.1}>
              <div className="db-empty">
                <div className="db-empty-icon-wrap">
                  <FolderOpen size={32} />
                </div>
                <h3 className="db-empty-title">No projects yet</h3>
                <p className="db-empty-sub">
                  Create your first architecture diagram and it will appear here.
                </p>
                <button className="db-hero-cta" onClick={handleNewProject} style={{ marginTop: 8 }}>
                  <Plus size={15} /> Create first project
                </button>
              </div>
            </AnimatedEntry>

          ) : (
            <div className={view === 'grid' ? 'db-grid' : 'db-list'}>
              {/* New Project card — always first in grid */}
              {view === 'grid' && (
                <AnimatedEntry delay={0.08}>
                  <button className="db-new-card" onClick={handleNewProject}>
                    <div className="db-new-card-inner">
                      <div className="db-new-card-icon">
                        <Plus size={24} />
                      </div>
                      <span className="db-new-card-label">New Project</span>
                      <span className="db-new-card-sub">Start from a blank canvas</span>
                    </div>
                  </button>
                </AnimatedEntry>
              )}

              {filtered.map((project, i) => (
                <AnimatedEntry key={project.id} delay={0.08 + i * 0.04}>
                  <div style={{ opacity: deleting === project.id ? 0.35 : 1, transition: 'opacity 0.25s' }}>
                    <ProjectCard
                      project={project}
                      view={view}
                      onOpen={handleOpen}
                      onDelete={handleDelete}
                      onRename={handleRename}
                      onDuplicate={handleDuplicate}
                    />
                  </div>
                </AnimatedEntry>
              ))}
            </div>
          )}
        </section>

        {/* ── Recent activity footer strip ── */}
        {projects.length > 0 && !loading && (
          <AnimatedEntry delay={0.2}>
            <div className="db-footer-strip">
              <Zap size={12} />
              <span>Last activity: <strong>{projects[0]?.name}</strong> was updated recently</span>
              <button className="db-footer-open" onClick={() => handleOpen(projects[0]?.id)}>
                Open <ArrowRight size={12} />
              </button>
            </div>
          </AnimatedEntry>
        )}
      </main>
    </div>
  );
}
