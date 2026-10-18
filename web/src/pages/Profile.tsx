import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MdAdminPanelSettings, MdChevronRight, MdGridView, MdLogout, MdShield, MdVerifiedUser, MdVolumeUp } from 'react-icons/md'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { playChime, setSoundEnabled, soundEnabled } from '../lib/sound'
import { toast } from '../lib/toast'
import Avatar from '../components/Avatar'
import ProfileFields, { LANGS, type ProfileValues } from '../components/ProfileFields'
import Spinner from '../components/Spinner'

function Row({ icon, label, detail, onClick, to, danger, on, children }: {
  icon: ReactNode; label: string; detail?: string; onClick?: () => void; to?: string; danger?: boolean
  on?: boolean; children?: ReactNode // on: the row is a switch
}) {
  const body = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[19px] ${danger ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`} aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] ${danger ? 'text-danger' : ''}`}>{label}</span>
        {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
      </span>
      {children ?? (to && <MdChevronRight size={22} className="text-muted" aria-hidden />)}
    </>
  )
  const cls = 'flex min-h-15 w-full items-center gap-3.5 px-4 text-left transition hover:bg-gray-50'
  if (to) return <Link to={to} className={cls}>{body}</Link>
  return <button type="button" className={cls} onClick={onClick} role={on === undefined ? undefined : 'switch'} aria-checked={on}>{body}</button>
}

export default function Profile() {
  const { me, fbUser, refreshMe, signOut } = useAuth()
  const nav = useNavigate()
  const [editing, setEditing] = useState<ProfileValues | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sound, setSound] = useState(soundEnabled)

  if (!me) return <Spinner />
  const protectedFace = me.protection.status === 'active'
  const email = me.email || fbUser?.email || ''

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setBusy(true); setErr('')
    try {
      await api('/api/me', { method: 'PUT', body: JSON.stringify(editing), quiet: true })
      await refreshMe()
      setEditing(null)
      toast('Profile saved', 'success')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save your profile.')
    } finally { setBusy(false) }
  }

  const joined = me.account_age_days === 0 ? 'Today' : `${me.account_age_days} d`
  return (
    <div className="space-y-3 p-3">
      <section className="flex flex-col items-center rounded-[20px] border border-line bg-white px-5 pb-5 pt-6 text-center">
        <div className="relative rounded-full ring-4 ring-primary/10">
          <Avatar name={me.display_name} handle={me.handle} size={88} />
          {protectedFace && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5" title="Face protected">
              <MdVerifiedUser size={26} className="text-success" aria-label="Face protected" />
            </span>
          )}
        </div>
        <h1 className="mt-3.5 text-[22px] font-bold">{me.display_name}</h1>
        <p className="text-sm text-muted">@{me.handle}</p>
        <p className="mt-2.5 max-w-full truncate rounded-full bg-surface px-3 py-1 text-xs text-muted">
          Signed in as <span className="font-medium text-ink">{email}</span>
          {me.is_demo && ' · demo account'}{me.is_admin && ' · admin'}
        </p>
        <dl className="mt-4 grid w-full grid-cols-3 rounded-2xl bg-gray-50">
          <div className="flex flex-col-reverse px-1 py-3"><dt className="text-xs text-muted">Face protection</dt><dd className={`text-lg font-bold ${protectedFace ? 'text-success' : 'text-danger'}`}>{protectedFace ? 'On' : 'Off'}</dd></div>
          <div className="flex flex-col-reverse border-x border-line px-1 py-3"><dt className="text-xs text-muted">Joined</dt><dd className="text-lg font-bold">{joined}</dd></div>
          <div className="flex flex-col-reverse px-1 py-3"><dt className="text-xs text-muted">Alert language</dt><dd className="flex min-h-7 items-center justify-center text-[15px] font-bold leading-tight">{LANGS.find((l) => l.value === me.preferred_language)?.label}</dd></div>
        </dl>
        {!editing && (
          <button className="btn-ghost mt-4 w-full" onClick={() => setEditing({ display_name: me.display_name, handle: me.handle, preferred_language: me.preferred_language })}>
            Edit profile
          </button>
        )}
      </section>

      {editing && (
        <form onSubmit={save} className="space-y-4 rounded-[20px] border border-line bg-white p-4" aria-label="Edit profile">
          <ProfileFields v={editing} set={setEditing} />
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost py-1.5" onClick={() => { setEditing(null); setErr('') }} disabled={busy}>Cancel</button>
            <button className="btn-primary py-1.5" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}

      <Link to="/settings/protection"
        className={`flex items-center gap-3 rounded-[20px] p-4 transition hover:brightness-[0.98] ${protectedFace ? 'bg-success/10' : 'bg-primary/10'}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white" aria-hidden>
          {protectedFace ? <MdVerifiedUser size={24} className="text-success" /> : <MdShield size={24} className="text-primary" />}
        </span>
        <span className="flex-1">
          <span className={`block font-semibold ${protectedFace ? 'text-success' : 'text-primary-dark'}`}>{protectedFace ? 'Your face is protected' : 'Your face is not protected'}</span>
          <span className="block text-[13px] leading-snug text-gray-700">
            {protectedFace ? 'Posts that misuse your face are held for you to decide.' : 'Enrol in under a minute to stop scams and gambling ads using your face.'}
          </span>
        </span>
        <MdChevronRight size={22} className="shrink-0 text-muted" aria-hidden />
      </Link>

      <section aria-label="Settings" className="divide-y divide-surface overflow-hidden rounded-[20px] border border-line bg-white">
        <Row icon={<MdGridView />} label="Your posts" detail="In your feed, including posts under review" to="/feed?tab=mine" />
        <Row icon={<MdVolumeUp />} label="Notification sound" detail="Plays when a new alert arrives" on={sound}
          onClick={() => { setSoundEnabled(!sound); setSound(!sound); if (!sound) playChime() }}>
          <span aria-hidden
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${sound ? 'bg-primary' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sound ? 'left-5.5' : 'left-0.5'}`} />
          </span>
        </Row>
        {me.is_admin && <Row icon={<MdAdminPanelSettings />} label="Admin console" detail="Trust & safety dashboard" to="/admin" />}
        <Row icon={<MdLogout />} label="Sign out" danger onClick={async () => { await signOut(); nav('/') }} />
      </section>
    </div>
  )
}
