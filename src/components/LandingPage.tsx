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
  FileCode, ShieldAlert, Target, Mail, Leaf,
  Warehouse, PackageOpen, LayoutDashboard, ArrowLeftRight, FileText, Cog, LayoutGrid,
  FolderOpen, CloudUpload, LogIn
} from 'lucide-react';
import '../styles/landing.css';
import { famousSystemTemplates, gameTemplates, nonGameFamousTemplates } from '../data/templates/famousSystemTemplates';
import { starterTemplates } from '../data/templates/starterTemplates';
import { useArchStore } from '../store/useArchStore';
import { instantiateTemplate, loadTemplateWithAnimation } from '../utils/templateLoader';
import type { Template } from '../types';

/* ── Brand icon mapping ── */
const brandIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  instagram: Camera, netflix: Tv, whatsapp: MessageCircle, uber: Car,
  spotify: Music, 'google-search': Search, stripe: CreditCard, tiktok: Film,
  amazon: ShoppingCart, 'x-twitter': MessageSquare, airbnb: MapPin, pinterest: Users,
  youtube: Video, cloudflare: Globe,
};

/* ── Game brand icon mapping ── */
const gameIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  steam: Gamepad2, discord: Disc, fortnite: Gamepad2, valorant: Gamepad2,
  roblox: Gamepad2, 'world-of-warcraft': Gamepad2, minecraft: Gamepad2,
};

/* ── Starter icon mapping ── */
const starterIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  'basic-web': Globe, 'chat-app': MessageSquare, 'video-streaming': Video,
  ecommerce: ShoppingCart, 'food-delivery': MapPin, 'social-media': Users,
  microservices: Blocks, serverless: Cloud,
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
  { label: 'Docker Container', icon: Box },
  { label: 'Container Registry', icon: PackageOpen },
  { label: 'Log Aggregator', icon: FileText },
  { label: 'Headless CMS', icon: LayoutDashboard },
  { label: 'AWS SageMaker', icon: BrainCircuit },
  { label: 'Vertex AI', icon: Sparkles },
  { label: 'Apache Airflow', icon: Clock },
  { label: 'Argo CD', icon: RefreshCcw },
  { label: 'Terraform Cloud', icon: Layers },
  { label: 'vLLM Engine', icon: BrainCircuit },
  { label: 'Temporal Worker', icon: Clock },
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
  { label: 'Data Lake', icon: Warehouse },
  { label: 'Block Storage', icon: HardDrive },
  { label: 'ClickHouse', icon: Database },
  { label: 'Supabase', icon: Database },
  { label: 'CockroachDB', icon: Globe },
  { label: 'Feature Store', icon: Layers },
  { label: 'Snowflake DW', icon: Database },
  { label: 'Vector DB', icon: Database },
  { label: 'Databricks', icon: Warehouse },
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
  { label: 'Reverse Proxy', icon: ArrowLeftRight },
  { label: 'VPN Gateway', icon: Lock },
  { label: 'Webhook Handler', icon: Webhook },
  { label: 'Fastly CDN', icon: Gauge },
  { label: 'Cloudflare ZT', icon: Shield },
  { label: 'AWS KMS', icon: Lock },
  { label: 'Okta SSO', icon: Fingerprint },
  { label: 'Sentry APM', icon: Activity },
  { label: 'PagerDuty', icon: Zap },
  { label: 'OpenTelemetry', icon: Eye },
  { label: 'Hugging Face', icon: Sparkles },
  { label: 'Firebase FCM', icon: Zap },
  { label: 'Slack API', icon: MessageSquare },
  { label: 'Istio Mesh', icon: Network },
];

interface LandingPageProps {
  onLaunch: (isTemplate?: boolean) => void;
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

/* ── Animated Counter ── */
function AnimatedCounter({ end, suffix = '', prefix = '', duration = 1800 }: {
  end: number; suffix?: string; prefix?: string; duration?: number;
}) {
  const { ref, inView } = useInView(0.3);
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ── Multi-Cloud Arbitrage Visualizer ── */
type ArbitrageProvider = 'aws' | 'azure' | 'gcp';

interface ArbitrageService {
  label: string;
  spec: string;
  aws: { name: string; cost: number };
  azure: { name: string; cost: number };
  gcp: { name: string; cost: number };
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
}

/* Pricing based on on-demand us-east / US rates as of April 2026.
   Scenario: Production SaaS — 3× compute, 5 TB storage, managed DB, 
   50M serverless invocations, 10 TB CDN egress, 13 GB Redis cache. */
const arbitrageServices: ArbitrageService[] = [
  {
    label: 'Compute',
    spec: '3× 4 vCPU · 16 GB',
    icon: Server,
    aws:   { name: 'EC2 m5.xlarge',        cost: 415 },
    azure: { name: 'D4s v5',               cost: 420 },
    gcp:   { name: 'n2-standard-4',        cost: 389 },
  },
  {
    label: 'Object Storage',
    spec: '5 TB Standard',
    icon: HardDrive,
    aws:   { name: 'S3 Standard',          cost: 118 },
    azure: { name: 'Blob Storage Hot',     cost: 92 },
    gcp:   { name: 'Cloud Storage Std',    cost: 105 },
  },
  {
    label: 'Managed Database',
    spec: 'PostgreSQL · 4 vCPU · 500 GB',
    icon: Database,
    aws:   { name: 'RDS db.r6g.xlarge',    cost: 380 },
    azure: { name: 'Azure SQL 4 vCore',    cost: 445 },
    gcp:   { name: 'Cloud SQL db-custom',  cost: 350 },
  },
  {
    label: 'Serverless Functions',
    spec: '50M invocations · 256 MB',
    icon: Zap,
    aws:   { name: 'Lambda',               cost: 42 },
    azure: { name: 'Azure Functions',      cost: 45 },
    gcp:   { name: 'Cloud Run Functions',  cost: 38 },
  },
  {
    label: 'CDN / Edge',
    spec: '10 TB egress · Global',
    icon: Globe,
    aws:   { name: 'CloudFront',           cost: 850 },
    azure: { name: 'Front Door CDN',       cost: 810 },
    gcp:   { name: 'Cloud CDN',            cost: 800 },
  },
  {
    label: 'In-Memory Cache',
    spec: 'Redis · 13 GB · HA',
    icon: Flame,
    aws:   { name: 'ElastiCache r7g',      cost: 320 },
    azure: { name: 'Azure Cache P2',       cost: 405 },
    gcp:   { name: 'Memorystore',          cost: 290 },
  },
];

/* Provider SVG logos (simplified official marks) */
const AwsLogo = () => (
  <svg width="20" height="12" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.2 17.6c-3.8 2.8-9.4 4.3-14.1 4.3-.7 0-1.3-.1-2-.1.4.4 4.4-2.9 10-6.5 1.4-.8 2.9-1.2 4.2-1.2 2 0 3.5.8 3.5 2.3 0 .4-.2.8-.5 1.2" transform="translate(6 0)" fill="#FF9900"/>
    <path d="M7 5.8l1.7 7.7h.1L11 5.8h2.3l2.2 7.7h.1l1.7-7.7h2.5L16.5 16h-2.4l-2.3-7.5h-.1L9.5 16H7L3.7 5.8H7z" fill="#fff"/>
  </svg>
);

const AzureLogo = () => (
  <svg width="18" height="16" viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.8 0L1 12.5h4.2L10.6 0H6.8zM7.2 9.3L3.4 16h12.1l-3-4.5L7.2 9.3z" fill="#0078D4"/>
  </svg>
);

const GcpLogo = () => (
  <svg width="18" height="16" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.1 3.4l2.1-2.1.1-.9C15.5-.5 13 -.3 10.8.5 8.6 1.4 6.8 3.1 5.8 5.2l.1 0 3.5-.5.3-.3c1.2-1.3 3-2 4.8-1.7l.6.7z" fill="#EA4335"/>
    <path d="M19.5 6.4c-.7-2-2-3.6-3.8-4.7l-3 3c1.4.7 2.5 2 2.8 3.5v.5c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5H12l-.5.5v3l.5.5h3.5c3.3 0 6-2.7 6-6 0-2.3-1.3-4.3-3.2-5.3" fill="#4285F4"/>
    <path d="M8 17.7h3.5V14.2H8c-.4 0-.7-.1-1-.2l-.7.2-2 2-.2.7C5.3 17.4 6.6 17.7 8 17.7" fill="#34A853"/>
    <path d="M8 5.7C4.7 5.7 2 8.4 2 11.7c0 2 1 3.8 2.5 4.9l2.9-2.9c-1-.5-1.7-1.6-1.7-2.8 0-1.7 1.3-3 3-3s3 1.3 3 3l2.9-2.9C13.2 7 10.8 5.7 8 5.7" fill="#FBBC05"/>
  </svg>
);

const providerLogos: Record<ArbitrageProvider, () => JSX.Element> = {
  aws: AwsLogo,
  azure: AzureLogo,
  gcp: GcpLogo,
};

const providerMeta: Record<ArbitrageProvider, { label: string; fullName: string; color: string }> = {
  aws:   { label: 'AWS',   fullName: 'Amazon Web Services', color: '#FF9900' },
  azure: { label: 'Azure', fullName: 'Microsoft Azure',     color: '#0078D4' },
  gcp:   { label: 'GCP',   fullName: 'Google Cloud',        color: '#4285F4' },
};

function ArbitrageVisualizer() {
  const [provider, setProvider] = useState<ArbitrageProvider>('aws');
  const [displayCost, setDisplayCost] = useState(0);
  const { ref } = useInView(0.15);

  const totalCost = arbitrageServices.reduce((sum, s) => sum + s[provider].cost, 0);
  const allTotals: Record<ArbitrageProvider, number> = {
    aws: arbitrageServices.reduce((s, v) => s + v.aws.cost, 0),
    azure: arbitrageServices.reduce((s, v) => s + v.azure.cost, 0),
    gcp: arbitrageServices.reduce((s, v) => s + v.gcp.cost, 0),
  };
  const maxCost = Math.max(allTotals.aws, allTotals.azure, allTotals.gcp);
  const savingsPercent = Math.round(((maxCost - totalCost) / maxCost) * 100);

  useEffect(() => {
    const start = displayCost;
    const end = totalCost;
    const duration = 600;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCost(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCost]);

  const meta = providerMeta[provider];

  return (
    <section className="lp-section lp-arbitrage-section" ref={ref}>
      <AnimatedSection>
        <div className="lp-section-header">
          <div className="lp-section-label" style={{ borderColor: `${meta.color}33` }}>
            <ArrowLeftRight size={13} />
            Multi-Cloud Arbitrage
          </div>
          <h2 className="lp-section-title">
            One architecture.<br />Three price tags.
          </h2>
          <p className="lp-section-desc">
            Toggle between AWS, Azure, and GCP to see how the same production stack
            costs differently. On-demand pricing, US regions, April 2026.
          </p>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.1}>
        {/* ── Provider Toggle with Logos ── */}
        <div className="lp-arb-toggle-wrap">
          <div className="lp-arb-toggle" role="radiogroup" aria-label="Cloud provider selector">
            {(['aws', 'azure', 'gcp'] as ArbitrageProvider[]).map(p => {
              const Logo = providerLogos[p];
              return (
                <button
                  key={p}
                  className={`lp-arb-toggle-btn${provider === p ? ' active' : ''}`}
                  onClick={() => setProvider(p)}
                  role="radio"
                  aria-checked={provider === p}
                >
                  <span className="lp-arb-toggle-logo"><Logo /></span>
                  <span className="lp-arb-toggle-label">{providerMeta[p].label}</span>
                </button>
              );
            })}
            <div
              className="lp-arb-toggle-pill"
              style={{
                transform: `translateX(${(['aws', 'azure', 'gcp'].indexOf(provider)) * 100}%)`,
                background: `${meta.color}18`,
                borderColor: `${meta.color}40`,
                boxShadow: `0 0 24px ${meta.color}20`,
              }}
            />
          </div>
        </div>

        {/* ── Scenario Label ── */}
        <div className="lp-arb-scenario">
          <span className="lp-arb-scenario-dot" style={{ background: meta.color }} />
          <span>Production SaaS Stack</span>
          <span className="lp-arb-scenario-sep">·</span>
          <span>3× Compute, Managed DB, 10 TB CDN, Redis HA, Serverless</span>
        </div>

        {/* ── Service Cards Grid ── */}
        <div className="lp-arb-grid">
          {arbitrageServices.map((service, idx) => {
            const Icon = service.icon;
            const current = service[provider];
            const serviceMax = Math.max(service.aws.cost, service.azure.cost, service.gcp.cost);
            const barPercent = Math.round((current.cost / serviceMax) * 100);
            return (
              <div
                key={idx}
                className="lp-arb-card"
                style={{ '--arb-accent': meta.color } as React.CSSProperties}
              >
                <div className="lp-arb-card-header">
                  <div className="lp-arb-card-icon" style={{ background: `${meta.color}12`, borderColor: `${meta.color}25` }}>
                    <Icon size={18} strokeWidth={1.5} style={{ color: meta.color }} />
                  </div>
                  <div className="lp-arb-card-meta">
                    <span className="lp-arb-card-label">{service.label}</span>
                    <span className="lp-arb-card-spec">{service.spec}</span>
                  </div>
                  <div className="lp-arb-card-cost">
                    <span className="lp-arb-card-price">${current.cost.toLocaleString()}</span>
                    <span className="lp-arb-card-mo">/mo</span>
                  </div>
                </div>
                <div className="lp-arb-card-bottom">
                  <span className="lp-arb-card-name" key={`${provider}-${idx}`}>{current.name}</span>
                  <div className="lp-arb-card-bar-track">
                    <div
                      className="lp-arb-card-bar-fill"
                      style={{ width: `${barPercent}%`, background: meta.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── All-Provider Comparison Strip ── */}
        <div className="lp-arb-compare-strip">
          {(['aws', 'azure', 'gcp'] as ArbitrageProvider[]).map(p => {
            const total = allTotals[p];
            const pMeta = providerMeta[p];
            const PLogo = providerLogos[p];
            const isActive = provider === p;
            const cheapest = Math.min(allTotals.aws, allTotals.azure, allTotals.gcp);
            const barW = Math.round((total / maxCost) * 100);
            return (
              <button
                key={p}
                className={`lp-arb-compare-row${isActive ? ' active' : ''}${total === cheapest ? ' cheapest' : ''}`}
                onClick={() => setProvider(p)}
                style={{ '--arb-c': pMeta.color } as React.CSSProperties}
              >
                <span className="lp-arb-compare-logo"><PLogo /></span>
                <span className="lp-arb-compare-name">{pMeta.label}</span>
                <span className="lp-arb-compare-bar-track">
                  <span className="lp-arb-compare-bar-fill" style={{ width: `${barW}%`, background: pMeta.color }} />
                </span>
                <span className="lp-arb-compare-price">${total.toLocaleString()}</span>
                {total === cheapest && <span className="lp-arb-cheapest-tag">Cheapest</span>}
              </button>
            );
          })}
        </div>

        {/* ── Total Cost Bar ── */}
        <div className="lp-arb-cost-bar" style={{ borderColor: `${meta.color}30` }}>
          <div className="lp-arb-cost-left">
            <div className="lp-arb-cost-dot" style={{ background: meta.color, boxShadow: `0 0 12px ${meta.color}60` }} />
            <span className="lp-arb-cost-label">
              Estimated Monthly Total
              <span className="lp-arb-cost-provider" style={{ color: meta.color }}> — {meta.fullName}</span>
            </span>
          </div>
          <div className="lp-arb-cost-right">
            {savingsPercent > 0 && (
              <span className="lp-arb-savings-badge" key={provider} style={{ background: `${meta.color}15`, color: meta.color, borderColor: `${meta.color}30` }}>
                ↓ {savingsPercent}% vs most expensive
              </span>
            )}
            <span className="lp-arb-cost-total" style={{ color: meta.color }}>
              ${displayCost.toLocaleString()}
            </span>
            <span className="lp-arb-cost-suffix">/mo</span>
          </div>
        </div>

        <p className="lp-arb-disclaimer">
          Prices reflect on-demand, public list rates for US regions (April 2026). Actual costs vary by region, commitment, and usage.
        </p>
      </AnimatedSection>
    </section>
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
            onLaunch(true);
          }
        );
      }, 50);
    },
    [clearCanvas, setNodes, setEdges, loadTemplate, onLaunch]
  );

  const handleBlankCanvas = useCallback(() => {
    clearCanvas();
    onLaunch(false);
  }, [clearCanvas, onLaunch]);

  /* ── Scroll-reactive navbar ── */
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    const container = document.querySelector('.landing-container');
    if (!container) return;

    const handleScroll = () => {
      setNavScrolled(container.scrollTop > 60);

      // Determine which section is in view
      const sections = ['features', 'preview', 'templates', 'comparison'];
      let current = '';
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom > 100) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
      <nav className={`lp-nav${navScrolled ? ' lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-logo">
          <BrainCircuit size={22} />
          <span>ArchViz  β</span>
        </div>
        <div className="lp-nav-center">
          <div className="lp-nav-links">
            <button className={`lp-nav-link${activeSection === 'features' ? ' lp-nav-link-active' : ''}`} onClick={() => scrollTo('features')}>Features</button>
            <button className={`lp-nav-link${activeSection === 'preview' ? ' lp-nav-link-active' : ''}`} onClick={() => scrollTo('preview')}>Preview</button>
            <button className={`lp-nav-link${activeSection === 'templates' ? ' lp-nav-link-active' : ''}`} onClick={() => scrollTo('templates')}>Templates</button>
            <button className={`lp-nav-link${activeSection === 'comparison' ? ' lp-nav-link-active' : ''}`} onClick={() => scrollTo('comparison')}>Compare</button>
          </div>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-nav-cta-ghost" onClick={() => onLaunch()}>
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
              <span className="lp-trust-value"><AnimatedCounter end={150} suffix="+" /></span>
              <span className="lp-trust-label">Components</span>
            </div>
            <div className="lp-trust-divider" />
            <div className="lp-trust-item">
              <span className="lp-trust-value"><AnimatedCounter end={40} suffix="+" /></span>
              <span className="lp-trust-label">Templates</span>
            </div>
            <div className="lp-trust-divider" />
            <div className="lp-trust-item">
              <span className="lp-trust-value"><AnimatedCounter end={10} suffix="M" /></span>
              <span className="lp-trust-label">Max Users Sim</span>
            </div>
            <div className="lp-trust-divider" />
            <div className="lp-trust-item">
              <span className="lp-trust-value"><AnimatedCounter end={0} prefix="$" /></span>
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
                archviz-studio.vercel.app — untitled
              </div>
              <div style={{ width: 44 }} />
            </div>
            <div className="lp-preview-body">
              <img
                src="/preview.png"
                alt="ArchViz workspace showing system architecture design with nodes, connections, and real-time metrics"
                className="lp-preview-screenshot"
              />
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
              <h2 className="lp-section-title" style={{ fontSize: '2.5rem' }}>150+ Cloud Modules</h2>
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
            <div className="lp-category-title">AI / ML & DevOps</div>
            <div className="lp-marquee-wrap" style={{ padding: '20px 0', maskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)' }}>
              <div className="lp-marquee-track reverse">
                {[...[
                  { label: 'AWS SageMaker', icon: BrainCircuit },
                  { label: 'Vertex AI', icon: Sparkles },
                  { label: 'Hugging Face', icon: Sparkles },
                  { label: 'OpenAI API', icon: Sparkles },
                  { label: 'Anthropic', icon: Sparkles },
                  { label: 'GitHub Actions', icon: RefreshCcw },
                  { label: 'Argo CD', icon: RefreshCcw },
                  { label: 'Terraform', icon: Layers },
                  { label: 'Jenkins CI', icon: Cog },
                  { label: 'CodePipeline', icon: Layers },
                  { label: 'Sentry', icon: Eye },
                  { label: 'PagerDuty', icon: Zap },
                  { label: 'OpenTelemetry', icon: Activity },
                  { label: 'Okta SSO', icon: Fingerprint },
                  { label: 'AWS KMS', icon: Lock },
                  { label: 'Cloudflare ZT', icon: Shield },
                  { label: 'Apache Airflow', icon: Clock },
                  { label: 'Feature Store', icon: Database },
                ], ...[
                  { label: 'AWS SageMaker', icon: BrainCircuit },
                  { label: 'Vertex AI', icon: Sparkles },
                  { label: 'Hugging Face', icon: Sparkles },
                  { label: 'OpenAI API', icon: Sparkles },
                  { label: 'Anthropic', icon: Sparkles },
                  { label: 'GitHub Actions', icon: RefreshCcw },
                  { label: 'Argo CD', icon: RefreshCcw },
                  { label: 'Terraform', icon: Layers },
                  { label: 'Jenkins CI', icon: Cog },
                  { label: 'CodePipeline', icon: Layers },
                  { label: 'Sentry', icon: Eye },
                  { label: 'PagerDuty', icon: Zap },
                  { label: 'OpenTelemetry', icon: Activity },
                  { label: 'Okta SSO', icon: Fingerprint },
                  { label: 'AWS KMS', icon: Lock },
                  { label: 'Cloudflare ZT', icon: Shield },
                  { label: 'Apache Airflow', icon: Clock },
                  { label: 'Feature Store', icon: Database },
                ]].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div className="lp-catalog-card" key={`ai-${i}`}>
                      <div className="lp-catalog-icon"><Icon size={24} strokeWidth={1.5} /></div>
                      <span className="lp-catalog-label">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.4}>
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
              <h3>40+ Pre-built Templates</h3>
              <p>
                Learn from reverse-engineered architectures of Netflix, Instagram, Uber, Fortnite,
                Valorant, Roblox and more. Or start with proven architectural patterns.
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


            {/* ── Professionalization Sprint ── */}
            <AnimatedSection className="lp-feature-card" delay={0.8}>
              <div className="lp-feature-icon" style={{ color: '#818cf8' }}><Sparkles size={24} /></div>
              <h3>Spring-Physics Micro-Interactions</h3>
              <p>
                Every node entrance, selection, and state change is animated with Framer Motion spring physics.
                The canvas feels alive — components pop into existence and transition smoothly between
                healthy, warning, and critical states.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.85}>
              <div className="lp-feature-badge-new" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}>SECURITY</div>
              <div className="lp-feature-icon" style={{ color: '#f87171' }}><ShieldAlert size={24} /></div>
              <h3>Actionable Security Findings</h3>
              <p>
                Security vulnerabilities are now directly actionable. Click "Fix Node" on any finding
                and the canvas automatically pans and zooms to the affected component, opening its
                config panel so you can remediate without hunting manually.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={0.9}>
              <div className="lp-feature-icon" style={{ color: '#fbbf24' }}><Download size={24} /></div>
              <h3>3× Retina-Quality Export</h3>
              <p>
                Upgraded export engine renders diagrams at 3× pixel density for pixel-perfect
                PNG output on Retina displays and in presentations. Controls, minimap, and
                overlays are automatically excluded from the export frame.
              </p>
            </AnimatedSection>
            <AnimatedSection className="lp-feature-card" delay={0.95}>
              <div className="lp-feature-badge-new" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.2)' }}>NEW</div>
              <div className="lp-feature-icon" style={{ color: '#818cf8' }}><LayoutGrid size={24} /></div>
              <h3>Precision Grid Alignment</h3>
              <p>
                Forget messy diagrams. The canvas auto-enforces a 20×20 pixel snap-to-grid physics engine,
                guaranteeing perfectly symmetrical and professional architectural alignment out of the box.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={1.0}>
              <div className="lp-feature-badge-new" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.2)' }}>NEW</div>
              <div className="lp-feature-icon" style={{ color: '#10b981' }}><Box size={24} /></div>
              <h3>Enterprise Network Grouping</h3>
              <p>
                Model logical isolation visually with scalable network boundaries. Drag drop AWS VPCs,
                Public/Private Subnets, and On-Premises environments that natively encapsulate and bind
                child components via intelligent spatial grouping logic.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card" delay={1.05}>
              <div className="lp-feature-badge-new" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.2)' }}>NEW</div>
              <div className="lp-feature-icon" style={{ color: '#ef4444' }}><ArrowRight size={24} /></div>
              <h3>Advanced Data Flow Routing</h3>
              <p>
                Visually differentiate your traffic flows. Apply edge-based configurations to simulate
                Synchronous APIs (Solid), Asynchronous Events (Dashed), and Firewall Boundaries (Dotted)
                directly from the properties panel.
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

          <div className="lp-features-grid">
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

            {/* ── Enterprise Features ── */}
            <AnimatedSection className="lp-feature-card lp-feature-card-large lp-feature-card-enterprise" delay={0.4}>
              <div className="lp-feature-badge-new">NEW — Enterprise</div>
              <div className="lp-feature-icon" style={{ color: '#6366f1' }}><FileCode size={24} /></div>
              <h3>Infrastructure-as-Code Expansion Pack</h3>
              <p>
                Turn your visual designs into deployable code. Export to <strong>Terraform (.tf)</strong>,
                <strong> AWS CloudFormation (.json)</strong>, <strong>Kubernetes Manifests (YAML)</strong>, or
                <strong> Docker Compose</strong> with a single click. Generates VPC scaffolding, deployment templates,
                security groups, and inter-resource references — a visual cloud compiler.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.5}>
              <div className="lp-feature-badge-new">NEW — Enterprise</div>
              <div className="lp-feature-icon" style={{ color: '#06b6d4', textShadow: '0 0 15px rgba(6, 182, 212, 0.5)' }}><Blocks size={24} /></div>
              <h3>Architecture "Snippets"</h3>
              <p>
                Drag and drop <strong>Micro-Architecture Patterns</strong> directly onto your canvas. Instantly instantiate
                best-practice modules like <span style={{ color: 'var(--accent)' }}>Serverless CRUD APIs</span>,
                <span style={{ color: 'var(--accent)' }}> CQRS Event Sourcing</span>,
                <span style={{ color: 'var(--accent)' }}> RAG AI Pipelines</span>, or
                <span style={{ color: 'var(--accent)' }}> Real-Time Data Pipelines</span> orchestrated via Kafka and Snowflake with a single click.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.6}>
              <div className="lp-feature-badge-new">NEW — Enterprise</div>
              <div className="lp-feature-icon" style={{ color: '#f59e0b', textShadow: '0 0 15px rgba(245, 158, 11, 0.5)' }}><Cloud size={24} /></div>
              <h3>Instant Cost Arbitrage</h3>
              <p>
                Visually compare what your architecture would cost on <strong>AWS vs. GCP vs. Azure</strong> via the new
                1-click Bottom Bar arbitrage interface. See financial variance immediately as the pricing engine automatically
                recalculates instance offsets and egress data fees.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.7}>
              <div className="lp-feature-badge-new">NEW — Enterprise</div>
              <div className="lp-feature-icon" style={{ color: '#10b981' }}><FileText size={24} /></div>
              <h3>Fully-Branded Architecture Reports</h3>
              <p>
                Generate sleek, multi-page professional PDF reports containing high-res diagrams,
                financial breakdowns, carbon footprint, security warnings, and SLA scores.
                Perfect for Solution Architects pitching to clients. Enable <strong>White-labeling</strong> to remove watermarks.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.8}>
              <div className="lp-feature-badge-new">NEW — Enterprise</div>
              <div className="lp-feature-icon" style={{ color: '#ec4899' }}><ShieldAlert size={24} /></div>
              <h3>Compliance & Security Scanner</h3>
              <p>
                25 architectural security rules scan for SOC2, HIPAA, PCI-DSS, GDPR, and NIST compliance violations.
                Detects publicly routable databases, missing WAF, no MFA, encryption gaps, and more — with remediation guidance.
              </p>
            </AnimatedSection>

            <AnimatedSection className="lp-feature-card lp-feature-card-enterprise" delay={0.9}>
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
         *  MULTI-CLOUD ARBITRAGE VISUALIZER
         * ═══════════════════════════════════════ */}
        <ArbitrageVisualizer />

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
              <div className="lp-stat-value"><AnimatedCounter end={150} suffix="+" duration={2000} /></div>
              <div className="lp-stat-label">Cloud Components</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-value"><AnimatedCounter end={8} duration={1200} /></div>
              <div className="lp-stat-label">Simulation Engines</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-value"><AnimatedCounter end={25} suffix="+" duration={1500} /></div>
              <div className="lp-stat-label">Security Rules</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-value"><AnimatedCounter end={3} suffix="×" duration={800} /></div>
              <div className="lp-stat-label">Retina Export</div>
            </div>
          </div>
        </AnimatedSection>

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  COMPONENT LIBRARY SPOTLIGHT
         * ═══════════════════════════════════════ */}
        <section className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label">
                <Blocks size={13} />
                Component Library
              </div>
              <h2 className="lp-section-title">150+ production-grade<br />cloud components</h2>
              <p className="lp-section-desc">
                Every major cloud service, platform, and pattern — fully modelled with real AWS pricing,
                capacity limits, latency profiles, and reliability scores.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.08}>
            <div className="lp-comp-grid">
              {[
                { label: 'ALB', sub: 'Layer 7 Load Balancer', icon: Network },
                { label: 'EKS Cluster', sub: 'Managed Kubernetes', icon: Blocks },
                { label: 'ECS Container', sub: 'Container Pod', icon: Box },
                { label: 'ElastiCache Redis', sub: 'Managed Redis Cluster', icon: Zap },
                { label: 'RDS PostgreSQL', sub: 'Managed Relational DB', icon: Database },
                { label: 'ECR', sub: 'Container Registry', icon: Code2 },
                { label: 'User / Client', sub: 'Generic Client Entry', icon: Users },
                { label: 'API Gateway', sub: 'Managed Gateway', icon: Webhook },
                { label: 'Lambda', sub: 'Serverless Compute', icon: Zap },
                { label: 'Kafka', sub: 'Event Streaming', icon: Radio },
                { label: 'Game Server', sub: 'UDP Low-Latency', icon: Gamepad2 },
                { label: 'ML / GPU Worker', sub: 'AI Inference', icon: Cpu },
                { label: 'Cloudflare Workers', sub: 'Edge Compute', icon: Cloud },
                { label: 'Kubernetes Cluster', sub: 'EKS Orchestration', icon: Blocks },
                { label: 'WAF / Firewall', sub: 'DDoS + Inspection', icon: Shield },
                { label: 'Pinecone DB', sub: 'Vector Database', icon: Search },
                { label: 'Snowflake DW', sub: 'Analytics Warehouse', icon: Database },
                { label: 'vLLM Server', sub: 'Self-hosted LLM', icon: Cpu },
              ].map(({ label, sub, icon: Icon }) => (
                <div key={label} className="lp-comp-card">
                  <div className="lp-comp-icon"><Icon size={18} strokeWidth={1.5} /></div>
                  <div className="lp-comp-info">
                    <span className="lp-comp-name">{label}</span>
                    <span className="lp-comp-sub">{sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </section>

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
                  <tr>
                    <td className="lp-feature-name">Framer Motion micro-animations</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Actionable security fix workflow</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Cloud project save &amp; dashboard</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                  </tr>
                  <tr>
                    <td className="lp-feature-name">Google Sign-In (one-click auth)</td>
                    <td className="lp-col-highlight"><span className="lp-check">✓</span></td>
                    <td><span className="lp-cross">✕</span></td>
                    <td><span className="lp-partial">Email only</span></td>
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
            {nonGameFamousTemplates.map((template, idx) => {
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

        <div className="lp-divider" />

        {/* ═══════════════════════════════════════
         *  GAME CLOUD INFRASTRUCTURE
         * ═══════════════════════════════════════ */}
        <section id="game-templates" className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label lp-section-label-game">
                <Gamepad2 size={13} />
                Game Cloud Infrastructure
              </div>
              <h2 className="lp-section-title">How the world's biggest<br />games are built</h2>
              <p className="lp-section-desc">
                From 350M-player battle royales to planet-scale MMOs.
                Explore the dedicated server farms, anti-cheat pipelines, and matchmaking systems
                that power the games you play.
              </p>
            </div>
          </AnimatedSection>

          <div className="lp-templates-grid">
            {gameTemplates.map((template, idx) => {
              const Icon = gameIcons[template.id] || Gamepad2;
              return (
                <AnimatedSection key={template.id} delay={0.05 * idx}>
                  <button
                    className="lp-template-card lp-template-card-game"
                    onClick={() => handleTemplateSelect(template)}
                    disabled={!!loadingId}
                    style={{ opacity: loadingId && loadingId !== template.id ? 0.35 : 1, width: '100%' }}
                  >
                    <div className="lp-template-top">
                      <div className={`lp-template-icon lp-template-icon-game ${template.id}`}>
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
                    <div className="lp-template-insight lp-template-insight-game">
                      <Gamepad2 size={14} strokeWidth={2.5} />
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
         *  CLOUD PERSISTENCE  (NEW)
         * ═══════════════════════════════════════ */}
        <section className="lp-section">
          <AnimatedSection>
            <div className="lp-section-header">
              <div className="lp-section-label">
                <CloudUpload size={13} />
                Cloud Persistence
              </div>
              <h2 className="lp-section-title">Your projects. Everywhere.</h2>
              <p className="lp-section-desc">
                Sign in with Google to save your architectures to the cloud.
                Pick up right where you left off — from any device, any time.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.08}>
            <div className="lp-cloud-grid">
              <div className="lp-cloud-card">
                <div className="lp-cloud-card-icon"><LogIn size={20} strokeWidth={1.5} /></div>
                <h3 className="lp-cloud-card-title">One-click Google Sign-In</h3>
                <p className="lp-cloud-card-desc">
                  No password to create. Hit "Sign in with Google" and you're in — your account is ready instantly.
                </p>
              </div>
              <div className="lp-cloud-card">
                <div className="lp-cloud-card-icon"><FolderOpen size={20} strokeWidth={1.5} /></div>
                <h3 className="lp-cloud-card-title">Figma-style Project Dashboard</h3>
                <p className="lp-cloud-card-desc">
                  All your saved architectures in one place. Search, sort, rename, duplicate, or delete — just like Figma.
                </p>
              </div>
              <div className="lp-cloud-card">
                <div className="lp-cloud-card-icon"><CloudUpload size={20} strokeWidth={1.5} /></div>
                <h3 className="lp-cloud-card-title">Auto-save to Firestore</h3>
                <p className="lp-cloud-card-desc">
                  Designs are saved to Firebase Firestore in real time. Your work is never lost, even if the tab closes.
                </p>
              </div>
              <div className="lp-cloud-card">
                <div className="lp-cloud-card-icon"><Download size={20} strokeWidth={1.5} /></div>
                <h3 className="lp-cloud-card-title">Auth-gated Professional Export</h3>
                <p className="lp-cloud-card-desc">
                  PDF reports, Terraform IaC, and multi-format exports require sign-in — keeping advanced tools in your personal workspace.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </section>

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
                <div className="lp-free-feature"><Check size={14} /> All 150+ components</div>
                <div className="lp-free-feature"><Check size={14} /> Full simulation engine</div>
                <div className="lp-free-feature"><Check size={14} /> All templates included</div>
                <div className="lp-free-feature"><Check size={14} /> PNG 3× Retina export</div>
                <div className="lp-free-feature"><Check size={14} /> Security scanner</div>
                <div className="lp-free-feature"><Check size={14} /> Local-first storage</div>
                <div className="lp-free-feature"><Check size={14} /> Version history</div>
                <div className="lp-free-feature"><Check size={14} /> Cloud project dashboard</div>
                <div className="lp-free-feature"><Check size={14} /> Google Sign-In</div>
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
          <div className="lp-footer-aurora">
            <div className="lp-footer-aurora-blob lp-footer-aurora-1" />
            <div className="lp-footer-aurora-blob lp-footer-aurora-2" />
            <div className="lp-footer-aurora-blob lp-footer-aurora-3" />
          </div>
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
