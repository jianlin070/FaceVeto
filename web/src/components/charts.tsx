import { useEffect, useRef, useState } from 'react'
import { REASONS, type BucketPlan, type ReasonKey } from '../lib/admin'

const H = 200 // plot height in px

/** Stacked columns, one per bucket. Only the reasons in `visible` are drawn. */
export function StackedBars({ plan, rows, visible, ariaLabel }: {
  plan: BucketPlan; rows: Record<ReasonKey, number>[]; visible: Set<ReasonKey>; ariaLabel: string
}) {
  const shown = rows.map((r) => REASONS.reduce((a, c) => a + (visible.has(c.key) ? r[c.key] : 0), 0))
  const top = Math.max(4, Math.ceil(Math.max(...shown) / 2) * 2)
  const every = plan.step === 1 ? (plan.count > 14 ? 7 : 1) : 2 // tick spacing, counted back from the newest bucket
  const gap = plan.count > 20 ? 'gap-1' : 'gap-2.5'
  return (
    <div className="flex gap-2.5">
      <div aria-hidden className="flex w-5 flex-col justify-between text-right text-[11px] tabular-nums text-gray-500" style={{ height: H }}>
        <span className="-translate-y-1.5">{top}</span><span>{top / 2}</span><span className="translate-y-1.5">0</span>
      </div>
      <div className="min-w-0 flex-1">
        <div role="img" aria-label={ariaLabel} className={`relative flex items-end border-b border-gray-300 ${gap}`} style={{ height: H }}>
          <div aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200" />
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200" />
          {rows.map((r, i) => {
            const segs = REASONS.filter((c) => visible.has(c.key) && r[c.key] > 0)
            const when = plan.step === 1 ? plan.label(i) : `Week of ${plan.label(i)}`
            const tip = shown[i] ? `${when}: ${shown[i]} held (${segs.map((c) => `${c.label} ${r[c.key]}`).join(', ')})` : `${when}: none held`
            return (
              <div key={i} title={tip} className="relative flex h-full min-w-0 max-w-14 flex-1 flex-col-reverse gap-0.5">
                {segs.map((c, k) => (
                  <div key={c.key} className="min-h-[3px] transition-[height] duration-300"
                    style={{ height: `calc(${(r[c.key] / top) * 100}% - 2px)`, background: c.color, borderRadius: k === segs.length - 1 ? '4px 4px 0 0' : 0 }} />
                ))}
              </div>
            )
          })}
        </div>
        <div aria-hidden className={`mt-2 flex text-[11px] text-gray-500 ${gap}`}>
          {rows.map((_, i) => (
            <span key={i} className="min-w-0 max-w-14 flex-1 whitespace-nowrap text-center">{(plan.count - 1 - i) % every === 0 ? plan.label(i) : ''}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Legend that doubles as the series filter. Click hides or shows a reason; double-click shows only that
 * reason (double-click it again to show all). The click is deferred briefly so a double-click does not
 * also toggle.
 */
export function ReasonLegend({ counts, visible, onChange }: {
  counts: Record<ReasonKey, number>; visible: Set<ReasonKey>; onChange: (v: Set<ReasonKey>) => void
}) {
  const timer = useRef<number>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const total = REASONS.reduce((a, r) => a + counts[r.key], 0)
  const all = new Set<ReasonKey>(REASONS.map((r) => r.key))

  function toggle(k: ReasonKey) {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const next = new Set(visible)
      if (!next.delete(k)) next.add(k)
      onChange(next)
    }, 230)
  }
  function only(k: ReasonKey) {
    clearTimeout(timer.current)
    onChange(visible.size === 1 && visible.has(k) ? all : new Set([k]))
  }

  return (
    <div className="mt-5 border-t border-surface pt-3.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>Click a reason to hide it. Double-click to show only that reason.</span>
        {visible.size < REASONS.length && (
          <button type="button" onClick={() => onChange(all)} className="rounded-lg px-2 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/5">Show all</button>
        )}
      </div>
      <ul aria-label="Reasons" className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
        {REASONS.map((r) => {
          const on = visible.has(r.key)
          return (
            <li key={r.key}>
              <button type="button" aria-pressed={on} title={`${on ? 'Hide' : 'Show'} ${r.label}. Double-click to show only this.`}
                onClick={() => toggle(r.key)} onDoubleClick={() => only(r.key)}
                className={`flex min-h-10 w-full select-none items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] transition hover:bg-gray-50 ${on ? '' : 'opacity-55'}`}>
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] border-2" style={{ borderColor: r.color, background: on ? r.color : 'transparent' }} />
                <span className={`flex-1 text-gray-700 ${on ? '' : 'line-through'}`}>{r.label}</span>
                <b className="tabular-nums">{counts[r.key]}</b>
                <span className="w-9 text-right tabular-nums text-muted">{total ? `${Math.round((counts[r.key] / total) * 100)}%` : '-'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export interface Slice { label: string; value: number; color: string }

const SWEEP_MS = 1100

/** Donut that sweeps in clockwise from 12 o'clock each time it mounts. Reduced motion turns the sweep off (see index.css). */
export function Donut({ slices, centre, ariaLabel }: { slices: Slice[]; centre: string; ariaLabel: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 50) // after first paint, so the sweep starts from empty
    return () => clearTimeout(id)
  }, [])
  const total = slices.reduce((a, s) => a + s.value, 0)
  const arcs = slices.filter((s) => s.value > 0).map((s, i, all) => {
    const before = all.slice(0, i).reduce((a, x) => a + x.value, 0)
    return { ...s, share: (s.value / total) * 100, start: (before / total) * 100 }
  })
  return (
    <svg viewBox="0 0 42 42" role="img" aria-label={ariaLabel} className="h-44 w-44">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#F1F3F4" strokeWidth="5" />
      <g transform="rotate(-90 21 21)">
        {arcs.map((a) => (
          <circle key={a.label} cx="21" cy="21" r="15.9155" fill="none" stroke={a.color} strokeWidth="5" pathLength={100}
            strokeDasharray={`${ready ? Math.max(0, a.share - (arcs.length > 1 ? 1 : 0)) : 0} 100`} strokeDashoffset={-a.start}
            style={{ transition: `stroke-dasharray ${(a.share / 100) * SWEEP_MS}ms linear ${(a.start / 100) * SWEEP_MS}ms` }} />
        ))}
      </g>
      <text x="21" y="21" textAnchor="middle" className="fill-ink text-[8px] font-bold">{centre}</text>
      <text x="21" y="26.5" textAnchor="middle" className="fill-muted text-[3.2px]">held posts</text>
    </svg>
  )
}

export function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const max = Math.max(...values, 1)
  const points = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 120},${34 - (v / max) * 30}`).join(' ')
  return (
    <svg viewBox="0 0 120 36" preserveAspectRatio="none" role="img" aria-label={label} className="mt-1.5 h-10 w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
