import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { MdArrowForward, MdChevronRight, MdHourglassTop, MdOutlineAutoAwesome, MdOutlineCenterFocusWeak, MdOutlineTimer } from 'react-icons/md'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { bucketize, bucketPlan, greeting, minutesText, percent, RANGES, reasonOf, REASONS, secondsText, type Range, type ReasonKey } from '../lib/admin'
import { timeAgo } from '../lib/format'
import type { Stats, Waiting } from '../lib/types'
import { Donut, ReasonLegend, Sparkline, StackedBars } from '../components/charts'
import RiskBadge from '../components/RiskBadge'

const ALL_REASONS = new Set<ReasonKey>(REASONS.map((r) => r.key))
const cardCls = 'rounded-2xl border border-line bg-white'

function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-sm text-muted">vs {before} before</span>
  const pct = Math.round((Math.abs(now - before) / before) * 100)
  return <span className="text-[13px] font-semibold text-muted">{now >= before ? '▲' : '▼'} {pct}%</span>
}

export default function Admin() {
  const { me } = useAuth()
  const waiting = useOutletContext<Waiting | null>()
  const [range, setRange] = useState<Range>(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [visible, setVisible] = useState(ALL_REASONS)
  const [table, setTable] = useState(false)
  const plan = useMemo(() => bucketPlan(range), [range])

  useEffect(() => {
    let live = true
    setStats(null)
    const load = () => api<Stats>(`/api/admin/stats?since=${encodeURIComponent(plan.since.toISOString())}`, { quiet: true })
      .then((s) => live && setStats(s)).catch(() => {})
    load()
    const t = setInterval(load, 20000)
    return () => { live = false; clearInterval(t) }
  }, [plan])

  const data = useMemo(() => {
    if (!stats) return null
    const b = bucketize(stats.held, plan)
    const count = (o: string) => stats.held.filter((h) => h.outcome === o).length
    const by = (o: string, who: string) => stats.held.filter((h) => h.outcome === o && h.by === who).length
    const reasonTotals = Object.fromEntries(REASONS.map((r) => [r.key, stats.held.filter((h) => reasonOf(h.category).key === r.key).length])) as Record<ReasonKey, number>
    return { b, reasonTotals, down: count('down'), live: count('live'), waiting: count('waiting'), deleted: count('deleted'),
      downOwner: by('down', 'owner'), downAdmin: by('down', 'admin'), liveOwner: by('live', 'owner'), liveAdmin: by('live', 'admin') }
  }, [stats, plan])

  const held = stats?.held.length ?? 0
  const decided = data ? data.down + data.live : 0
  const med = stats?.decision_minutes
  const medDelta = med?.median != null && med.prev_median ? Math.round(((med.median - med.prev_median) / med.prev_median) * 100) : null
  const visibleNames = REASONS.filter((r) => visible.has(r.key))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-primary">FaceVeto Trust &amp; Safety</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-[28px]">{greeting()}, {me?.display_name || 'admin'}</h1>
          <p className="mt-1.5 text-[15px] text-muted">Here is what FaceVeto caught in the last {range} days.</p>
        </div>
        <div role="group" aria-label="Time range" className="flex rounded-full border border-line bg-white p-1">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}
              className={`min-h-9 rounded-full px-4 text-sm font-medium transition ${range === r ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
              {r} days
            </button>
          ))}
        </div>
      </header>

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/admin/queue" className="flex flex-col gap-1.5 rounded-2xl bg-primary p-5 text-white shadow-lg shadow-primary/25 transition hover:bg-primary-dark">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Waiting for owner</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20" aria-hidden><MdHourglassTop size={18} /></span>
          </div>
          <span className="text-4xl font-bold leading-tight tracking-tight">{waiting ? waiting.count : <Skeleton className="inline-block h-9 w-12 !bg-white/25" />}</span>
          <span className="text-[13px] opacity-90">{waiting?.oldest_at ? `Right now · oldest waited ${timeAgo(waiting.oldest_at).replace(' ago', '')}` : 'Right now'}</span>
          <span className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold">Open review queue <MdArrowForward aria-hidden /></span>
        </Link>

        <div className={`${cardCls} flex flex-col gap-1.5 p-5`}>
          <span className="text-sm font-medium text-muted">Posts held</span>
          {stats ? <>
            <div className="flex items-baseline gap-2.5"><span className="text-4xl font-bold leading-tight tracking-tight">{held}</span><Delta now={held} before={stats.prev_held} /></div>
            <span className="text-[13px] text-muted">vs {stats.prev_held} in the {range} days before</span>
            <Sparkline values={data!.b.totals} color="#1A73E8" label="Posts held over the period" />
          </> : <Skeleton className="h-24 w-full" />}
        </div>

        <div className={`${cardCls} flex flex-col gap-1.5 p-5`}>
          <span className="text-sm font-medium text-muted">Taken down</span>
          {data ? <>
            <div className="flex items-baseline gap-2.5"><span className="text-4xl font-bold leading-tight tracking-tight">{data.down}</span><span className="text-[13px] font-semibold text-muted">{percent(data.down, decided)} of decided</span></div>
            <span className="text-[13px] text-muted">{data.downOwner} by the owner, {data.downAdmin} by an admin</span>
            <Sparkline values={data.b.byOutcome.down} color="#D93025" label="Posts taken down over the period" />
          </> : <Skeleton className="h-24 w-full" />}
        </div>

        <div className={`${cardCls} flex flex-col gap-1.5 p-5`}>
          <span className="text-sm font-medium text-muted">Median time to decision</span>
          {med ? <>
            <div className="flex items-baseline gap-2.5">
              <span className="text-4xl font-bold leading-tight tracking-tight">{minutesText(med.median)}</span>
              {medDelta != null && <span className={`text-[13px] font-semibold ${medDelta <= 0 ? 'text-success' : 'text-danger'}`}>{medDelta <= 0 ? '▼' : '▲'} {Math.abs(medDelta)}%</span>}
            </div>
            <span className="text-[13px] text-muted">From hold to the owner's or an admin's call</span>
            <span className="mt-auto pt-2 text-[13px] text-muted">Slowest 10%: over {minutesText(med.p90)}</span>
          </> : <Skeleton className="h-24 w-full" />}
        </div>
      </section>

      <section className="flex flex-wrap gap-5">
        <div className={`${cardCls} min-w-0 flex-[2_1_560px] p-5 md:p-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-semibold">Harmful posts held, by {plan.unit}</h2>
              <p className="mt-1 text-[13px] text-muted">Each post showed a protected member's face. Colour shows why the AI held it.</p>
            </div>
            <button type="button" onClick={() => setTable((t) => !t)} className="rounded-lg px-2 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/5">{table ? 'View as chart' : 'View as table'}</button>
          </div>
          {!data ? <Skeleton className="mt-5 h-60 w-full" /> : table ? (
            <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-surface">
              <table className="w-full text-[13px] tabular-nums">
                <thead className="sticky top-0 bg-gray-50 text-right text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{plan.unit === 'day' ? 'Day' : 'Week of'}</th>
                    {visibleNames.map((r) => <th key={r.key} className="px-3 py-2 font-medium">{r.label}</th>)}
                    <th className="px-3 py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.b.byReason.map((row, i) => (
                    <tr key={i} className="border-t border-surface text-right">
                      <td className="whitespace-nowrap px-3 py-2 text-left">{plan.label(i)}</td>
                      {visibleNames.map((r) => <td key={r.key} className="px-3 py-2 text-gray-700">{row[r.key]}</td>)}
                      <td className="px-3 py-2 font-semibold">{visibleNames.reduce((a, r) => a + row[r.key], 0)}</td>
                    </tr>
                  )).reverse()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5"><StackedBars plan={plan} rows={data.b.byReason} visible={visible} ariaLabel={`Stacked column chart of held posts per ${plan.unit} over the last ${range} days`} /></div>
          )}
          {data && <ReasonLegend counts={data.reasonTotals} visible={visible} onChange={setVisible} />}
        </div>

        <div className={`${cardCls} flex min-w-0 flex-[1_1_320px] flex-col p-5 md:p-6`}>
          <h2 className="text-[17px] font-semibold">How held posts ended</h2>
          <p className="mt-1 text-[13px] text-muted">Who made the final call on each hold.</p>
          {!data ? <Skeleton className="mx-auto my-6 h-44 w-44 !rounded-full" /> : (
            <>
              <div className="my-5 flex justify-center">
                <Donut centre={String(held)} ariaLabel={`${held} held posts: ${data.down} taken down, ${data.live} back live, ${data.waiting} waiting, ${data.deleted} deleted by poster`}
                  slices={[
                    { label: 'Taken down', value: data.down, color: '#D93025' }, { label: 'Back live', value: data.live, color: '#1E8E3E' },
                    { label: 'Waiting', value: data.waiting, color: '#F9AB00' }, { label: 'Deleted', value: data.deleted, color: '#BDC1C6' },
                  ]} />
              </div>
              <ul className="space-y-3 text-[13px]">
                {[
                  { c: '#D93025', t: 'Taken down', s: `${data.downOwner} owner said Not me · ${data.downAdmin} admin`, n: data.down },
                  { c: '#1E8E3E', t: 'Back live', s: `${data.liveOwner} owner said It's me · ${data.liveAdmin} admin released`, n: data.live },
                  { c: '#F9AB00', t: 'Waiting for owner', s: '', n: data.waiting },
                  { c: '#BDC1C6', t: 'Deleted by poster', s: '', n: data.deleted },
                ].map((x) => (
                  <li key={x.t} className="flex items-start gap-2.5">
                    <span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: x.c }} />
                    <span className="flex-1"><b className="font-semibold">{x.t}</b>{x.s && <><br /><span className="text-muted">{x.s}</span></>}</span>
                    <b className="tabular-nums">{x.n}</b>
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-4 text-[13px] leading-relaxed text-gray-700">
                <b>{percent(data.live, decided)}</b> of decided holds went back live. A rising share means the AI is holding harmless posts.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-5">
        <div className={`${cardCls} min-w-0 flex-[2_1_560px] pb-2 pt-5 md:pt-6`}>
          <div className="px-5 md:px-6">
            <h2 className="text-[17px] font-semibold">High-risk posters</h2>
            <p className="mt-1 text-[13px] text-muted">Accounts whose posts were held more than once. Click a poster to review their latest held post.</p>
          </div>
          <div className="mt-4 @container">
            <div className="text-[13px]">
              <div aria-hidden className="hidden @2xl:grid-cols-[minmax(170px,1.5fr)_44px_52px_minmax(0,1.6fr)_76px_72px_16px] gap-3 px-6 py-2 text-xs font-medium text-muted @2xl:grid">
                <span>Poster</span><span className="text-right">Held</span><span className="text-right">People</span><span>Why flagged</span><span>Worst</span><span className="text-right">Last held</span><span />
              </div>
              {!stats ? <div className="space-y-2 px-6 py-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                : stats.posters.length === 0 ? <p className="border-t border-surface px-6 py-10 text-center text-muted">No account has had more than one post held in this period.</p>
                : stats.posters.map((p) => (
                  <Link key={p.handle} to={`/admin/cases/${p.case_id}`} aria-label={`@${p.handle}, ${p.held} posts held. Review latest held post`}
                    className="flex flex-col gap-2 border-t border-surface px-5 py-3 transition hover:bg-primary/5 @2xl:grid @2xl:grid-cols-[minmax(170px,1.5fr)_44px_52px_minmax(0,1.6fr)_76px_72px_16px] @2xl:items-center @2xl:gap-3 @2xl:px-6">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{p.handle.slice(0, 1).toUpperCase()}</span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">@{p.handle}</span>
                        <span className={`truncate whitespace-nowrap text-xs ${p.account_age_days < 30 ? 'font-medium text-danger' : 'text-muted'}`}>{p.account_age_days < 30 ? `New account · ${p.account_age_days} days` : `${p.account_age_days} days old`}</span>
                      </span>
                    </span>
                    <span className="font-bold tabular-nums @2xl:text-right">{p.held}<span className="font-normal text-muted @2xl:hidden"> held · {p.people} {p.people === 1 ? 'person' : 'people'}</span></span>
                    <span className="hidden text-right tabular-nums @2xl:block">{p.people}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {Object.entries(p.reasons).map(([cat, n]) => {
                        const r = reasonOf(cat)
                        return <span key={cat} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface py-0.5 pl-2 pr-2.5 text-xs"><span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />{r.label} ×{n}</span>
                      })}
                    </span>
                    <span><RiskBadge severity={p.worst} /></span>
                    <span className="whitespace-nowrap text-muted @2xl:text-right"><span className="@2xl:hidden">Last held </span>{timeAgo(p.last_at)}</span>
                    <MdChevronRight aria-hidden className="hidden text-gray-400 @2xl:block" size={18} />
                  </Link>
                ))}
            </div>
          </div>
        </div>

        <div className={`${cardCls} min-w-0 flex-[1_1_320px] p-5 md:p-6`}>
          <h2 className="text-[17px] font-semibold">Most targeted members</h2>
          <p className="mt-1 text-[13px] text-muted">Protected members shown in held posts. Several posters at once can mean a pile-on.</p>
          <ul className="mt-5 space-y-4">
            {!stats ? <Skeleton className="h-24 w-full" /> : stats.targets.length === 0 ? <li className="py-6 text-center text-sm text-muted">No protected member appears in a held post in this period.</li>
              : stats.targets.map((t) => (
                <li key={t.handle} className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-[13px]">
                    <span className="truncate font-semibold">@{t.handle}</span>
                    <span className="shrink-0 text-muted"><b className="text-ink">{t.held}</b> held · {t.posters} {t.posters === 1 ? 'poster' : 'posters'}</span>
                  </div>
                  <div aria-hidden className="h-1.5 rounded-full bg-surface"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(t.held / stats.targets[0].held) * 100}%` }} /></div>
                </li>
              ))}
          </ul>
        </div>
      </section>

      <section aria-label="System health" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { icon: <MdOutlineCenterFocusWeak size={22} />, bg: 'bg-primary/10 text-primary', t: 'Photos scanned', v: stats ? String(stats.system.posts_scanned) : null, s: '' },
          { icon: <MdOutlineTimer size={22} />, bg: 'bg-success/10 text-success', t: 'Decision speed', v: stats ? secondsText(stats.system.scan_p50_ms) : null, s: stats ? `typical · ${secondsText(stats.system.scan_p95_ms)} slowest 5%` : '' },
          { icon: <MdOutlineAutoAwesome size={22} />, bg: 'bg-warning/15 text-amber-800', t: 'AI checks run', v: stats ? String(stats.system.ai_checks) : null, s: stats ? (stats.system.ai_errors ? `${stats.system.ai_errors} failed, held safely` : 'none failed') : '' },
        ].map((x) => (
          <div key={x.t} className={`${cardCls} flex items-center gap-3.5 px-5 py-4`}>
            <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${x.bg}`}>{x.icon}</span>
            <div>
              <p className="text-[13px] text-muted">{x.t}</p>
              <p className="mt-0.5 text-xl font-bold">{x.v ?? <Skeleton className="inline-block h-6 w-14 align-middle" />} <span className="text-[13px] font-medium text-muted">{x.s}</span></p>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
