import { useEffect, useState } from 'react'
import { onToast, type ToastMsg } from '../lib/toast'

const STYLE = { info: 'bg-ink text-white', success: 'bg-success text-white', error: 'bg-danger text-white' }

export default function Toasts() {
  const [items, setItems] = useState<ToastMsg[]>([])
  useEffect(() => onToast((t) => {
    setItems((xs) => [...xs, t])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4500)
  }), [])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} role="status" className={`pointer-events-auto max-w-sm animate-fade-in rounded-xl px-4 py-3 text-sm shadow-lg ${STYLE[t.kind]}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
