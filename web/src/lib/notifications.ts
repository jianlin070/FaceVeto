import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore'
import { db } from './firebase'
import { api } from './api'
import { useAuth } from './auth'
import type { Notification } from './types'

const RECENT_MS = 2 * 60_000

function toNote(id: string, d: DocumentData): Notification {
  return { id, type: d.type, title: d.title, body: d.body, case_id: d.case_id ?? null, post_id: d.post_id ?? null,
    read: false, created_at: d.created_at?.toDate?.().toISOString() ?? null }
}

/** Live unread notifications from Firestore (rules allow owners to read their own).
 *
 * Returns the unread count and calls onNew with the newest notification that arrived in the last two
 * minutes and was not announced before in this tab. Remembering announced ids (not "skip the first
 * snapshot") means a phone that reloads a background tab still announces what arrived meanwhile,
 * while old unread items stay quiet. If the listener fails, it polls the API instead.
 */
export function useLiveNotifications(onNew: (n: Notification) => void) {
  const { fbUser } = useAuth()
  const [count, setCount] = useState(0)
  const handler = useRef(onNew)
  useEffect(() => { handler.current = onNew })
  useEffect(() => {
    if (!fbUser) return
    const key = `lepak.announced.${fbUser.uid}`
    let announced: Set<string>
    try { announced = new Set(JSON.parse(sessionStorage.getItem(key) ?? '[]')) } catch { announced = new Set() }

    const consider = (unread: Notification[]) => {
      setCount(unread.length)
      const fresh = unread.filter((n) => !announced.has(n.id))
      if (!fresh.length) return
      fresh.forEach((n) => announced.add(n.id))
      try { sessionStorage.setItem(key, JSON.stringify([...announced].slice(-200))) } catch { /* not critical */ }
      const recent = fresh.filter((n) => n.created_at && Date.now() - Date.parse(n.created_at) < RECENT_MS)
        .sort((a, b) => Date.parse(b.created_at!) - Date.parse(a.created_at!))
      if (recent.length) handler.current(recent[0])
    }

    let poll: ReturnType<typeof setInterval> | undefined
    const q = query(collection(db, 'notifications'), where('uid', '==', fbUser.uid), where('read', '==', false))
    const unsub = onSnapshot(q, (s) => consider(s.docs.map((d) => toNote(d.id, d.data()))), () => {
      const tick = () => api<{ notifications: Notification[] }>('/api/alerts', { quiet: true })
        .then((r) => consider(r.notifications.filter((n) => !n.read))).catch(() => {})
      tick()
      poll ??= setInterval(tick, 4000)
    })
    return () => { unsub(); clearInterval(poll) }
  }, [fbUser])
  return count
}

/** Where tapping a notification takes you: its entry on the Alerts page. */
export function notificationHref(n: Pick<Notification, 'id' | 'type' | 'case_id'>) {
  return n.case_id ? `/alerts#case-${n.case_id}` : `/alerts#note-${n.id}`
}
