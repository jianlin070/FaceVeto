import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import AuthCard from '../components/AuthCard'
import ProfileFields, { suggestHandle, type ProfileValues } from '../components/ProfileFields'
import Spinner from '../components/Spinner'

/** First-time Google (or any profile-less) users pick a handle and language, then enrol. */
export default function Onboarding() {
  const { fbUser, me, loading, refreshMe } = useAuth()
  const nav = useNavigate()
  const [profile, setProfile] = useState<ProfileValues>(() => ({
    display_name: fbUser?.displayName ?? '',
    handle: suggestHandle(fbUser?.displayName || fbUser?.email || 'user'),
    preferred_language: 'en',
  }))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner full />
  if (!fbUser) return <Navigate to="/login" replace />
  if (me?.profile_complete) return <Navigate to="/feed" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      await api('/api/me', { method: 'PUT', body: JSON.stringify(profile), quiet: true })
      await refreshMe()
      nav('/enrol')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save your profile.')
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Welcome to Lepak">
      <p className="mt-1 text-sm text-muted">Pick how people see you. You can protect your face next.</p>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <ProfileFields v={profile} set={setProfile} />
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving...' : 'Continue'}</button>
      </form>
    </AuthCard>
  )
}
