import { useMemo } from 'react';
import { X, DollarSign, TrendingUp, Server, Database, Globe, MessageSquare, Zap, Eye, MoreHorizontal } from 'lucide-react';
import { useArchStore } from '../store/useArchStore';
import { useSimulation } from '../hooks/useSimulation';
import { calculateCostBreakdown, formatCost } from '../engine/costEngine';

const CATEGORY_COLORS: Record<string, string> = {
  compute: '#6366f1',
  storage: '#f59e0b',
  network: '#06b6d4',
  messaging: '#10b981',
  serverless: '#a855f7',
  observability: '#ec4899',
  other: '#64748b',
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  compute: Server,
  storage: Database,
  network: Globe,
  messaging: MessageSquare,
  serverless: Zap,
  observability: Eye,
  other: MoreHorizontal,
};

const CATEGORY_LABELS: Record<string, string> = {
  compute: 'Compute & VMs',
  storage: 'Storage & DBs',
  network: 'Network & CDN',
  messaging: 'Messaging & Queues',
  serverless: 'Serverless / PaaS',
  observability: 'Observability',
  other: 'Other Services',
};

function DonutChart({ data }: { data: { key: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="finops-donut-empty">
        <DollarSign size={32} strokeWidth={1} />
        <span>No cost data</span>
      </div>
    );
  }

  const radius = 80;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  // Pre-compute segment layout with useMemo — no mutation during render
  const segments = useMemo(() => {
    let offset = 0;
    return data.filter(d => d.value > 0).map((segment) => {
      const pct = segment.value / total;
      const dashLength = pct * circumference;
      const dashGap = circumference - dashLength;
      const segmentOffset = offset;
      offset += dashLength;
      return { ...segment, dashLength, dashGap, offset: segmentOffset };
    });
  }, [data, total, circumference]);

  return (
    <div className="finops-donut-wrap">
      <svg viewBox="0 0 200 200" className="finops-donut-svg">
        {segments.map((segment, idx) => (
          <circle
            key={idx}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segment.dashLength} ${segment.dashGap}`}
            strokeDashoffset={-segment.offset}
            strokeLinecap="butt"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '100px 100px',
              transition: 'stroke-dasharray 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        ))}
      </svg>
      <div className="finops-donut-center">
        <span className="finops-donut-total">{formatCost(total)}</span>
        <span className="finops-donut-label">per month</span>
      </div>
    </div>
  );
}

export default function FinOpsPanel() {
  const finopsPanelOpen = useArchStore(s => s.finopsPanelOpen);
  const toggleFinopsPanel = useArchStore(s => s.toggleFinopsPanel);
  const nodes = useArchStore(s => s.nodes);
  const edges = useArchStore(s => s.edges);
  const cloudProvider = useArchStore(s => s.cloudProvider);
  const { nodeLoads } = useSimulation();

  const breakdown = useMemo(() => {
    return calculateCostBreakdown(nodes, edges, nodeLoads, cloudProvider);
  }, [nodes, edges, nodeLoads, cloudProvider]);

  const donutData = useMemo(() => {
    return Object.entries(CATEGORY_COLORS).map(([key, color]) => ({
      key,
      value: breakdown[key as keyof typeof breakdown] as number,
      color,
    }));
  }, [breakdown]);

  if (!finopsPanelOpen) return null;

  const categoriesWithCost = donutData.filter(d => d.value > 0);

  return (
    <div className="finops-panel">
      <div className="finops-panel-header">
        <div className="finops-panel-title">
          <DollarSign size={16} />
          <span>FinOps Breakdown</span>
        </div>
        <button className="finops-close-btn" onClick={toggleFinopsPanel}>
          <X size={16} />
        </button>
      </div>

      <div className="finops-panel-body">
        {/* ── Donut Chart ── */}
        <DonutChart data={donutData} />

        {/* ── Provider Badge ── */}
        <div className="finops-provider-badge">
          {cloudProvider.toUpperCase()} pricing
        </div>

        {/* ── Category Breakdown ── */}
        <div className="finops-category-list">
          <div className="finops-section-label">Cost by Category</div>
          {categoriesWithCost.length === 0 && (
            <div className="finops-empty-state">Add components to see cost breakdown</div>
          )}
          {categoriesWithCost.map(({ key, value, color }) => {
            const pct = breakdown.total > 0 ? Math.round((value / breakdown.total) * 100) : 0;
            const Icon = CATEGORY_ICONS[key] || MoreHorizontal;
            return (
              <div key={key} className="finops-category-row">
                <div className="finops-cat-left">
                  <span className="finops-cat-dot" style={{ background: color }} />
                  <Icon size={13} />
                  <span className="finops-cat-name">{CATEGORY_LABELS[key]}</span>
                </div>
                <div className="finops-cat-right">
                  <div className="finops-cat-bar-track">
                    <div
                      className="finops-cat-bar-fill"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <span className="finops-cat-pct">{pct}%</span>
                  <span className="finops-cat-cost">{formatCost(value)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Top Components ── */}
        {breakdown.topComponents.length > 0 && (
          <div className="finops-top-components">
            <div className="finops-section-label">
              <TrendingUp size={12} />
              Top Spenders
            </div>
            {breakdown.topComponents.map((comp, idx) => (
              <div key={idx} className="finops-top-row">
                <span className="finops-top-rank">#{idx + 1}</span>
                <span className="finops-top-name">{comp.label}</span>
                <span className="finops-top-cost">{formatCost(comp.cost)}/mo</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
