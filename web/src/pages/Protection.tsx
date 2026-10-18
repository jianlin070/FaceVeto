import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MdArrowBack, MdDeleteOutline, MdLock, MdSearchOff, MdShield, MdVerifiedUser } from 'react-icons/md'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { toast } from '../lib/toast'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Protection() {
  const { me, refreshMe } = useAuth()
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const active = me?.protection.status === 'active'

  async function del() {
    setBusy(true)
    try {
      await api('/api/enrol', { method: 'DELETE' })
      await refreshMe()
      toast('Face template deleted', 'success')
    } finally {
      setBusy(false); setAsk(false)
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="-ml-1 flex items-center gap-1">
        <Link to="/profile" className="icon-btn" aria-label="Back to profile"><MdArrowBack size={22} /></Link>
        <h1 className="text-lg font-bold">Face protection</h1>
      </div>
      <section className="rounded-[20px] border border-line bg-white px-5 pb-6 pt-7 text-center">
        <span className={`mx-auto flex h-18 w-18 items-center justify-center rounded-full ring-8 ${active ? 'bg-success/10 text-success ring-success/5' : 'bg-surface text-muted ring-surface/50'}`} aria-hidden>
          {active ? <MdVerifiedUser size={36} /> : <MdShield size={36} />}
        </span>
        <p className={`mt-4 text-xl font-bold ${active ? 'text-success' : ''}`}>{active ? 'Protected' : 'Not protected'}</p>
        <p className="mt-1.5 text-sm text-muted">
          {active && me?.protection.enrolled_at
            ? `Enrolled ${new Date(me.protection.enrolled_at).toLocaleString()}`
            : 'Enrol your face so we can hold harmful posts of you.'}
        </p>
      </section>
      <Link to="/enrol" className="btn-primary min-h-13 w-full text-base shadow-lg shadow-primary/25">{active ? 'Re-enrol my face' : 'Protect my face'}</Link>
      {active && <button className="btn-ghost min-h-13 w-full text-base text-danger" onClick={() => setAsk(true)}>Delete my face template</button>}
      <section className="rounded-[20px] border border-line bg-white p-5">
        <h2 className="font-semibold">How we handle your face</h2>
        <ul className="mt-3 space-y-3 text-sm leading-snug text-gray-700">
          {[
            [<MdLock key="i" />, 'We store a 512-number face template, encrypted at rest. Never your photos.'],
            [<MdSearchOff key="i" />, 'Templates are only used to protect you. There is no face search.'],
            [<MdDeleteOutline key="i" />, 'Deleting is immediate and permanent. Posts already held stay held until you decide.'],
          ].map(([icon, text]) => (
            <li key={text as string} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-base text-primary" aria-hidden>{icon}</span>
              <span className="pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
      </section>
      <ConfirmDialog open={ask} title="Delete your face template?" confirmLabel="Delete" danger busy={busy}
        onConfirm={del} onCancel={() => setAsk(false)}>
        New posts of you will no longer be checked. You can enrol again any time.
      </ConfirmDialog>
    </div>
  )
}
