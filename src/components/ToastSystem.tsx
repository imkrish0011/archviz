import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { toastBus } from '../lib/toastBus';
import type { ToastVariant } from '../lib/toastBus';

/* ─────────────────────────────────────────────────────────
 *  Toast Notification System
 *  Usage: const toast = useToast(); toast.success('Saved!')
 * ───────────────────────────────────────────────────────── */

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id = `toast_${++toastCounter}`;
    setToasts(prev => [...prev.slice(-4), { id, message, variant }]);
    const timer = setTimeout(() => dismiss(id), 3000);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  const value: ToastContextValue = {
    toasts,
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.variant}`}
          onClick={() => onDismiss(toast.id)}
        >
          <span className="toast-icon">
            {toast.variant === 'success' && '✓'}
            {toast.variant === 'error' && '✕'}
            {toast.variant === 'info' && 'i'}
            {toast.variant === 'warning' && '!'}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

/** Hook that bridges bus → ToastContext */
export function useToastBus() {
  const toast = useToast();
  useEffect(() => {
    // 1. Listen to our internal JS object bus
    const unsubscribe = toastBus.subscribe((msg, variant) => {
      switch (variant) {
        case 'success': toast.success(msg); break;
        case 'error': toast.error(msg); break;
        case 'warning': toast.warning(msg); break;
        default: toast.info(msg);
      }
    });

    // 2. Listen to window-level custom events (for modules that can't import the bus)
    const handleWindowEvent = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail;
      switch (type) {
        case 'success': toast.success(message); break;
        case 'error': toast.error(message); break;
        case 'warning': toast.warning(message); break;
        default: toast.info(message);
      }
    };
    window.addEventListener('archviz-toast', handleWindowEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('archviz-toast', handleWindowEvent);
    };
  }, [toast]);
}
