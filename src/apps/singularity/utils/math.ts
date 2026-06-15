// ─── Singularity · pure math helpers ─────────────────────────────────────────

export type Level = 'low' | 'medium' | 'high'

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const mix3 = (
  a: [number, number, number], b: [number, number, number], t: number,
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

// Mass → event-horizon radius and accretion-disk radius (clip-space units).
export function horizonRadius(mass: number, k: number) { return k * Math.sqrt(mass) }

// Colour evolves with mass: cyan → magenta → orange → white-hot blue-edged.
export function massColor(mass: number): [number, number, number] {
  const CYAN: [number, number, number]    = [0.25, 0.75, 1.0]
  const MAGENTA: [number, number, number] = [0.8, 0.3, 1.0]
  const ORANGE: [number, number, number]  = [1.0, 0.55, 0.15]
  const WHITE: [number, number, number]   = [1.0, 0.95, 0.85]
  const m = clamp(mass / 3.2, 0, 1)
  if (m < 0.33) return mix3(CYAN, MAGENTA, m / 0.33)
  if (m < 0.66) return mix3(MAGENTA, ORANGE, (m - 0.33) / 0.33)
  return mix3(ORANGE, WHITE, (m - 0.66) / 0.34)
}

// Mulberry32 — small seeded PRNG for reproducible "universe seeds".
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
