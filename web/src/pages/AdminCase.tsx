import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MdArrowBack, MdAutoAwesome, MdDelete, MdCheck, MdDescription, MdDownload, MdPrint, MdSmartToy, MdVisibility } from 'react-icons/md'
import { api, apiText } from '../lib/api'
import { categoryLabel, timeAgo } from '../lib/format'
import { toast } from '../lib/toast'
import type { AdminCase } from '../lib/types'
import AuthImage from '../components/AuthImage'
import RiskBadge, { STATUS_LABEL } from '../components/RiskBadge'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'

const ACTION_LABEL: Record<string, string> = {
  post_held: 'FaceVeto held the post', owner_not_me: 'Owner: Not me', owner_its_me: 'Owner: It\'s me',
  admin_takedown: 'Admin took it down', admin_release: 'Admin released it',
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function AdminCasePage() {
  const { id } = useParams()
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

  return (
    <div className="space-y-4">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-primary"><MdArrowBack aria-hidden /> Queue</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{categoryLabel(c.category)}</h1>
        <RiskBadge severity={c.severity} />
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium ring-1 ring-gray-300">{STATUS_LABEL[c.status] ?? c.status}</span>
        <span className="text-sm text-muted">Case {c.case_id} · {timeAgo(c.created_at)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="card space-y-3 p-4" aria-label="Post">
          <div className="relative overflow-hidden rounded-xl">
            <AuthImage src={c.post.image_url} alt="Post under review" className="w-full object-contain" blurred={!revealed} />
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
            <div><dt className="text-xs text-muted">Post status</dt><dd>{c.post.status}</dd></div>
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
            {c.owner_response && <p className="mt-1 text-sm">Owner responded <b>{c.owner_response.value === 'not_me' ? 'Not me' : 'It\'s me'}</b> {timeAgo(c.owner_response.at)}.</p>}
            {c.admin_action && <p className="mt-1 text-sm">Admin action <b>{c.admin_action.value}</b> {timeAgo(c.admin_action.at)}{c.admin_action.note && `: "${c.admin_action.note}"`}</p>}
            <label className="label mt-3" htmlFor="note">Note (saved to the audit log)</label>
            <input id="note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-danger" onClick={() => setAsk('takedown')} disabled={busy}><MdDelete aria-hidden /> Take down</button>
              <button className="btn-ghost" onClick={() => setAsk('release')} disabled={busy}><MdCheck aria-hidden /> Release</button>
              <button className="btn-ghost" onClick={() => evidence(false)} disabled={reportBusy}><MdDescription aria-hidden /> {reportBusy ? 'Preparing...' : c.has_evidence ? 'View evidence pack' : 'Generate evidence pack'}</button>
            </div>
          </section>

          <section className="card p-4" aria-label="Timeline">
            <h2 className="font-semibold">Timeline</h2>
            <ol className="mt-2 space-y-2 border-l-2 border-gray-200 pl-4 text-sm">
              <li><span className="font-medium">Post uploaded and scanned</span> <span className="text-muted">{c.post.created_at && new Date(c.post.created_at).toLocaleString()}</span></li>
              {c.timeline.map((t, i) => (
                <li key={i}><span className="font-medium">{ACTION_LABEL[t.action] ?? t.action}</span> <span className="text-muted">{t.at && new Date(t.at).toLocaleString()}</span>
                  {typeof t.details?.note === 'string' && t.details.note && <span className="text-muted">: "{t.details.note}"</span>}</li>
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
