export type ToastKind = 'info' | 'success' | 'error'
export interface ToastMsg { id: number; kind: ToastKind; text: string }

type Listener = (t: ToastMsg) => void
const listeners = new Set<Listener>()
let nextId = 1

export function toast(text: string, kind: ToastKind = 'info') {
  const msg = { id: nextId++, kind, text }
  listeners.forEach((l) => l(msg))
}

export function onToast(l: Listener) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
