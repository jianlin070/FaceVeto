import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { MdFaceRetouchingNatural, MdImageSearch, MdGavel, MdLock, MdPerson, MdAdminPanelSettings, MdCameraAlt, MdCheckCircle, MdChevronRight, MdArrowForward } from 'react-icons/md'
import { demoLogin, useAuth } from '../lib/auth'
import Logo from '../components/Logo'
import Intro, { shouldPlayIntro } from '../components/Intro'

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

const PRIVACY = [
  'Not a face search engine: nobody can look up who a face belongs to.',
  'Posters never learn who matched or why a post is held.',
  'Only the enrolled person and reviewers see a held post.',
  'Templates, not photos. Delete yours at any time.',
  'Matching only runs against people who opted in.',
  'A human decides every takedown. AI explains its reasoning.',
]

/** Rises into place the first time it scrolls into view. */
function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { rootMargin: '0px 0px -10% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown])
  return <div ref={ref} className={shown ? 'animate-rise' : 'opacity-0'}>{children}</div>
}

export default function Landing() {
  const { fbUser, me } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  // play: intro covers the page; reveal: the logo is flying to the header; done
  const [playedIntro] = useState(shouldPlayIntro)
  const [intro, setIntro] = useState<'play' | 'reveal' | 'done'>(playedIntro ? 'play' : 'done')
  const headerLogo = useRef<HTMLSpanElement>(null)
  const reveal = useCallback(() => setIntro((s) => (s === 'play' ? 'reveal' : s)), [])
  const introDone = useCallback(() => setIntro('done'), [])
  const showContent = intro !== 'play'

  if (fbUser && me?.profile_complete) return <Navigate to={me.is_admin ? '/admin' : '/feed'} replace />

  async function go(d: (typeof DEMO)[number]) {
    setBusy(d.who)
    try {
      await demoLogin(d.who)
      nav(d.to, { viewTransition: true })
    } catch {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-dvh bg-surface">
      {intro !== 'done' && <Intro target={headerLogo} onReveal={reveal} onDone={introDone} />}
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          <Link to="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <span ref={headerLogo} className={`flex ${intro === 'done' ? '' : 'opacity-0'}`}><Logo size={36} animated={!playedIntro} /></span>
            <span className={showContent ? (playedIntro ? 'animate-rise' : '') : 'opacity-0'}>Face<span className="text-primary">Veto</span></span>
          </Link>
          <nav className={`ml-auto flex items-center gap-2 ${showContent ? (playedIntro ? 'animate-rise [animation-delay:120ms]' : '') : 'opacity-0'}`}>
            <Link to="/login" viewTransition className="btn-ghost min-h-10 px-4 py-2 text-sm">Sign in</Link>
            <Link to="/signup" viewTransition className="btn-primary hidden min-h-10 px-4 py-2 text-sm sm:inline-flex">Create an account</Link>
          </nav>
        </div>
      </header>

      {showContent && <main className="mx-auto max-w-6xl space-y-6 px-5 pb-12 pt-10 sm:pt-14">
        <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[13px] font-semibold text-primary-dark">
              <MdLock aria-hidden /> Face protection for social platforms
            </p>
            <h1 className="mt-5 animate-rise text-4xl [animation-delay:80ms] font-bold leading-[1.1] tracking-tight sm:text-5xl">Your face, <span className="text-primary">your veto.</span></h1>
            <p className="mt-5 max-w-xl animate-rise text-lg leading-relaxed text-muted [animation-delay:160ms]">
              Selfies get stolen and reused in online gambling ads, scam endorsements and sexualised edits.
              FaceVeto is a protection layer inside social platforms that holds those posts before they go live,
              and lets the real person decide.
            </p>
            <div className="mt-8 flex animate-rise flex-wrap gap-3 [animation-delay:240ms]">
              <Link to="/signup" viewTransition className="group btn-primary min-h-12 px-6 text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30">
                Create an account <MdArrowForward aria-hidden className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link to="/login" viewTransition className="btn-ghost min-h-12 px-6 text-base">Sign in</Link>
            </div>
          </div>

          {/* What the protected person sees: an illustration of the real alert, not interactive */}
          <div aria-hidden className="relative mx-auto w-full max-w-sm animate-rise select-none [animation-delay:300ms]">
            <div className="absolute -inset-2 rounded-[32px] bg-primary/10 sm:-inset-4" />
            <div className="relative animate-float space-y-3 rounded-[28px] border border-line bg-surface p-4 shadow-xl shadow-ink/5 [animation-delay:1.4s]">
              <div className="flex animate-slide-down items-center gap-2.5 rounded-2xl border border-line bg-white p-3 shadow-sm [animation-delay:900ms]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger"><MdGavel size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">A post of you is on hold</span>
                  <span className="block text-xs text-muted">Nobody can see it until you decide</span>
                </span>
                <span className="text-xs text-muted">now</span>
              </div>
              <div className="rounded-[20px] border border-danger/35 bg-white p-4 shadow-[0_0_0_3px_rgba(217,48,37,0.08)]">
                <span className="inline-block rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">NEEDS YOUR DECISION</span>
                <div className="mt-3 aspect-[4/3] rounded-2xl bg-gradient-to-br from-gray-300 to-gray-400 blur-[1px]" />
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 font-semibold text-danger">Gambling promotion</span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-muted">2 min ago</span>
                </div>
                <div className="mt-3 grid gap-2">
                  <span className="flex min-h-10 items-center justify-center rounded-full bg-danger text-sm font-semibold text-white">Not me, take it down</span>
                  <span className="flex min-h-10 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold">It's me, allow</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Reveal>
        <section className="rounded-[20px] border border-line bg-white p-5 sm:p-6" aria-labelledby="demo-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="demo-h" className="text-lg font-semibold">Try the demo in one click</h2>
            <Link to="/demo" viewTransition className="text-sm font-medium text-primary hover:underline">Demo guide</Link>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            The prototype simulates a social app called Lepak with FaceVeto built in. Each browser tab keeps its own login,
            so open Alice and Admin side by side to watch an alert arrive in real time.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {DEMO.map((d) => (
              <button key={d.who} disabled={!!busy} onClick={() => go(d)}
                className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white" aria-hidden>
                  {busy === d.who ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <d.icon size={22} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{busy === d.who ? 'Signing in...' : d.label}</span>
                  <span className="block text-xs text-muted">{d.sub}</span>
                </span>
                <MdChevronRight size={20} className="shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Want to use your own face? Create an account, enrol, then sign in as Bob and post a photo of yourself.
          </p>
        </section>
        </Reveal>

        <Reveal>
        <section aria-labelledby="how-h">
          <h2 id="how-h" className="px-1 text-lg font-semibold">How it works</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-[20px] border border-line bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden><s.icon size={24} /></span>
                  <span className="text-sm font-semibold text-gray-400">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
        </Reveal>

        <Reveal>
        <section className="rounded-[20px] border border-line bg-white p-5 sm:p-6" aria-labelledby="privacy-h">
          <h2 id="privacy-h" className="flex items-center gap-2.5 text-lg font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success" aria-hidden><MdLock size={18} /></span>
            Privacy by design
          </h2>
          <ul className="mt-4 grid gap-x-6 gap-y-3 text-sm text-gray-700 sm:grid-cols-2">
            {PRIVACY.map((t) => (
              <li key={t} className="flex items-start gap-2.5"><MdCheckCircle size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />{t}</li>
            ))}
          </ul>
        </section>
        </Reveal>
      </main>}
    </div>
  )
}
