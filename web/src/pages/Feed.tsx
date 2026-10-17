import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdShield } from 'react-icons/md'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Post } from '../lib/types'
import Composer from '../components/Composer'
import PostCard from '../components/PostCard'
import Spinner from '../components/Spinner'

export default function Feed() {
  const { me } = useAuth()
  const [tab, setTab] = useState<'feed' | 'mine'>('feed')
  const [posts, setPosts] = useState<Post[] | null>(null)

  const load = useCallback(async (which: 'feed' | 'mine') => {
    setPosts(null)
    try {
      setPosts(await api<Post[]>(which === 'feed' ? '/api/feed' : '/api/posts/mine'))
    } catch { setPosts([]) }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  return (
    <div>
      {me?.protection.status !== 'active' && (
        <Link to="/enrol" className="m-3 flex items-center gap-3 rounded-xl bg-primary/10 p-3 text-sm text-primary">
          <MdShield size={24} aria-hidden />
          <span><b>Protect your face.</b> Stop strangers using your photos in scams and gambling ads.</span>
        </Link>
      )}
      <Composer onPosted={(s) => { if (s !== 'published' || tab === 'mine') load('mine'); else load('feed'); if (s !== 'published') setTab('mine') }} />
      <div className="flex border-b border-gray-200" role="tablist">
        {(['feed', 'mine'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted'}`}>
            {t === 'feed' ? 'Feed' : 'My posts'}
          </button>
        ))}
      </div>
      {posts === null ? <Spinner /> : posts.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">{tab === 'feed' ? 'Nothing here yet. Be the first to post.' : 'You have not posted yet.'}</p>
      ) : posts.map((p) => <PostCard key={p.post_id} post={p} showStatus={tab === 'mine'} />)}
    </div>
  )
}
