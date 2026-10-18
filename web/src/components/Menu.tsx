import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Popup menu following the WAI-ARIA menu button pattern: Escape closes, arrow keys move, outside tap closes. */
export default function Menu({ label, trigger, children, className = 'icon-btn', panelClassName = 'right-0 origin-top-right' }: {
  label: string; trigger: ReactNode; className?: string; panelClassName?: string; children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
    items()[0]?.focus()
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const xs = items()
      const i = xs.indexOf(document.activeElement as HTMLElement)
      xs[(i + (e.key === 'ArrowDown' ? 1 : xs.length - 1)) % xs.length]?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button ref={button} type="button" className={className} aria-label={label} title={label}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div role="menu" aria-label={label}
          className={`absolute top-full z-30 mt-1 min-w-52 animate-fade-in overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-xl ${panelClassName}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onSelect, danger, checked }: {
  icon?: ReactNode; children: ReactNode; onSelect: () => void; danger?: boolean; checked?: boolean
}) {
  return (
    <button type="button" role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={checked}
      onClick={onSelect}
      className={`flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm hover:bg-surface focus:bg-surface focus:outline-none ${danger ? 'text-danger' : 'text-ink'}`}>
      {icon && <span className="text-[20px] opacity-80" aria-hidden>{icon}</span>}
      <span className="flex-1">{children}</span>
      {checked !== undefined && (
        <span aria-hidden className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-primary' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} />
        </span>
      )}
    </button>
  )
}
