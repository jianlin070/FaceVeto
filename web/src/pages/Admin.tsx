import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { categoryLabel, timeAgo } from '../lib/format'
import type { AdminCaseRow, Stats } from '../lib/types'
import StatsBar from '../components/StatsBar'
import RiskBadge, { STATUS_LABEL } from '../components/RiskBadge'
import Spinner from '../components/Spinner'

const FILTERS = ['', 'awaiting_owner', 'owner_not_me', 'owner_its_me', 'removed', 'released']

export default function Admin() {
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

  return (
    <div className="space-y-4">
      <StatsBar s={stats} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 p-3">
          <h1 className="font-semibold">Review queue</h1>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Status</span>
            <select className="input w-auto py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
              {FILTERS.map((f) => <option key={f} value={f}>{f ? STATUS_LABEL[f] : 'All'}</option>)}
            </select>
          </label>
        </div>
        {rows === null ? <Spinner /> : rows.length === 0 ? <p className="p-6 text-center text-sm text-muted">No cases.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted">
                <tr><th className="p-3">Risk</th><th className="p-3">Category</th><th className="p-3">Match</th><th className="p-3">Protected user</th><th className="p-3">Poster</th><th className="p-3">Status</th><th className="p-3">Age</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.case_id} className="border-t border-gray-100 hover:bg-primary/5">
                    <td className="p-3"><RiskBadge severity={r.severity} /></td>
                    <td className="p-3"><Link className="font-medium text-primary hover:underline" to={`/admin/cases/${r.case_id}`}>{categoryLabel(r.category)}</Link></td>
                    <td className="p-3 tabular-nums">{r.similarity != null ? `${Math.round(r.similarity * 100)}%` : '-'}</td>
                    <td className="p-3">@{r.owner_handle}</td>
                    <td className="p-3">@{r.poster_handle}</td>
                    <td className="p-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="p-3 text-muted">{timeAgo(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
