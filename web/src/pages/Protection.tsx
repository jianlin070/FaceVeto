import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MdArrowBack, MdVerifiedUser, MdShield } from 'react-icons/md'
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
    <div className="space-y-4 p-4">
      <div className="-ml-2 flex items-center gap-1">
        <Link to="/profile" className="icon-btn" aria-label="Back to profile"><MdArrowBack size={22} /></Link>
        <h1 className="text-lg font-semibold">Face protection</h1>
      </div>
      <div className={`card flex items-center gap-4 p-4 ${active ? 'border-success' : ''}`}>
        {active ? <MdVerifiedUser size={40} className="text-success" aria-hidden /> : <MdShield size={40} className="text-muted" aria-hidden />}
        <div>
          <p className="font-semibold">{active ? 'Protected' : 'Not protected'}</p>
          <p className="text-sm text-muted">
            {active && me?.protection.enrolled_at
              ? `Enrolled ${new Date(me.protection.enrolled_at).toLocaleString()}`
              : 'Enrol your face so we can hold harmful posts of you.'}
          </p>
        </div>
      </div>
      <Link to="/enrol" className="btn-primary w-full">{active ? 'Re-enrol my face' : 'Protect my face'}</Link>
      {active && <button className="btn-ghost w-full text-danger" onClick={() => setAsk(true)}>Delete my face template</button>}
      <div className="card p-4 text-sm text-muted">
        <p className="font-medium text-ink">How we handle your face</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>We store a 512-number face template, encrypted at rest. Never your photos.</li>
          <li>Templates are only used to protect you. There is no face search.</li>
          <li>Deleting is immediate and permanent. Posts already held stay held until you decide.</li>
        </ul>
      </div>
      <ConfirmDialog open={ask} title="Delete your face template?" confirmLabel="Delete" danger busy={busy}
        onConfirm={del} onCancel={() => setAsk(false)}>
        New posts of you will no longer be checked. You can enrol again any time.
      </ConfirmDialog>
    </div>
  )
}
