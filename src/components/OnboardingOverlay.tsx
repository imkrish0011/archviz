import { useArchStore } from '../store/useArchStore';
import { Box, DollarSign, Activity, Lightbulb } from 'lucide-react';

export default function OnboardingOverlay() {
  const show = useArchStore(s => s.showOnboarding);
  const dismiss = useArchStore(s => s.dismissOnboarding);
  
  if (!show) return null;
  
  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Box size={32} style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="onboarding-title">
          Welcome to <span className="onboarding-accent">ArchViz</span>
        </h1>
        <p className="onboarding-desc">
          A visual system design engine where every component has meaning, 
          every connection affects performance, and every decision has measurable consequences.
        </p>
        
        <div className="onboarding-features">
          <div className="onboarding-feature">
            <Activity size={18} />
            <div className="onboarding-feature-title">Design</div>
            <div className="onboarding-feature-desc">
              Drag components onto the canvas and connect them to build your architecture
            </div>
          </div>
          <div className="onboarding-feature">
            <DollarSign size={18} />
            <div className="onboarding-feature-title">Simulate</div>
            <div className="onboarding-feature-desc">
              Real-time cost estimation using actual AWS pricing — see the impact instantly
            </div>
          </div>
          <div className="onboarding-feature">
            <Lightbulb size={18} />
            <div className="onboarding-feature-title">Optimize</div>
            <div className="onboarding-feature-desc">
              AI-powered recommendations detect bottlenecks and suggest improvements
            </div>
          </div>
        </div>
        
        <button className="btn btn-accent" onClick={dismiss} style={{ padding: '8px 32px', fontSize: 'var(--text-md)' }}>
          Get Started
        </button>
      </div>
    </div>
  );
}
