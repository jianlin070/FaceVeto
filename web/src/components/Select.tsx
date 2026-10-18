import { useEffect, useId, useRef, useState } from 'react'
import { MdCheck, MdExpandMore } from 'react-icons/md'

export interface Option { value: string; label: string; dot?: string }

/** Themed single-select following the WAI-ARIA listbox pattern: arrows move, Enter picks, Escape closes. */
export default function Select({ label, value, options, onChange }: {
  label: string; value: string; options: Option[]; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function show() {
    setActive(Math.max(0, options.indexOf(current)))
    setOpen(true)
  }
  function pick(o: Option) {
    onChange(o.value)
    setOpen(false)
    button.current?.focus()
  }
  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(options[active])
    }
  }

  const dot = (c?: string) => c && <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: c }} />
  return (
    <div ref={root} className="relative">
      <button ref={button} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined} aria-label={`${label}: ${current.label}`}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}
        className={`flex h-11 w-full min-w-0 items-center sm:min-w-48 gap-2 rounded-xl border bg-white pl-3.5 pr-2.5 text-left text-sm transition hover:border-gray-400 ${open ? 'border-primary ring-3 ring-primary/20' : 'border-gray-300'}`}>
        <span className="text-muted">{label}</span>
        {dot(current.dot)}
        <span className="flex-1 truncate font-medium">{current.label}</span>
        <MdExpandMore size={20} aria-hidden className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label={label}
          className="absolute right-0 top-full z-30 mt-1.5 w-full min-w-56 animate-fade-in rounded-2xl border border-line bg-white p-1.5 shadow-xl">
          {options.map((o, i) => {
            const selected = o.value === current.value
            return (
              <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={selected}
                onPointerEnter={() => setActive(i)} onClick={() => pick(o)}
                className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm ${selected ? 'font-semibold text-primary-dark' : 'text-ink'} ${i === active ? 'bg-surface' : ''} ${selected && i !== active ? 'bg-primary/8' : ''}`}>
                {dot(o.dot)}
                <span className="flex-1">{o.label}</span>
                {selected && <MdCheck size={18} className="text-primary" aria-hidden />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
