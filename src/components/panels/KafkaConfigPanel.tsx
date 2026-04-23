import PanelSection from './PanelSection';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

export default function KafkaConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="Kafka / Streaming Configuration" defaultOpen>
      <div className="form-group">
        <label className="form-label">Number of Partitions</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={1} max={256} step={1}
            value={data.kafkaPartitions || 6}
            onChange={e => update('kafkaPartitions', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 36, color: 'var(--text-primary)' }}>
            {data.kafkaPartitions || 6}
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          More partitions = higher throughput but more broker overhead. Rule: partitions ≥ consumer count.
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">Retention Period (days)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={1} max={90}
            value={data.kafkaRetentionDays || 7}
            onChange={e => update('kafkaRetentionDays', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 36, color: 'var(--text-primary)' }}>
            {data.kafkaRetentionDays || 7}d
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          How long messages are kept on disk. Longer retention = more storage cost.
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">Replication Factor</label>
        <select className="form-select" value={data.kafkaReplicationFactor || 3}
          onChange={e => update('kafkaReplicationFactor', Number(e.target.value))}
        >
          <option value={1}>1 — No redundancy (dev only)</option>
          <option value={2}>2 — Tolerates 1 broker failure</option>
          <option value={3}>3 — Production standard (recommended)</option>
        </select>
        {(data.kafkaReplicationFactor || 3) < 3 && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4, display: 'block' }}>
            ⚠️ Replication factor &lt; 3 risks data loss during broker failure.
          </span>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Auto-Create Topics</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.kafkaAutoCreateTopics ? 'var(--warning)' : 'var(--success)',
            borderColor: data.kafkaAutoCreateTopics ? 'var(--warning-muted)' : 'var(--success-muted)',
            background: data.kafkaAutoCreateTopics ? 'var(--warning-muted)' : 'var(--success-muted)',
          }}
          onClick={() => update('kafkaAutoCreateTopics', !data.kafkaAutoCreateTopics)}
        >
          {data.kafkaAutoCreateTopics ? '⚠️ Auto-Create ON (Risk of topic sprawl)' : '✓ Manual Topic Creation (Safe)'}
        </button>
      </div>
    </PanelSection>
  );
}
