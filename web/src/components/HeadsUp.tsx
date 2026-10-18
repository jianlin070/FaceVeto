import { useEffect } from 'react'
import { MdClose, MdInfoOutline, MdShield, MdWarning } from 'react-icons/md'
import type { Notification } from '../lib/types'

const ICON = {
  held_post: <MdWarning size={22} className="text-danger" />,
  fyi_appearance: <MdInfoOutline size={22} className="text-primary" />,
  case_update: <MdShield size={22} className="text-success" />,
}

/** In-app "heads-up" banner that drops in from the top when a notification arrives. Tap to open it. */
export default function HeadsUp({ note, onOpen, onDismiss }: { note: Notification; onOpen: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, note.type === 'held_post' ? 10000 : 6000)
    return () => clearTimeout(t)
  }, [note, onDismiss])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto max-w-[420px] px-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div role={note.type === 'held_post' ? 'alert' : 'status'}
        className="pointer-events-auto flex animate-drop-in items-start gap-1 rounded-2xl border border-line bg-white/95 shadow-2xl backdrop-blur">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-3 text-left">
          <span className="mt-0.5 shrink-0" aria-hidden>{ICON[note.type] ?? ICON.fyi_appearance}</span>
          <span className="min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-sm font-semibold">{note.title}</span>
              <span className="shrink-0 text-xs text-muted">now</span>
            </span>
            <span className="line-clamp-2 text-sm text-muted">{note.body}</span>
            <span className="mt-1 block text-xs font-medium text-primary">{note.type === 'held_post' ? 'Review now' : 'View'}</span>
          </span>
        </button>
        <button type="button" className="icon-btn m-1" aria-label="Dismiss notification" onClick={onDismiss}><MdClose size={18} /></button>
      </div>
    </div>
  )
}
