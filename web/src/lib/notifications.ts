import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth'

/** Live unread notification count from Firestore (rules allow owners to read their own). */
export function useUnreadCount() {
  const { fbUser } = useAuth()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!fbUser) return
    const q = query(collection(db, 'notifications'), where('uid', '==', fbUser.uid), where('read', '==', false))
    return onSnapshot(q, (s) => setCount(s.size), () => setCount(0))
  }, [fbUser])
  return count
}
