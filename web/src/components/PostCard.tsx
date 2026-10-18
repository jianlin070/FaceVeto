import { useState } from 'react'
import { MdBlock, MdDeleteOutline, MdHourglassTop, MdMoreHoriz, MdOutlineEdit } from 'react-icons/md'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { Post } from '../lib/types'
import { timeAgo } from '../lib/format'
import AuthImage from './AuthImage'
import Avatar from './Avatar'
import ConfirmDialog from './ConfirmDialog'
import Menu, { MenuItem } from './Menu'

export default function PostCard({ post, showStatus, onChange, onDelete }: {
  post: Post; showStatus?: boolean; onChange: (p: Post) => void; onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const hidden = post.status !== 'published'
  const name = post.author_display_name || post.author_handle
  // Posts under review are locked until the decision is made.
  const canManage = post.is_mine && post.status !== 'under_review' && post.status !== 'processing'
  const big = !post.image_url && post.caption.length <= 120 && !post.caption.includes('\n')

  async function save() {
    if (editing === null) return
    setBusy(true)
    try {
      const r = await api<{ status: Post['status'] }>(`/api/posts/${post.post_id}`, { method: 'PATCH', body: JSON.stringify({ caption: editing }) })
      toast(r.status === 'published' ? 'Post updated' : 'Your edit is under review', r.status === 'published' ? 'success' : 'info')
      onChange({ ...post, caption: editing.trim(), status: r.status, edited: true })
      setEditing(null)
    } finally { setBusy(false) }
  }

  async function del() {
    setBusy(true)
    try {
      await api(`/api/posts/${post.post_id}`, { method: 'DELETE' })
      toast('Post deleted', 'success')
      setConfirmDelete(false)
      onDelete(post.post_id)
    } finally { setBusy(false) }
  }

  return (
    <article className="overflow-hidden rounded-[20px] border border-line bg-white" aria-label={`Post by ${name}`}>
      <header className="flex items-center gap-3 py-3.5 pl-4 pr-2">
        <Avatar name={post.author_display_name} handle={post.author_handle} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{name}</p>
          <p className="truncate text-xs text-muted">
            @{post.author_handle} · <time dateTime={post.created_at ?? undefined} title={post.created_at ? new Date(post.created_at).toLocaleString() : undefined}>{timeAgo(post.created_at)}</time>
            {post.edited && ' · Edited'}
          </p>
        </div>
        {showStatus && post.status === 'under_review' && (
          <span className="mr-2 flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-amber-900"><MdHourglassTop aria-hidden />Under review</span>
        )}
        {showStatus && post.status === 'removed' && (
          <span className="mr-2 flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger"><MdBlock aria-hidden />Removed</span>
        )}
        {canManage && (
          <Menu label="Post options" trigger={<MdMoreHoriz size={22} />}>
            {(close) => (
              <>
                {post.status === 'published' && (
                  <MenuItem icon={<MdOutlineEdit />} onSelect={() => { close(); setEditing(post.caption) }}>Edit text</MenuItem>
                )}
                <MenuItem icon={<MdDeleteOutline />} danger onSelect={() => { close(); setConfirmDelete(true) }}>Delete post</MenuItem>
              </>
            )}
          </Menu>
        )}
      </header>

      {editing !== null ? (
        <div className="px-4 pb-4">
          <label htmlFor={`edit-${post.post_id}`} className="sr-only">Edit post text</label>
          <textarea id={`edit-${post.post_id}`} className="input resize-none text-base" rows={3} maxLength={2000} autoFocus
            value={editing} onChange={(e) => setEditing(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null) }} />
          {post.image_url && <p className="mt-1 text-xs text-muted">Edited posts are checked again before they update.</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost py-1.5" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button type="button" className="btn-primary py-1.5" onClick={save}
              disabled={busy || editing.trim() === post.caption || (!post.image_url && !editing.trim())}>
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : post.caption && (
        <p className={`whitespace-pre-wrap break-words px-4 ${post.image_url ? 'pb-3' : 'pb-4'} ${big ? 'text-xl leading-snug' : 'text-[15px] leading-relaxed'}`}>{post.caption}</p>
      )}

      {post.image_url && (hidden ? (
        <div className="mx-4 mb-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-[13px] leading-relaxed text-muted">
          {post.status === 'under_review' ? <MdHourglassTop size={26} className="text-warning" aria-hidden /> : <MdBlock size={26} aria-hidden />}
          {post.status === 'under_review'
            ? 'This post is being reviewed before it goes live. You will see it here once a decision is made.'
            : 'This post is not available.'}
        </div>
      ) : (
        <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-surface">
          <AuthImage src={post.image_url} alt={post.caption ? `Photo: ${post.caption.slice(0, 80)}` : `Photo by @${post.author_handle}`}
            className="max-h-[560px] w-full object-cover" placeholderClassName="aspect-[4/3]" />
        </div>
      ))}
      {!post.image_url && hidden && showStatus && post.status === 'under_review' && (
        <p className="px-4 pb-4 text-sm text-muted">This post is being reviewed before it goes live.</p>
      )}

      <ConfirmDialog open={confirmDelete} title="Delete this post?" confirmLabel="Delete" danger busy={busy}
        onConfirm={del} onCancel={() => setConfirmDelete(false)}>
        It will be removed from Lepak for everyone. This cannot be undone.
      </ConfirmDialog>
    </article>
  )
}
