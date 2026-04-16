import { useArchStore } from '../store/useArchStore';
import { runSecurityScan } from '../engine/securityScanner';
import {
  X, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, AlertCircle,
  Info, ChevronDown, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { SecurityFinding, SecuritySeverity } from '../types';

const severityColors: Record<SecuritySeverity, string> = {
  critical: '#ff4444',
  high: '#ff8c00',
  medium: '#fbbf24',
  low: '#60a5fa',
};

const severityIcons: Record<SecuritySeverity, typeof ShieldAlert> = {
  critical: ShieldX,
  high: AlertCircle,
  medium: AlertTriangle,
  low: Info,
};

const complianceBadgeColors: Record<string, string> = {
  'SOC2':     '#818cf8',
  'HIPAA':    '#f472b6',
  'PCI-DSS':  '#fbbf24',
  'GDPR':     '#34d399',
  'NIST':     '#60a5fa',
  'OWASP':    '#f87171',
  'ISO-27001':'#a78bfa',
  'CCPA':     '#2dd4bf',
};

function FindingCard({ finding, index }: { finding: SecurityFinding; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const SevIcon = severityIcons[finding.severity];
  const color = severityColors[finding.severity];

  return (
    <div
      className="security-finding-card"
      style={{
        borderLeftColor: color,
        animationDelay: `${index * 30}ms`,
      }}
    >
      <button
        className="security-finding-header"
        onClick={() => setExpanded(!expanded)}
      >
        <SevIcon size={15} style={{ color, flexShrink: 0, marginTop: 1 }} />
        <div className="security-finding-title-area">
          <span className="security-finding-title">{finding.title}</span>
          <div className="security-finding-badges">
            <span
              className="severity-badge"
              style={{ background: color + '18', color }}
            >
              {finding.severity.toUpperCase()}
            </span>
            {finding.compliance.map(c => (
              <span
                key={c}
                className="compliance-badge"
                style={{ background: (complianceBadgeColors[c] || '#666') + '15', color: complianceBadgeColors[c] || '#888' }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <span style={{ 
          flexShrink: 0, marginTop: 2, 
          transition: 'transform 0.2s ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          color: 'rgba(255,255,255,0.25)',
        }}>
          <ChevronDown size={14} />
        </span>
      </button>

      {expanded && (
        <div className="security-finding-body">
          <p className="security-finding-desc">{finding.description}</p>
          <div className="security-finding-remediation">
            <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>Remediation:</strong> {finding.remediation}</span>
          </div>
          {finding.affectedNodeIds.length > 0 && (
            <p className="security-finding-affected">
              {finding.affectedNodeIds.length} component{finding.affectedNodeIds.length > 1 ? 's' : ''} affected
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SecurityPanel() {
  const securityPanelOpen = useArchStore(s => s.securityPanelOpen);
  const toggleSecurityPanel = useArchStore(s => s.toggleSecurityPanel);
  const nodes = useArchStore(s => s.nodes);
  const edges = useArchStore(s => s.edges);

  const report = useMemo(() => runSecurityScan(nodes, edges), [nodes, edges]);

  if (!securityPanelOpen) return null;

  const gradeColor =
    report.grade === 'A' ? '#34d399' :
    report.grade === 'B' ? '#60a5fa' :
    report.grade === 'C' ? '#fbbf24' :
    report.grade === 'D' ? '#fb923c' : '#f87171';

  const criticalCount = report.findings.filter(f => f.severity === 'critical').length;
  const highCount = report.findings.filter(f => f.severity === 'high').length;
  const mediumCount = report.findings.filter(f => f.severity === 'medium').length;
  const lowCount = report.findings.filter(f => f.severity === 'low').length;

  return (
    <div className="security-panel-overlay" onClick={toggleSecurityPanel}>
      <div className="security-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="security-panel-header">
          <div className="security-panel-title-row">
            <ShieldAlert size={20} style={{ color: gradeColor }} />
            <h2>Security Report</h2>
          </div>
          <button className="btn-icon" onClick={toggleSecurityPanel} style={{ color: 'rgba(255,255,255,0.4)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Score Ring */}
        <div className="security-score-card">
          <div
            className="security-score-circle"
            style={{
              borderColor: gradeColor,
              boxShadow: `0 0 24px ${gradeColor}25, inset 0 0 12px rgba(0,0,0,0.6)`,
            }}
          >
            <span className="security-score-value" style={{ color: gradeColor }}>{report.score}</span>
            <span className="security-score-label">out of 100</span>
          </div>
          <div className="security-score-grade" style={{ color: gradeColor }}>
            Grade {report.grade}
          </div>
          <div className="security-score-summary">
            {report.findings.length === 0
              ? 'No security issues detected. Your architecture follows security best practices.'
              : `${report.findings.length} issue${report.findings.length > 1 ? 's' : ''} found across your architecture.`
            }
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="security-severity-bar">
          {criticalCount > 0 && (
            <div className="severity-count" style={{ color: severityColors.critical }}>
              <ShieldX size={12} /> {criticalCount} Critical
            </div>
          )}
          {highCount > 0 && (
            <div className="severity-count" style={{ color: severityColors.high }}>
              <AlertCircle size={12} /> {highCount} High
            </div>
          )}
          {mediumCount > 0 && (
            <div className="severity-count" style={{ color: severityColors.medium }}>
              <AlertTriangle size={12} /> {mediumCount} Medium
            </div>
          )}
          {lowCount > 0 && (
            <div className="severity-count" style={{ color: severityColors.low }}>
              <Info size={12} /> {lowCount} Low
            </div>
          )}
        </div>

        {/* Findings List */}
        <div className="security-findings-list">
          {report.findings.map((finding, idx) => (
            <FindingCard key={finding.id} finding={finding} index={idx} />
          ))}
          {report.findings.length === 0 && (
            <div className="security-empty">
              <ShieldCheck size={52} style={{ color: '#34d399' }} />
              <p>All clear — no security issues detected.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="security-panel-footer">
          <span>25 rules  •  SOC2  •  HIPAA  •  PCI-DSS  •  GDPR  •  NIST  •  OWASP</span>
        </div>
      </div>
    </div>
  );
}
