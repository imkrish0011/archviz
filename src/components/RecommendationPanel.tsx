import { useSimulation } from '../hooks/useSimulation';
import { useArchStore } from '../store/useArchStore';
import { X, TrendingUp, DollarSign, Plus } from 'lucide-react';

export default function RecommendationPanel() {
  const open = useArchStore(s => s.recommendationPanelOpen);
  const toggle = useArchStore(s => s.toggleRecommendationPanel);
  const addNode = useArchStore(s => s.addNode);
  const nodes = useArchStore(s => s.nodes);
  const { metrics } = useSimulation();
  
  if (!open || metrics.recommendations.length === 0) return null;
  
  const handleApply = (componentToAdd?: string) => {
    if (!componentToAdd) return;
    // Find a good position for the new node
    const maxX = nodes.reduce((max, n) => Math.max(max, n.position.x), 0);
    const avgY = nodes.length > 0 
      ? nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length 
      : 200;
    addNode(componentToAdd, { x: maxX + 200, y: avgY });
  };
  
  return (
    <div className="recommendation-panel">
      <div className="recommendation-header">
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>Recommendations & Insights</span>
        <button className="btn-icon" onClick={toggle}>
          <X size={16} />
        </button>
      </div>
      
      {metrics.recommendations.map(rec => (
        <div key={rec.id} className="recommendation-card">
          <div className="recommendation-reason">{rec.reason}</div>
          
          {rec.solution && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--success-muted)', borderLeft: '4px solid var(--success)', borderRadius: '0 4px 4px 0', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              <span style={{ fontWeight: 700, color: 'var(--success)', display: 'block', marginBottom: '4px', letterSpacing: '0.02em' }}>💡 EXACT SOLUTION</span>
              {rec.solution}
            </div>
          )}
          
          {rec.insight && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--info-muted)', borderLeft: '4px solid var(--info)', borderRadius: '0 4px 4px 0', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              <span style={{ fontWeight: 700, color: 'var(--info)', display: 'block', marginBottom: '4px', letterSpacing: '0.02em' }}>🔍 SYSTEM INSIGHT</span>
              {rec.insight}
            </div>
          )}

          <div className="recommendation-meta" style={{ marginTop: '8px' }}>
            <span>
              <TrendingUp size={12} />
              {rec.expectedImprovement}
            </span>
            <span>
              <DollarSign size={12} />
              {rec.costImpact}
            </span>
          </div>
          {rec.componentToAdd && (
            <button 
              className="btn" 
              style={{ marginTop: 8, fontSize: 'var(--text-xs)' }}
              onClick={() => handleApply(rec.componentToAdd)}
            >
              <Plus size={12} />
              Apply
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
