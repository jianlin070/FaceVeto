/** A short notification chime made with Web Audio, so there is no sound file to load.
 *
 * Browsers only allow audio after the user has interacted with the page, so the context is
 * unlocked on a tap or key press.
 */
const KEY = 'lepak.sound'
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

export function unlockAudioOnGesture() {
  // iPhone Safari only starts audio from touchend or click (not pointerdown or touchstart), and suspends
  // it again when the tab is in the background, so every gesture tries to resume it.
  const unlock = () => {
    const c = audio()
    if (!c || c.state === 'running') return
    c.resume().catch(() => {})
    const s = c.createBufferSource() // older iOS also needs a sound started inside the gesture
    s.buffer = c.createBuffer(1, 1, 22050)
    s.connect(c.destination)
    s.start(0)
  }
  for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { passive: true })
  return () => { for (const ev of ['touchend', 'click', 'keydown']) window.removeEventListener(ev, unlock) }
}

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode: keep default */ }
}

export function playChime() {
  if (!soundEnabled()) return
  navigator.vibrate?.([40, 60, 40])
  const c = audio()
  if (!c) return
  if (c.state === 'running') tones(c)
  else c.resume().then(() => tones(c)).catch(() => {}) // works if a tap unlocked it before
}

function tones(c: AudioContext) {
  const t = c.currentTime
  for (const [freq, at] of [[880, 0], [1318.5, 0.13]]) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t + at)
    gain.gain.exponentialRampToValueAtTime(0.18, t + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.4)
    osc.connect(gain).connect(c.destination)
    osc.start(t + at)
    osc.stop(t + at + 0.45)
  }
}
