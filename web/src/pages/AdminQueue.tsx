import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdChevronRight, MdInbox, MdSearch } from 'react-icons/md'
import { api } from '../lib/api'
import { reasonOf, REASONS } from '../lib/admin'
import { timeAgo } from '../lib/format'
import type { AdminCaseRow } from '../lib/types'
import RiskBadge from '../components/RiskBadge'
import CaseStatusPill, { toneOf } from '../components/CaseStatus'
import Select from '../components/Select'

type Group = 'all' | 'pending' | 'removed' | 'live'
const TILES: { key: Group; label: string; tile: string; ring: string }[] = [
  { key: 'all', label: 'All cases', tile: 'bg-primary/10 text-primary-dark', ring: 'border-primary' },
  { key: 'pending', label: 'Waiting for owner', tile: 'bg-warning/15 text-amber-900', ring: 'border-warning' },
  { key: 'removed', label: 'Taken down', tile: 'bg-danger/10 text-danger', ring: 'border-danger' },
  { key: 'live', label: 'Back live', tile: 'bg-success/10 text-success', ring: 'border-success' },
]
const REASON_OPTIONS = [{ value: 'all', label: 'All reasons' }, ...REASONS.map((r) => ({ value: r.key, label: r.label, dot: r.color }))]
const RISK_OPTIONS = [
  { value: 'all', label: 'Any risk' }, { value: 'high', label: 'High', dot: '#D93025' },
  { value: 'medium', label: 'Medium', dot: '#F9AB00' }, { value: 'low', label: 'Low', dot: '#8AB4F8' },
]
const COLS = '@4xl:grid @4xl:grid-cols-[72px_minmax(0,2.4fr)_184px_56px_minmax(0,1fr)_minmax(0,1fr)_64px_18px] @4xl:items-center @4xl:gap-3'

export default function AdminQueue() {
  const [rows, setRows] = useState<AdminCaseRow[] | null>(null)
  const [group, setGroup] = useState<Group>('all')
  const [reason, setReason] = useState('all')
  const [risk, setRisk] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    const load = () => api<AdminCaseRow[]>('/api/admin/cases?limit=100', { quiet: true }).then((r) => live && setRows(r)).catch(() => live && setRows((p) => p ?? []))
    load()
    const t = setInterval(load, 10000)
    return () => { live = false; clearInterval(t) }
  }, [])

  const groupOf = (r: AdminCaseRow): Group | 'gone' => {
    const tone = toneOf(r.status, r.post_status)
    return tone === 'gone' ? 'gone' : tone
  }
  const counts = useMemo(() => {
    const c: Record<Group, number> = { all: rows?.length ?? 0, pending: 0, removed: 0, live: 0 }
    rows?.forEach((r) => { const g = groupOf(r); if (g !== 'gone') c[g]++ })
    return c
  }, [rows])

  const q = query.trim().toLowerCase().replace(/^@/, '')
  const shown = (rows ?? []).filter((r) =>
    (group === 'all' || groupOf(r) === group) && (reason === 'all' || reasonOf(r.category).key === reason)
    && (risk === 'all' || r.severity === risk)
    && (!q || [r.poster_handle, r.owner_handle, r.caption].some((s) => s.toLowerCase().includes(q))))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">Review queue</h1>
        <p className="mt-1.5 text-[15px] text-muted">Posts FaceVeto held because they show a protected member. Click a row to see the post and decide.</p>
      </header>

      <section role="group" aria-label="Filter by outcome" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {TILES.map((t) => (
          <button key={t.key} type="button" aria-pressed={group === t.key} onClick={() => setGroup(t.key)}
            className={`rounded-2xl border-2 p-4 text-left transition hover:brightness-[0.98] ${t.tile} ${group === t.key ? t.ring : 'border-transparent'}`}>
            <span className="block text-[13px] font-semibold">{t.label}</span>
            <span className="mt-1 block text-[28px] font-bold leading-tight text-ink tabular-nums">{rows ? counts[t.key] : <span className="skeleton inline-block h-7 w-10 align-middle" />}</span>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white @container">
        <div className="relative z-10 flex flex-wrap items-center gap-3 border-b border-surface p-4">
          <label className="flex h-11 min-w-0 flex-[1_1_260px] items-center gap-2 rounded-xl border border-gray-300 px-3.5 text-muted focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
            <MdSearch size={20} aria-hidden />
            <input type="search" aria-label="Search by handle or caption" placeholder="Search @handle or caption" value={query} onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" />
          </label>
          <div className="grid min-w-0 flex-[1_1_100%] grid-cols-1 gap-3 sm:flex sm:flex-none">
            <Select label="Reason" value={reason} options={REASON_OPTIONS} onChange={setReason} />
            <Select label="Risk" value={risk} options={RISK_OPTIONS} onChange={setRisk} />
          </div>
        </div>

        <div aria-hidden className={`hidden px-5 py-3 text-xs font-medium text-muted ${COLS}`}>
          <span>Risk</span><span>Post</span><span>Status</span><span className="text-right">Match</span><span>Member shown</span><span>Poster</span><span className="text-right">Held</span><span />
        </div>
        {rows === null ? (
          <div className="space-y-2 p-4" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14 w-full" />)}</div>
        ) : shown.length === 0 ? (
          <div className="border-t border-surface p-10 text-center text-muted">
            <MdInbox size={36} className="mx-auto" aria-hidden />
            <p className="mt-2">{rows.length === 0 ? 'No cases yet.' : 'No cases match these filters.'}</p>
          </div>
        ) : shown.map((r) => {
          const cat = reasonOf(r.category)
          const waitingRow = toneOf(r.status, r.post_status) === 'pending'
          return (
            <Link key={r.case_id} to={`/admin/cases/${r.case_id}`}
              aria-label={`${cat.label}, ${r.severity} risk. Posted by @${r.poster_handle}, shows @${r.owner_handle}. Open case`}
              className={`flex flex-col gap-2 border-t border-surface px-5 py-3.5 text-sm shadow-[inset_4px_0_0_transparent] transition hover:bg-primary/5 ${COLS} ${waitingRow ? 'bg-warning/5 !shadow-[inset_4px_0_0_var(--color-warning)]' : ''}`}>
              <span className="flex items-center justify-between gap-2 @4xl:block">
                <RiskBadge severity={r.severity} />
                <span className="text-xs text-muted @4xl:hidden">{timeAgo(r.created_at)}</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate">{r.caption ? `“${r.caption}”` : <span className="text-muted">(no caption)</span>}</span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted"><span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: cat.color }} />{cat.label}</span>
              </span>
              <span><CaseStatusPill status={r.status} postStatus={r.post_status} /></span>
              <span className="font-semibold tabular-nums @4xl:text-right"><span className="font-normal text-muted @4xl:hidden">Match </span>{r.similarity != null ? `${Math.round(r.similarity * 100)}%` : '-'}</span>
              <span className="truncate"><span className="text-muted @4xl:hidden">Shows </span>@{r.owner_handle}</span>
              <span className="truncate"><span className="text-muted @4xl:hidden">Posted by </span>@{r.poster_handle}</span>
              <span className="hidden whitespace-nowrap text-right text-muted @4xl:block">{timeAgo(r.created_at)}</span>
              <MdChevronRight aria-hidden size={18} className="hidden text-gray-400 @4xl:block" />
            </Link>
          )
        })}
        <p className="border-t border-surface px-5 py-3.5 text-[13px] text-muted">
          {rows ? `Showing ${shown.length} of ${rows.length} cases${rows.length >= 100 ? ' (latest 100)' : ''}, newest first` : ' '}
        </p>
      </section>
    </div>
  )
}
