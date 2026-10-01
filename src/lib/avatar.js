// Issue #18: single source of truth for avatar colours and initials.
// Import from here instead of copy-pasting into each file.
// Palette is derived from the primary colour ramp in tailwind.config.js.

export const AVATAR_PALETTE = [
  'bg-[#c94070]',
  'bg-[#a0395d]',
  'bg-[#7d2648]',
  'bg-[#633a49]',
  'bg-[#8b3a5a]',
  'bg-[#b5486a]',
];

/** Returns a deterministic Tailwind bg class for a given name string. */
export function avatarBg(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

/** Returns up to 2 uppercase initials from a display name. */
export function getInitials(name) {
  const initials = (name || 'U')
    .trim()
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || 'U';
}
