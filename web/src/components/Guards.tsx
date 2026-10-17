import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Spinner from './Spinner'

/** Signed in with a completed profile. */
export function RequireUser() {
  const { fbUser, me, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner full />
  if (!fbUser) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!me) return <Spinner full label="Loading your profile" />
  if (!me.profile_complete) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { me } = useAuth()
  if (!me?.is_admin) return <Navigate to="/feed" replace />
  return <Outlet />
}
