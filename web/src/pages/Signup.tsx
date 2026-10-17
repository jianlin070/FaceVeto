import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { api, ApiError } from '../lib/api'
import { signInWithGoogle, useAuth } from '../lib/auth'
import AuthCard, { GoogleButton, authErrorText } from '../components/AuthCard'
import ProfileFields, { type ProfileValues } from '../components/ProfileFields'

export default function Signup() {
  const nav = useNavigate()
  const { refreshMe } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<ProfileValues>({ display_name: '', handle: '', preferred_language: 'en' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      if (!auth.currentUser) await createUserWithEmailAndPassword(auth, email, password)
      await api('/api/me', { method: 'PUT', body: JSON.stringify(profile), quiet: true })
      await refreshMe()
      nav('/enrol')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : authErrorText(e))
      setBusy(false)
    }
  }

  async function google() {
    setBusy(true); setErr('')
    try {
      await signInWithGoogle()
      const me = await refreshMe()
      nav(me?.profile_complete ? '/feed' : '/onboarding')
    } catch (e) { setErr(authErrorText(e)); setBusy(false) }
  }

  return (
    <AuthCard title="Create your account">
      <p className="mt-1 text-sm text-muted">Next you can protect your face in about 20 seconds.</p>
      <GoogleButton onClick={google} disabled={busy} />
      <div className="my-4 text-center text-xs text-muted">or sign up with email</div>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={6} className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ProfileFields v={profile} set={setProfile} />
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">Already have an account? <Link to="/login" className="text-primary underline">Sign in</Link></p>
    </AuthCard>
  )
}
