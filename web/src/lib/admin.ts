import type { Outcome, Stats } from './types'

export const RANGES = [7, 30, 90] as const
export type Range = (typeof RANGES)[number]

/** One colour per harm reason, from a colour-blind-checked palette. Everything minor folds into Other. */
export const REASONS = [
  { key: 'sexual_or_intimate', label: 'Sexual or intimate', color: '#2a78d6' },
  { key: 'harassment_or_defamation', label: 'Harassment', color: '#eb6834' },
  { key: 'scam_or_fraud', label: 'Scam or fraud', color: '#1baf7a' },
  { key: 'impersonation', label: 'Impersonation', color: '#eda100' },
  { key: 'gambling_promotion', label: 'Gambling promotion', color: '#e87ba4' },
  { key: 'other', label: 'Other', color: '#9aa0a6' },
] as const

export type ReasonKey = (typeof REASONS)[number]['key']

export function reasonOf(category: string): (typeof REASONS)[number] {
  return REASONS.find((r) => r.key === category) ?? REASONS[REASONS.length - 1]
}

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Chart buckets for a range: days, or weeks for 90 days (90 bars would be too thin to read). */
export function bucketPlan(days: Range, today = new Date()) {
  const step = days === 90 ? 7 : 1
  const count = Math.ceil(days / step)
  const first = startOfDay(today)
  first.setDate(first.getDate() - (count * step - 1))
  const label = (i: number) => {
    const d = new Date(first)
    d.setDate(d.getDate() + i * step)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const indexOf = (iso: string) => {
    const diff = Math.round((startOfDay(new Date(iso)).getTime() - first.getTime()) / DAY)
    return Math.min(count - 1, Math.max(0, Math.floor(diff / step)))
  }
  return { since: first, step, count, label, indexOf, unit: step === 1 ? 'day' : 'week' } as const
}

export type BucketPlan = ReturnType<typeof bucketPlan>

/** Held posts per bucket per reason, and per bucket by outcome, for the chart and the sparklines. */
export function bucketize(held: Stats['held'], plan: BucketPlan) {
  const byReason = Array.from({ length: plan.count }, () => Object.fromEntries(REASONS.map((r) => [r.key, 0])) as Record<ReasonKey, number>)
  const byOutcome: Record<Outcome, number[]> = {
    waiting: Array(plan.count).fill(0), down: Array(plan.count).fill(0), live: Array(plan.count).fill(0), deleted: Array(plan.count).fill(0),
  }
  const totals = Array(plan.count).fill(0)
  for (const h of held) {
    const i = plan.indexOf(h.at)
    byReason[i][reasonOf(h.category).key]++
    byOutcome[h.outcome][i]++
    totals[i]++
  }
  return { byReason, byOutcome, totals }
}

export function minutesText(m: number | null | undefined) {
  if (m == null) return '-'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

export function secondsText(ms: number | null | undefined) {
  return ms == null ? '-' : `${(ms / 1000).toFixed(1)} s`
}

export function percent(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 100)}%` : '-'
}

export function greeting(now = new Date()) {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
