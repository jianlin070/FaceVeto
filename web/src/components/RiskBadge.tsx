const TONE: Record<string, string> = {
  high: 'bg-danger text-white', medium: 'bg-warning text-ink', low: 'bg-primary/15 text-primary', none: 'bg-surface text-muted',
}

export default function RiskBadge({ severity }: { severity: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${TONE[severity] ?? TONE.none}`}>{severity}</span>
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_owner: 'Awaiting owner', owner_not_me: 'Owner: Not me', owner_its_me: 'Owner: It\'s me',
  removed: 'Removed', released: 'Released',
}
