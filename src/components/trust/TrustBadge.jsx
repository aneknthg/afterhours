/**
 * TrustBadge.jsx — INERT. Renders nothing in practice. Read this before wiring
 * anything to `trust_level` or wondering what it was for.
 *
 * Nothing writes `trust_level`: no migration, no edge function, no client path.
 * `guard_profile_trust_cols()` actively reverts client attempts to set it. As of
 * 2026-08-01 every profile in production is level 0, and the badge body is
 * behind `{level > 0 && ...}`, so it has never appeared on screen.
 *
 * The tiers below assume a product Afterhours didn't build: level 1 is phone
 * verification (never implemented — SMS OTP costs per message) and level 2 is
 * ID verification. The real trust signal is `verification_status`, set by the
 * verify-identity edge function after an AWS Face Liveness challenge.
 *
 * Deliberately NOT deleted. `trust_level` is referenced by the `public_profiles`
 * view and by `guard_profile_trust_cols()` (which also protects
 * verification_status), and it appears inside ~28 `.select(...)` strings across
 * both repos. A malformed select fails at runtime, not at build, so the cleanup
 * is riskier than the dead code it removes. Leaving the column costs nothing.
 *
 * If you do build reputation later, design the tiers around signals that exist
 * — liveness verified, events hosted, reviews received — not phone/ID. And
 * award it server-side; the guard trigger already assumes that.
 *
 * NB: `trust.service.js` is unrelated despite the name. It is reporting,
 * blocking and verification, all of which are live. Don't sweep it up with this.
 *
 * Usage:
 *   <TrustBadge level={2} />                     — standalone badge
 *   <TrustBadge level={2} size="lg" showLabel />  — with text label
 *
 * Wrap around an avatar to get the colored ring:
 *   <div className="relative">
 *     <Avatar ... />
 *     <TrustBadge level={profile.trust_level} size="sm" className="absolute -bottom-1 -right-1" />
 *   </div>
 */

const LEVELS = {
  0: {
    ring:  'border-outline',
    bg:    'bg-outline',
    icon:  null,
    label: 'New member',
    color: '#a18b90',
  },
  1: {
    ring:  'border-tertiary',
    bg:    'bg-tertiary',
    icon:  'phone_iphone',
    label: 'Phone verified',
    color: '#dfbeca',
  },
  2: {
    ring:  'border-secondary',
    bg:    'bg-secondary',
    icon:  'verified_user',
    label: 'ID verified',
    color: '#efb7c9',
  },
  3: {
    ring:  'border-primary',
    bg:    'bg-primary',
    icon:  'verified',
    label: 'Community trusted',
    color: '#ffb1c7',
  },
};

const SIZES = {
  sm: { badge: 'w-4 h-4', icon: 8, ring: 'border' },
  md: { badge: 'w-5 h-5', icon: 10, ring: 'border-[1.5px]' },
  lg: { badge: 'w-6 h-6', icon: 12, ring: 'border-2' },
};

export default function TrustBadge({ level = 0, size = 'md', showLabel = false, className = '' }) {
  const config = LEVELS[level] || LEVELS[0];
  const sz = SIZES[size] || SIZES.md;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} title={config.label}>
      {level > 0 && (
        <div
          className={`${sz.badge} rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}
        >
          {config.icon && (
            <span
              className="material-symbols-outlined text-white"
              style={{ fontSize: sz.icon, fontVariationSettings: "'FILL' 1" }}
            >
              {config.icon}
            </span>
          )}
        </div>
      )}
      {showLabel && (
        <span className="text-xs font-medium" style={{ color: config.color }}>
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * TrustRing — wraps an avatar with a colored border ring
 *
 * Usage:
 *   <TrustRing level={2} size="md">
 *     <div className="w-10 h-10 rounded-full bg-red-500 ..." />
 *   </TrustRing>
 */
export function TrustRing({ level = 0, size = 'md', children, className = '' }) {
  const config = LEVELS[level] || LEVELS[0];
  const ringWidth = size === 'lg' ? 'border-[3px]' : 'border-2';

  return (
    <div className={`relative inline-flex ${className}`}>
      <div className={`rounded-full ${ringWidth} ${config.ring} p-[2px]`}>
        {children}
      </div>
      {level >= 2 && (
        <div className={`absolute -bottom-0.5 -right-0.5 z-10`}>
          <TrustBadge level={level} size="sm" />
        </div>
      )}
    </div>
  );
}
