/**
 * The FaceVeto mark: a person whose shoulders form a V.
 * animated: a short build-in on mount; 'intro': the slower build used by the landing intro.
 */
export default function Logo({ size = 36, animated = false, className = '' }: { size?: number; animated?: boolean | 'intro'; className?: string }) {
  const motion = animated === 'intro' ? 'logo-intro' : animated ? 'logo-animated' : ''
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={`shrink-0 ${motion} ${className}`}>
      <rect className="logo-tile" width="32" height="32" rx="8" fill="#1A73E8" />
      <circle className="logo-head" cx="16" cy="10.6" r="3.4" fill="#fff" />
      <path className="logo-v" d="M8.6 14.6L16 23.6L23.4 14.6" pathLength={1} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
