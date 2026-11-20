export type ToastKind = 'success' | 'error' | 'info';
export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
  action?: { label: string; onClick: () => void };
}

type Listener = (items: ToastItem[]) => void;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();
let n = 0;

const emit = () => listeners.forEach((l) => l(items));

function push(kind: ToastKind, text: string, action?: ToastItem['action']) {
  const id = ++n;
  items = [...items, { id, kind, text, action }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export const toast = {
  success: (t: string, action?: ToastItem['action']) => push('success', t, action),
  error: (t: string) => push('error', t),
  info: (t: string) => push('info', t),
};
