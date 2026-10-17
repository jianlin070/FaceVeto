import { MdHourglassTop, MdBlock } from 'react-icons/md'
import type { Post } from '../lib/types'
import { timeAgo } from '../lib/format'
import AuthImage from './AuthImage'

export default function PostCard({ post, showStatus }: { post: Post; showStatus?: boolean }) {
  const hidden = post.status !== 'published'
  return (
    <article className="border-b border-gray-200 bg-white">
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary" aria-hidden>
          {(post.author_display_name || post.author_handle).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{post.author_display_name || post.author_handle}</p>
          <p className="text-xs text-muted">@{post.author_handle} · {timeAgo(post.created_at)}</p>
        </div>
        {showStatus && post.status === 'under_review' && (
          <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-ink"><MdHourglassTop aria-hidden />Under review</span>
        )}
        {showStatus && post.status === 'removed' && (
          <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"><MdBlock aria-hidden />Removed</span>
        )}
      </header>
      {post.caption && <p className="whitespace-pre-wrap px-4 pb-3 text-sm">{post.caption}</p>}
      {hidden ? (
        <div className="mx-4 mb-4 rounded-xl bg-surface p-6 text-center text-sm text-muted">
          {post.status === 'under_review'
            ? 'This post is being reviewed before it goes live. You will see it here once a decision is made.'
            : 'This post is not available.'}
        </div>
      ) : (
        <AuthImage src={post.image_url} alt={post.caption ? `Photo: ${post.caption.slice(0, 80)}` : `Photo by @${post.author_handle}`} className="aspect-square w-full object-cover" />
      )}
    </article>
  )
}
