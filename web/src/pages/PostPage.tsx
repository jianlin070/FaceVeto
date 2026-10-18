import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MdArrowBack, MdHideImage } from 'react-icons/md'
import { api } from '../lib/api'
import type { Post } from '../lib/types'
import PostCard from '../components/PostCard'
import Spinner from '../components/Spinner'

/** One post, opened from an alert or a link. Held, removed and deleted posts answer "not available". */
export default function PostPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [post, setPost] = useState<Post | null | 'gone'>(null)

  useEffect(() => {
    setPost(null)
    api<Post>(`/api/posts/${encodeURIComponent(id)}`, { quiet: true }).then(setPost).catch(() => setPost('gone'))
  }, [id])

  // Back to wherever the post was opened from; a shared link with no history goes to the feed.
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/feed'))

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-line px-2 py-2">
        <button className="icon-btn" onClick={back} aria-label="Back"><MdArrowBack size={22} /></button>
        <h1 className="text-lg font-bold">Post</h1>
      </div>
      {post === null ? <Spinner /> : post === 'gone' ? (
        <div className="px-6 py-14 text-center text-muted">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface" aria-hidden><MdHideImage size={28} /></span>
          <p className="mt-3 font-semibold text-ink">This post is no longer available</p>
          <p className="mt-1 text-sm">It may have been taken down, deleted, or still be under review.</p>
        </div>
      ) : (
        <PostCard post={post} showStatus={post.is_mine} onChange={setPost} onDelete={() => nav('/feed', { replace: true })} />
      )}
    </div>
  )
}
