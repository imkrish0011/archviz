import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainCircuit, Plus, Search, LogOut, Grid3X3,
  Loader2, FolderOpen, Server, MoreVertical, ArrowRight,
  Zap, Layout, Clock, Activity, Star, TrendingUp
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { listProjects, deleteProject, renameProject } from '../../services/projectService';
import type { CloudProject } from '../../types';
import ProjectCard from './ProjectCard';

type SortMode = 'updated' | 'created' | 'name';
type ViewMode  = 'grid' | 'list';

/* ── Intersection observer for scroll-in animations ── */
function useInView(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [projects, setProjects]   = useState<CloudProject[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [sort, setSort]           = useState<SortMode>('updated');
  const [view, setView]           = useState<ViewMode>('grid');
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [userMenu, setUserMenu]   = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { setProjects(await listProjects(user.uid)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleOpen   = (id: string) => navigate(`/app/${id}`);
  const handleNew    = ()           => navigate('/app');
  const handleSignOut = async ()    => { await signOut(); navigate('/'); };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    setDeleting(id);
    try { await deleteProject(id); setProjects(p => p.filter(x => x.id !== id)); }
    catch (e) { console.error(e); }
    finally { setDeleting(null); }
  };

  const handleRename = async (id: string, name: string) => {
    try { await renameProject(id, name); setProjects(p => p.map(x => x.id === id ? { ...x, name } : x)); }
    catch (e) { console.error(e); }
  };

  const handleDuplicate = (id: string) => {
    handleOpen(id); // navigate to open then duplicate from within editor
  };

  const filtered = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'name')    return a.name.localeCompare(b.name);
      if (sort === 'created') return b.createdAt.getTime() - a.createdAt.getTime();
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  const firstName  = user?.displayName?.split(' ')[0] ?? 'there';
  const totalNodes = projects.reduce((s, p) => s + p.nodeCount, 0);
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';

  return (
    <div className="db-root">
      {/* ── Background ── */}
      <div className="db-bg-grid" />
      <div className="db-bg-orb db-bg-orb-1" />
      <div className="db-bg-orb db-bg-orb-2" />

      {/* ════════════════════════════════
          SIDEBAR
      ════════════════════════════════ */}
      <aside className="db-sidebar">
        {/* Logo */}
        <div className="db-sidebar-logo">
          <div className="db-sidebar-logo-icon"><BrainCircuit size={17} /></div>
          <span className="db-sidebar-logo-text">ArchViz</span>
          <div className="db-sidebar-logo-dot" />
        </div>

        {/* Nav */}
        <nav className="db-sidebar-nav">
          <div className="db-nav-section-label">Workspace</div>
          <button className="db-nav-item db-nav-item--active">
            <Grid3X3 size={14} /> <span>All Projects</span>
          </button>
          <button className="db-nav-item">
            <Clock size={14} /> <span>Recent</span>
          </button>
          <button className="db-nav-item">
            <Star size={14} /> <span>Starred</span>
          </button>

          <div className="db-nav-divider" />
          <div className="db-nav-section-label">Quick Actions</div>
          <button className="db-nav-item db-nav-item--new" onClick={handleNew}>
            <Plus size={14} /> <span>New Project</span>
          </button>
        </nav>

        {/* Stats pills */}
        <div className="db-sidebar-stats">
          <div className="db-stat-pill">
            <div className="db-stat-icon"><Layout size={13} /></div>
            <div>
              <span className="db-stat-value">{projects.length}</span>
              <span className="db-stat-label">Projects</span>
            </div>
          </div>
          <div className="db-stat-pill">
            <div className="db-stat-icon"><Server size={13} /></div>
            <div>
              <span className="db-stat-value">{totalNodes}</span>
              <span className="db-stat-label">Total Nodes</span>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="db-sidebar-user" onClick={() => setUserMenu(v => !v)}>
          <div className="db-user-avatar-wrap">
            {user?.photoURL
              ? <img src={user.photoURL} alt="avatar" className="db-user-avatar" />
              : <div className="db-user-avatar-placeholder">{firstName.charAt(0).toUpperCase()}</div>
            }
            <div className="db-user-status-dot" />
          </div>
          <div className="db-user-info">
            <span className="db-user-name">{user?.displayName ?? 'User'}</span>
            <span className="db-user-role">Pro · Active</span>
          </div>
          <MoreVertical size={13} className="db-user-more" />
          {userMenu && (
            <div className="db-user-menu" onClick={e => e.stopPropagation()}>
              <button className="db-user-menu-item">
                <Activity size={12} /> Account
              </button>
              <div className="db-user-menu-sep" />
              <button className="db-user-menu-item db-user-menu-item--danger" onClick={handleSignOut}>
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════
          MAIN
      ════════════════════════════════ */}
      <main className="db-main">

        {/* ── Top bar ── */}
        <header className="db-topbar">
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
            <button className={`db-view-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')} title="Grid">
              <Grid3X3 size={13} />
            </button>
            <button className={`db-view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} title="List">
              <Layout size={13} />
            </button>
            <select className="db-sort-select" value={sort} onChange={e => setSort(e.target.value as SortMode)}>
              <option value="updated">Last edited</option>
              <option value="created">Date created</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </header>

        {/* ── Hero ── */}
        <FadeUp delay={0}>
          <section className="db-hero">
            <div className="db-hero-text">
              <div className="db-hero-eyebrow">
                <span className="db-hero-eyebrow-dot" />
                Good {greeting}, {firstName}
              </div>
              <h1 className="db-hero-title">
                Architecture<br />
                <span className="db-hero-title-sub">Command Center.</span>
              </h1>
              <p className="db-hero-sub">
                {projects.length > 0
                  ? `${projects.length} project${projects.length !== 1 ? 's' : ''} · ${totalNodes} components across all designs`
                  : 'Design, simulate, and ship cloud architectures at scale.'}
              </p>
            </div>
            <button className="db-hero-cta" onClick={handleNew}>
              <Plus size={15} /> New Project <ArrowRight size={13} style={{ opacity: 0.5 }} />
            </button>
          </section>
        </FadeUp>

        {/* ── Stats bar ── */}
        {!loading && projects.length > 0 && (
          <FadeUp delay={0.05}>
            <div className="db-stats-bar">
              <div className="db-stats-item" style={{ animationDelay: '0.05s' }}>
                <span className="db-stats-item-num">{projects.length}</span>
                <span className="db-stats-item-label">Diagrams</span>
                <div className="db-stats-item-trend"><TrendingUp size={10} /> Active</div>
              </div>
              <div className="db-stats-item" style={{ animationDelay: '0.1s' }}>
                <span className="db-stats-item-num">{totalNodes}</span>
                <span className="db-stats-item-label">Components</span>
                <div className="db-stats-item-trend"><Server size={10} /> Total nodes</div>
              </div>
              <div className="db-stats-item" style={{ animationDelay: '0.15s' }}>
                <span className="db-stats-item-num">
                  {projects.length > 0
                    ? Math.round(totalNodes / projects.length)
                    : 0}
                </span>
                <span className="db-stats-item-label">Avg Complexity</span>
                <div className="db-stats-item-trend"><Activity size={10} /> Nodes/project</div>
              </div>
              <div className="db-stats-item" style={{ animationDelay: '0.2s' }}>
                <span className="db-stats-item-num">∞</span>
                <span className="db-stats-item-label">Scale</span>
                <div className="db-stats-item-trend"><Zap size={10} /> Simulation ready</div>
              </div>
            </div>
          </FadeUp>
        )}

        {/* ── Projects ── */}
        <section className="db-projects-section">
          <FadeUp delay={0.1}>
            <div className="db-section-header">
              <div className="db-section-title-wrap">
                <h2 className="db-section-title">Projects</h2>
                {!loading && <span className="db-section-count">{filtered.length}</span>}
              </div>
            </div>
          </FadeUp>

          {loading ? (
            <div className="db-loading">
              <div className="db-loading-spinner"><Loader2 size={22} className="db-spin" /></div>
              <span className="db-loading-text">Loading your projects...</span>
            </div>

          ) : filtered.length === 0 && search ? (
            <FadeUp delay={0.1}>
              <div className="db-empty">
                <div className="db-empty-icon-wrap"><Search size={26} /></div>
                <h3 className="db-empty-title">No results</h3>
                <p className="db-empty-sub">No projects match "{search}"</p>
                <button className="db-empty-clear" onClick={() => setSearch('')}>Clear search</button>
              </div>
            </FadeUp>

          ) : filtered.length === 0 ? (
            <FadeUp delay={0.1}>
              <div className="db-empty">
                <div className="db-empty-icon-wrap"><FolderOpen size={28} /></div>
                <h3 className="db-empty-title">No projects yet</h3>
                <p className="db-empty-sub">Create your first architecture diagram to get started.</p>
                <button className="db-hero-cta" onClick={handleNew} style={{ marginTop: 12 }}>
                  <Plus size={14} /> Create first project
                </button>
              </div>
            </FadeUp>

          ) : (
            <div className={view === 'grid' ? 'db-grid' : 'db-list'}>
              {/* New card (grid only) */}
              {view === 'grid' && (
                <FadeUp delay={0.1}>
                  <button className="db-new-card" onClick={handleNew}>
                    <div className="db-new-card-inner">
                      <div className="db-new-card-icon"><Plus size={22} /></div>
                      <span className="db-new-card-label">New Project</span>
                      <span className="db-new-card-sub">Blank canvas</span>
                    </div>
                  </button>
                </FadeUp>
              )}

              {filtered.map((project, i) => (
                <FadeUp key={project.id} delay={0.1 + i * 0.035}>
                  <div style={{ opacity: deleting === project.id ? 0.3 : 1, transition: 'opacity 0.25s' }}>
                    <ProjectCard
                      project={project}
                      view={view}
                      onOpen={handleOpen}
                      onDelete={handleDelete}
                      onRename={handleRename}
                      onDuplicate={handleDuplicate}
                    />
                  </div>
                </FadeUp>
              ))}
            </div>
          )}
        </section>

        {/* ── Footer activity strip ── */}
        {projects.length > 0 && !loading && (
          <FadeUp delay={0.25}>
            <div className="db-footer-strip">
              <Zap size={11} />
              <span>Last edited: <strong>{filtered[0]?.name ?? projects[0]?.name}</strong></span>
              <button className="db-footer-open" onClick={() => handleOpen(filtered[0]?.id ?? projects[0]?.id)}>
                Open <ArrowRight size={11} />
              </button>
            </div>
          </FadeUp>
        )}
      </main>
    </div>
  );
}
