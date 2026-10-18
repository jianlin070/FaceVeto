const COLORS = ['bg-blue-100 text-blue-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800', 'bg-cyan-100 text-cyan-800', 'bg-lime-100 text-lime-800',
  'bg-orange-100 text-orange-800']

/** Initials avatar with a stable colour per handle. Decorative: the name is always shown next to it. */
export default function Avatar({ name, handle, size = 40 }: { name: string; handle: string; size?: number }) {
  let h = 0
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <span aria-hidden className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${COLORS[h % COLORS.length]}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {(name || handle || '?').trim().slice(0, 1).toUpperCase()}
    </span>
  )
}
