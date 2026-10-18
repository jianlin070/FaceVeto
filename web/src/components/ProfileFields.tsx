import type { Language } from '../lib/types'
import Select from './Select'

export interface ProfileValues { display_name: string; handle: string; preferred_language: Language }

export const LANGS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'zh', label: '中文' },
]

export function suggestHandle(s: string) {
  return s.toLowerCase().replace(/@.*/, '').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 20).padEnd(3, '0')
}

export default function ProfileFields({ v, set }: { v: ProfileValues; set: (v: ProfileValues) => void }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="display_name">Display name</label>
        <input id="display_name" className="input" required maxLength={60} value={v.display_name}
          onChange={(e) => set({ ...v, display_name: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="handle">Handle</label>
        <div className="flex items-center rounded-xl border border-gray-300 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <span className="pl-3 text-muted">@</span>
          <input id="handle" className="w-full rounded-xl px-1 py-2.5 focus:outline-none" required pattern="[a-z0-9_]{3,20}"
            title="3 to 20 lowercase letters, numbers or underscores" value={v.handle}
            onChange={(e) => set({ ...v, handle: e.target.value.toLowerCase() })} />
        </div>
      </div>
      <div>
        <p className="label">Preferred language for alerts</p>
        <Select label="Language" value={v.preferred_language} options={LANGS}
          onChange={(x) => set({ ...v, preferred_language: x as Language })} />
      </div>
    </>
  )
}
