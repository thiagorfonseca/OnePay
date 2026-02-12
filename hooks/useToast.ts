import { useCallback, useState } from 'react';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = { id, ...toast } as ToastItem;
    setToasts((prev) => [...prev, next]);
    setTimeout(() => dismiss(id), 6000);
  }, [dismiss]);

  return { toasts, push, dismiss };
};
