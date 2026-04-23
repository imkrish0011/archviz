import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainCircuit, Plus, Search, LogOut, Grid3X3,
  Loader2, FolderOpen, Server, MoreVertical, ArrowRight,
  Zap, Layout, Activity, TrendingUp,
  Camera, Tv, MessageCircle, Car, Music, Gamepad2, Disc,
  CreditCard, Film, ShoppingCart, MessageSquare, Globe, Users,
  Blocks, Cloud, LayoutTemplate, ShieldCheck, Key, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { listProjects, deleteProject, renameProject } from '../../services/projectService';
import { toastBus } from '../ToastSystem';
import type { CloudProject } from '../../types';
import ProjectCard from './ProjectCard';
import { famousSystemTemplates } from '../../data/templates/famousSystemTemplates';
import { starterTemplates } from '../../data/templates/starterTemplates';
import { useArchStore } from '../../store/useArchStore';
import { loadTemplateWithAnimation } from '../../utils/templateLoader';

type SortMode = 'updated' | 'created' | 'name';
type ViewMode  = 'grid' | 'list';
type Tab = 'projects' | 'templates' | 'account';

/* ── Brand icon map ── */
const brandIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  instagram: Camera, netflix: Tv, whatsapp: MessageCircle, uber: Car,
  spotify: Music, 'google-search': Search, steam: Gamepad2, discord: Disc,
  stripe: CreditCard, tiktok: Film, amazon: ShoppingCart, 'x-twitter': MessageSquare,
};
const starterIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  'basic-web': Globe, 'chat-app': MessageSquare, 'video-streaming': Tv,
  ecommerce: ShoppingCart, 'food-delivery': Car, 'social-media': Users,
  microservices: Blocks, serverless: Cloud,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const setNodes = useArchStore(s => s.setNodes);
  const setEdges = useArchStore(s => s.setEdges);
  const clearRef = useRef<(() => void) | null>(null);

  const [projects, setProjects]     = useState<CloudProject[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [sort, setSort]             = useState<SortMode>('updated');
  const [view, setView]             = useState<ViewMode>('grid');
  const [tab, setTab]               = useState<Tab>('projects');
  const [tplTab, setTplTab]         = useState<'famous' | 'starter'>('famous');
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // id pending confirm
  const [userMenu, setUserMenu]     = useState(false);
  const [loadingTpl, setLoadingTpl] = useState<string | null>(null);

  const MAX_PROJECTS = 5;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { setProjects(await listProjects(user.uid)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* Close user menu on outside click */
  useEffect(() => {
    if (!userMenu) return;
    const h = () => setUserMenu(false);
    const t = setTimeout(() => document.addEventListener('click', h), 100);
    return () => { clearTimeout(t); document.removeEventListener('click', h); };
  }, [userMenu]);

  /* Auto-dismiss confirm after 5s */
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(null), 5000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const handleOpen = (id: string) => navigate(`/app/${id}`);

  const handleNew = () => {
    if (projects.length >= MAX_PROJECTS) {
      toastBus.emit(`Project limit reached (${MAX_PROJECTS} max) — delete one to create a new project`, 'warning');
      return;
    }
    navigate('/app');
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  /* Delete: first click sets confirmDelete, second click executes */
  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id); // ask for confirmation
      return;
    }
    // Confirmed
    setConfirmDelete(null);
    setDeleting(id);
    try {
      await deleteProject(id);
      // Also wipe localStorage if this was the last-saved project
      try {
        const saved = localStorage.getItem('archviz-state');
        if (saved) {
          const parsed = JSON.parse(saved);
          // If no explicit projectId tracking, just clear local cache too
          if (parsed?.cloudProjectId === id) {
            localStorage.removeItem('archviz-state');
          }
        }
      } catch { /* ignore */ }
      setProjects(p => p.filter(x => x.id !== id));
      toastBus.emit('Project deleted', 'success');
    } catch (e) {
      console.error(e);
      toastBus.emit('Failed to delete project', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await renameProject(id, name);
      setProjects(p => p.map(x => x.id === id ? { ...x, name } : x));
      toastBus.emit('Renamed successfully', 'success');
    } catch (e) { console.error(e); }
  };

  const handleDuplicate = (id: string) => handleOpen(id);

  const handleLoadTemplate = (tpl: typeof famousSystemTemplates[0]) => {
    setLoadingTpl(tpl.id);
    if (clearRef.current) clearRef.current();
    clearRef.current = loadTemplateWithAnimation(tpl, setNodes, setEdges, () => {});
    setTimeout(() => navigate('/app', { state: { fromTemplate: true } }), 220);
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
  const atLimit   = projects.length >= MAX_PROJECTS;

  return (
    <div className="db-root">
      <div className="db-bg-grid" />
      <div className="db-bg-orb db-bg-orb-1" />
      <div className="db-bg-orb db-bg-orb-2" />

      {/* ══ SIDEBAR ══ */}
      <aside className="db-sidebar">
        <div className="db-sidebar-logo">
          <div className="db-sidebar-logo-icon"><BrainCircuit size={17} /></div>
          <span className="db-sidebar-logo-text">ArchViz</span>
          <div className="db-sidebar-logo-dot" />
        </div>

        <nav className="db-sidebar-nav">
          <div className="db-nav-section-label">Workspace</div>
          <button className={`db-nav-item ${tab === 'projects' ? 'db-nav-item--active' : ''}`}
            onClick={() => { setTab('projects'); setSort('updated'); }}>
            <Grid3X3 size={14} /> <span>My Projects</span>
          </button>
          <button className={`db-nav-item ${tab === 'templates' ? 'db-nav-item--active' : ''}`}
            onClick={() => setTab('templates')}>
            <LayoutTemplate size={14} /> <span>Templates</span>
          </button>
          <div className="db-nav-divider" />
          <div className="db-nav-section-label">Quick Actions</div>
          <button className="db-nav-item db-nav-item--new" onClick={handleNew}>
            <Plus size={14} /> <span>New Project</span>
          </button>
        </nav>

        {/* Stats */}
        <div className="db-sidebar-stats">
          <div className="db-stat-pill">
            <div className="db-stat-icon"><Layout size={13} /></div>
            <div>
              <span className="db-stat-value">{loading ? '—' : projects.length}</span>
              <span className="db-stat-label">Projects</span>
            </div>
          </div>
          <div className="db-stat-pill">
            <div className="db-stat-icon"><Server size={13} /></div>
            <div>
              <span className="db-stat-value">{loading ? '—' : totalNodes}</span>
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
            <span className="db-user-role">Active</span>
          </div>
          <MoreVertical size={13} className="db-user-more" />
          {userMenu && (
            <div className="db-user-menu" onClick={e => e.stopPropagation()}>
              <button className="db-user-menu-item" onClick={() => { setTab('account'); setUserMenu(false); }}><Activity size={12} /> Account</button>
              <div className="db-user-menu-sep" />
              <button className="db-user-menu-item db-user-menu-item--danger" onClick={handleSignOut}>
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main className="db-main">
        {/* Top bar */}
        <header className="db-topbar">
          <div className="db-topbar-search-wrap">
            <Search size={14} className="db-topbar-search-icon" />
            <input
              className="db-topbar-search"
              placeholder={tab === 'projects' ? 'Search projects...' : 'Search templates...'}
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="db-topbar-actions">
            {tab === 'projects' && <>
              <button className={`db-view-btn ${view === 'grid' ? 'active' : ''}`}
                onClick={() => setView('grid')} title="Grid"><Grid3X3 size={13} /></button>
              <button className={`db-view-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')} title="List"><Layout size={13} /></button>
              <select className="db-sort-select" value={sort}
                onChange={e => setSort(e.target.value as SortMode)}>
                <option value="updated">Last edited</option>
                <option value="created">Date created</option>
                <option value="name">Name A–Z</option>
              </select>
            </>}
            {tab === 'account' && (
              <span style={{ fontSize: 13, color: 'var(--db-text-4)', fontWeight: 500 }}>Account Management</span>
            )}
          </div>
        </header>

        {/* Hero — visible for projects and templates */}
        {tab !== 'account' && (
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
                {tab === 'projects'
                  ? projects.length > 0
                    ? `${projects.length} project${projects.length !== 1 ? 's' : ''} · ${totalNodes} components across all designs`
                    : 'Design, simulate, and ship cloud architectures at scale.'
                  : `${famousSystemTemplates.length + starterTemplates.length} ready-to-use architecture templates.`
                }
              </p>
            </div>
            {atLimit
              ? <div className="db-hero-cta" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', cursor: 'not-allowed', boxShadow: 'none' }}>
                  <Server size={14}/> {MAX_PROJECTS}/{MAX_PROJECTS} Projects
                </div>
              : <button className="db-hero-cta" onClick={handleNew}>
                  <Plus size={15} /> New Project <ArrowRight size={13} style={{ opacity: 0.5 }} />
                </button>
            }
          </section>
        )}

        {/* Stats bar — projects only */}
        {tab === 'projects' && !loading && projects.length > 0 && (
          <div className="db-stats-bar">
            <div className="db-stats-item">
              <span className="db-stats-item-num">{projects.length}</span>
              <span className="db-stats-item-label">Diagrams</span>
              <div className="db-stats-item-trend"><TrendingUp size={10} /> Active</div>
            </div>
            <div className="db-stats-item">
              <span className="db-stats-item-num">{totalNodes}</span>
              <span className="db-stats-item-label">Components</span>
              <div className="db-stats-item-trend"><Server size={10} /> Total nodes</div>
            </div>
            <div className="db-stats-item">
              <span className="db-stats-item-num">
                {projects.length > 0 ? Math.round(totalNodes / projects.length) : 0}
              </span>
              <span className="db-stats-item-label">Avg Complexity</span>
              <div className="db-stats-item-trend"><Activity size={10} /> Nodes/project</div>
            </div>
            <div className="db-stats-item">
              <span className="db-stats-item-num">∞</span>
              <span className="db-stats-item-label">Scale</span>
              <div className="db-stats-item-trend"><Zap size={10} /> Simulation ready</div>
            </div>
          </div>
        )}

        {/* ══ PROJECTS TAB ══ */}
        {tab === 'projects' && (
          <section className="db-projects-section">
            <div className="db-section-header">
              <div className="db-section-title-wrap">
                <h2 className="db-section-title">My Projects</h2>
                {!loading && <span className="db-section-count">{filtered.length}</span>}
              </div>
            </div>

            {loading ? (
              <div className="db-loading">
                <Loader2 size={22} className="db-spin db-loading-spinner" />
                <span className="db-loading-text">Loading your projects...</span>
              </div>
            ) : filtered.length === 0 && search ? (
              <div className="db-empty">
                <div className="db-empty-icon-wrap"><Search size={26} /></div>
                <h3 className="db-empty-title">No results</h3>
                <p className="db-empty-sub">No projects match "{search}"</p>
                <button className="db-empty-clear" onClick={() => setSearch('')}>Clear search</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty-icon-wrap"><FolderOpen size={28} /></div>
                <h3 className="db-empty-title">No projects yet</h3>
                <p className="db-empty-sub">Create a new project or load a template to get started.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button className="db-hero-cta" onClick={handleNew}><Plus size={14} /> New Project</button>
                  <button className="db-empty-clear" onClick={() => setTab('templates')}>Browse Templates</button>
                </div>
              </div>
            ) : (
              <div className={view === 'grid' ? 'db-grid' : 'db-list'}>
                {view === 'grid' && (
                  <button className="db-new-card" onClick={handleNew} disabled={atLimit} title={atLimit ? `Limit of ${MAX_PROJECTS} projects reached` : 'New project'}>
                    <div className="db-new-card-inner">
                      <div className="db-new-card-icon">
                        {atLimit ? <Server size={20} /> : <Plus size={22} />}
                      </div>
                      <span className="db-new-card-label">{atLimit ? 'Limit reached' : 'New Project'}</span>
                      <span className="db-new-card-sub">{atLimit ? `${MAX_PROJECTS}/${MAX_PROJECTS} used` : 'Blank canvas'}</span>
                    </div>
                  </button>
                )}
                {filtered.map(project => (
                  <div
                    key={project.id}
                    style={{ opacity: deleting === project.id ? 0.3 : 1, transition: 'opacity 0.25s' }}
                  >
                    <ProjectCard
                      project={project} view={view}
                      onOpen={handleOpen} onDelete={handleDelete}
                      onRename={handleRename} onDuplicate={handleDuplicate}
                      confirmingDelete={confirmDelete === project.id}
                    />
                  </div>
                ))}
              </div>
            )}

            {projects.length > 0 && !loading && filtered[0] && (
              <div className="db-footer-strip">
                <Zap size={11} />
                <span>Last edited: <strong>{filtered[0].name}</strong></span>
                <button className="db-footer-open" onClick={() => handleOpen(filtered[0].id)}>
                  Open <ArrowRight size={11} />
                </button>
              </div>
            )}
          </section>
        )}

        {/* ══ TEMPLATES TAB ══ */}
        {tab === 'templates' && (
          <section className="db-projects-section">
            <div className="db-tpl-tabs">
              <button
                className={`db-tpl-tab ${tplTab === 'famous' ? 'active' : ''}`}
                onClick={() => setTplTab('famous')}
              >
                Famous Architectures
              </button>
              <button
                className={`db-tpl-tab ${tplTab === 'starter' ? 'active' : ''}`}
                onClick={() => setTplTab('starter')}
              >
                Starter Patterns
              </button>
            </div>

            {tplTab === 'famous' && (
              <>
                <div className="db-section-header">
                  <div className="db-section-title-wrap">
                    <h2 className="db-section-title">Famous Architectures</h2>
                    <span className="db-section-count">{famousSystemTemplates.length}</span>
                  </div>
                  <p className="db-section-sub">Reverse-engineered real-world systems — click any to load into canvas instantly</p>
                </div>
                <div className="db-tpl-grid">
                  {famousSystemTemplates
                    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))
                    .map(tpl => {
                      const Icon = brandIcons[tpl.id] || BrainCircuit;
                      return (
                        <button
                          key={tpl.id}
                          className="db-tpl-card"
                          onClick={() => handleLoadTemplate(tpl)}
                          disabled={!!loadingTpl}
                          style={{ opacity: loadingTpl && loadingTpl !== tpl.id ? 0.4 : 1 }}
                        >
                          <div className="db-tpl-card-top">
                            <div className="db-tpl-icon">
                              {loadingTpl === tpl.id
                                ? <Loader2 size={18} className="db-spin" />
                                : <Icon size={18} strokeWidth={1.5} />
                              }
                            </div>
                            <div className="db-tpl-info">
                              <span className="db-tpl-name">{tpl.name}</span>
                              <span className="db-tpl-meta">{tpl.nodeCount} nodes · ~${tpl.baselineCost}/mo</span>
                            </div>
                            <ArrowRight size={14} className="db-tpl-arrow" />
                          </div>
                          <p className="db-tpl-desc">{tpl.description}</p>
                          <div className="db-tpl-insight">
                            <Zap size={11} />
                            <span>{tpl.keyInsight}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            {tplTab === 'starter' && (
              <>
                <div className="db-section-header">
                  <div className="db-section-title-wrap">
                    <h2 className="db-section-title">Starter Patterns</h2>
                    <span className="db-section-count">{starterTemplates.length}</span>
                  </div>
                  <p className="db-section-sub">Proven architectural patterns ready to customize</p>
                </div>
                <div className="db-starter-grid">
                  {starterTemplates
                    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))
                    .map(tpl => {
                      const Icon = starterIcons[tpl.id] || BrainCircuit;
                      return (
                        <button
                          key={tpl.id}
                          className="db-starter-card"
                          onClick={() => handleLoadTemplate(tpl)}
                          disabled={!!loadingTpl}
                          style={{ opacity: loadingTpl && loadingTpl !== tpl.id ? 0.4 : 1 }}
                        >
                          <div className="db-starter-icon">
                            {loadingTpl === tpl.id
                              ? <Loader2 size={16} className="db-spin" />
                              : <Icon size={16} strokeWidth={1.5} />
                          }
                          </div>
                          <div className="db-starter-text">
                            <span className="db-starter-name">{tpl.name}</span>
                            <span className="db-starter-meta">{tpl.nodeCount} nodes · ~${tpl.baselineCost}/mo</span>
                          </div>
                          <ArrowRight size={13} className="db-tpl-arrow" />
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </section>
        )}

        {/* ══ ACCOUNT TAB ══ */}
        {tab === 'account' && (
          <section className="db-account-section">
            <div className="db-acc-header">
              <div className="db-acc-avatar-large">
                {user?.photoURL
                  ? <img src={user.photoURL} alt="avatar" />
                  : <div>{firstName.charAt(0).toUpperCase()}</div>
                }
              </div>
              <div className="db-acc-title-area">
                <h2 className="db-acc-name">{user?.displayName ?? 'Architect'}</h2>
                <span className="db-acc-email">{user?.email ?? 'user@archviz.com'}</span>
              </div>
            </div>

            <div className="db-acc-grid">
              
              <div className="db-acc-card">
                <h3 className="db-acc-card-title"><Activity size={16} /> Usage Metrics</h3>
                
                <div className="db-acc-stats-split">
                  <div className="db-acc-stats-main">
                    <div className="db-acc-stats">
                      <div className="db-acc-stat">
                        <span className="db-acc-val">{projects.length} <span style={{ opacity: 0.3, fontSize: 18 }}>/ {MAX_PROJECTS}</span></span>
                        <span className="db-acc-lbl">Projects Active</span>
                      </div>
                      <div className="db-acc-stat">
                        <span className="db-acc-val">{totalNodes}</span>
                        <span className="db-acc-lbl">Total Components</span>
                      </div>
                      <div className="db-acc-stat">
                        <span className="db-acc-val">4.2<span style={{fontSize: 14, marginLeft: 3, opacity: 0.4}}>MB</span></span>
                        <span className="db-acc-lbl">Storage Used</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="db-acc-progress-wrap">
                    <div className="db-acc-progress-label">
                      <span>Cloud Limit</span>
                      <span>{Math.round((projects.length / MAX_PROJECTS) * 100)}%</span>
                    </div>
                    <div className="db-acc-progress-bar">
                      <div className="db-acc-progress-fill" style={{ width: `${(projects.length / MAX_PROJECTS) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>
        )}
      </main>
    </div>
  );
}
