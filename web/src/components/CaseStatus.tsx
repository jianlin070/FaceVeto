import type { ReactNode } from 'react'
import { MdBlock, MdCheckCircle, MdDeleteOutline, MdHourglassTop } from 'react-icons/md'
import type { CaseStatus } from '../lib/types'

type Tone = 'pending' | 'removed' | 'live' | 'gone'

/** One plain-language answer to "what happened to this post, and who decided". */
export function caseState(status: CaseStatus, postStatus?: string | null): { label: string; tone: Tone } {
  if (postStatus === 'deleted') return { label: 'Deleted by poster', tone: 'gone' }
  if (status === 'awaiting_owner') {
    // Another person in the same photo may already have decided.
    if (postStatus === 'removed') return { label: 'Taken down', tone: 'removed' }
    if (postStatus === 'published') return { label: 'Live', tone: 'live' }
    return { label: 'Held: waiting for owner', tone: 'pending' }
  }
  return {
    owner_not_me: { label: 'Taken down by owner', tone: 'removed' as Tone },
    removed: { label: 'Taken down by admin', tone: 'removed' as Tone },
    owner_its_me: { label: 'Live: owner said It\'s me', tone: 'live' as Tone },
    released: { label: 'Live: released by admin', tone: 'live' as Tone },
  }[status]
}

const STYLE: Record<Tone, string> = {
  pending: 'bg-warning/15 text-amber-900 ring-warning/40',
  removed: 'bg-danger/10 text-danger ring-danger/30',
  live: 'bg-success/10 text-success ring-success/30',
  gone: 'bg-surface text-muted ring-gray-300',
}
const ICON: Record<Tone, ReactNode> = {
  pending: <MdHourglassTop />, removed: <MdBlock />, live: <MdCheckCircle />, gone: <MdDeleteOutline />,
}

export default function CaseStatusPill({ status, postStatus, large }: { status: CaseStatus; postStatus?: string | null; large?: boolean }) {
  const s = caseState(status, postStatus)
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ${STYLE[s.tone]} ${large ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'}`}>
      <span aria-hidden>{ICON[s.tone]}</span>{s.label}
    </span>
  )
}

export function toneOf(status: CaseStatus, postStatus?: string | null) {
  return caseState(status, postStatus).tone
}
