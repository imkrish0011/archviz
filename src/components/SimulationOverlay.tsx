import { useArchStore } from '../store/useArchStore';
import { useSimulationEvents } from '../hooks/useSimulationEvents';
import { AlertTriangle, X } from 'lucide-react';

const eventLabels: Record<string, { title: string; description: string }> = {
  serverCrash: { title: 'Server Crash', description: 'A server instance has failed. Watch how the load redistributes.' },
  removeCache: { title: 'Cache Removed', description: 'All cache nodes disabled. Database is handling 100% of requests.' },
  trafficSpike: { title: 'Traffic Spike (10x)', description: 'Traffic surged 10x. Watch for overloaded components.' },
  cdnFailure: { title: 'CDN Failure', description: 'CDN is offline. All requests hit origin servers directly.' },
  dbFailover: { title: 'Database Failover', description: 'Primary database failed. Checking for replica...' },
};

export default function SimulationOverlay() {
  const activeEvent = useArchStore(s => s.activeSimulationEvent);
  const { revert } = useSimulationEvents();
  
  if (!activeEvent) return null;
  
  const info = eventLabels[activeEvent] || { title: 'Simulation', description: '' };
  
  return (
    <div className="scenario-bar">
      <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
      <span className="scenario-title">{info.title}</span>
      <span className="scenario-objective">{info.description}</span>
      <button className="btn" onClick={revert} style={{ marginLeft: 'auto' }}>
        <X size={12} />
        Stop
      </button>
    </div>
  );
}
