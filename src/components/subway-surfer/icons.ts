// ─── Rail Runner · shared inline-SVG icon art ────────────────────────────────
// Detailed, original vector icons used in BOTH the 3D pickup chips (rasterised
// to textures) and the React HUD/menu, so the look stays consistent.

import type { PowerupType } from '@/lib/subway-surfer/powerups'

export const POWERUP_TINT: Record<PowerupType, string> = {
  magnet:     '#e34234',
  jetpack:    '#3a7bc8',
  multiplier: '#e8a020',
  sneakers:   '#22a65a',
}

// Inner icon art, drawn inside a 0 0 100 100 viewBox. White-on-color glyphs
// with soft shading so they read at chip size.
export function powerupGlyph(kind: PowerupType): string {
  switch (kind) {
    case 'magnet':
      return `
        <defs>
          <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ff6f5e"/><stop offset="1" stop-color="#c62a1d"/>
          </linearGradient>
        </defs>
        <g transform="translate(50 54)">
          <path d="M -26 -22 A 26 26 0 0 1 26 -22 L 26 6 A 26 26 0 0 1 -26 6 Z"
                fill="none" stroke="#fff" stroke-width="15"/>
          <path d="M -26 -22 A 26 26 0 0 1 26 -22 L 26 6 A 26 26 0 0 1 -26 6 Z"
                fill="none" stroke="url(#mg)" stroke-width="9"/>
          <rect x="-34" y="-30" width="16" height="16" rx="2" fill="#d7dde6"/>
          <rect x="18" y="-30" width="16" height="16" rx="2" fill="#3a4250"/>
          <rect x="-34" y="0" width="16" height="14" rx="2" fill="#d7dde6"/>
          <rect x="18" y="0" width="16" height="14" rx="2" fill="#3a4250"/>
        </g>`
    case 'jetpack':
      return `
        <defs>
          <linearGradient id="jb" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#dfe6ee"/><stop offset="0.5" stop-color="#fff"/><stop offset="1" stop-color="#c2ccd8"/>
          </linearGradient>
        </defs>
        <g transform="translate(50 50)">
          <path d="M 0 -34 C 16 -22 18 0 12 20 L -12 20 C -18 0 -16 -22 0 -34 Z" fill="url(#jb)" stroke="#9aa6b4" stroke-width="2"/>
          <circle cx="0" cy="-8" r="7" fill="#7cc4ef" stroke="#3a7bc8" stroke-width="2.5"/>
          <path d="M -12 14 L -22 26 L -12 22 Z" fill="#e8542e"/>
          <path d="M 12 14 L 22 26 L 12 22 Z" fill="#e8542e"/>
          <path d="M -9 22 C -6 36 6 36 9 22 C 5 30 -5 30 -9 22 Z" fill="#ffb020"/>
          <path d="M -5 24 C -3 33 3 33 5 24 C 3 29 -3 29 -5 24 Z" fill="#ffe08a"/>
        </g>`
    case 'multiplier':
      return `
        <g transform="translate(50 52)">
          <g stroke="#ffe7a0" stroke-width="4" stroke-linecap="round">
            <line x1="0" y1="-30" x2="0" y2="-40"/>
            <line x1="21" y1="-21" x2="28" y2="-28"/>
            <line x1="30" y1="0" x2="40" y2="0"/>
            <line x1="21" y1="21" x2="28" y2="28"/>
            <line x1="0" y1="30" x2="0" y2="40"/>
            <line x1="-21" y1="21" x2="-28" y2="28"/>
            <line x1="-30" y1="0" x2="-40" y2="0"/>
            <line x1="-21" y1="-21" x2="-28" y2="-28"/>
          </g>
          <text x="0" y="15" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="46" fill="#fff" stroke="#a86a08" stroke-width="2" paint-order="stroke">×2</text>
        </g>`
    case 'sneakers':
      return `
        <g transform="translate(50 52)">
          <path d="M -32 8 C -30 14 24 16 32 8 C 34 4 30 -2 18 -4 L 4 -14 C -2 -8 -10 -6 -18 -6 C -26 -6 -32 0 -32 8 Z"
                fill="#fff" stroke="#cfd6df" stroke-width="2"/>
          <path d="M -32 8 C -30 14 24 16 32 8 L 32 12 C 24 19 -30 17 -32 12 Z" fill="#2aa65a"/>
          <path d="M 4 -14 L 8 -6 M -6 -10 L -2 -2 M -16 -7 L -13 0" stroke="#cfd6df" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M -18 -6 L -40 -22 L -22 -14 L -34 -30 L -14 -16 Z" fill="#bfe9d2" stroke="#7fd0a6" stroke-width="1.5"/>
        </g>`
  }
}

// Backpack rear face — textured onto the runner's pack (camera-facing side).
export function backpackSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bp" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f29b2e"/><stop offset="1" stop-color="#c9701a"/>
      </linearGradient>
      <linearGradient id="pk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e98e22"/><stop offset="1" stop-color="#bd6614"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#bp)"/>
    <rect x="8" y="6" width="84" height="88" rx="18" fill="url(#bp)" stroke="#8f4e10" stroke-width="2.5"/>
    <!-- top grab handle -->
    <path d="M 40 8 Q 50 -2 60 8" fill="none" stroke="#8f4e10" stroke-width="5" stroke-linecap="round"/>
    <!-- top lid seam + zipper -->
    <path d="M 12 34 Q 50 26 88 34" fill="none" stroke="#7c440e" stroke-width="3"/>
    <path d="M 12 34 Q 50 26 88 34" fill="none" stroke="#ffd27a" stroke-width="1.2" stroke-dasharray="2 3"/>
    <!-- front pocket -->
    <rect x="24" y="46" width="52" height="36" rx="10" fill="url(#pk)" stroke="#8f4e10" stroke-width="2.5"/>
    <path d="M 28 56 Q 50 50 72 56" fill="none" stroke="#7c440e" stroke-width="2.5"/>
    <circle cx="50" cy="56" r="3" fill="#ffd27a"/>
    <!-- side compression straps -->
    <rect x="6" y="52" width="8" height="20" rx="2" fill="#5f3a12"/>
    <rect x="86" y="52" width="8" height="20" rx="2" fill="#5f3a12"/>
    <!-- logo patch -->
    <circle cx="50" cy="66" r="7" fill="#fff" opacity="0.92"/>
    <path d="M 46 66 L 50 61 L 54 66 L 50 71 Z" fill="#e34234"/>
  </svg>`
}

// Cap emblem — small lightning badge shown on the back of the runner's cap.
export function capLogoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="#ffd84d" stroke="#fff" stroke-width="7"/>
    <path d="M 57 16 L 32 55 L 47 55 L 41 84 L 70 43 L 53 43 Z" fill="#d92b20" stroke="#8f1810" stroke-width="3" stroke-linejoin="round"/>
  </svg>`
}

// Full chip SVG (rounded square + glyph) for the in-world 3D pickup texture.
export function powerupChipSvg(kind: PowerupType): string {
  const tint = POWERUP_TINT[kind]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="chip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.32"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="84" height="84" rx="20" fill="${tint}"/>
    <rect x="8" y="8" width="84" height="84" rx="20" fill="url(#chip)"/>
    <rect x="8" y="8" width="84" height="84" rx="20" fill="none" stroke="#fff" stroke-width="5" stroke-opacity="0.92"/>
    ${powerupGlyph(kind)}
  </svg>`
}
