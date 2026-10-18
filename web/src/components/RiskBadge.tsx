const TONE: Record<string, string> = {
  high: 'bg-danger text-white', medium: 'bg-warning text-ink', low: 'bg-primary/15 text-primary', none: 'bg-surface text-muted',
}

export default function RiskBadge({ severity }: { severity: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONE[severity] ?? TONE.none}`}>{severity}</span>
}
