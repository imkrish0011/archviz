import { useArchStore } from '../store/useArchStore';
import { X, RotateCcw } from 'lucide-react';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function VersionHistoryDrawer() {
  const open = useArchStore(s => s.versionHistoryOpen);
  const toggle = useArchStore(s => s.toggleVersionHistory);
  const snapshots = useArchStore(s => s.snapshots);
  const restoreSnapshot = useArchStore(s => s.restoreSnapshot);
  
  if (!open) return null;
  
  const sortedSnapshots = [...snapshots].reverse();
  
  return (
    <div className="version-drawer">
      <div className="version-drawer-header">
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>Version History</span>
        <button className="btn-icon" onClick={toggle}>
          <X size={16} />
        </button>
      </div>
      
      <div className="version-list">
        {sortedSnapshots.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-disabled)', fontSize: 'var(--text-sm)' }}>
            No snapshots yet. Changes are auto-saved as you build.
          </div>
        ) : (
          sortedSnapshots.map(snap => (
            <div 
              key={snap.id} 
              className="version-item"
              onClick={() => restoreSnapshot(snap.id)}
            >
              <RotateCcw size={14} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
              <div className="version-item-info">
                <div className="version-item-label">{snap.label}</div>
                <div className="version-item-time">{timeAgo(snap.timestamp)}</div>
              </div>
              <div className="version-item-badges">
                <span className="version-badge cost">
                  ${Math.round(snap.monthlyCost || 0)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
