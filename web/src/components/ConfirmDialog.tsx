import { useEffect, useRef, type ReactNode } from 'react'

/** Accessible in-page confirm (native confirm() would block the page). */
export default function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onCancel() }}
      className="m-auto w-[min(92vw,380px)] rounded-2xl p-0 backdrop:bg-black/40">
      <div className="p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy ? 'Working...' : confirmLabel}</button>
        </div>
      </div>
    </dialog>
  )
}
