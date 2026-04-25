/**
 * Global Toast Event Bus — extracted from ToastSystem.tsx to fix Fast Refresh.
 * 
 * Non-component exports must live in a separate file from React components
 * so that HMR can properly refresh the component module.
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';
export type ToastListener = (msg: string, variant: ToastVariant) => void;

const listeners: ToastListener[] = [];

export const toastBus = {
  emit(msg: string, variant: ToastVariant = 'info') {
    listeners.forEach(fn => fn(msg, variant));
  },
  subscribe(fn: ToastListener) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  },
};
