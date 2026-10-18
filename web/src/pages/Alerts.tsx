import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { MdInfoOutline, MdNotificationsNone } from 'react-icons/md'
import { db } from '../lib/firebase'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { toast } from '../lib/toast'
import { timeAgo } from '../lib/format'
import type { Notification, OwnerCase } from '../lib/types'
import AuthImage from '../components/AuthImage'
import CaseCard from '../components/CaseCard'
import Spinner from '../components/Spinner'

export default function Alerts() {
  const { fbUser } = useAuth()
  const [data, setData] = useState<{ cases: OwnerCase[]; notifications: Notification[] } | null>(null)
  const loading = useRef(false)
  const { hash } = useLocation()
  const [focus, setFocus] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    try {
      setData(await api('/api/alerts', { quiet: true }))
      api('/api/notifications/read', { method: 'POST', quiet: true }).catch(() => {})
    } catch { /* keep last data */ } finally { loading.current = false }
  }, [])

  // Real time: refetch whenever my notifications change. Falls back to polling if the listener fails.
  useEffect(() => {
    if (!fbUser) return
    let poll: ReturnType<typeof setInterval> | null = null
    const q = query(collection(db, 'notifications'), where('uid', '==', fbUser.uid))
    const unsub = onSnapshot(q, () => { load() }, () => { poll ??= setInterval(load, 3000) })
    load()
    return () => { unsub(); if (poll) clearInterval(poll) }
  }, [fbUser, load])

  // Opened from a notification: scroll to its entry and highlight it briefly.
  const ready = data !== null
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1))
    const el = ready && id ? document.getElementById(id) : null
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFocus(id)
    const t = setTimeout(() => setFocus(null), 2500)
    return () => clearTimeout(t)
  }, [hash, ready])
  const ring = (id: string) => (focus === id ? 'rounded-2xl ring-2 ring-primary ring-offset-2 transition' : 'transition')

  async function respond(id: string, r: 'not_me' | 'its_me') {
    await api(`/api/cases/${id}/respond`, { method: 'POST', body: JSON.stringify({ response: r }) })
    toast(r === 'not_me' ? 'Removed. We prepared an evidence pack for the review team.' : 'Allowed. Thanks for confirming.', 'success')
    await load()
  }

  if (!data) return <Spinner />
  const open = data.cases.filter((c) => c.status === 'awaiting_owner')
  const closed = data.cases.filter((c) => c.status !== 'awaiting_owner')
  const fyis = data.notifications.filter((n) => n.type !== 'held_post')

  return (
    <div className="space-y-4 p-3">
      <h1 className="px-1 text-lg font-semibold">Alerts</h1>
      {open.length === 0 && fyis.length === 0 && closed.length === 0 && (
        <div className="p-8 text-center text-muted">
          <MdNotificationsNone size={40} className="mx-auto" aria-hidden />
          <p className="mt-2 text-sm">No alerts. If someone posts your face, you will see it here first.</p>
        </div>
      )}
      {open.map((c) => <div key={c.case_id} id={`case-${c.case_id}`} className={ring(`case-${c.case_id}`)}><CaseCard c={c} onRespond={respond} /></div>)}
      {fyis.length > 0 && (
        <section aria-label="Updates" className="card divide-y divide-gray-100">
          {fyis.map((n) => (
            <div key={n.id} id={`note-${n.id}`} className={`flex gap-3 p-3 ${ring(`note-${n.id}`)}`}>
              <MdInfoOutline size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
                <p className="mt-0.5 text-xs text-muted">{timeAgo(n.created_at)}</p>
              </div>
              {n.type === 'fyi_appearance' && n.post_id && (
                <AuthImage src={`/api/media/${n.post_id}`} alt="The post you appear in" className="h-14 w-14 shrink-0 rounded-lg object-cover text-[0px]" />
              )}
            </div>
          ))}
        </section>
      )}
      {closed.length > 0 && <h2 className="px-1 pt-2 text-sm font-semibold text-muted">Resolved</h2>}
      {closed.map((c) => <div key={c.case_id} id={`case-${c.case_id}`} className={ring(`case-${c.case_id}`)}><CaseCard c={c} onRespond={respond} /></div>)}
    </div>
  )
}
