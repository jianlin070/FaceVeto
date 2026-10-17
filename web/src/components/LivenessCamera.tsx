import { useCallback, useEffect, useRef, useState } from 'react'
import { MdCheckCircle, MdRemoveRedEye, MdArrowBack, MdArrowForward, MdCenterFocusStrong, MdLock } from 'react-icons/md'
import { api, ApiError } from '../lib/api'
import {
  BlinkCounter, CHALLENGE_TEXT, isCentred, isTurned, loadLandmarker, yawRatio, type Challenge,
} from '../lib/liveness'

type Step = Challenge | 'centre'
type Phase = 'starting' | 'running' | 'uploading' | 'failed'

const TIMEOUT_MS = 30_000
const CENTRE_HOLD_MS = 400
const TURN_HOLD_FRAMES = 4

const STEP_ICON = { blink: MdRemoveRedEye, turn_left: MdArrowBack, turn_right: MdArrowForward, centre: MdCenterFocusStrong }

/** Randomised blink and head-turn check with MediaPipe, then uploads 4 frontal frames for enrolment. */
export default function LivenessCamera({ onDone }: { onDone: (framesUsed: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [prompt, setPrompt] = useState('Starting camera...')
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 1 })
  const [yaw, setYaw] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  const stepIcon = useRef<Step>('centre')

  const capture = useCallback((): Promise<Blob> => {
    const v = videoRef.current!
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0) // unmirrored, as the server expects
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('capture failed'))), 'image/jpeg', 0.9))
  }, [])

  useEffect(() => {
    let raf = 0
    let stream: MediaStream | null = null
    let cancelled = false

    async function run() {
      try {
        setPhase('starting'); setError(''); setWarning(''); setPrompt('Starting camera...')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setPrompt('Loading face check...')
        const [landmarker, ch] = await Promise.all([
          loadLandmarker(),
          api<{ nonce: string; challenges: Challenge[] }>('/api/enrol/challenge'),
        ])
        if (cancelled) return

        const steps: Step[] = ['centre']
        ch.challenges.forEach((c) => steps.push(c, 'centre'))
        const frames: Blob[] = []
        const blinks = new BlinkCounter()
        const started = performance.now()
        let i = 0
        let centredSince: number | null = null
        let turnFrames = 0
        let lastTs = -1
        setProgress({ done: 0, total: steps.length })
        setPhase('running')

        const show = (s: Step) => {
          stepIcon.current = s
          setPrompt(s === 'centre' ? 'Look straight at the camera' : CHALLENGE_TEXT[s])
        }
        show(steps[0])

        const tick = async () => {
          if (cancelled) return
          const now = performance.now()
          if (now - started > TIMEOUT_MS) {
            setPhase('failed'); setError('That took too long. Let\'s try again with a new check.')
            return
          }
          if (video.readyState >= 2 && now > lastTs) {
            lastTs = now
            const res = landmarker.detectForVideo(video, now)
            const n = res.faceLandmarks.length
            const r = n === 1 ? yawRatio(res) : null
            setYaw(r)
            if (n === 0) { setWarning('Move into the frame'); centredSince = null }
            else if (n > 1) { setWarning('Only one person, please'); centredSince = null }
            else if (r !== null) {
              setWarning('')
              const step = steps[i]
              let complete = false
              if (step === 'centre') {
                if (isCentred(r)) {
                  centredSince ??= now
                  if (now - centredSince >= CENTRE_HOLD_MS) {
                    frames.push(await capture())
                    complete = true
                  }
                } else centredSince = null
              } else if (step === 'blink') {
                blinks.update(res, now)
                complete = blinks.count >= 2
              } else {
                turnFrames = isTurned(r, step) ? turnFrames + 1 : 0
                complete = turnFrames >= TURN_HOLD_FRAMES
              }
              if (complete) {
                i++
                centredSince = null; turnFrames = 0; blinks.reset()
                setProgress({ done: i, total: steps.length })
                if (i === steps.length) {
                  await upload(frames, ch, Math.round(now - started))
                  return
                }
                show(steps[i])
              }
            }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (e) {
        if (cancelled) return
        const name = (e as { name?: string }).name
        setPhase('failed')
        setError(name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow the camera in your browser settings and try again.'
          : name === 'NotFoundError' ? 'No camera found on this device.'
          : e instanceof ApiError ? e.message : 'Could not start the face check. Please try again.')
      }
    }

    async function upload(frames: Blob[], ch: { nonce: string; challenges: Challenge[] }, durationMs: number) {
      setPhase('uploading'); setPrompt('Creating your face template...')
      stream?.getTracks().forEach((t) => t.stop())
      const fd = new FormData()
      frames.forEach((b, k) => fd.append('frames', b, `frame${k}.jpg`))
      fd.append('liveness', JSON.stringify({ challenges: ch.challenges, passed: true, duration_ms: durationMs, nonce: ch.nonce }))
      try {
        const r = await api<{ status: string; frames_used: number }>('/api/enrol', { method: 'POST', body: fd, quiet: true })
        if (!cancelled) onDone(r.frames_used)
      } catch (e) {
        if (cancelled) return
        setPhase('failed')
        setError(e instanceof ApiError ? e.message : 'Upload failed. Please try again.')
      }
    }

    run()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [attempt, capture, onDone])

  const Icon = STEP_ICON[stepIcon.current]
  const pct = Math.round((progress.done / progress.total) * 100)

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink">
        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" aria-label="Camera preview" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`h-[72%] w-[48%] rounded-[50%] border-4 ${warning ? 'border-warning' : 'border-white/80'}`} />
        </div>
        {phase === 'running' && yaw !== null && (
          // mirrored like the preview so the dot follows the user's head
          <div className="absolute inset-x-6 bottom-3 h-2 rounded-full bg-white/30" aria-hidden>
            <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `${Math.min(100, Math.max(0, (1 - yaw) * 100))}%` }} />
          </div>
        )}
      </div>

      <div className="card p-4 text-center" aria-live="polite">
        {phase === 'failed' ? (
          <>
            <p className="font-medium text-danger" role="alert">{error}</p>
            <button className="btn-primary mt-3" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 text-lg font-semibold">
              {phase === 'uploading' ? <MdCheckCircle className="text-success" aria-hidden /> : <Icon className="text-primary" aria-hidden />}
              {prompt}
            </div>
            {warning && <p className="mt-1 text-sm font-medium text-warning">{warning}</p>}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>
      <p className="flex items-start gap-2 text-xs text-muted">
        <MdLock className="mt-0.5 shrink-0" aria-hidden />
        Only an encrypted face template is stored. Photos are discarded right after the check.
      </p>
    </div>
  )
}
