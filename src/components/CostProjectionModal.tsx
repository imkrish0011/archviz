import { useEffect, useMemo, useCallback } from 'react';
import { X, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { useArchStore } from '../store/useArchStore';
import { calculateDBLoads } from '../engine/trafficModel';
import { calculateNodeLoads } from '../engine/bottleneckDetector';
import { getBottleneckedNodeIds } from '../engine/bottleneckDetector';
import { calculateTotalCost, formatCostFull } from '../engine/costEngine';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface CostProjectionModalProps {
  currentMonthlyCost: number;
  currentRps: number;
  onClose: () => void;
}

function formatTraffic(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
}

function formatCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1e1b29', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Traffic: {formatTraffic(payload[0].payload.traffic)} reqs/s</p>
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#818cf8' }}>{formatCurrency(payload[0].value)}/mo</p>
      </div>
    );
  }
  return null;
};

export default function CostProjectionModal({ onClose }: CostProjectionModalProps) {
  const nodes = useArchStore(s => s.nodes);
  const edges = useArchStore(s => s.edges);
  const config = useArchStore(s => s.simulationConfig);
  const simulatedTraffic = useArchStore(s => s.simulatedTraffic);
  const setSimulatedTraffic = useArchStore(s => s.setSimulatedTraffic);
  const provider = useArchStore(s => s.cloudProvider);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const getCostForTraffic = useCallback((traffic: number) => {
    const dbLoads = calculateDBLoads(nodes, traffic, config.cacheHitRate);
    const nodeLoads = calculateNodeLoads(nodes, edges, traffic, dbLoads);
    return calculateTotalCost(nodes, edges, nodeLoads, provider);
  }, [nodes, edges, config.cacheHitRate, provider]);

  const chartData = useMemo(() => {
    // Logarithmic scale data points
    const points = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000];
    return points.map(traffic => ({
      traffic,
      cost: getCostForTraffic(traffic)
    }));
  }, [getCostForTraffic]);

  const currentProjectedCost = getCostForTraffic(simulatedTraffic);
  const bottlenecks = getBottleneckedNodeIds(nodes, simulatedTraffic);

  // Convert log value from slider to actual traffic
  const logMin = Math.log10(1000);
  const logMax = Math.log10(10000000);
  const sliderToTraffic = (val: number) => Math.round(Math.pow(10, val));
  const trafficToSlider = (traffic: number) => Math.log10(traffic);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 820,
          background: 'linear-gradient(160deg, #13111a 0%, #0c0b0f 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(129,140,248,0.08)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(129,140,248,0.06) 0%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(129,140,248,0.12)',
              border: '1px solid rgba(129,140,248,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={18} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', fontFamily: 'var(--font-sans)' }}>
                Predictive Cost & Scaling Engine
              </h2>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                Simulate traffic spikes and analyze auto-scaling impacts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Controls Row */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
              <div style={{ flex: 1, marginRight: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '12px' }}>
                  <Users size={14} />
                  Global Traffic Simulation (RPS)
                </label>
                <input
                  type="range"
                  min={logMin}
                  max={logMax}
                  step={0.01}
                  value={trafficToSlider(simulatedTraffic)}
                  onChange={e => setSimulatedTraffic(sliderToTraffic(Number(e.target.value)))}
                  style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>
                  <span>1k</span>
                  <span>10k</span>
                  <span>100k</span>
                  <span>1M</span>
                  <span>10M</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '4px' }}>
                  Projected Monthly Cost
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                  {formatCostFull(currentProjectedCost)}
                </div>
              </div>
            </div>

            {bottlenecks.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                  <strong>{bottlenecks.length} component(s)</strong> are bottlenecked at this traffic level! They are highlighted in red on the canvas.
                </span>
              </div>
            )}
          </div>

          {/* Chart Area */}
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="traffic" 
                  tickFormatter={formatTraffic} 
                  stroke="rgba(255,255,255,0.2)" 
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  minTickGap={30}
                />
                <YAxis 
                  tickFormatter={formatCurrency} 
                  stroke="rgba(255,255,255,0.2)" 
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip content={CustomTooltip} />
                <Area 
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#818cf8" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCost)" 
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}