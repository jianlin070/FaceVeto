import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signInWithPopup, signInWithRedirect,
  signOut as fbSignOut, type User as FbUser,
} from 'firebase/auth'
import { auth } from './firebase'
import { api } from './api'
import type { Me } from './types'

interface AuthState {
  fbUser: FbUser | null
  me: Me | null
  loading: boolean
  refreshMe: () => Promise<Me | null>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FbUser | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    if (!auth.currentUser) { setMe(null); return null }
    try {
      const m = await api<Me>('/api/me', { quiet: true })
      setMe(m)
      return m
    } catch {
      setMe(null)
      return null
    }
  }, [])

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setLoading(true)
    setFbUser(u)
    if (u) await refreshMe()
    else setMe(null)
    setLoading(false)
  }), [refreshMe])

  const signOut = useCallback(async () => { await fbSignOut(auth) }, [])

  return <Ctx.Provider value={{ fbUser, me, loading, refreshMe, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
    } else {
      throw e
    }
  }
}

export async function demoLogin(who: 'alice' | 'bob' | 'admin') {
  const { token } = await api<{ token: string }>('/api/demo/login-token', {
    method: 'POST', body: JSON.stringify({ who }),
  })
  await signInWithCustomToken(auth, token)
}
