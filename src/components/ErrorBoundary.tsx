import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

/**
 * App-level Error Boundary.
 * Catches any unhandled React error and renders a recovery UI
 * instead of a blank white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log to console for debugging
    console.error('[ArchViz ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReset = () => {
    localStorage.removeItem('archviz-state');
    localStorage.removeItem('archviz-onboarded');
    window.location.hash = '#/';
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: '#0a0a0c',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          zIndex: 99999,
        }}>
          {/* Subtle background grid */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.03,
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />

          <div style={{
            position: 'relative',
            maxWidth: 520, width: '90%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: '48px 40px',
            textAlign: 'center',
          }}>
            {/* Error icon */}
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <AlertTriangle size={28} color="#f87171" />
            </div>

            <h1 style={{
              fontSize: '1.5rem', fontWeight: 700,
              color: '#f1f1f3', margin: '0 0 8px',
              letterSpacing: '-0.02em',
            }}>
              {this.props.fallbackTitle || 'Something went wrong'}
            </h1>

            <p style={{
              fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.7, margin: '0 0 32px',
            }}>
              ArchViz encountered an unexpected error. Your saved data is still safe in local storage.
              Try reloading, or clear all data to start fresh.
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#a5b4fc', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.25)')}
                onMouseOut={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
              >
                <RefreshCw size={14} />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              >
                <RefreshCw size={14} />
                Reload Page
              </button>
              <button
                onClick={this.handleClearAndReset}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
                onMouseOut={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              >
                <Trash2 size={14} />
                Clear & Reset
              </button>
            </div>

            {/* Error details (collapsible) */}
            <div style={{ textAlign: 'left' }}>
              <button
                onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: 0, letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {this.state.showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Error Details
              </button>
              {this.state.showDetails && (
                <pre style={{
                  marginTop: 12, padding: 16,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.7rem', lineHeight: 1.65,
                  overflow: 'auto', maxHeight: 200,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                }}>
                  {this.state.error?.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Canvas-level Error Boundary.
 * Wraps only the ReactFlow canvas so sidebar/topbar remain functional.
 */
export class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ArchViz CanvasError]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0c0b0f',
          gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={22} color="#fbbf24" />
          </div>
          <h3 style={{
            fontSize: '1.1rem', fontWeight: 700,
            color: '#f1f1f3', margin: 0,
          }}>
            Canvas Error
          </h3>
          <p style={{
            fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)',
            margin: 0, textAlign: 'center', maxWidth: 340,
            lineHeight: 1.6,
          }}>
            The canvas encountered an error, but your data is safe.
            Try again or reload the page.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <RefreshCw size={13} /> Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
          {this.state.error && (
            <pre style={{
              marginTop: 8, padding: 12,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 6, fontSize: '0.65rem',
              color: 'rgba(255,255,255,0.3)',
              maxWidth: 500, overflow: 'auto', maxHeight: 120,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
