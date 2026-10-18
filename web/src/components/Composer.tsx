import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { MdClose, MdContentPaste, MdOutlineImage } from 'react-icons/md'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { toast } from '../lib/toast'
import { imageFromClipboard, imageFromTransfer, isImageFile, normalizeImage } from '../lib/imageFile'
import { BANNERS, applyBanner, type Banner } from '../lib/testBanner'
import Avatar from './Avatar'
import Select from './Select'

const MAX = 2000
const canReadClipboard = typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function'

export default function Composer({ onPosted }: { onPosted: (status: string) => void }) {
  const { me } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<Banner>('none')
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const text = useRef<HTMLTextAreaElement>(null)

  const pick = useCallback(async (f: File | null) => {
    if (f && !isImageFile(f)) { toast('That file is not a photo.', 'error'); return }
    const img = f ? await normalizeImage(f) : null
    setFile(img)
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return img ? URL.createObjectURL(img) : null })
    if (!img) setBanner('none')
    if (input.current) input.current.value = ''
  }, [])

  // Paste a copied photo (from Instagram, WhatsApp, a screenshot...) anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null
      const otherField = t && t !== text.current && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      const img = otherField ? null : imageFromTransfer(e.clipboardData)
      if (!img) return
      e.preventDefault()
      pick(img)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [pick])

  useEffect(() => { // grow the text box with its content
    const el = text.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }, [caption])

  async function pasteButton() {
    try {
      const img = await imageFromClipboard()
      if (img) pick(img)
      else toast('No photo on the clipboard. Copy a photo first.', 'info')
    } catch {
      toast('Clipboard access was blocked. Long-press the text box and choose Paste instead.', 'info')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if ((!file && !caption.trim()) || busy) return
    setBusy(true)
    const fd = new FormData()
    if (file) fd.append('image', banner === 'none' ? file : await applyBanner(file, banner))
    fd.append('caption', caption)
    try {
      const r = await api<{ post_id: string; status: string }>('/api/posts', { method: 'POST', body: fd })
      toast(r.status === 'published' ? 'Posted' : 'Your post is under review', r.status === 'published' ? 'success' : 'info')
      pick(null); setCaption('')
      onPosted(r.status)
    } finally {
      setBusy(false)
    }
  }

  const left = MAX - caption.length
  return (
    <form onSubmit={submit} aria-label="Create a post"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); pick(imageFromTransfer(e.dataTransfer)) }}
      className={`rounded-[20px] border border-line bg-white px-4 pb-3 pt-3.5 transition ${dragging ? 'bg-primary/5 ring-2 ring-inset ring-primary' : ''}`}>
      <div className="flex gap-3">
        <Avatar name={me?.display_name ?? ''} handle={me?.handle ?? ''} />
        <div className="min-w-0 flex-1">
          <label htmlFor="caption" className="sr-only">Post text</label>
          <textarea id="caption" ref={text} rows={2} maxLength={MAX} value={caption} onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e) }}
            placeholder={`What's on your mind${me?.display_name ? `, ${me.display_name.split(' ')[0]}` : ''}?`}
            className="block w-full resize-none bg-transparent py-2 text-base placeholder:text-muted focus:outline-none" />
          {preview && (
            <div className="relative mt-2 overflow-hidden rounded-2xl border border-line">
              {banner !== 'none' && (
                <span className="absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white">
                  {BANNERS.find((b) => b.value === banner)?.label} will be added
                </span>
              )}
              <img src={preview} alt="Selected photo" className="max-h-80 w-full object-cover" />
              <button type="button" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
                aria-label="Remove photo" onClick={() => pick(null)}>
                <MdClose size={18} />
              </button>
            </div>
          )}
          {file && (
            <div className="mt-2">
              <Select label="Test banner" value={banner} options={BANNERS.map((b) => ({ value: b.value, label: b.label }))}
                onChange={(v) => {
                  const b = v as Banner
                  setBanner(b)
                  const cap = BANNERS.find((x) => x.value === b)?.caption
                  if (cap && !caption) setCaption(cap)
                }} />
            </div>
          )}
          {dragging && <p className="mt-2 text-sm font-medium text-primary">Drop the photo to add it</p>}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-surface pt-2.5">
        <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-medium text-ink transition hover:bg-gray-200 focus-within:ring-3 focus-within:ring-primary/30" title="Add a photo">
          <MdOutlineImage size={20} className="text-primary" aria-hidden />
          Photo
          {/* image/* lets iPhone convert HEIC to JPEG on pick */}
          <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        {canReadClipboard && (
          <button type="button" className="icon-btn bg-surface text-primary hover:bg-gray-200" onClick={pasteButton} aria-label="Paste a copied photo" title="Paste a copied photo">
            <MdContentPaste size={20} />
          </button>
        )}
        <span className="flex-1" />
        {left <= 200 && <span className={`mr-2 text-xs tabular-nums ${left <= 20 ? 'text-danger' : 'text-muted'}`} aria-live="polite">{left}</span>}
        <button className="btn-primary px-6 py-1.5" disabled={(!file && !caption.trim()) || busy}>{busy ? 'Checking...' : 'Post'}</button>
      </div>
    </form>
  )
}
