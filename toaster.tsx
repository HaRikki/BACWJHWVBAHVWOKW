'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Math.random().toString(36) }],
    })),
  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function toast(opts: Omit<Toast, 'id'>) {
  useToastStore.getState().add(opts);
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400',
  error: 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400',
  info: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
};

export function Toaster() {
  const { toasts, remove } = useToastStore();

  useEffect(() => {
    toasts.forEach((t) => {
      const timer = setTimeout(() => remove(t.id), 4000);
      return () => clearTimeout(timer);
    });
  }, [toasts, remove]);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-xl animate-slide-up',
              colors[t.type]
            )}
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">{t.title}</p>
              {t.description && (
                <p className="text-xs opacity-80 mt-0.5">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="opacity-60 hover:opacity-100 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
