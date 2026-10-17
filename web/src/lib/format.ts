export function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const CATEGORY_LABEL: Record<string, string> = {
  gambling_promotion: 'Gambling promotion',
  sexual_or_intimate: 'Sexual or intimate',
  scam_or_fraud: 'Scam or fraud',
  impersonation: 'Impersonation',
  harassment_or_defamation: 'Harassment',
  other_harmful: 'Other harmful',
  benign: 'Looks harmless',
  unassessed: 'Not assessed',
}

export function categoryLabel(c: string) {
  return CATEGORY_LABEL[c] ?? c
}
