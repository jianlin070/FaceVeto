export default function Spinner({ full, label = 'Loading' }: { full?: boolean; label?: string }) {
  const s = (
    <div className="flex items-center justify-center gap-3 p-6 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
  return full ? <div className="flex min-h-screen items-center justify-center">{s}</div> : s
}
