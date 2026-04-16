import { useCallback, useRef, useState, useEffect } from 'react';
import {
  BrainCircuit, Plus, ArrowRight, Tv, Camera, MessageCircle,
  Car, Music, Search, Gamepad2, Disc, CreditCard, Film, Globe,
  MessageSquare, Video, ShoppingCart, MapPin, Users, Blocks, Server,
  Zap, Layers, Box, Activity, DollarSign, Fingerprint, RefreshCcw,
  Lock, Eye, Download, Clock, Shield, Cpu, Database, Cloud,
  GitBranch, LayoutTemplate, Check, Terminal,
  Workflow, Sparkles, Monitor, Palette, Keyboard,
  Code2, Gauge, Network,
  Webhook, Container, HardDrive, Radio, CircuitBoard, Flame,
  FileCode, ShieldAlert, Target, Mail, Leaf
} from 'lucide-react';
import '../styles/landing.css';
import { famousSystemTemplates } from '../data/templates/famousSystemTemplates';
import { starterTemplates } from '../data/templates/starterTemplates';
import { useArchStore } from '../store/useArchStore';
import { instantiateTemplate, loadTemplateWithAnimation } from '../utils/templateLoader';
import type { Template } from '../types';

/* ── Brand icon mapping ── */
const brandIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  instagram: Camera, netflix: Tv, whatsapp: MessageCircle, uber: Car,
  spotify: Music, 'google-search': Search, steam: Gamepad2, discord: Disc,
  stripe: CreditCard, tiktok: Film,
};

/* ── Starter icon mapping ── */
const starterIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  'basic-web': Globe, 'chat-app': MessageSquare, 'video-streaming': Video,
  ecommerce: ShoppingCart, 'food-delivery': MapPin, 'social-media': Users,
  microservices: Blocks,
};

/* ── Component library items for marquee ── */
const computeItems = [
  { label: 'Web Server', icon: Monitor },
  { label: 'Docker/K8s', icon: Container },
  { label: 'Lambda', icon: Zap },
  { label: 'Step Functions', icon: CircuitBoard },
  { label: 'EC2 Instance', icon: Server },
  { label: 'Microservices', icon: Blocks },
  { label: 'GPU Node', icon: Cpu },
  { label: 'App Engine', icon: LayoutTemplate },
  { label: 'AWS Fargate', icon: Container },
  { label: 'AWS Batch', icon: Layers },
  { label: 'Apache Spark', icon: Terminal },
  { label: 'Datadog', icon: Activity },
  { label: 'AWS Bedrock', icon: Sparkles },
];

const dataItems = [
  { label: 'PostgreSQL', icon: Database },
  { label: 'Redis Cache', icon: Flame },
  { label: 'S3 Storage', icon: HardDrive },
  { label: 'MongoDB', icon: Database },
  { label: 'Kafka', icon: Radio },
  { label: 'SNS/SQS', icon: Radio },
  { label: 'Elasticsearch', icon: Search },
  { label: 'GraphQL', icon: Code2 },
  { label: 'DynamoDB', icon: Database },
  { label: 'Neo4j Graph', icon: Network },
  { label: 'InfluxDB', icon: Activity },
  { label: 'Amazon EFS', icon: HardDrive },
  { label: 'Amazon Glacier', icon: Box },
  { label: 'AWS Athena', icon: Search },
];

const networkItems = [
  { label: 'Load Balancer', icon: Network },
  { label: 'API Gateway', icon: Webhook },
  { label: 'CDN', icon: Cloud },
  { label: 'WAF', icon: Shield },
  { label: 'Auth0', icon: Shield },
  { label: 'Route 53', icon: Globe },
  { label: 'VPC', icon: Layers },
  { label: 'Security Group', icon: ShieldAlert },
  { label: 'EventBridge', icon: Zap },
  { label: 'RabbitMQ', icon: MessageSquare },
  { label: 'Transit Gateway', icon: Globe },
  { label: 'Secrets Manager', icon: Lock },
  { label: 'Twilio API', icon: MessageCircle },
  { label: 'SendGrid', icon: Mail },
  { label: 'Pusher', icon: Radio },
];

interface LandingPageProps {
  onLaunch: () => void;
}

/* ── Intersection Observer Hook ── */
function useInView(threshold = 0.15) {
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

function AnimatedSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage({ onLaunch }: LandingPageProps) {
  const loadTemplate = useArchStore(s => s.loadTemplate);
  const clearCanvas = useArchStore(s => s.clearCanvas);
  const setNodes = useArchStore(s => s.setNodes);
  const setEdges = useArchStore(s => s.setEdges);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleTemplateSelect = useCallback(
    (template: Template) => {
      setLoadingId(template.id);
      cleanupRef.current?.();
      clearCanvas();
      setTimeout(() => {
        cleanupRef.current = loadTemplateWithAnimation(
          template, setNodes, setEdges,
          () => {
            const { nodes, edges } = instantiateTemplate(template);
            loadTemplate(nodes, edges);
            setLoadingId(null);
            onLaunch();
          }
        );
      }, 50);
    },
    [clearCanvas, setNodes, setEdges, loadTemplate, onLaunch]
  );

  const handleBlankCanvas = useCallback(() => {
    clearCanvas();
    onLaunch();
  }, [clearCanvas, onLaunch]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-container">
      {/* ── Background ── */}
      <div className="lp-bg-grid" />
      <div className="lp-bg-orbs">
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-orb lp-orb-3" />
      </div>

      {/* ═══════════════════════════════════════
       *  NAVBAR
       * ═══════════════════════════════════════ */}
      <nav className="lp-nav">
        <div className="lp-nav-logo">
          <BrainCircuit size={22} />
          <span>ArchViz</span>
        </div>
        <div className="lp-nav-center">
          <div className="lp-nav-links">
            <button className="lp-nav-link" onClick={() => scrollTo('features')}>Features</button>
            <button className="lp-nav-link" onClick={() => scrollTo('preview')}>Preview</button>
            <button className="lp-nav-link" onClick={() => scrollTo('templates')}>Templates</button>
            <button className="lp-nav-link" onClick={() => scrollTo('comparison')}>Compare</button>
          </div>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-nav-cta-ghost" onClick={onLaunch}>
            <Terminal size={14} />
            Workspace
          </button>
          <button className="lp-nav-cta" onClick={handleBlankCanvas}>
            <Sparkles size={14} />
            Start Building
            <ArrowRight size={13} style={{ marginLeft: -2, opacity: 0.6 }} />
          </button>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className="lp-main">
        {/* ═══════════════════════════════════════
         *  HERO
         * ═══════════════════════════════════════ */}
        <section className="lp-hero">
          <div className="lp-hero-badge">
            <span className="lp-badge-dot" />
            System Design Simulator — Open & Free
          </div>

          <h1>
            <span className="lp-hero-gradient-text">
              Design. Simulate.<br />Ship with confidence.
            </span>
          </h1>

          <p className="lp-hero-sub">
            The professional-grade canvas for architecting distributed systems.
            Drag cloud components, simulate live traffic, detect bottlenecks,
            and estimate costs — all before writing a single line of code.
          </p>

          <div className="lp-hero-actions">
            <button className="lp-btn-primary" onClick={handleBlankCanvas}>
              <Plus size={18} strokeWidth={2.5} />
              Start Designing — It's Free
            </button>
            <button className="lp-btn-secondary" onClick={() => scrollTo('templates')}>
              <Eye size={18} />
              Explore Templates
            </button>
          </div>

          <div className="lp-hero-trust">
            <div className="lp-trust-item">
              <span className="lp-trust-value">90+</span>
              <span className="lp-trust-label">Components</span>
            </div>
            <div className="lp-trust-divider" />
            <div className="lp-trust-item">
              <span className="lp-trust-value">10+</span>
              <span className="lp-trust-label">Templates</span>
            </div>
            <div className="lp-trust-divider" />
            <div className="lp-trust-item">
              <span className="lp-trust-value">10M</span>
              <span className="lp-trust-label">Max Users Sim</span>
            </div>
            <div className="lp-trust-divider" />
            <div className="lp-trust-item">
              <span className="lp-trust-value">$0</span>
              <span className="lp-trust-label">Forever Free</span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
         *  LIVE PREVIEW WINDOW
         * ═══════════════════════════════════════ */}
        <AnimatedSection className="lp-preview-section" delay={0.1}>
          <div id="preview" className="lp-preview-window">
            <div className="lp-preview-titlebar">
              <div className="lp-preview-dots">
                <span className="lp-preview-dot" />
                <span className="lp-preview-dot" />
                <span className="lp-preview-dot" />
              </div>
              <div className="lp-preview-tab">
                <Lock size={11} />
                archviz.app — untitled-project
              </div>
              <div style={{ width: 44 }} />
            </div>
            <div className="lp-preview-body">
              <div className="lp-mock-workspace">
                {/* Mock TopBar */}
                <div className="lp-mock-topbar">
                  <div className="lp-mock-topbar-logo">
                    <BrainCircuit size={13} />
                    ArchViz
                  </div>
                  <div style={{ flex: 1 }} />
                  <div className="lp-mock-topbar-btns">
                    <button className="lp-mock-topbar-btn" style={{ padding: '0 8px', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#fff', border: '1px solid #312e3d' }}><Code2 size={12} />IaC Export</button>
                    <button className="lp-mock-topbar-btn" style={{ padding: '0 8px', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#fff', border: '1px solid #312e3d' }}><ShieldAlert size={12} />Security Scan</button>
                  </div>
                </div>

                {/* Mock Left Sidebar */}
                <div className="lp-mock-sidebar">
                  <div style={{ gridColumn: '1 / -1', fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Components</div>
                  <div className="lp-mock-sidebar-item" />
                  <div className="lp-mock-sidebar-item" />
                  <div className="lp-mock-sidebar-item" />
                  <div className="lp-mock-sidebar-item" />
                  <div className="lp-mock-sidebar-item" />
                  <div className="lp-mock-sidebar-item" />
                  <div className="lp-mock-sidebar-item" />
                  <div className="lp-mock-sidebar-item" />
                </div>

                {/* Mock Canvas */}
                <div className="lp-mock-canvas">
                  <div className="lp-mock-canvas-grid" />
                  {/* SVG Edges */}
                  <svg className="lp-mock-edges" viewBox="0 0 800 500" preserveAspectRatio="none">
                    <line x1="160" y1="80" x2="320" y2="160" />
                    <line x1="320" y1="160" x2="520" y2="120" />
                    <line x1="320" y1="160" x2="520" y2="260" />
                    <line x1="520" y1="120" x2="680" y2="200" />
                    <line x1="520" y1="260" x2="680" y2="340" />
                    <line x1="160" y1="80" x2="160" y2="300" />
                    <line x1="160" y1="300" x2="320" y2="380" />
                  </svg>
                  {/* Mock Nodes */}
                  {/* Mock Nodes with realistic styles */}
                  <div className="lp-mock-node" style={{ top: '10%', left: '12%', borderLeft: '3px solid #f2901a' }}>
                    <Network size={14} color="#f2901a" />
                    <span>Load Balancer</span>
                  </div>
                  <div className="lp-mock-node" style={{ top: '28%', left: '35%', borderLeft: '3px solid #f2901a' }}>
                    <Server size={14} color="#f2901a" />
                    <span>API Server ×3</span>
                  </div>
                  <div className="lp-mock-node" style={{ top: '14%', left: '58%', borderLeft: '3px solid #d62828' }}>
                    <Database size={14} color="#d62828" />
                    <span>Redis Cache</span>
                  </div>
                  <div className="lp-mock-node" style={{ top: '45%', left: '58%', borderLeft: '3px solid #336791' }}>
                    <Database size={14} color="#336791" />
                    <span>PostgreSQL</span>
                  </div>
                  <div className="lp-mock-node" style={{ top: '30%', left: '78%', borderLeft: '3px solid #7B42BC' }}>
                    <Globe size={14} color="#7B42BC" />
                    <span>CDN</span>
                  </div>
                  <div className="lp-mock-node" style={{ top: '60%', left: '78%', borderLeft: '3px solid #E34F26' }}>
                    <HardDrive size={14} color="#E34F26" />
                    <span>S3 Storage</span>
                  </div>
                  <div className="lp-mock-node" style={{ top: '55%', left: '12%', borderLeft: '3px solid #f2901a' }}>
                    <Globe size={14} color="#f2901a" />
                    <span>DNS</span>
                  </div>
                  <div className="lp-mock-node" style={{ top: '70%', left: '35%', borderLeft: '3px solid #d62828' }}>
                    <Activity size={14} color="#d62828" />
                    <span>Message Queue</span>
                  </div>
                </div>

                {/* Mock Right Panel */}
                <div className="lp-mock-right-panel">
                  <div className="lp-mock-config-block">
                    <div className="lp-mock-config-title">Configuration</div>
                    <div className="lp-mock-config-row">
                      <span className="lp-mock-config-label">Tier</span>
                      <span className="lp-mock-config-value">m5.xlarge</span>
                    </div>
                    <div className="lp-mock-config-row">
                      <span className="lp-mock-config-label">Instances</span>
                      <span className="lp-mock-config-value">3</span>
                    </div>
                    <div className="lp-mock-config-row">
                      <span className="lp-mock-config-label">Region</span>
                      <span className="lp-mock-config-value">us-east-1</span>
                    </div>
                  </div>
                  <div className="lp-mock-config-block">
                    <div className="lp-mock-config-title">Performance</div>
                    <div className="lp-mock-config-row">
                      <span className="lp-mock-config-label">CPU Load</span>
                      <span className="lp-mock-config-value">42%</span>
                    </div>
                    <div className="lp-mock-bar">
                      <div className="lp-mock-bar-fill" style={{ width: '42%' }} />
                    </div>
                    <div className="lp-mock-config-row">
                      <span className="lp-mock-config-label">Memory</span>
                      <span className="lp-mock-config-value">68%</span>
                    </div>
                    <div className="lp-mock-bar">
                      <div className="lp-mock-bar-fill" style={{ width: '68%' }} />
                    </div>
                  </div>
                  <div className="lp-mock-config-block">
                    <div className="lp-mock-config-title">Cost</div>
                    <div className="lp-mock-config-row">
                      <span className="lp-mock-config-label">Monthly</span>
                      <span className="lp-mock-config-value" style={{ color: 'rgba(255,255,255,0.7)' }}>$847/mo</span>
                    </div>
                    <div className="lp-mock-config-row">
                      <span className="lp-mock-config-label">Per request</span>
                      <span className="lp-mock-config-value">$0.00024</span>
                    </div>
                  </div>
                </div>

                {/* Mock Bottom Bar */}
                <div className="lp-mock-bottombar">
                  <div className="lp-mock-metric">
                    <DollarSign size={10} color="#10b981" />
                    Estimated Cost: <span className="lp-mock-metric-val">$847.00 /mo</span>
                  </div>
                  <div className="lp-mock-metric">
                    <Clock size={10} color="#eab308" />
                    P95 Latency: <span className="lp-mock-metric-val">142ms</span>
                  </div>
                  <div className="lp-mock-metric">
                    <Activity size={10} color="#3b82f6" />
                    QPS Load: <span className="lp-mock-metric-val">8,400 rps</span>
                  </div>
                  <div className="lp-mock-metric">
                    <Target size={10} color="#10b981" />
                    Availability: <span className="lp-mock-metric-val">99.999% (5 Nines)</span>
                  </div>
                  <div className="lp-mock-metric">
                    <Activity size={10} color="#10b981" />
                    Health: <span className="lp-mock-metric-val" style={{ color: '#10b981', fontWeight: 800 }}>Grade A</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* ═══════════════════════════════════════
         *  COMPONENT LIBRARY
         * ═══════════════════════════════════════ */}
        <section className="lp-section" style={{ padding: '60px 0' }}>
          <AnimatedSection>
            <div className="lp-section-header" style={{ marginBottom: '20px' }}>
              <div className="lp-section-label">
                <Box size={13} />
                Component Library
              </div>
              <h2 className="lp-section-title" style={{ fontSize: '2.5rem' }}>90+ Cloud Modules</h2>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="lp-category-title">Compute & Microservices</div>
            <div className="lp-marquee-wrap" style={{ padding: '20px 0', maskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)' }}>
              <div className="lp-marquee-track">
                {[...computeItems, ...computeItems, ...computeItems].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div className="lp-catalog-card" key={`compute-${i}`}>
                      <div className="lp-catalog-icon"><Icon size={24} strokeWidth={1.5} /></div>
                      <span className="lp-catalog-label">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <div className="lp-category-title">Databases & Storage</div>
            <div className="lp-marquee-wrap" style={{ padding: '20px 0', maskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)' }}>
              <div className="lp-marquee-track reverse">
                {[...dataItems, ...dataItems, ...dataItems].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div className="lp-catalog-card" key={`data-${i}`}>
                      <div className="lp-catalog-icon"><Icon size={24} strokeWidth={1.5} /></div>
                      <span className="lp-catalog-label">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.3}>
            <div className="lp-category-title">Networking & Security</div>
            <div className="lp-marquee-wrap" style={{ padding: '20px 0', maskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)' }}>
              <div className="lp-marquee-track">
                {[...networkItems, ...networkItems, ...networkItems].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div className="lp-catalog-card" key={`network-${i}`}>
                      <div className="lp-catalog-icon"><Icon size={24} strokeWidth={1.5} /></div>
                      <span className="lp-catalog-label">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </AnimatedSection>
        </section>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  FEATURES GRID
         * ═══════════════════════════════════════ */}
        <section id="features" className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label">
                <Sparkles size={13} />
                Features
              </div>
              <h2 className="lp-section-title">Everything you need to<br />architect at scale</h2>
              <p className="lp-section-desc">
                From drag-and-drop design to real-time failure simulation — ArchViz is the
                complete toolkit for modern system design.
              </p>
            </div>
          </AnimatedSection>

          <div className="lp-features-grid">
            <AnimatedSection className="lp-feature-card lp-feature-card-large" delay={0.05}>
              <div className="lp-feature-icon"><Activity size={24} /></div>
              <h3>Live Traffic Simulation</h3>
              <p>
                Simulate up to 10M concurrent users and watch your architecture respond in real-time.
                Identify bottlenecks before they become production issues. Adjust traffic with a slider
                and watch load percentages, latency, and health scores update instantly.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.1}>
              <div className="lp-feature-icon"><DollarSign size={24} /></div>
              <h3>Instant Cost Estimation</h3>
              <p>
                Calculate realistic cloud costs per month based on component tiers, instance counts,
                traffic volume, and pricing models (on-demand, reserved, spot).
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.15}>
              <div className="lp-feature-icon"><RefreshCcw size={24} /></div>
              <h3>Connection Validation</h3>
              <p>
                Smart rules engine prevents invalid service connections. Get instant toast notifications
                when incompatible components are linked together.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.2}>
              <div className="lp-feature-icon"><Zap size={24} /></div>
              <h3>Failure Injection</h3>
              <p>
                Test resilience with chaos engineering events: server crash, CDN failure,
                traffic spike (10x), cache removal, and database failover — all from the menu.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-large" delay={0.25}>
              <div className="lp-feature-icon"><Gauge size={24} /></div>
              <h3>Real-Time Metrics Engine</h3>
              <p>
                The bottom insight bar calculates and displays 5 critical metrics in real-time:
                monthly cost, P95 latency, health score with letter grade, throughput (rps),
                and availability percentage. Warnings are surfaced automatically.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.3}>
              <div className="lp-feature-icon"><Cpu size={24} /></div>
              <h3>AI Recommendations</h3>
              <p>
                Intelligent recommendation engine suggests optimizations for horizontal scaling,
                cache placement, read replicas, and cost reduction.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.35}>
              <div className="lp-feature-icon"><Database size={24} /></div>
              <h3>Deep Component Config</h3>
              <p>
                Configure every component with real-world settings: max connections, read replicas,
                eviction policies, TLS enforcement, MFA, and more.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.4}>
              <div className="lp-feature-icon"><Fingerprint size={24} /></div>
              <h3>Local-First Privacy</h3>
              <p>
                All designs stay on your device. No accounts, no tracking, no cloud dependency.
                Designs are saved to localStorage with full version history.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.45}>
              <div className="lp-feature-icon"><LayoutTemplate size={24} /></div>
              <h3>10+ Pre-built Templates</h3>
              <p>
                Learn from reverse-engineered architectures of Netflix, Instagram, Uber, Spotify,
                and more. Or start with proven architectural patterns.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.5}>
              <div className="lp-feature-icon"><Download size={24} /></div>
              <h3>Export & Share</h3>
              <p>
                Export your designs as high-resolution PNG images or JSON files for version control.
                Import previously saved architectures with one click.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.55}>
              <div className="lp-feature-icon"><GitBranch size={24} /></div>
              <h3>Version History</h3>
              <p>
                Every change is snapshotted. Travel back in time with the version history drawer,
                undo/redo support, and named save points.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.6}>
              <div className="lp-feature-icon"><Palette size={24} /></div>
              <h3>Professional UI</h3>
              <p>
                Figma-quality workspace with collapsible sidebars, property panels, mini-map,
                right-click context menu, and keyboard-first workflow.
              </p>
            </AnimatedSection>

            {/* ── Enterprise Features ── */}
            <AnimatedSection className="lp-feature-card lp-feature-card-large lp-feature-card-enterprise" delay={0.65}>
              <div className="lp-feature-badge-new">NEW — Enterprise</div>
              <div className="lp-feature-icon" style={{ color: '#6366f1' }}><FileCode size={24} /></div>
              <h3>Infrastructure-as-Code Export</h3>
              <p>
                Turn your visual designs into deployable code. Export to <strong>Terraform (.tf)</strong> or
                <strong> AWS CloudFormation (.json)</strong> with a single click. Generates VPC scaffolding,
                security groups, instance configurations, and inter-resource references — a visual cloud compiler.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.7}>
              <div className="lp-feature-badge-new">NEW — Enterprise</div>
              <div className="lp-feature-icon" style={{ color: '#ec4899' }}><ShieldAlert size={24} /></div>
              <h3>Compliance & Security Scanner</h3>
              <p>
                25 architectural security rules scan for SOC2, HIPAA, PCI-DSS, GDPR, and NIST compliance violations.
                Detects publicly routable databases, missing WAF, no MFA, encryption gaps, and more — with remediation guidance.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.75}>
              <div className="lp-feature-badge-new">NEW — Enterprise</div>
              <div className="lp-feature-icon" style={{ color: '#10b981' }}><Target size={24} /></div>
              <h3>SLA/SLO Reliability Calculator</h3>
              <p>
                Advanced math-driven composite SLA calculator. Analyzes serial and parallel dependency paths,
                instance redundancy, Multi-AZ boosts, and DR strategies. Displays availability in "nines" notation with downtime estimates.
              </p>
            </AnimatedSection>
          </div>
        </section>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  ENTERPRISE SIMULATIONS
         * ═══════════════════════════════════════ */}
        <section className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label">
                <Zap size={13} />
                Enterprise Simulations
              </div>
              <h2 className="lp-section-title">Enterprise-Grade<br />System Simulations</h2>
              <p className="lp-section-desc">
                Go beyond static diagrams. ArchViz simulates real-world failure scenarios,
                environmental impact, and deployment strategies — all in real-time on the canvas.
              </p>
            </div>
          </AnimatedSection>

          <div className="lp-features-grid" style={{ maxWidth: 960 }}>
            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.1}>
              <div className="lp-feature-badge-new" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>CHAOS ENGINEERING</div>
              <div className="lp-feature-icon" style={{ color: '#ef4444' }}><MapPin size={24} /></div>
              <h3>Chaos Engineering &amp; Disaster Recovery</h3>
              <p>
                Simulate region-wide outages and test your multi-AZ failover strategies in real-time.
                Watch traffic automatically reroute to healthy regions, view latency penalties, and validate
                your DR runbook — all without touching production. Trigger server crashes, CDN failures,
                database failovers, and 10x traffic spikes from the simulation menu.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.2}>
              <div className="lp-feature-badge-new" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.2)' }}>GREENOPS</div>
              <div className="lp-feature-icon" style={{ color: '#10b981' }}><Leaf size={24} /></div>
              <h3>GreenOps Carbon Heatmap</h3>
              <p>
                Visualize your architecture's environmental impact with the carbon heatmap overlay.
                Each node is tinted based on its estimated CO₂ footprint — green for serverless/clean-grid regions,
                yellow for standard compute, and red for GPU instances in high-carbon grids. Get AI-powered
                recommendations to migrate workloads to greener regions.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-large lp-feature-card-enterprise" delay={0.3}>
              <div className="lp-feature-badge-new" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.2)' }}>LIVE DEPLOYMENT</div>
              <div className="lp-feature-icon" style={{ color: '#818cf8' }}><GitBranch size={24} /></div>
              <h3>Live Deployment Visualizer</h3>
              <p>
                Watch Blue/Green and Canary deployments unfold in real-time on the canvas. Trigger a deployment
                on any compute cluster and watch traffic shift from v1 (Blue) to v2 (Green) over a 10-second
                rollout — edges animate with traffic weight percentages (100/0 → 50/50 → 0/100), nodes display
                version badges, and a "Deployment Successful" toast fires on completion. Understand deployment
                strategies visually, not theoretically.
              </p>
            </AnimatedSection>
          </div>
        </section>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  HOW IT WORKS
         * ═══════════════════════════════════════ */}
        <section className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label">
                <Workflow size={13} />
                How It Works
              </div>
              <h2 className="lp-section-title">From zero to architecture<br />in 60 seconds</h2>
              <p className="lp-section-desc">
                Four simple steps to design, validate, and optimize your system.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection>
            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-line" />
                <div className="lp-step-number">01</div>
                <h4>Drag & Drop</h4>
                <p>Choose from 40+ cloud components in the sidebar and drag them onto the infinite canvas.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-line" />
                <div className="lp-step-number">02</div>
                <h4>Connect & Configure</h4>
                <p>Draw edges between components to define data flow. Configure tiers, instances, and settings.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-line" />
                <div className="lp-step-number">03</div>
                <h4>Simulate Traffic</h4>
                <p>Slide the concurrent users control from 100 to 10M and watch real-time bottleneck detection.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-number">04</div>
                <h4>Optimize & Export</h4>
                <p>Follow AI recommendations, reduce costs, improve availability, and export your final design.</p>
              </div>
            </div>
          </AnimatedSection>
        </section>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  STATS
         * ═══════════════════════════════════════ */}
        <AnimatedSection>
          <div className="lp-stats-bar">
            <div className="lp-stat">
              <div className="lp-stat-value">40+</div>
              <div className="lp-stat-label">Cloud Components</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-value">8</div>
              <div className="lp-stat-label">Simulation Engines</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-value">5</div>
              <div className="lp-stat-label">Chaos Events</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-value">∞</div>
              <div className="lp-stat-label">Canvas Size</div>
            </div>
          </div>
        </AnimatedSection>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  COMPARISON TABLE
         * ═══════════════════════════════════════ */}
        <section id="comparison" className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label">
                <Shield size={13} />
                Comparison
              </div>
              <h2 className="lp-section-title">Why ArchViz stands out</h2>
              <p className="lp-section-desc">
                See how ArchViz compares to traditional whiteboarding, Excalidraw, and Lucidchart.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="lp-comparison-wrapper">
              <table className="lp-comparison">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th className="lp-col-highlight">ArchViz</th>
                    <th>Excalidraw</th>
                    <th>Lucidchart</th>
                    <th>Whiteboard</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="lp-feature-name">Drag-and-drop components</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-partial">Shapes only</span></td>
                    <td><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Live traffic simulation</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Real-time cost estimation</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Failure injection / chaos</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Bottleneck detection</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">AI-powered recommendations</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Connection validation rules</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-partial">Basic</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Pre-built architecture templates</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-partial">Limited</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Local-first / no account</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-check">✓</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">100% Free</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-check">✓</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">IaC Export (Terraform / CloudFormation)</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Security / Compliance Scanner</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">SLA / SLO Calculator</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </AnimatedSection>
        </section>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  KEYBOARD SHORTCUTS
         * ═══════════════════════════════════════ */}
        <section className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label">
                <Keyboard size={13} />
                Shortcuts
              </div>
              <h2 className="lp-section-title">Keyboard-first design</h2>
              <p className="lp-section-desc">
                Speed up your workflow with built-in keyboard shortcuts for every action.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="lp-shortcuts-grid">
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">Ctrl</span>
                  <span className="lp-kbd">S</span>
                </div>
                <span className="lp-shortcut-desc">Save design</span>
              </div>
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">Ctrl</span>
                  <span className="lp-kbd">Z</span>
                </div>
                <span className="lp-shortcut-desc">Undo action</span>
              </div>
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">Ctrl</span>
                  <span className="lp-kbd">Y</span>
                </div>
                <span className="lp-shortcut-desc">Redo action</span>
              </div>
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">Ctrl</span>
                  <span className="lp-kbd">E</span>
                </div>
                <span className="lp-shortcut-desc">Export as PNG</span>
              </div>
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">Del</span>
                </div>
                <span className="lp-shortcut-desc">Delete selected</span>
              </div>
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">Esc</span>
                </div>
                <span className="lp-shortcut-desc">Deselect all</span>
              </div>
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">F11</span>
                </div>
                <span className="lp-shortcut-desc">Toggle fullscreen</span>
              </div>
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">Ctrl</span>
                  <span className="lp-kbd">K</span>
                </div>
                <span className="lp-shortcut-desc">Search palette</span>
              </div>
              <div className="lp-shortcut-item">
                <div className="lp-shortcut-keys">
                  <span className="lp-kbd">?</span>
                </div>
                <span className="lp-shortcut-desc">Show all shortcuts</span>
              </div>
            </div>
          </AnimatedSection>
        </section>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  FAMOUS ARCHITECTURE TEMPLATES
         * ═══════════════════════════════════════ */}
        <section id="templates" className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label">
                <Server size={13} />
                Famous Architectures
              </div>
              <h2 className="lp-section-title">Learn from the tech giants</h2>
              <p className="lp-section-desc">
                Reverse-engineered architectures of billion-user platforms.
                Load, explore, and modify to understand how they scale.
              </p>
            </div>
          </AnimatedSection>

          <div className="lp-templates-grid">
            {famousSystemTemplates.map((template, idx) => {
              const Icon = brandIcons[template.id] || Box;
              return (
                <AnimatedSection key={template.id} delay={0.05 * idx}>
                  <button
                    className="lp-template-card"
                    onClick={() => handleTemplateSelect(template)}
                    disabled={!!loadingId}
                    style={{ opacity: loadingId && loadingId !== template.id ? 0.35 : 1, width: '100%' }}
                  >
                    <div className="lp-template-top">
                      <div className={`lp-template-icon ${template.id}`}>
                        <Icon size={22} strokeWidth={1.5} />
                      </div>
                      <div className="lp-template-info">
                        <span className="lp-template-name">{template.name}</span>
                        <span className="lp-template-meta">
                          {template.nodeCount} components · ~${template.baselineCost}/mo
                        </span>
                      </div>
                      <ArrowRight size={16} className="lp-template-arrow" />
                    </div>
                    <p className="lp-template-desc">{template.description}</p>
                    <div className="lp-template-insight">
                      <Zap size={14} strokeWidth={2.5} />
                      <span>{template.keyInsight}</span>
                    </div>
                  </button>
                </AnimatedSection>
              );
            })}
          </div>
        </section>

        {/* ── Starters ── */}
        <AnimatedSection>
          <div className="lp-section-header" style={{ paddingTop: 40 }}>
            <div className="lp-section-label">
              <Layers size={13} />
              Starter Templates
            </div>
            <h2 className="lp-section-title">Or start with a pattern</h2>
            <p className="lp-section-desc">
              Skip boilerplate with proven architectural patterns ready for customization.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="lp-starters-grid" style={{ paddingBottom: 80 }}>
            {starterTemplates.map(template => {
              const Icon = starterIcons[template.id] || Box;
              return (
                <button
                  key={template.id}
                  className="lp-starter-card"
                  onClick={() => handleTemplateSelect(template)}
                  disabled={!!loadingId}
                  style={{ opacity: loadingId && loadingId !== template.id ? 0.35 : 1 }}
                >
                  <div className="lp-starter-icon">
                    <Icon size={18} strokeWidth={1.5} />
                  </div>
                  <div className="lp-starter-text">
                    <span className="lp-starter-name">{template.name}</span>
                    <span className="lp-starter-meta">
                      {template.nodeCount} nodes · ~${template.baselineCost}/mo
                    </span>
                  </div>
                  <ArrowRight size={14} className="lp-starter-arrow" />
                </button>
              );
            })}
          </div>
        </AnimatedSection>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  FREE BANNER
         * ═══════════════════════════════════════ */}
        <section className="lp-section">
          <AnimatedSection>
            <div className="lp-free-banner">
              <div className="lp-free-price">$0</div>
              <p className="lp-free-subtitle">
                ArchViz is completely free and open. No sign-up. No limits.
              </p>
              <div className="lp-free-features">
                <div className="lp-free-feature"><Check size={14} /> Unlimited designs</div>
                <div className="lp-free-feature"><Check size={14} /> All 40+ components</div>
                <div className="lp-free-feature"><Check size={14} /> Full simulation engine</div>
                <div className="lp-free-feature"><Check size={14} /> All templates included</div>
                <div className="lp-free-feature"><Check size={14} /> PNG & JSON export</div>
                <div className="lp-free-feature"><Check size={14} /> No tracking</div>
                <div className="lp-free-feature"><Check size={14} /> Local-first storage</div>
                <div className="lp-free-feature"><Check size={14} /> Version history</div>
              </div>
              <button className="lp-btn-primary" onClick={handleBlankCanvas}>
                <Plus size={18} strokeWidth={2.5} />
                Start Building Now
              </button>
            </div>
          </AnimatedSection>
        </section>

        {/* ═══════════════════════════════════════
         *  FINAL CTA
         * ═══════════════════════════════════════ */}
        <section className="lp-cta-section">
          <AnimatedSection>
            <h2>Ready to architect<br />your next system?</h2>
            <p>
              Join thousands of developers who design, simulate, and optimize
              their systems before writing code.
            </p>
            <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
              <button className="lp-btn-primary" onClick={handleBlankCanvas}>
                <Plus size={18} strokeWidth={2.5} />
                Open Workspace
              </button>
              <button className="lp-btn-secondary" onClick={() => scrollTo('templates')}>
                <LayoutTemplate size={18} />
                Browse Templates
              </button>
            </div>
          </AnimatedSection>
        </section>

        {/* ═══════════════════════════════════════
         *  FOOTER
         * ═══════════════════════════════════════ */}
        <footer className="lp-footer-pro">
          <div className="lp-footer-content">
            <div className="lp-footer-logo">
              <BrainCircuit size={24} />
              <span>ArchViz</span>
            </div>

            <div className="lp-footer-copyright">
              © {new Date().getFullYear()} ArchViz Simulator. All rights reserved. Built for elite system designers.
            </div>

            <div className="lp-footer-socials">
              <a href="https://github.com/imkrish0011" target="_blank" rel="noopener noreferrer" className="lp-social-link" aria-label="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              </a>
              <a href="https://twitter.com/signin_as_krish" target="_blank" rel="noopener noreferrer" className="lp-social-link" aria-label="Twitter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <a href="mailto:krish.qcai@gmail.com" className="lp-social-link" aria-label="Email">
                <Mail size={18} />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
