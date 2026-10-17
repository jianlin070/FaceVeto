import type { Language } from '../lib/types'

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
        <div className="flex items-center rounded-lg border border-gray-300 bg-white focus-within:border-primary">
          <span className="pl-3 text-muted">@</span>
          <input id="handle" className="w-full rounded-lg px-1 py-2 focus:outline-none" required pattern="[a-z0-9_]{3,20}"
            title="3 to 20 lowercase letters, numbers or underscores" value={v.handle}
            onChange={(e) => set({ ...v, handle: e.target.value.toLowerCase() })} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="lang">Preferred language for alerts</label>
        <select id="lang" className="input" value={v.preferred_language}
          onChange={(e) => set({ ...v, preferred_language: e.target.value as Language })}>
          {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>
    </>
  )
}
