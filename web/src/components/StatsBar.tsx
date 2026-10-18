import type { Stats } from '../lib/types'

export default function StatsBar({ s }: { s: Stats | null }) {
  const sec = (ms: number | null | undefined) => (ms == null ? '-' : `${(ms / 1000).toFixed(1)} s`)
  const items = [
    ['Posts scanned', s?.posts_scanned], ['Held', s?.held_total], ['Taken down', s?.removed], ['Released', s?.released],
    ['Gemini calls', s?.gemini_calls], ['Decision p50', sec(s?.scan_latency_ms.p50)], ['Decision p95', sec(s?.scan_latency_ms.p95)],
  ] as const
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7" aria-label="Statistics">
      {items.map(([k, v]) => (
        <div key={k} className="card px-4 py-3">
          <p className="text-xs font-medium text-muted">{k}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{s ? v ?? '-' : <span className="skeleton inline-block h-7 w-12 align-middle" />}</p>
        </div>
      ))}
    </section>
  )
}
