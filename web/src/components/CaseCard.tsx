import { useState } from 'react'
import { MdVisibility, MdCheckCircle, MdDeleteForever, MdWarning } from 'react-icons/md'
import type { OwnerCase } from '../lib/types'
import { categoryLabel, timeAgo } from '../lib/format'
import AuthImage from './AuthImage'

const RESOLVED: Record<string, { text: string; tone: string }> = {
  owner_not_me: { text: 'You said "Not me". The post was removed and an evidence pack was prepared.', tone: 'text-danger' },
  owner_its_me: { text: 'You said "It\'s me". The post was allowed.', tone: 'text-success' },
  removed: { text: 'Our review team removed this post.', tone: 'text-danger' },
  released: { text: 'Our review team allowed this post.', tone: 'text-muted' },
}

export default function CaseCard({ c, onRespond }: { c: OwnerCase; onRespond: (id: string, r: 'not_me' | 'its_me') => Promise<void> }) {
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const open = c.status === 'awaiting_owner'

  async function act(r: 'not_me' | 'its_me') {
    setBusy(r)
    try { await onRespond(c.case_id, r) } finally { setBusy(null) }
  }

  return (
    <article className={`card overflow-hidden ${open ? 'border-danger/40 ring-1 ring-danger/20' : ''}`}>
      <div className="flex items-start gap-3 p-4">
        <MdWarning size={24} className={open ? 'shrink-0 text-danger' : 'shrink-0 text-muted'} aria-hidden />
        <div className="min-w-0">
          <h2 className="font-semibold">{c.title || 'A post of you is on hold'}</h2>
          <p className="mt-1 text-sm text-muted">{c.body}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger">{categoryLabel(c.category)}</span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-muted">{timeAgo(c.created_at)}</span>
          </div>
        </div>
      </div>
      {open && (
        <div className="relative mx-4 overflow-hidden rounded-xl">
          <AuthImage src={c.image_url} alt="The post that shows you" className="aspect-square w-full object-cover" blurred={!revealed} />
          {!revealed && (
            <button className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30 text-sm font-medium text-white" onClick={() => setRevealed(true)}>
              <MdVisibility size={28} aria-hidden /> Tap to view. It may be upsetting.
            </button>
          )}
        </div>
      )}
      {open && c.caption && <p className="mx-4 mt-2 text-sm"><span className="text-muted">Caption: </span>{c.caption}</p>}
      {open && c.reason && <p className="mx-4 mt-2 rounded-lg bg-surface p-2 text-xs text-muted"><b>Why we held it:</b> {c.reason}</p>}
      <div className="p-4">
        {open ? (
          <div className="grid gap-2">
            <button className="btn-danger py-3 text-base" disabled={!!busy} onClick={() => act('not_me')}>
              <MdDeleteForever size={20} aria-hidden />{busy === 'not_me' ? 'Removing...' : 'Not me, take it down'}
            </button>
            <button className="btn-ghost py-3 text-base" disabled={!!busy} onClick={() => act('its_me')}>
              <MdCheckCircle size={20} aria-hidden />{busy === 'its_me' ? 'Allowing...' : 'It\'s me, allow'}
            </button>
          </div>
        ) : (
          <p className={`text-sm font-medium ${RESOLVED[c.status]?.tone ?? ''}`}>{RESOLVED[c.status]?.text}</p>
        )}
      </div>
    </article>
  )
}
