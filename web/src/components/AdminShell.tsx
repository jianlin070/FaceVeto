import { Link, Outlet, useNavigate } from 'react-router-dom'
import { MdLogout, MdPhoneIphone } from 'react-icons/md'
import { useAuth } from '../lib/auth'

/** FaceVeto trust & safety console: desktop, dense, dark header. */
export default function AdminShell() {
  const { me, signOut } = useAuth()
  const nav = useNavigate()
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-ink pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2 font-semibold">
            <img src="/favicon.svg" alt="" className="h-7 w-7" /> FaceVeto <span className="font-normal text-gray-400">Trust & Safety</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-gray-400 sm:inline">{me?.email}</span>
            <Link to="/feed" className="rounded-lg p-2 hover:bg-white/10" title="Open Lepak app" aria-label="Open Lepak app"><MdPhoneIphone size={20} /></Link>
            <button className="rounded-lg p-2 hover:bg-white/10" aria-label="Sign out" onClick={async () => { await signOut(); nav('/') }}><MdLogout size={20} /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4"><Outlet /></main>
    </div>
  )
}
