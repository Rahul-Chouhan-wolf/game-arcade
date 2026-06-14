import type { RGB } from '../types'

// ─── Element Flow · colour palette ───────────────────────────────────────────
// Electric Blue, Purple, Pink, Cyan, Orange, Emerald, Magenta, Golden Yellow.

export const PALETTE: RGB[] = [
  { r: 0.15, g: 0.45, b: 1.0 },   // electric blue
  { r: 0.55, g: 0.2,  b: 0.95 },  // purple
  { r: 1.0,  g: 0.3,  b: 0.65 },  // pink
  { r: 0.1,  g: 0.85, b: 0.95 },  // cyan
  { r: 1.0,  g: 0.55, b: 0.15 },  // orange
  { r: 0.15, g: 0.85, b: 0.55 },  // emerald
  { r: 0.9,  g: 0.15, b: 0.85 },  // magenta
  { r: 1.0,  g: 0.82, b: 0.2 },   // golden yellow
]

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r = 0, g = 0, b = 0
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return { r, g, b }
}

/** Pick a palette colour, optionally nudged toward a freshly generated hue. */
export function pickColor(randomness: number): RGB {
  if (Math.random() < randomness) {
    // Vivid generated hue — bright, saturated, never muddy.
    return hsvToRgb(Math.random(), 0.85, 1.0)
  }
  const base = PALETTE[(Math.random() * PALETTE.length) | 0]
  // Slight value jitter keeps repeated clicks from looking flat.
  const k = 0.85 + Math.random() * 0.15
  return { r: base.r * k, g: base.g * k, b: base.b * k }
}

/** Two-stop gradient pair for occasional gradient splats. */
export function pickGradient(randomness: number): [RGB, RGB] {
  const a = pickColor(randomness)
  const b = pickColor(Math.min(1, randomness + 0.4))
  return [a, b]
}

/** Scale a colour's intensity (dye splats are pushed bright for bloom). */
export function scaleColor(c: RGB, k: number): [number, number, number] {
  return [c.r * k, c.g * k, c.b * k]
}
