import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MdHome, MdLogout, MdNotifications, MdShield, MdAdminPanelSettings } from 'react-icons/md'
import { useAuth } from '../lib/auth'
import { useUnreadCount } from '../lib/notifications'

/** The "Lepak" social app: phone-width, friendly, bottom navigation. */
export default function AppShell() {
  const { me, signOut } = useAuth()
  const nav = useNavigate()
  const unread = useUnreadCount()
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-primary font-semibold' : 'text-muted'}`
  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col bg-white shadow-sm">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <span className="text-xl font-bold text-primary">Lepak</span>
          <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">protected by FaceVeto</span>
        </div>
        <div className="flex items-center gap-1">
          {me?.is_admin && (
            <NavLink to="/admin" className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="Admin console" title="Admin console">
              <MdAdminPanelSettings size={22} />
            </NavLink>
          )}
          <button
            className="rounded-lg p-2 text-muted hover:bg-surface"
            aria-label="Sign out" title={`Sign out @${me?.handle ?? ''}`}
            onClick={async () => { await signOut(); nav('/') }}
          >
            <MdLogout size={20} />
          </button>
        </div>
      </header>
      <main className="flex-1 pb-20"><Outlet /></main>
      <nav className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-[420px] -translate-x-1/2 border-t border-gray-200 bg-white" aria-label="Main">
        <NavLink to="/feed" className={item}><MdHome size={24} aria-hidden />Feed</NavLink>
        <NavLink to="/alerts" className={item}>
          <span className="relative">
            <MdNotifications size={24} aria-hidden />
            {unread > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{unread}</span>
            )}
          </span>
          Alerts{unread > 0 && <span className="sr-only">, {unread} unread</span>}
        </NavLink>
        <NavLink to="/settings/protection" className={item}><MdShield size={24} aria-hidden />Protection</NavLink>
      </nav>
    </div>
  )
}
