export type Language = 'en' | 'ms' | 'zh'

export interface Me {
  uid: string
  email: string
  is_admin: boolean
  profile_complete: boolean
  display_name: string
  handle: string
  preferred_language: Language
  protection: { status: 'none' | 'active'; enrolled_at: string | null; template_version: string | null }
  account_age_days: number
  is_demo: boolean
}
