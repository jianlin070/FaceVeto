import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MdOpenInNew } from 'react-icons/md'
import { demoLogin } from '../lib/auth'
import Spinner from '../components/Spinner'

// Alice stays reachable at /demo/go/alice but is not offered here: her face is not enrolled, so she never gets alerts.
const WINDOWS = [
  { who: 'bob', label: 'Bob: 3 day old account', size: 'width=430,height=880' },
  { who: 'admin', label: 'Admin: review console', size: 'width=1200,height=880' },
] as const

function open(who: string, size: string) {
  window.open(`/demo/go/${who}`, `faceveto-${who}`, `popup,${size}`)
}

/** Split-screen helper for live demos and the video. Each window keeps its own sign-in. */
export default function Demo() {
  return (
    <div className="mx-auto max-w-3xl p-5">
      <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight"><img src="/favicon.svg" alt="" className="h-8 w-8" /><span>Face<span className="text-primary">Veto</span></span></Link>
      <h1 className="mt-6 text-2xl font-bold">Demo guide</h1>
      <p className="mt-1 text-muted">Open the two windows and arrange them next to your own tab. Every window has its own login.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {WINDOWS.map((w) => (
          <button key={w.who} className="btn-primary" onClick={() => open(w.who, w.size)}>
            <MdOpenInNew aria-hidden /> {w.label}
          </button>
        ))}
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-semibold">Try it with your own face (about 2 minutes)</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>In a new tab, <Link to="/signup" className="text-primary underline">create an account</Link> and complete the live face check (blink twice, turn left and right in the order shown).</li>
          <li>Open the <b>Bob</b> window. Choose a selfie of yourself, pick <b>Test: betting ad</b> from the banner menu, and post it. Bob only sees "Under review".</li>
          <li>Back in your own tab, open <b>Alerts</b>: the held post appears within seconds. Tap <b>Not me</b> to take it down, or <b>It's me</b> to allow it.</li>
          <li>Open the <b>Admin</b> window to see the case with the match score, Gemini's reasoning and the evidence pack.</li>
          <li>As Bob, post the same selfie with <b>Harmless: birthday</b>: it goes live and you get an FYI instead.</li>
        </ol>
      </section>

      <p className="mt-4 text-xs text-muted">Banners are added in your browser and labelled as tests. The prototype never uses real sexual content.</p>
    </div>
  )
}

const LANDING: Record<string, string> = { alice: '/alerts', bob: '/feed', admin: '/admin' }

export function DemoGo() {
  const { who } = useParams()
  const nav = useNavigate()
  const [err, setErr] = useState('')
  useEffect(() => {
    if (who !== 'alice' && who !== 'bob' && who !== 'admin') { nav('/demo'); return }
    demoLogin(who).then(() => nav(LANDING[who], { replace: true })).catch(() => setErr('Demo login is not available right now.'))
  }, [who, nav])
  return err ? <p className="p-6 text-danger" role="alert">{err}</p> : <Spinner full label={`Signing in as ${who}`} />
}
