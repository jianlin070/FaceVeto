import { useAuth } from '../lib/auth'

export default function Admin() {
  const { me } = useAuth()
  return <div className="p-6"><h1 className="text-xl font-semibold">Admin console</h1><p className="text-muted">Signed in as {me?.email}</p></div>
}
