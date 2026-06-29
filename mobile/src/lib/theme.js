// Shared palette + status tones for the mobile UI (MICO360 red branding), with
// light and dark schemes. `colors` and `tones` are live bindings reassigned by
// applyScheme(); screens read them at render time and re-render on scheme change
// (the ThemeProvider remounts the tree), so most screens need no theme plumbing.

const light = {
  brand: '#b3171e',
  brandDark: '#7f1d1d',
  bg: '#f1f5f9',
  card: '#ffffff',
  subtle: '#f8fafc', // pressed rows / zebra / chips
  border: '#e2e8f0',
  track: '#e2e8f0', // progress/bar track
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  danger: '#dc2626',
  success: '#15803d',
}

const dark = {
  brand: '#ef4444',
  brandDark: '#7f1d1d',
  bg: '#0b1220',
  card: '#1e293b',
  subtle: '#172033',
  border: '#334155',
  track: '#334155',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  danger: '#f87171',
  success: '#4ade80',
}

const tonesLight = {
  green: { bg: '#dcfce7', fg: '#15803d' },
  amber: { bg: '#fef3c7', fg: '#b45309' },
  red: { bg: '#fee2e2', fg: '#b91c1c' },
  blue: { bg: '#dbeafe', fg: '#1d4ed8' },
  slate: { bg: '#f1f5f9', fg: '#475569' },
}

const tonesDark = {
  green: { bg: '#064e3b', fg: '#6ee7b7' },
  amber: { bg: '#78350f', fg: '#fcd34d' },
  red: { bg: '#7f1d1d', fg: '#fca5a5' },
  blue: { bg: '#1e3a8a', fg: '#93c5fd' },
  slate: { bg: '#334155', fg: '#cbd5e1' },
}

// Live bindings — reassigned by applyScheme(). Default to light.
export let colors = light
export let tones = tonesLight

export function applyScheme(scheme) {
  const dk = scheme === 'dark'
  colors = dk ? dark : light
  tones = dk ? tonesDark : tonesLight
  return colors
}

export function schemeColors(scheme) {
  return scheme === 'dark' ? dark : light
}
