import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth'
import type { Notification } from './types'

/** Live unread notifications from Firestore (rules allow owners to read their own).
 *
 * Returns the unread count and calls onNew for each notification that arrives after the first
 * snapshot, so existing unread items do not chime on page load.
 */
export function useLiveNotifications(onNew: (n: Notification) => void) {
  const { fbUser } = useAuth()
  const [count, setCount] = useState(0)
  const handler = useRef(onNew)
  useEffect(() => { handler.current = onNew })
  useEffect(() => {
    if (!fbUser) return
    let first = true
    const q = query(collection(db, 'notifications'), where('uid', '==', fbUser.uid), where('read', '==', false))
    return onSnapshot(q, (s) => {
      setCount(s.size)
      if (!first) {
        for (const ch of s.docChanges()) {
          if (ch.type !== 'added') continue
          const d = ch.doc.data()
          handler.current({ id: ch.doc.id, type: d.type, title: d.title, body: d.body, case_id: d.case_id ?? null,
            post_id: d.post_id ?? null, read: false, created_at: null })
        }
      }
      first = false
    }, () => setCount(0))
  }, [fbUser])
  return count
}

/** Where tapping a notification takes you: its entry on the Alerts page. */
export function notificationHref(n: Pick<Notification, 'id' | 'type' | 'case_id'>) {
  return n.case_id ? `/alerts#case-${n.case_id}` : `/alerts#note-${n.id}`
}
