import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdShield, MdVerifiedUser, MdRemoveRedEye, MdDeleteOutline, MdBlock } from 'react-icons/md'
import { useAuth } from '../lib/auth'
import LivenessCamera from '../components/LivenessCamera'

export default function Enrol() {
  const { me, refreshMe } = useAuth()
  const [consent, setConsent] = useState(false)
  const [stage, setStage] = useState<'intro' | 'camera' | 'done'>('intro')
  const done = useCallback(async () => { await refreshMe(); setStage('done') }, [refreshMe])

  if (stage === 'done') {
    return (
      <div className="m-3 rounded-[20px] border border-line bg-white p-6 text-center">
        <span className="mx-auto flex h-18 w-18 items-center justify-center rounded-full bg-success/10 text-success ring-8 ring-success/5" aria-hidden><MdVerifiedUser size={36} /></span>
        <h1 className="mt-4 text-2xl font-bold">You're protected</h1>
        <p className="mt-2 text-muted">If someone posts your face in a harmful way, we will hold the post and ask you first.</p>
        <Link to="/feed" className="btn-primary mt-6">Go to feed</Link>
      </div>
    )
  }

  if (stage === 'camera') {
    return (
      <div className="p-3">
        <h1 className="mb-3 px-1 text-lg font-bold">Live face check</h1>
        <LivenessCamera onDone={done} />
        <button className="btn-ghost mt-4 w-full" onClick={() => setStage('intro')}>Cancel</button>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-[20px] bg-primary p-5 text-white shadow-lg shadow-primary/25">
        <MdShield size={36} aria-hidden />
        <h1 className="mt-2 text-2xl font-bold">Protect my face</h1>
        <p className="mt-1 text-sm text-blue-100">
          {me?.protection.status === 'active'
            ? 'Your face is already protected. You can re-enrol to refresh your template.'
            : 'Takes about 20 seconds. Stop strangers using your selfies in gambling ads, scams or sexual edits.'}
        </p>
      </div>
      <ul className="space-y-3 rounded-[20px] border border-line bg-white p-5 text-sm leading-snug">
        <li className="flex gap-3"><MdRemoveRedEye size={22} className="shrink-0 text-primary" aria-hidden />We ask you to blink and turn your head so we know it's really you, live.</li>
        <li className="flex gap-3"><MdBlock size={22} className="shrink-0 text-primary" aria-hidden />Nobody can search for you by face. Posters never learn that you were matched.</li>
        <li className="flex gap-3"><MdDeleteOutline size={22} className="shrink-0 text-primary" aria-hidden />We keep a face template, not your photos. Delete it any time in Protection.</li>
      </ul>
      <label className="flex cursor-pointer items-start gap-3 rounded-[20px] border border-line bg-white p-4 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I consent to FaceVeto storing a face template of me. I can delete it anytime.</span>
      </label>
      <button className="btn-primary min-h-13 w-full text-base" disabled={!consent} onClick={() => setStage('camera')}>Start live check</button>
      <Link to="/feed" className="block py-2 text-center text-sm text-muted underline">Skip for now</Link>
    </div>
  )
}
