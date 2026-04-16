import { useArchStore } from '../store/useArchStore';
import { useSimulationEvents } from '../hooks/useSimulationEvents';
import { AlertTriangle, X, MapPin, RotateCcw, GitBranch } from 'lucide-react';

const eventLabels: Record<string, { title: string; description: string; color?: string }> = {
  serverCrash: { title: 'Server Crash', description: 'A server instance has failed. Watch how the load redistributes.' },
  removeCache: { title: 'Cache Removed', description: 'All cache nodes disabled. Database is handling 100% of requests.' },
  trafficSpike: { title: 'Traffic Spike (10x)', description: 'Traffic surged 10x. Watch for overloaded components.' },
  cdnFailure: { title: 'CDN Failure', description: 'CDN is offline. All requests hit origin servers directly.' },
  dbFailover: { title: 'Database Failover', description: 'Primary database failed. Checking for replica...' },
  regionOutage: { 
    title: 'Regional Outage', 
    description: 'Region is down. Traffic rerouted to healthy regions. +300ms global latency added.',
    color: '#ef4444',
  },
};

export default function SimulationOverlay() {
  const activeEvent = useArchStore(s => s.activeSimulationEvent);
  const outageRegionId = useArchStore(s => s.outageRegionId);
  const nodes = useArchStore(s => s.nodes);
  const deploymentState = useArchStore(s => s.deploymentState);
  const cancelDeployment = useArchStore(s => s.cancelDeployment);
  const { revert } = useSimulationEvents();
  
  if (!activeEvent && !deploymentState.isActive) return null;
  
  // Show Deployment Banner prioritized if active
  if (deploymentState.isActive) {
    return (
      <div className="scenario-bar" style={{ 
        borderColor: 'rgba(99, 102, 241, 0.3)',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(15,14,20,0.95))',
      }}>
        <GitBranch size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
        
        <span className="scenario-title" style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
          Live Deployment Rollout
          <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(99,102,241,0.15)', borderRadius: 12 }}>
            v1 → v2
          </span>
        </span>
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, marginLeft: 10 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              background: '#818cf8', 
              width: `${deploymentState.trafficWeightV2}%`,
              transition: 'width 0.3s ease-out'
            }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600, minWidth: 40, fontFamily: 'var(--font-mono)' }}>
            {deploymentState.trafficWeightV2}% v2
          </span>
        </div>
        
        <button 
          className="btn" 
          onClick={cancelDeployment} 
          style={{ 
            marginLeft: 'auto',
            background: 'rgba(239, 68, 68, 0.1)', 
            borderColor: 'rgba(239, 68, 68, 0.25)',
            color: '#f87171',
          }}
        >
          <X size={12} />
          Abort Rollback
        </button>
      </div>
    );
  }
  
  const info = eventLabels[activeEvent] || { title: 'Simulation', description: '' };
  
  // For region outage, find which nodes are affected
  const failedCount = activeEvent === 'regionOutage' 
    ? nodes.filter(n => n.data.isFailed).length 
    : 0;
  
  const regionLabel = outageRegionId 
    ? nodes.find(n => n.id === outageRegionId)?.data.label || 'Region' 
    : 'Region';
  
  const isRegionOutage = activeEvent === 'regionOutage';
  
  return (
    <div className="scenario-bar" style={isRegionOutage ? { 
      borderColor: 'rgba(239, 68, 68, 0.3)',
      background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(30,10,10,0.95))',
    } : undefined}>
      {isRegionOutage ? (
        <MapPin size={16} style={{ color: '#ef4444' }} />
      ) : (
        <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
      )}
      
      <span className="scenario-title" style={isRegionOutage ? { color: '#ef4444' } : undefined}>
        {info.title}
      </span>
      
      {isRegionOutage ? (
        <span className="scenario-objective">
          <strong>{regionLabel}</strong> is down. {failedCount} component{failedCount !== 1 ? 's' : ''} failed. 
          Traffic rerouted to healthy instances. <span style={{ color: '#fbbf24' }}>+300ms global latency</span>.
        </span>
      ) : (
        <span className="scenario-objective">{info.description}</span>
      )}
      
      <button 
        className="btn" 
        onClick={revert} 
        style={{ 
          marginLeft: 'auto',
          ...(isRegionOutage ? { 
            background: 'rgba(16, 185, 129, 0.15)', 
            borderColor: 'rgba(16, 185, 129, 0.3)',
            color: '#10b981',
          } : {}),
        }}
      >
        {isRegionOutage ? (
          <>
            <RotateCcw size={12} />
            Restore Region
          </>
        ) : (
          <>
            <X size={12} />
            Stop
          </>
        )}
      </button>
    </div>
  );
}
