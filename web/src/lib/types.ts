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

export interface Post {
  post_id: string
  author_handle: string
  author_display_name: string
  caption: string
  status: 'published' | 'under_review' | 'removed' | 'processing'
  created_at: string | null
  image_url: string | null
  is_mine: boolean
  edited: boolean
}

export type CaseStatus = 'awaiting_owner' | 'owner_not_me' | 'owner_its_me' | 'removed' | 'released'

export interface OwnerCase {
  case_id: string
  post_id: string
  status: CaseStatus
  category: string
  severity: string
  created_at: string | null
  caption: string
  image_url: string
  title: string
  body: string
  reason: string
  owner_response: 'not_me' | 'its_me' | null
  admin_action: 'takedown' | 'release' | null
}

export interface Notification {
  id: string
  type: 'held_post' | 'fyi_appearance' | 'case_update'
  title: string
  body: string
  case_id: string | null
  post_id: string | null
  read: boolean
  created_at: string | null
}

export interface HarmAssessment {
  is_harmful: boolean
  category: string
  severity: 'none' | 'low' | 'medium' | 'high'
  confidence: number
  text_in_image: string
  languages: string[]
  evidence: string[]
  reasoning: string
  recommended_action: string
}

export interface AdminCaseRow {
  case_id: string
  post_id: string
  status: CaseStatus
  category: string
  severity: string
  confidence: number | null
  similarity: number | null
  created_at: string | null
  owner_handle: string
  poster_handle: string
  owner_response: string | null
}

export interface AdminCase {
  case_id: string
  status: CaseStatus
  similarity: number | null
  category: string
  severity: string
  confidence: number | null
  created_at: string | null
  owner_response: { value: string; at: string | null } | null
  admin_action: { value: string; by: string; at: string | null; note: string } | null
  has_evidence: boolean
  allowed_actions: ('takedown' | 'release')[]
  admin_handle: string | null
  owner: { handle: string; display_name: string }
  post: {
    post_id: string
    status: string
    caption: string
    image_url: string
    created_at: string | null
    poster_handle: string
    poster_account_age_days: number
    faces_detected: number
    decision: { action: string; reason: string; policy_version: string } | null
    assessment: HarmAssessment | null
    scan: { latency_ms: number | null; detect_ms: number | null; match_ms: number | null; gemini_called: boolean; gemini_latency_ms: number | null; gemini_error: string | null
      agent_ms?: number | null; agent_trace?: AgentStep[] | null }
  }
  timeline: { action: string; actor: string; at: string | null; details: Record<string, unknown> }[]
}

export interface Stats {
  posts_scanned: number
  published: number
  held: number
  removed: number
  released: number
  held_total: number
  gemini_calls: number
  scan_latency_ms: { p50: number | null; p95: number | null; mean: number | null }
  gemini_latency_ms: { p50: number | null; p95: number | null }
}

export interface AgentStep {
  step: 'call' | 'result' | 'final' | 'error' | 'fallback'
  tool?: string
  args?: Record<string, unknown>
  result?: Record<string, unknown>
  text?: string
  at_ms?: number
}
