import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { MdHome, MdNotifications, MdOutlineHome, MdOutlineNotifications, MdPerson, MdPersonOutline } from 'react-icons/md'
import { notificationHref, useLiveNotifications } from '../lib/notifications'
import { playChime, unlockAudioOnGesture } from '../lib/sound'
import type { Notification } from '../lib/types'
import HeadsUp from './HeadsUp'

/** The "Lepak" social app: phone-width, friendly, bottom navigation. */
export default function AppShell() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [headsUp, setHeadsUp] = useState<Notification | null>(null)

  useEffect(unlockAudioOnGesture, [])
  const unread = useLiveNotifications((n) => { playChime(); setHeadsUp(n) })
  const dismiss = useCallback(() => setHeadsUp(null), [])

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Lepak` : 'Lepak'
    return () => { document.title = 'FaceVeto' }
  }, [unread])

  // Face protection and enrolment live under Profile.
  const inProfile = ['/profile', '/settings', '/enrol'].some((p) => pathname.startsWith(p))
  const tab = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${active ? 'font-semibold text-ink' : 'text-muted'}`
  const pill = (active: boolean) =>
    `relative flex h-8 w-13 items-center justify-center rounded-xl transition ${active ? 'bg-primary text-white shadow-sm' : 'hover:bg-surface'}`

  return (
    <div className="min-h-dvh bg-[#E2E5E9]">
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col bg-surface shadow-[0_0_0_1px_#E3E5E8,0_8px_40px_rgba(32,33,36,0.08)]">
      {headsUp && <HeadsUp note={headsUp} onDismiss={dismiss} onOpen={() => { nav(notificationHref(headsUp)); dismiss() }} />}
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-15 items-center gap-2.5 px-4">
          <NavLink to="/feed" className="flex items-center gap-2.5" aria-label="Lepak home">
            <span className="flex h-8.5 w-8.5 items-center justify-center rounded-[11px] bg-primary/10" aria-hidden>
              <img src="/favicon.svg" alt="" className="h-5.5 w-5.5" />
            </span>
            <span className="text-xl font-bold tracking-tight">Lepak</span>
          </NavLink>
          <span className="ml-auto rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-muted">protected by FaceVeto</span>
        </div>
      </header>
      <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"><Outlet /></main>
      <nav aria-label="Main"
        className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[420px] -translate-x-1/2 border-t border-line bg-white px-2 pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/feed" className={({ isActive }) => tab(isActive)}>
          {({ isActive }) => <><span className={pill(isActive)}>{isActive ? <MdHome size={22} /> : <MdOutlineHome size={22} />}</span>Feed</>}
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => tab(isActive)}>
          {({ isActive }) => (
            <>
              <span className={pill(isActive)}>
                {isActive ? <MdNotifications size={22} /> : <MdOutlineNotifications size={22} />}
                {unread > 0 && (
                  <span className="absolute -top-1 right-1.5 min-w-4.5 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4.5 text-white ring-2 ring-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              Alerts{unread > 0 && <span className="sr-only">, {unread} unread</span>}
            </>
          )}
        </NavLink>
        <NavLink to="/profile" className={tab(inProfile)} aria-current={inProfile ? 'page' : undefined}>
          <span className={pill(inProfile)}>{inProfile ? <MdPerson size={22} /> : <MdPersonOutline size={22} />}</span>Profile
        </NavLink>
      </nav>
    </div>
    </div>
  )
}
