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
      <span className={`text-[22px] ${danger ? 'text-danger' : 'text-muted'}`} aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] ${danger ? 'text-danger' : ''}`}>{label}</span>
        {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
      </span>
      {children ?? (to && <MdChevronRight size={22} className="text-muted" aria-hidden />)}
    </>
  )
  const cls = 'flex min-h-14 w-full items-center gap-4 px-4 text-left hover:bg-surface'
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

  return (
    <div>
      <section className="flex flex-col items-center px-4 pb-5 pt-6 text-center">
        <div className="relative">
          <Avatar name={me.display_name} handle={me.handle} size={88} />
          {protectedFace && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5" title="Face protected">
              <MdVerifiedUser size={26} className="text-success" aria-label="Face protected" />
            </span>
          )}
        </div>
        <h1 className="mt-3 text-xl font-bold">{me.display_name}</h1>
        <p className="text-sm text-muted">@{me.handle}</p>
        <p className="mt-2 rounded-full bg-surface px-3 py-1 text-xs text-muted">
          Signed in as <span className="font-medium text-ink">{email}</span>
          {me.is_demo && ' · demo account'}{me.is_admin && ' · admin'}
        </p>
        <p className="mt-1 text-xs text-muted">
          Joined {me.account_age_days === 0 ? 'today' : `${me.account_age_days} day${me.account_age_days === 1 ? '' : 's'} ago`}
          {' · '}Alerts in {LANGS.find((l) => l.value === me.preferred_language)?.label}
        </p>
        {!editing && (
          <button className="btn-ghost mt-4 py-1.5" onClick={() => setEditing({ display_name: me.display_name, handle: me.handle, preferred_language: me.preferred_language })}>
            Edit profile
          </button>
        )}
      </section>

      {editing && (
        <form onSubmit={save} className="mx-4 mb-4 space-y-4 rounded-2xl border border-line p-4" aria-label="Edit profile">
          <ProfileFields v={editing} set={setEditing} />
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost py-1.5" onClick={() => { setEditing(null); setErr('') }} disabled={busy}>Cancel</button>
            <button className="btn-primary py-1.5" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}

      <Link to="/settings/protection"
        className={`mx-4 flex items-center gap-3 rounded-2xl p-4 ${protectedFace ? 'bg-success/10' : 'bg-primary/10'}`}>
        {protectedFace ? <MdVerifiedUser size={32} className="shrink-0 text-success" aria-hidden /> : <MdShield size={32} className="shrink-0 text-primary" aria-hidden />}
        <span className="flex-1">
          <span className="block font-semibold">{protectedFace ? 'Your face is protected' : 'Your face is not protected'}</span>
          <span className="block text-sm text-muted">
            {protectedFace ? 'Posts that misuse your face are held for you to decide.' : 'Enrol in under a minute to stop scams and gambling ads using your face.'}
          </span>
        </span>
        <MdChevronRight size={22} className="shrink-0 text-muted" aria-hidden />
      </Link>

      <section aria-label="Settings" className="mt-4 divide-y divide-line border-y border-line">
        <Row icon={<MdGridView />} label="Your posts" detail="In your feed, including posts under review" to="/feed?tab=mine" />
        <Row icon={<MdVolumeUp />} label="Notification sound" detail="Plays when a new alert arrives" on={sound}
          onClick={() => { setSoundEnabled(!sound); setSound(!sound); if (!sound) playChime() }}>
          <span aria-hidden
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${sound ? 'bg-primary' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sound ? 'left-5.5' : 'left-0.5'}`} />
          </span>
        </Row>
        {me.is_admin && <Row icon={<MdAdminPanelSettings />} label="Admin console" detail="Trust & safety review queue" to="/admin" />}
        <Row icon={<MdLogout />} label="Sign out" danger onClick={async () => { await signOut(); nav('/') }} />
      </section>

    </div>
  )
}
