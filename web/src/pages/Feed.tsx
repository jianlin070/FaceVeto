import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MdChevronRight, MdShield } from 'react-icons/md'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Post } from '../lib/types'
import Composer from '../components/Composer'
import PostCard from '../components/PostCard'

function PostSkeleton() {
  return (
    <div className="border-b border-line p-4" aria-hidden>
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2"><div className="skeleton h-3 w-32" /><div className="skeleton h-3 w-20" /></div>
      </div>
      <div className="skeleton mt-3 h-3 w-3/4" />
      <div className="skeleton mt-3 aspect-[4/3] w-full rounded-2xl" />
    </div>
  )
}

export default function Feed() {
  const { me } = useAuth()
  const nav = useNavigate()
  const [posts, setPosts] = useState<Post[] | null>(null)

  const load = useCallback(async () => {
    try {
      setPosts(await api<Post[]>('/api/feed'))
    } catch { setPosts([]) }
  }, [])

  useEffect(() => { load() }, [load])

  function changed(p: Post) {
    // A post that went back under review leaves the public feed; it stays on the author's profile.
    setPosts((xs) => xs && (p.status !== 'published' ? xs.filter((x) => x.post_id !== p.post_id) : xs.map((x) => x.post_id === p.post_id ? p : x)))
  }

  return (
    <div>
      {me?.protection.status !== 'active' && (
        <Link to="/enrol" className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-primary/10 p-3 text-sm text-primary">
          <MdShield size={26} className="shrink-0" aria-hidden />
          <span className="flex-1"><b>Protect your face.</b> Stop strangers using your photos in scams and gambling ads.</span>
          <MdChevronRight size={22} className="shrink-0" aria-hidden />
        </Link>
      )}
      <Composer onPosted={(s) => { if (s === 'published') load(); else nav('/profile') }} />
      {posts === null ? (
        <div role="status" aria-label="Loading posts"><PostSkeleton /><PostSkeleton /></div>
      ) : posts.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted">Nothing here yet. Be the first to post.</p>
      ) : posts.map((p) => (
        <PostCard key={p.post_id} post={p} onChange={changed}
          onDelete={(id) => setPosts((xs) => xs && xs.filter((x) => x.post_id !== id))} />
      ))}
    </div>
  )
}
