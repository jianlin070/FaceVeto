import { useEffect, useState } from 'react'
import { fetchImage } from '../lib/api'

/** Media is never public: fetch with the ID token and show as an object URL. */
export default function AuthImage({ src, alt, className, blurred }: { src: string; alt: string; className?: string; blurred?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let revoked: string | null = null
    let live = true
    setUrl(null); setFailed(false)
    fetchImage(src).then((u) => { if (live) { revoked = u; setUrl(u) } else URL.revokeObjectURL(u) }).catch(() => live && setFailed(true))
    return () => { live = false; if (revoked) URL.revokeObjectURL(revoked) }
  }, [src])
  if (failed) return <div className={`flex items-center justify-center bg-surface text-sm text-muted ${className ?? ''}`}>Image not available</div>
  if (!url) return <div className={`animate-pulse bg-surface ${className ?? ''}`} aria-label="Loading image" />
  return <img src={url} alt={alt} className={`${className ?? ''} ${blurred ? 'blur-xl' : ''} transition`} />
}
