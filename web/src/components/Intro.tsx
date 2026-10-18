import { useCallback, useEffect, useRef, type RefObject } from 'react'
import Logo from './Logo'

const SEEN = 'faceveto-intro-seen'

/** Play the intro once per browser session, and never for people who ask for reduced motion. */
export function shouldPlayIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try { return !sessionStorage.getItem(SEEN) } catch { return false }
}

/**
 * Landing intro: the mark flows in from the left and forms in the centre, then shrinks into the
 * header's logo spot while the backdrop fades. onReveal fires as it starts to fly, onDone when it lands.
 * Tap, Escape or "Skip intro" ends it at once.
 */
export default function Intro({ target, onReveal, onDone }: {
  target: RefObject<HTMLElement | null>; onReveal: () => void; onDone: () => void
}) {
  const mark = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const ended = useRef(false)

  const finish = useCallback(() => {
    if (ended.current) return
    ended.current = true
    try { sessionStorage.setItem(SEEN, '1') } catch { /* private mode: replays next time, harmless */ }
    onReveal()
    onDone()
  }, [onReveal, onDone])

  useEffect(() => {
    const m = mark.current, b = backdrop.current
    if (!m || !b || typeof m.animate !== 'function') { finish(); return }
    let cancelled = false
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Each step is timed to its animation's length; timers keep the sequence moving even where
    // an animation's finished promise is slow to settle.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    async function run(m: HTMLDivElement, b: HTMLDivElement) {
      const slide = m.animate([
        { transform: 'translateX(-55vw) scale(0.7)', opacity: 0, filter: 'blur(8px)' },
        { opacity: 1, filter: 'blur(0px)', offset: 0.7 },
        { transform: 'translateX(0) scale(1)', opacity: 1, filter: 'blur(0px)' },
      ], { duration: 800, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' })
      await sleep(800 + 750) // slide in, then the head drops in and the V draws
      if (cancelled || ended.current) return
      // The slide ends where the mark rests, so dropping it changes nothing on screen and lets us
      // measure the true resting place (the viewport may have resized since the start).
      slide.cancel()
      const from = m.getBoundingClientRect()
      const to = target.current?.getBoundingClientRect()
      const fly = to
        ? `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${to.width / from.width})`
        : 'scale(0.3)'
      onReveal()
      b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 550, delay: 150, easing: 'ease', fill: 'forwards' })
      m.animate([{ transform: 'translateX(0) scale(1)' }, { transform: fly }],
        { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' })
      await sleep(700)
      if (!cancelled) finish()
    }
    run(m, b)

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish() }
    window.addEventListener('keydown', onKey)
    return () => { cancelled = true; window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
  }, [target, onReveal, finish])

  return (
    <div className="fixed inset-0 z-50" onClick={finish}>
      <div ref={backdrop} className="absolute inset-0 bg-surface">
        <button type="button" onClick={finish}
          className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 rounded-full bg-white px-4 py-2 text-sm font-medium text-muted shadow-sm ring-1 ring-line transition hover:text-ink">
          Skip intro
        </button>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div ref={mark} className="flex"><Logo size={112} animated="intro" /></div>
      </div>
    </div>
  )
}
