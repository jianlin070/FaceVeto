import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { MdFaceRetouchingNatural, MdImageSearch, MdGavel, MdLock, MdPerson, MdAdminPanelSettings, MdCameraAlt } from 'react-icons/md'
import { demoLogin, useAuth } from '../lib/auth'

const STEPS = [
  { icon: MdFaceRetouchingNatural, title: 'Enrol', text: 'Register your face once at sign-up with a quick live check: blink and turn your head. Only a face template is kept, never the photo.' },
  { icon: MdImageSearch, title: 'Detect', text: 'Every new post is face matched. If you appear in someone else\'s post, Gemini checks whether it misuses your image: gambling, scams, sexual edits, impersonation.' },
  { icon: MdGavel, title: 'Protect', text: 'Harmful posts are held before anyone sees them. You get an alert in seconds and decide: "Not me" takes it down, "It\'s me" lets it through.' },
]

const DEMO = [
  { who: 'alice' as const, label: 'Login as Alice', sub: 'protected user, gets alerts', icon: MdPerson, to: '/alerts' },
  { who: 'bob' as const, label: 'Login as Bob', sub: '3 day old account, posts photos', icon: MdCameraAlt, to: '/feed' },
  { who: 'admin' as const, label: 'Login as Admin', sub: 'trust & safety review console', icon: MdAdminPanelSettings, to: '/admin' },
]

export default function Landing() {
  const { fbUser, me } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)

  if (fbUser && me?.profile_complete) return <Navigate to={me.is_admin ? '/admin' : '/feed'} replace />

  async function go(d: (typeof DEMO)[number]) {
    setBusy(d.who)
    try {
      await demoLogin(d.who)
      nav(d.to)
    } catch {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 pb-14 pt-10">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <img src="/favicon.svg" alt="" className="h-8 w-8" /> FaceVeto
          </div>
          <h1 className="mt-10 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">Your face, your veto.</h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-300">
            Selfies get stolen and reused in online gambling ads, scam endorsements and sexualised edits.
            FaceVeto is a protection layer inside social platforms that holds those posts before they go live,
            and lets the real person decide.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary">Create an account</Link>
            <Link to="/login" className="btn bg-white/10 text-white hover:bg-white/20">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="card -mt-8 p-5 sm:p-6" aria-labelledby="demo-h">
          <h2 id="demo-h" className="text-lg font-semibold">Try the demo in one click</h2>
          <p className="mt-1 text-sm text-muted">
            The prototype simulates a social app called Lepak with FaceVeto built in. Open Alice and Admin in two windows
            (one incognito) to watch an alert arrive in real time. <Link to="/demo" className="text-primary underline">Demo guide</Link>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {DEMO.map((d) => (
              <button key={d.who} className="btn-ghost flex-col items-start !justify-start p-4 text-left" disabled={!!busy} onClick={() => go(d)}>
                <span className="flex items-center gap-2 font-semibold"><d.icon size={20} className="text-primary" aria-hidden />{busy === d.who ? 'Signing in...' : d.label}</span>
                <span className="text-xs font-normal text-muted">{d.sub}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Want to use your own face? Create an account, enrol, then sign in as Bob and post a photo of yourself.
          </p>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3" aria-label="How it works">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-5">
              <s.icon size={32} className="text-primary" aria-hidden />
              <h3 className="mt-3 font-semibold">{i + 1}. {s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </section>

        <section className="card mt-6 mb-12 p-5" aria-labelledby="privacy-h">
          <h2 id="privacy-h" className="flex items-center gap-2 font-semibold"><MdLock className="text-success" aria-hidden /> Privacy by design</h2>
          <ul className="mt-2 grid gap-1 text-sm text-muted sm:grid-cols-2">
            <li>Not a face search engine: nobody can look up who a face belongs to.</li>
            <li>Posters never learn who matched or why a post is held.</li>
            <li>Only the enrolled person and reviewers see a held post.</li>
            <li>Templates, not photos. Delete yours at any time.</li>
            <li>Matching only runs against people who opted in.</li>
            <li>A human decides every takedown. AI explains its reasoning.</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
