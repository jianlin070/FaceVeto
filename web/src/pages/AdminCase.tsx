import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MdArrowBack, MdAutoAwesome, MdDelete, MdCheck, MdDescription, MdDownload, MdLock, MdPrint, MdSmartToy, MdVisibility } from 'react-icons/md'
import { api, apiText } from '../lib/api'
import { categoryLabel, timeAgo } from '../lib/format'
import { toast } from '../lib/toast'
import type { AdminCase } from '../lib/types'
import AuthImage from '../components/AuthImage'
import RiskBadge from '../components/RiskBadge'
import CaseStatusPill, { toneOf } from '../components/CaseStatus'
import { useAuth } from '../lib/auth'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'

const ACTION_LABEL: Record<string, string> = {
  post_held: 'FaceVeto held the post', owner_not_me: 'Owner said Not me: taken down', owner_its_me: 'Owner said It\'s me: allowed',
  admin_takedown: 'Admin took it down', admin_release: 'Admin released it', post_edited: 'Poster edited the caption',
  post_deleted: 'Poster deleted the post',
}
const DOT: Record<string, string> = {
  post_held: 'bg-warning', owner_not_me: 'bg-danger', admin_takedown: 'bg-danger', owner_its_me: 'bg-success',
  admin_release: 'bg-success', post_deleted: 'bg-gray-400',
}
const BANNER = {
  pending: 'border-warning bg-warning/10', removed: 'border-danger bg-danger/5', live: 'border-success bg-success/5', gone: 'border-gray-300 bg-surface',
}

/** What happened, who decided and when, in one sentence for the reviewer. */
function summary(c: AdminCase, myUid?: string): string {
  const owner = `@${c.owner.handle}`
  const admin = c.admin_action ? (c.admin_action.by === myUid ? 'you' : `@${c.admin_handle ?? 'an admin'}`) : ''
  const when = (t?: string | null) => (t ? ` ${timeAgo(t)}` : '')
  const note = c.admin_action?.note ? ` Note: "${c.admin_action.note}"` : ''
  if (c.post.status === 'deleted') return 'The poster deleted this post. Nothing else to do.'
  switch (c.status) {
    case 'awaiting_owner':
      if (c.post.status === 'held') return `Held before anyone saw it. Waiting for ${owner} to say Not me or It's me. You can act now if it is urgent.`
      return `Waiting for ${owner}, but the post is already ${c.post.status === 'removed' ? 'taken down' : 'live'} (another person in the photo decided).`
    case 'owner_not_me': return `${owner} said Not me${when(c.owner_response?.at)}. The post was taken down and an evidence pack prepared. The owner's veto is final.`
    case 'owner_its_me': return `${owner} said It's me${when(c.owner_response?.at)}, so the post is live. You can still take it down if it breaks other rules.`
    case 'removed': return `Taken down by ${admin}${when(c.admin_action?.at)}.${note}`
    case 'released': return `Released by ${admin}${when(c.admin_action?.at)}. The post is live.${note}`
  }
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function AdminCasePage() {
  const { id } = useParams()
  const { me } = useAuth()
  const [c, setC] = useState<AdminCase | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [note, setNote] = useState('')
  const [ask, setAsk] = useState<'takedown' | 'release' | null>(null)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [reportBusy, setReportBusy] = useState(false)

  const load = useCallback(() => api<AdminCase>(`/api/admin/cases/${id}`).then(setC).catch(() => {}), [id])
  useEffect(() => { load() }, [load])

  async function act(action: 'takedown' | 'release') {
    setBusy(true)
    try {
      await api(`/api/admin/cases/${id}/action`, { method: 'POST', body: JSON.stringify({ action, note }) })
      toast(action === 'takedown' ? 'Post taken down' : 'Post released', 'success')
      setNote('')
      await load()
    } finally { setBusy(false); setAsk(null) }
  }

  async function evidence(regenerate = false) {
    setReportBusy(true)
    try {
      setReport(await apiText(`/api/admin/cases/${id}/evidence?format=html${regenerate ? '&regenerate=true' : ''}`))
      load()
    } finally { setReportBusy(false) }
  }

  if (!c) return <Spinner />
  const a = c.post.assessment
  const s = c.post.scan
  const tone = toneOf(c.status, c.post.status)
  const can = (x: 'takedown' | 'release') => c.allowed_actions.includes(x)

  return (
    <div className="space-y-4">
      <Link to="/admin" className="inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-medium text-primary hover:bg-primary/5"><MdArrowBack aria-hidden /> Review queue</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{categoryLabel(c.category)}</h1>
        <RiskBadge severity={c.severity} />
        <CaseStatusPill status={c.status} postStatus={c.post.status} large />
        <span className="text-sm text-muted">Case {c.case_id} · opened {timeAgo(c.created_at)}</span>
      </div>
      <div role="status" className={`rounded-2xl border-l-4 px-4 py-3 text-sm ${BANNER[tone]}`}>{summary(c, me?.uid)}</div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="card space-y-3 p-4" aria-label="Post">
          <div className="relative overflow-hidden rounded-xl">
            <AuthImage src={c.post.image_url} alt="Post under review" className="w-full object-contain" placeholderClassName="aspect-square" blurred={!revealed} />
            {tone !== 'pending' && revealed && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white">
                <MdLock aria-hidden /> {tone === 'live' ? 'Live in the feed' : 'Hidden from users. Only reviewers can see this.'}
              </span>
            )}
            {!revealed && (
              <button className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 font-medium text-white" onClick={() => setRevealed(true)}>
                <MdVisibility size={22} aria-hidden /> Reveal image
              </button>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Caption</p>
            <p className="whitespace-pre-wrap text-sm">{c.post.caption || '(none)'}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-muted">Poster</dt><dd>@{c.post.poster_handle}</dd></div>
            <div><dt className="text-xs text-muted">Poster account age</dt><dd className={c.post.poster_account_age_days < 30 ? 'font-semibold text-danger' : ''}>{c.post.poster_account_age_days} days</dd></div>
            <div><dt className="text-xs text-muted">Protected user</dt><dd>@{c.owner.handle}</dd></div>
            <div><dt className="text-xs text-muted">Face match</dt><dd className="font-semibold tabular-nums">{c.similarity != null ? `${Math.round(c.similarity * 100)}% similarity` : '-'}</dd></div>
            <div><dt className="text-xs text-muted">Faces in image</dt><dd>{c.post.faces_detected}</dd></div>
            <div><dt className="text-xs text-muted">Visible to users</dt><dd>{c.post.status === 'published' ? 'Yes, live' : 'No'}</dd></div>
          </dl>
        </section>

        <div className="space-y-4">
          <section className="card p-4" aria-label="Gemini assessment">
            <h2 className="flex items-center gap-2 font-semibold"><MdAutoAwesome className="text-primary" aria-hidden /> Gemini assessment</h2>
            {a ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex flex-wrap gap-4">
                  <div><p className="text-xs text-muted">Category</p><p className="font-medium">{categoryLabel(a.category)}</p></div>
                  <div><p className="text-xs text-muted">Severity</p><RiskBadge severity={a.severity} /></div>
                  <div><p className="text-xs text-muted">Confidence</p><p className="font-medium tabular-nums">{Math.round(a.confidence * 100)}%</p></div>
                  <div><p className="text-xs text-muted">Recommended</p><p className="font-medium">{a.recommended_action}</p></div>
                  {a.languages.length > 0 && <div><p className="text-xs text-muted">Languages</p><p className="font-medium">{a.languages.join(', ')}</p></div>}
                </div>
                <div><p className="text-xs text-muted">Reasoning</p><p>{a.reasoning}</p></div>
                {a.text_in_image && <div><p className="text-xs text-muted">Text in image</p><p className="whitespace-pre-wrap rounded-lg bg-surface p-2 font-mono text-xs">{a.text_in_image}</p></div>}
                {a.evidence.length > 0 && (
                  <div><p className="text-xs text-muted">Evidence</p><ul className="list-disc space-y-0.5 pl-5">{a.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
                )}
              </div>
            ) : <p className="mt-2 text-sm text-danger">No assessment ({s.gemini_error ?? 'unavailable'}). Held by fail-closed policy.</p>}
            <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-muted">
              Policy {c.post.decision?.policy_version}: <b>{c.post.decision?.action}</b> ({c.post.decision?.reason}).
              Decision in {s.latency_ms ?? '-'} ms (detect {s.detect_ms ?? '-'} ms, match {s.match_ms ?? '-'} ms, Gemini {s.gemini_latency_ms ?? '-'} ms).
            </p>
          </section>

          {s.agent_trace && s.agent_trace.length > 0 && (
            <section className="card p-4" aria-label="Agent trace">
              <h2 className="flex items-center gap-2 font-semibold"><MdSmartToy className="text-primary" aria-hidden /> Agent trace <span className="text-xs font-normal text-muted">Google ADK, {s.agent_ms} ms</span></h2>
              <ol className="mt-2 space-y-1 font-mono text-xs">
                {s.agent_trace.map((t, i) => (
                  <li key={i} className={t.step === 'error' || t.step === 'fallback' ? 'text-danger' : ''}>
                    <span className="text-muted">{t.at_ms != null ? `${(t.at_ms / 1000).toFixed(1)}s ` : ''}</span>
                    {t.step === 'call' && <>call <b>{t.tool}</b>({Object.entries(t.args ?? {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})</>}
                    {t.step === 'result' && <>&nbsp;&nbsp;{'->'} {t.tool}: {JSON.stringify(t.result)}</>}
                    {(t.step === 'final' || t.step === 'error' || t.step === 'fallback') && t.text}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted">Tools enforce policy v1: the agent can hold more strictly but cannot publish what the policy holds.</p>
            </section>
          )}

          <section className="card p-4" aria-label="Actions">
            <h2 className="font-semibold">Actions</h2>
            {c.allowed_actions.length > 0 ? (
              <>
                <label className="label mt-3" htmlFor="note">Note (saved to the audit log)</label>
                <input id="note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
              </>
            ) : (
              <p className="mt-2 flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm text-muted">
                <MdLock className="shrink-0" aria-hidden />
                {c.post.status === 'deleted' ? 'No actions: the poster deleted this post.' : 'No actions: this post is already taken down.'}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {can('takedown') && <button className="btn-danger" onClick={() => setAsk('takedown')} disabled={busy}><MdDelete aria-hidden /> Take down</button>}
              {can('release') && <button className="btn-ghost" onClick={() => setAsk('release')} disabled={busy}><MdCheck aria-hidden /> Release</button>}
              <button className="btn-ghost" onClick={() => evidence(false)} disabled={reportBusy}><MdDescription aria-hidden /> {reportBusy ? 'Preparing...' : c.has_evidence ? 'View evidence pack' : 'Generate evidence pack'}</button>
            </div>
          </section>

          <section className="card p-4" aria-label="Timeline">
            <h2 className="font-semibold">Timeline</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {[{ action: 'uploaded', at: c.post.created_at, details: {} as Record<string, unknown> }, ...c.timeline].map((t, i) => (
                <li key={i} className="relative flex gap-3 pl-1">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${DOT[t.action] ?? 'bg-primary'}`} aria-hidden />
                  <div>
                    <p className="font-medium">{t.action === 'uploaded' ? 'Post uploaded and scanned' : ACTION_LABEL[t.action] ?? t.action}</p>
                    <p className="text-xs text-muted">{t.at && new Date(t.at).toLocaleString()}
                      {typeof t.details?.note === 'string' && t.details.note && <>: "{t.details.note}"</>}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {report && (
        <section className="card p-4" aria-label="Evidence pack">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Evidence pack</h2>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost py-1.5" onClick={async () => download(`faceveto-evidence-${c.case_id}.md`, await apiText(`/api/admin/cases/${c.case_id}/evidence?format=md`), 'text/markdown')}><MdDownload aria-hidden /> Markdown</button>
              <button className="btn-ghost py-1.5" onClick={() => window.open(URL.createObjectURL(new Blob([report], { type: 'text/html' })), '_blank', 'noopener')}><MdPrint aria-hidden /> Printable page</button>
              <button className="btn-ghost py-1.5" onClick={() => evidence(true)} disabled={reportBusy}><MdAutoAwesome aria-hidden /> Regenerate</button>
            </div>
          </div>
          {/* sandbox without scripts: the report quotes untrusted captions */}
          <iframe title="Evidence pack" sandbox="" srcDoc={report} className="mt-3 h-[600px] w-full rounded-lg border border-gray-200 bg-white" />
        </section>
      )}

      <ConfirmDialog open={ask !== null} title={ask === 'takedown' ? 'Take this post down?' : 'Release this post?'}
        confirmLabel={ask === 'takedown' ? 'Take down' : 'Release'} danger={ask === 'takedown'} busy={busy}
        onConfirm={() => ask && act(ask)} onCancel={() => setAsk(null)}>
        {ask === 'takedown' ? 'The post is removed for everyone. The image stays in quarantine as evidence.' : 'The post becomes visible in the feed.'} This is recorded in the audit log.
      </ConfirmDialog>
    </div>
  )
}
