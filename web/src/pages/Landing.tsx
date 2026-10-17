import { useEffect, useState } from 'react'

export default function Landing() {
  const [health, setHealth] = useState<string>('checking')
  useEffect(() => {
    fetch('/api/healthz')
      .then((r) => r.json())
      .then((j) => setHealth(j.ok ? `API ok (v${j.version})` : 'API error'))
      .catch(() => setHealth('API unreachable'))
  }, [])
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold">FaceVeto</h1>
      <p className="mt-2 text-muted">Your face, your veto. Face misuse protection built into social platforms.</p>
      <p className="mt-6 text-sm" role="status">{health}</p>
    </main>
  )
}
