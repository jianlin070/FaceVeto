import { useAuth } from '../lib/auth'

export default function Feed() {
  const { me } = useAuth()
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Hi {me?.display_name}</h1>
      <p className="text-sm text-muted">@{me?.handle} · account age {me?.account_age_days} days · protection {me?.protection.status}</p>
    </div>
  )
}
