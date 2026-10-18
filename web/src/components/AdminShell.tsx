import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { MdDashboard, MdInbox, MdLogout, MdOutlineDashboard, MdOutlineInbox, MdPerson, MdPhoneIphone } from 'react-icons/md'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Waiting } from '../lib/types'
import Avatar from './Avatar'
import Menu, { MenuItem } from './Menu'

/** FaceVeto trust & safety console: side navigation on desktop, a top bar on phones. */
export default function AdminShell() {
  const { me, signOut } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [waiting, setWaiting] = useState<Waiting | null>(null)

  useEffect(() => {
    let live = true
    const load = () => api<Waiting>('/api/admin/waiting', { quiet: true }).then((w) => live && setWaiting(w)).catch(() => {})
    load()
    const t = setInterval(load, 15000)
    return () => { live = false; clearInterval(t) }
  }, [])

  const name = me?.display_name || me?.handle || 'Admin'
  const item = (active: boolean) =>
    `relative flex h-12 w-12 items-center justify-center rounded-2xl transition ${active ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-surface hover:text-ink'}`

  return (
    <div className="flex min-h-dvh flex-col bg-surface md:flex-row">
      <aside className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-white px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] md:h-dvh md:w-22 md:flex-col md:gap-3 md:border-b-0 md:border-r md:px-0 md:py-6">
        <Menu label={`Account menu for ${name}`} className="rounded-full ring-4 ring-primary/10 transition hover:ring-primary/20"
          trigger={<span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-white" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>}
          panelClassName="left-0 origin-top-left mt-2 w-72">
          {(close) => (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 pb-3 pt-2">
                <Avatar name={name} handle={me?.handle || name} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="truncate text-sm text-muted">{me?.email}</p>
                  <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary-dark">Trust &amp; safety admin</span>
                </div>
              </div>
              <MenuItem icon={<MdPerson />} onSelect={() => { close(); nav('/profile') }}>My profile</MenuItem>
              <MenuItem icon={<MdPhoneIphone />} onSelect={() => { close(); nav('/feed') }}>Open Lepak app</MenuItem>
              <MenuItem icon={<MdLogout />} danger onSelect={async () => { close(); await signOut(); nav('/') }}>Sign out</MenuItem>
            </>
          )}
        </Menu>

        <nav aria-label="Admin" className="flex items-center gap-2 md:mt-4 md:flex-col md:gap-3">
          <NavLink to="/admin" end title="Overview" aria-label="Overview" className={({ isActive }) => item(isActive)}>
            {({ isActive }) => (isActive ? <MdDashboard size={24} /> : <MdOutlineDashboard size={24} />)}
          </NavLink>
          <NavLink to="/admin/queue" title="Review queue" className={({ isActive }) => item(isActive || pathname.startsWith('/admin/cases'))}
            aria-label={`Review queue${waiting?.count ? `, ${waiting.count} waiting` : ''}`}>
            {({ isActive }) => (
              <>
                {isActive ? <MdInbox size={24} /> : <MdOutlineInbox size={24} />}
                {!!waiting?.count && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-warning px-1.5 text-center text-[11px] font-bold leading-5 text-ink ring-2 ring-white">
                    {waiting.count > 99 ? '99+' : waiting.count}
                  </span>
                )}
              </>
            )}
          </NavLink>
        </nav>
        <p className="ml-auto text-sm font-semibold md:hidden">FaceVeto <span className="font-normal text-muted">Trust &amp; Safety</span></p>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-[1360px] flex-1 px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))] md:px-10 md:py-8">
        <Outlet context={waiting} />
      </main>
    </div>
  )
}
