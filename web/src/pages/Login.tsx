import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { signInWithGoogle, useAuth } from '../lib/auth'
import AuthCard, { GoogleButton, authErrorText } from '../components/AuthCard'

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const { refreshMe } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function after() {
    const me = await refreshMe()
    if (!me?.profile_complete) nav('/onboarding')
    else nav((loc.state as { from?: string } | null)?.from ?? (me.is_admin ? '/admin' : '/feed'))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
      await after()
    } catch (e) { setErr(authErrorText(e)); setBusy(false) }
  }

  async function google() {
    setBusy(true); setErr('')
    try { await signInWithGoogle(); await after() } catch (e) { setErr(authErrorText(e)); setBusy(false) }
  }

  return (
    <AuthCard title="Sign in">
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <div className="my-4 text-center text-xs text-muted">or</div>
      <GoogleButton onClick={google} disabled={busy} />
      <p className="mt-5 text-center text-sm text-muted">New here? <Link to="/signup" className="text-primary underline">Create an account</Link></p>
    </AuthCard>
  )
}
