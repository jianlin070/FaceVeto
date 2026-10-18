import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MdVisibility, MdCheckCircle, MdChevronRight, MdDeleteForever, MdWarning } from 'react-icons/md'
import type { OwnerCase } from '../lib/types'
import { categoryLabel, timeAgo } from '../lib/format'
import AuthImage from './AuthImage'

const RESOLVED: Record<string, { text: string; pill: string }> = {
  owner_not_me: { text: 'You said "Not me". The post was removed and an evidence pack was prepared.', pill: 'bg-danger/10 text-danger' },
  owner_its_me: { text: 'You said "It\'s me". The post was allowed.', pill: 'bg-success/10 text-success' },
  removed: { text: 'Our review team removed this post.', pill: 'bg-danger/10 text-danger' },
  released: { text: 'Our review team allowed this post.', pill: 'bg-surface text-muted' },
}

export default function CaseCard({ c, onRespond }: { c: OwnerCase; onRespond: (id: string, r: 'not_me' | 'its_me') => Promise<void> }) {
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const open = c.status === 'awaiting_owner'

  async function act(r: 'not_me' | 'its_me') {
    setBusy(r)
    try { await onRespond(c.case_id, r) } finally { setBusy(null) }
  }

  if (!open) {
    const r = RESOLVED[c.status]
    return (
      <article className="flex gap-3 rounded-[20px] border border-line bg-white px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted" aria-hidden><MdWarning size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{categoryLabel(c.category)} · {timeAgo(c.created_at)}</p>
          {r && <p className={`mt-1 inline-block rounded-xl px-2.5 py-1 text-xs font-medium ${r.pill}`}>{r.text}</p>}
          {(c.status === 'owner_its_me' || c.status === 'released') && (
            <Link to={`/posts/${c.post_id}`} className="mt-2 flex items-center gap-0.5 text-sm font-semibold text-primary">
              View post<MdChevronRight size={18} aria-hidden />
            </Link>
          )}
        </div>
      </article>
    )
  }

  return (
    <article className="overflow-hidden rounded-[20px] border border-danger/35 bg-white shadow-[0_0_0_3px_rgba(217,48,37,0.08)]">
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger" aria-hidden><MdWarning size={22} /></span>
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">NEEDS YOUR DECISION</span>
          <h2 className="mt-2 font-semibold leading-snug">{c.title || 'A post of you is on hold'}</h2>
          <p className="mt-1 text-sm leading-snug text-muted">{c.body}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-danger/10 px-2.5 py-0.5 font-semibold text-danger">{categoryLabel(c.category)}</span>
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-muted">{timeAgo(c.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="relative mx-4 overflow-hidden rounded-2xl">
        <AuthImage src={c.image_url} alt="The post that shows you" className="aspect-square w-full object-cover" blurred={!revealed} />
        {!revealed && (
          <button className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35 text-white" onClick={() => setRevealed(true)}>
            <MdVisibility size={28} aria-hidden />
            <span className="text-[15px] font-semibold">Tap to view</span>
            <span className="text-[13px]">It may be upsetting</span>
          </button>
        )}
      </div>
      <div className="space-y-2.5 px-4 pt-3.5">
        {c.caption && (
          <div>
            <p className="text-xs font-semibold text-muted">Caption</p>
            <p className="mt-0.5 text-[15px] leading-snug [overflow-wrap:anywhere]">{c.caption}</p>
          </div>
        )}
        {c.reason && <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] leading-snug text-gray-700"><b>Why we held it:</b> {c.reason}</p>}
      </div>
      <div className="grid gap-2.5 p-4">
        <button className="btn-danger min-h-13 text-base" disabled={!!busy} onClick={() => act('not_me')}>
          <MdDeleteForever size={20} aria-hidden />{busy === 'not_me' ? 'Removing...' : 'Not me, take it down'}
        </button>
        <button className="btn-ghost min-h-13 text-base" disabled={!!busy} onClick={() => act('its_me')}>
          <MdCheckCircle size={20} className="text-success" aria-hidden />{busy === 'its_me' ? 'Allowing...' : 'It\'s me, allow'}
        </button>
      </div>
    </article>
  )
}
