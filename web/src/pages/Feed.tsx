import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdChevronRight, MdShield } from 'react-icons/md'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Post } from '../lib/types'
import Composer from '../components/Composer'
import PostCard from '../components/PostCard'

function PostSkeleton() {
  return (
    <div className="rounded-[20px] border border-line bg-white p-4" aria-hidden>
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2"><div className="skeleton h-3 w-32" /><div className="skeleton h-3 w-20" /></div>
      </div>
      <div className="skeleton mt-3 h-3 w-3/4" />
      <div className="skeleton mt-3 aspect-[4/3] w-full rounded-2xl" />
    </div>
  )
}

const TABS = [{ value: 'all', label: 'Everyone' }, { value: 'mine', label: 'Your posts' }] as const

export default function Feed() {
  const { me } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'mine' ? 'mine' : 'all'
  const [posts, setPosts] = useState<Post[] | null>(null)

  const load = useCallback(async () => {
    try {
      if (tab === 'mine') { setPosts(await api<Post[]>('/api/posts/mine')); return }
      // Your own posts that are still under review appear in your feed (only you see them), like other apps do.
      const [feed, mine] = await Promise.all([api<Post[]>('/api/feed'), api<Post[]>('/api/posts/mine', { quiet: true }).catch(() => [])])
      const pending = mine.filter((p) => p.status === 'under_review' || p.status === 'processing')
      setPosts([...pending, ...feed].sort((a, b) => Date.parse(b.created_at ?? '0') - Date.parse(a.created_at ?? '0')))
    } catch { setPosts([]) }
  }, [tab])

  useEffect(() => { setPosts(null); load() }, [load])

  function changed(p: Post) {
    setPosts((xs) => xs && xs.map((x) => x.post_id === p.post_id ? p : x))
  }

  return (
    <div className="space-y-3 p-3">
      {me?.protection.status !== 'active' && (
        <Link to="/enrol" className="flex items-center gap-3 rounded-[20px] bg-primary p-4 text-white shadow-lg shadow-primary/25 transition hover:bg-primary-dark">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20" aria-hidden><MdShield size={22} /></span>
          <span className="flex-1 text-sm leading-snug"><b className="block text-[15px]">Protect your face</b>Stop strangers using your photos in scams and gambling ads.</span>
          <MdChevronRight size={22} className="shrink-0" aria-hidden />
        </Link>
      )}
      <Composer onPosted={load} />
      <div role="tablist" aria-label="Posts"
        className="sticky top-[calc(3.75rem+env(safe-area-inset-top)+0.5rem)] z-10 flex rounded-full border border-line bg-white/95 p-1 backdrop-blur">
        {TABS.map((t) => (
          <button key={t.value} role="tab" aria-selected={tab === t.value}
            onClick={() => setParams(t.value === 'all' ? {} : { tab: t.value }, { replace: true })}
            className={`min-h-9 flex-1 rounded-full text-sm font-medium transition ${tab === t.value ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {posts === null ? (
        <div role="status" aria-label="Loading posts" className="space-y-3"><PostSkeleton /><PostSkeleton /></div>
      ) : posts.length === 0 ? (
        <p className="rounded-[20px] border border-line bg-white p-10 text-center text-sm text-muted">{tab === 'mine' ? 'You have not posted yet.' : 'Nothing here yet. Be the first to post.'}</p>
      ) : posts.map((p) => (
        <PostCard key={p.post_id} post={p} showStatus={tab === 'mine' || p.is_mine} onChange={changed}
          onDelete={(id) => setPosts((xs) => xs && xs.filter((x) => x.post_id !== id))} />
      ))}
    </div>
  )
}
