import { useSimulation } from '../hooks/useSimulation';
import { useArchStore } from '../store/useArchStore';
import { formatCost } from '../engine/costEngine';
import { formatAvailability } from '../engine/failureModel';
import { DollarSign, Clock, Heart, Activity, Shield, AlertTriangle, AlertCircle, Info, Cloud } from 'lucide-react';

export default function BottomInsightBar() {
  const { metrics } = useSimulation();
  const toggleRecommendationPanel = useArchStore(s => s.toggleRecommendationPanel);
  const nodes = useArchStore(s => s.nodes);
  const cloudProvider = useArchStore(s => s.cloudProvider);
  const setCloudProvider = useArchStore(s => s.setCloudProvider);
  const toggleFinopsPanel = useArchStore(s => s.toggleFinopsPanel);
  
  if (nodes.length === 0) {
    return (
      <div className="bottom-bar">
        <div className="bottom-bar-metrics">
          <div className="bottom-metric">
            <span className="bottom-metric-label" style={{ color: 'var(--text-disabled)' }}>
              Drag components from the sidebar to begin designing your architecture
            </span>
          </div>
        </div>
      </div>
    );
  }
  
  const healthBarClass = metrics.healthScore >= 80 ? '' : metrics.healthScore >= 60 ? 'health-warning' : 'health-critical';
  
  const latencyClass = metrics.estimatedLatency < 200 ? 'good' : metrics.estimatedLatency < 500 ? 'moderate' : 'bad';
  
  const formatLatency = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  };
  
  const visibleWarnings = metrics.warnings.slice(0, 3);
  const extraWarnings = metrics.warnings.length - 3;
  
  return (
    <div className={`bottom-bar ${healthBarClass}`}>
      <div className="bottom-bar-metrics">
        <div className="bottom-metric" onClick={toggleFinopsPanel} style={{ cursor: 'pointer' }} title="Click for FinOps cost breakdown">
          <DollarSign size={13} style={{ color: 'var(--text-tertiary)' }} />
          <span className="bottom-metric-label">Cost</span>
          <span className="bottom-metric-value" style={{ color: 'var(--accent)', transition: 'color 0.3s' }}>
            {formatCost(metrics.totalCost)}/mo
          </span>
        </div>
        
        <div className="bottom-metric" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
          <Cloud size={13} style={{ color: 'var(--text-tertiary)' }} />
          <span className="bottom-metric-label">Arbitrage</span>
          <div className="provider-toggles" style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
            {(['aws', 'gcp', 'azure'] as const).map(p => (
              <button
                key={p}
                onClick={() => setCloudProvider(p)}
                style={{
                  background: cloudProvider === p ? 'var(--accent-muted)' : 'transparent',
                  color: cloudProvider === p ? 'var(--accent)' : 'var(--text-tertiary)',
                  border: `1px solid ${cloudProvider === p ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title={`Switch to ${p.toUpperCase()} pricing`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        
        <div className="bottom-metric">
          <Clock size={13} style={{ color: 'var(--text-tertiary)' }} />
          <span className="bottom-metric-label">Latency</span>
          <span className={`bottom-metric-value ${latencyClass}`}>
            {formatLatency(metrics.estimatedLatency)}
          </span>
        </div>
        
        <div className="bottom-metric">
          <Heart size={13} style={{ color: 'var(--text-tertiary)' }} />
          <span className="bottom-metric-label">Health</span>
          <span className="bottom-metric-value">
            {metrics.healthScore}
          </span>
          <span className={`metric-grade ${metrics.letterGrade}`}>
            {metrics.letterGrade}
          </span>
        </div>
        
        <div className="bottom-metric">
          <Activity size={13} style={{ color: 'var(--text-tertiary)' }} />
          <span className="bottom-metric-label">Throughput</span>
          <span className="bottom-metric-value">
            {metrics.throughput.toLocaleString()} rps
          </span>
        </div>
        
        <div className="bottom-metric" title={`Downtime: ${metrics.downtimePerYear}/yr • ${metrics.downtimePerMonth}/mo`}>
          <Shield size={13} style={{ color: 'var(--text-tertiary)' }} />
          <span className="bottom-metric-label">SLA</span>
          <span className="bottom-metric-value">
            {formatAvailability(metrics.availability)}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 4 }}>
            ({metrics.nines})
          </span>
        </div>
      </div>
      
      <div className="bottom-bar-warnings">
        {visibleWarnings.map(warning => {
          const IconComp = warning.type === 'critical' ? AlertCircle : warning.type === 'warning' ? AlertTriangle : Info;
          return (
            <button
              key={warning.id}
              className={`warning-pill ${warning.type}`}
              onClick={toggleRecommendationPanel}
            >
              <IconComp size={12} />
              {warning.message}
            </button>
          );
        })}
        {extraWarnings > 0 && (
          <span className="warning-pill-more" onClick={toggleRecommendationPanel}>
            +{extraWarnings} more
          </span>
        )}
      </div>
    </div>
  );
}
