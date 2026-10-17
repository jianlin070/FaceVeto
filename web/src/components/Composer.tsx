import { useRef, useState, type FormEvent } from 'react'
import { MdAddPhotoAlternate, MdClose } from 'react-icons/md'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { BANNERS, applyBanner, type Banner } from '../lib/testBanner'

export default function Composer({ onPosted }: { onPosted: (status: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<Banner>('none')
  const input = useRef<HTMLInputElement>(null)

  function pick(f: File | null) {
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('image', banner === 'none' ? file : await applyBanner(file, banner))
    fd.append('caption', caption)
    try {
      const r = await api<{ post_id: string; status: string }>('/api/posts', { method: 'POST', body: fd })
      toast(r.status === 'published' ? 'Posted' : 'Your post is under review', r.status === 'published' ? 'success' : 'info')
      pick(null); setCaption(''); setBanner('none')
      if (input.current) input.current.value = ''
      onPosted(r.status)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card m-3 p-3">
      <label htmlFor="caption" className="sr-only">Caption</label>
      <textarea id="caption" className="w-full resize-none rounded-lg p-2 focus:outline-none" rows={2} maxLength={2000}
        placeholder="What's happening?" value={caption} onChange={(e) => setCaption(e.target.value)} />
      {preview && (
        <div className="relative mt-2">
          {banner !== 'none' && <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-2 py-0.5 text-xs text-white">{BANNERS.find((b) => b.value === banner)?.label} will be added</span>}
          <img src={preview} alt="Selected" className="max-h-64 w-full rounded-lg object-cover" />
          <button type="button" className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white" aria-label="Remove image" onClick={() => pick(null)}>
            <MdClose size={18} />
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-primary hover:bg-surface">
          <MdAddPhotoAlternate size={22} aria-hidden /> <span className="text-sm font-medium">Photo</span>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        {file && (
          <select className="rounded-lg border border-gray-300 px-2 py-1 text-xs" value={banner} aria-label="Add a test banner"
            onChange={(e) => {
              const b = e.target.value as Banner
              setBanner(b)
              const cap = BANNERS.find((x) => x.value === b)?.caption
              if (cap && !caption) setCaption(cap)
            }}>
            {BANNERS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        )}
        <button className="btn-primary py-1.5" disabled={!file || busy}>{busy ? 'Checking...' : 'Post'}</button>
      </div>
    </form>
  )
}
