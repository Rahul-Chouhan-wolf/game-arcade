// ─── Singularity · gravity math (pure) ───────────────────────────────────────
// The heavy per-particle integration runs on the GPU (see render/shaders);
// these pure helpers document the model and are unit-testable.

import { G, SOFTENING, SWIRL } from '../utils/constants'

export interface Vec2 { x: number; y: number }

/** Newtonian-ish acceleration toward a mass at `src`, softened near r→0. */
export function gravityAccel(px: number, py: number, sx: number, sy: number, mass: number): Vec2 {
  const dx = sx - px, dy = sy - py
  const r2 = dx * dx + dy * dy + SOFTENING * SOFTENING
  const inv = 1 / Math.sqrt(r2)
  const a = (G * mass) / r2
  return { x: a * dx * inv, y: a * dy * inv }
}

/** Tangential (perpendicular) component that turns infall into orbital swirl. */
export function swirlAccel(px: number, py: number, sx: number, sy: number, mass: number): Vec2 {
  const dx = sx - px, dy = sy - py
  const r2 = dx * dx + dy * dy + SOFTENING * SOFTENING
  const inv = 1 / Math.sqrt(r2)
  const a = (G * SWIRL * mass) / r2
  // perpendicular to the radial direction
  return { x: -a * dy * inv, y: a * dx * inv }
}
