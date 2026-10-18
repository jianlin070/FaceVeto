import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdChevronRight, MdInbox } from 'react-icons/md'
import { api } from '../lib/api'
import { categoryLabel, timeAgo } from '../lib/format'
import type { AdminCaseRow, Stats } from '../lib/types'
import StatsBar from '../components/StatsBar'
import RiskBadge from '../components/RiskBadge'
import CaseStatusPill, { toneOf } from '../components/CaseStatus'

const FILTERS: [string, string][] = [
  ['', 'All'], ['awaiting_owner', 'Waiting for owner'], ['owner_not_me', 'Taken down by owner'],
  ['removed', 'Taken down by admin'], ['owner_its_me', 'Owner said It\'s me'], ['released', 'Released by admin'],
]

function RowSkeleton() {
  return <tr aria-hidden><td colSpan={7} className="p-3"><div className="skeleton h-5 w-full" /></td></tr>
}

export default function Admin() {
  const nav = useNavigate()
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<AdminCaseRow[] | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let live = true
    const load = () => {
      api<AdminCaseRow[]>(`/api/admin/cases${status ? `?status=${status}` : ''}`, { quiet: true }).then((r) => live && setRows(r)).catch(() => live && setRows([]))
      api<Stats>('/api/admin/stats', { quiet: true }).then((s) => live && setStats(s)).catch(() => {})
    }
    setRows(null)
    load()
    const t = setInterval(load, 5000)
    return () => { live = false; clearInterval(t) }
  }, [status])

  const waiting = rows?.filter((r) => r.status === 'awaiting_owner').length ?? 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review queue</h1>
        <p className="text-sm text-muted">Posts FaceVeto held because they show a protected person. Updates every 5 seconds.</p>
      </div>
      <StatsBar s={stats} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3" role="group" aria-label="Filter by status">
          {FILTERS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${status === v ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
          {status === '' && waiting > 0 && <span className="ml-auto text-sm text-muted"><b className="text-ink">{waiting}</b> waiting for the owner</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Risk</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Match</th><th className="px-4 py-2.5">Protected user</th><th className="px-4 py-2.5">Poster</th>
                <th className="px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? <><RowSkeleton /><RowSkeleton /><RowSkeleton /></> : rows.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-muted">
                  <MdInbox size={36} className="mx-auto" aria-hidden />
                  <p className="mt-2">No cases here.</p>
                </td></tr>
              ) : rows.map((r) => {
                const tone = toneOf(r.status)
                return (
                  <tr key={r.case_id} onClick={() => nav(`/admin/cases/${r.case_id}`)}
                    className={`cursor-pointer border-t border-line transition hover:bg-primary/5 ${tone === 'pending' ? 'bg-warning/5' : ''}`}>
                    <td className={`border-l-4 px-4 py-3 ${tone === 'pending' ? 'border-warning' : 'border-transparent'}`}><RiskBadge severity={r.severity} /></td>
                    <td className="px-4 py-3">
                      {/* the link keeps the row reachable by keyboard and screen readers */}
                      <a className="font-medium text-ink hover:text-primary" href={`/admin/cases/${r.case_id}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav(`/admin/cases/${r.case_id}`) }}>
                        {categoryLabel(r.category)}
                      </a>
                    </td>
                    <td className="px-4 py-3"><CaseStatusPill status={r.status} /></td>
                    <td className="px-4 py-3 font-medium tabular-nums">{r.similarity != null ? `${Math.round(r.similarity * 100)}%` : '-'}</td>
                    <td className="px-4 py-3">@{r.owner_handle}</td>
                    <td className="px-4 py-3">@{r.poster_handle}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      <span className="inline-flex items-center gap-1">{timeAgo(r.created_at)}<MdChevronRight aria-hidden /></span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
