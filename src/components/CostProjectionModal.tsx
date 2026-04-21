import { useEffect, useRef, useState, useCallback } from 'react';
import { X, TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface CostProjectionModalProps {
  currentMonthlyCost: number;
  currentRps: number;
  onClose: () => void;
}

type GrowthCurve = 'linear' | 'exponential' | 'hockey-stick';

interface ProjectionPoint {
  month: number;
  rps: number;
  cost: number;
}

const GROWTH_LABELS: Record<GrowthCurve, string> = {
  linear: 'Linear Growth',
  exponential: 'Exponential Growth',
  'hockey-stick': 'Hockey-stick (Startup)',
};

const GROWTH_COLORS: Record<GrowthCurve, string> = {
  linear: '#818cf8',
  exponential: '#f472b6',
  'hockey-stick': '#34d399',
};

const GROWTH_DESCRIPTIONS: Record<GrowthCurve, string> = {
  linear: 'Steady, predictable growth — B2B SaaS, enterprise products',
  exponential: 'Compounding growth — viral consumer apps, crypto platforms',
  'hockey-stick': 'Slow initial ramp, then explosive ~month 12 breakout — typical startup curve',
};

function computeProjection(
  baseCost: number,
  baseRps: number,
  growthCurve: GrowthCurve,
  months: number,
  mrrGrowthRate: number,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  for (let month = 0; month <= months; month++) {
    let multiplier = 1;
    const rate = mrrGrowthRate / 100;

    switch (growthCurve) {
      case 'linear':
        multiplier = 1 + rate * month;
        break;
      case 'exponential':
        multiplier = Math.pow(1 + rate, month);
        break;
      case 'hockey-stick': {
        // Flat for first 40% of timeline, then explosive
        const inflection = months * 0.4;
        if (month < inflection) {
          multiplier = 1 + (rate * 0.1 * month);
        } else {
          const baseAtInflection = 1 + (rate * 0.1 * inflection);
          multiplier = baseAtInflection * Math.pow(1 + rate * 1.5, month - inflection);
        }
        break;
      }
    }

    points.push({
      month,
      rps: Math.round(baseRps * multiplier),
      cost: baseCost * multiplier,
    });
  }
  return points;
}

function formatCostK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatMonthLabel(month: number): string {
  if (month === 0) return 'Now';
  if (month % 12 === 0) return `Y${month / 12}`;
  if (month % 6 === 0) return `M${month}`;
  return '';
}

function drawChart(
  canvas: HTMLCanvasElement,
  curves: { label: string; color: string; points: ProjectionPoint[] }[],
  timelineMonths: number,
  activeCurve: GrowthCurve,
) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, W, H);

  const PAD = { top: 20, right: 20, bottom: 48, left: 68 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Compute max across all curves for Y scale
  const allCosts = curves.flatMap(c => c.points.map(p => p.cost));
  const maxCost = Math.max(...allCosts) * 1.08;

  const toX = (month: number) => PAD.left + (month / timelineMonths) * chartW;
  const toY = (cost: number) => PAD.top + chartH - (cost / maxCost) * chartH;

  // Grid lines
  const gridLines = 5;
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= gridLines; i++) {
    const y = PAD.top + (chartH / gridLines) * i;
    const cost = maxCost - (maxCost / gridLines) * i;

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + chartW, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `10px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(formatCostK(cost), PAD.left - 8, y);
  }

  // X-axis labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let m = 0; m <= timelineMonths; m++) {
    const label = formatMonthLabel(m);
    if (!label) continue;
    const x = toX(m);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, PAD.top);
    ctx.lineTo(x, PAD.top + chartH);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `10px "Inter", system-ui, sans-serif`;
    ctx.fillText(label, x, PAD.top + chartH + 10);
  }

  // Chart area clip
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.left, PAD.top, chartW, chartH);
  ctx.clip();

  // Draw each curve — inactive ones as dimmed, active one prominent + gradient fill
  for (const curve of curves) {
    const pts = curve.points;
    const isActive = curve.label === GROWTH_LABELS[activeCurve as GrowthCurve];
    const alpha = isActive ? 1 : 0.18;

    ctx.globalAlpha = alpha;

    // Gradient fill for active curve
    if (isActive) {
      const gradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
      const hex = curve.color;
      gradient.addColorStop(0, hex + '30');
      gradient.addColorStop(1, hex + '00');
      ctx.beginPath();
      ctx.moveTo(toX(pts[0].month), PAD.top + chartH);
      for (const pt of pts) ctx.lineTo(toX(pt.month), toY(pt.cost));
      ctx.lineTo(toX(pts[pts.length - 1].month), PAD.top + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = curve.color;
    ctx.lineWidth = isActive ? 2.5 : 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < pts.length; i++) {
      const x = toX(pts[i].month);
      const y = toY(pts[i].cost);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // End dot for active curve
    if (isActive && pts.length > 0) {
      const last = pts[pts.length - 1];
      ctx.beginPath();
      ctx.arc(toX(last.month), toY(last.cost), 5, 0, Math.PI * 2);
      ctx.fillStyle = curve.color;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Final cost label
      ctx.fillStyle = curve.color;
      ctx.font = `bold 11px "Inter", system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatCostK(last.cost) + '/mo', toX(last.month) - 6, toY(last.cost) - 6);
    }

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export default function CostProjectionModal({ currentMonthlyCost, currentRps, onClose }: CostProjectionModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timelineYears, setTimelineYears] = useState(3);
  const [growthRate, setGrowthRate] = useState(15); // % per month
  const [activeCurve, setActiveCurve] = useState<GrowthCurve>('hockey-stick');

  const curves: GrowthCurve[] = ['linear', 'exponential', 'hockey-stick'];

  const timelineMonths = timelineYears * 12;

  const allCurveData = curves.map(curve => ({
    label: GROWTH_LABELS[curve],
    color: GROWTH_COLORS[curve],
    points: computeProjection(currentMonthlyCost, currentRps, curve, timelineMonths, growthRate),
  }));

  const activePoints = allCurveData.find(c => c.label === GROWTH_LABELS[activeCurve])?.points ?? [];
  const finalCost = activePoints[activePoints.length - 1]?.cost ?? currentMonthlyCost;
  const finalRps = activePoints[activePoints.length - 1]?.rps ?? currentRps;
  const totalCost = activePoints.reduce((sum, p, i) => {
    if (i === 0) return sum;
    return sum + p.cost;
  }, 0);

  const redraw = useCallback(() => {
    if (!canvasRef.current) return;
    drawChart(canvasRef.current, allCurveData, timelineMonths, activeCurve);
  }, [allCurveData, timelineMonths, activeCurve]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    redraw();
    const obs = new ResizeObserver(redraw);
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [redraw]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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
                Cost Projection
              </h2>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                Based on current architecture &amp; selected traffic growth curve
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
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Controls row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Timeline selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
              <label style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                <Calendar size={10} style={{ marginRight: 4, verticalAlign: -1 }} />
                Timeline
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 5].map(yr => (
                  <button
                    key={yr}
                    onClick={() => setTimelineYears(yr)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: `1px solid ${timelineYears === yr ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.07)'}`,
                      background: timelineYears === yr ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                      color: timelineYears === yr ? '#818cf8' : 'rgba(255,255,255,0.4)',
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {yr}Y
                  </button>
                ))}
              </div>
            </div>

            {/* Growth Rate */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Monthly Traffic Growth Rate: <span style={{ color: '#818cf8', fontFamily: 'var(--font-mono)' }}>{growthRate}%</span>
              </label>
              <input
                type="range"
                min={2} max={60} step={1}
                value={growthRate}
                onChange={e => setGrowthRate(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#818cf8' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>
                <span>2% (conservative)</span><span>30% (aggressive)</span><span>60% (viral)</span>
              </div>
            </div>
          </div>

          {/* Curve selectors */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {curves.map(curve => (
              <button
                key={curve}
                onClick={() => setActiveCurve(curve)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${activeCurve === curve ? GROWTH_COLORS[curve] + '50' : 'rgba(255,255,255,0.06)'}`,
                  background: activeCurve === curve ? GROWTH_COLORS[curve] + '12' : 'rgba(255,255,255,0.02)',
                  color: activeCurve === curve ? GROWTH_COLORS[curve] : 'rgba(255,255,255,0.35)',
                  fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s',
                  flex: 1, minWidth: 160,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: GROWTH_COLORS[curve], flexShrink: 0 }} />
                <div style={{ textAlign: 'left' }}>
                  <div>{GROWTH_LABELS[curve]}</div>
                  {activeCurve === curve && (
                    <div style={{ fontSize: '0.62rem', fontWeight: 400, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                      {GROWTH_DESCRIPTIONS[curve]}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Chart */}
          <div style={{
            background: 'rgba(255,255,255,0.015)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
            height: 260,
            marginBottom: 20,
          }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              {
                label: 'Current Cost',
                value: formatCostK(currentMonthlyCost) + '/mo',
                sub: `${currentRps.toLocaleString()} rps`,
                color: 'rgba(255,255,255,0.5)',
                icon: <DollarSign size={14} />,
              },
              {
                label: `Projected (${timelineYears}Y)`,
                value: formatCostK(finalCost) + '/mo',
                sub: `${finalRps.toLocaleString()} rps`,
                color: GROWTH_COLORS[activeCurve],
                icon: <TrendingUp size={14} />,
              },
              {
                label: 'Total Infrastructure Spend',
                value: formatCostK(totalCost),
                sub: `over ${timelineYears} year${timelineYears > 1 ? 's' : ''}`,
                color: '#f59e0b',
                icon: <Calendar size={14} />,
              },
              {
                label: 'Cost Multiplier',
                value: `${(finalCost / Math.max(currentMonthlyCost, 1)).toFixed(1)}×`,
                sub: `vs today`,
                color: finalCost > currentMonthlyCost * 10 ? '#f87171' : '#34d399',
                icon: <TrendingUp size={14} />,
              },
            ].map(kpi => (
              <div
                key={kpi.label}
                style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
                  <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    {kpi.label}
                  </span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: kpi.color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Hint */}
          <p style={{ margin: '16px 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, textAlign: 'center' }}>
            Projections are directional estimates based on traffic-proportional cost scaling. Actual costs depend on pricing model changes, reserved instance discounts, and architecture optimizations.
          </p>
        </div>
      </div>
    </div>
  );
}
