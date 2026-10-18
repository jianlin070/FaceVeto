/** A short notification chime made with Web Audio, so there is no sound file to load.
 *
 * Browsers only allow audio after the user has interacted with the page, so the context is
 * unlocked on the first tap or key press.
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

export function unlockAudioOnFirstGesture() {
  const unlock = () => {
    const c = audio()
    if (c && c.state !== 'running') c.resume().catch(() => {})
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
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
  if (!c || c.state !== 'running') return
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
