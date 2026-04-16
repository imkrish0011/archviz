import { useArchStore } from '../store/useArchStore';
import { useSimulationEvents } from '../hooks/useSimulationEvents';
import { AlertTriangle, X, MapPin, RotateCcw } from 'lucide-react';

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
  const { revert } = useSimulationEvents();
  
  if (!activeEvent) return null;
  
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
