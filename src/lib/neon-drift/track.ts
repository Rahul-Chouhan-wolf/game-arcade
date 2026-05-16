// ─── Neon Drift · Track geometry ─────────────────────────────────────────────
// Circular track (torus cross-section).
// World origin at centre of the circle.

export const TRACK_RADIUS     = 500   // centreline radius (px)
export const TRACK_HALF_WIDTH = 100   // half the driveable width (px)

// ─── Collision ────────────────────────────────────────────────────────────────

/** Is world point (px, py) on the driveable track surface? */
export function isOnTrack(px: number, py: number): boolean {
  const d = Math.hypot(px, py)
  return d >= TRACK_RADIUS - TRACK_HALF_WIDTH && d <= TRACK_RADIUS + TRACK_HALF_WIDTH
}

/** Nearest point on the track centreline to (px, py). */
export function nearestCentreline(px: number, py: number): { x: number; y: number } {
  const d = Math.hypot(px, py)
  if (d < 0.001) return { x: TRACK_RADIUS, y: 0 }
  const scale = TRACK_RADIUS / d
  return { x: px * scale, y: py * scale }
}

/**
 * Push car back onto the track if it has gone outside the boundaries.
 * Returns a corrected { x, y } (velocity handling is done in physics).
 */
export function constrainToTrack(px: number, py: number): { x: number; y: number } {
  const d = Math.hypot(px, py)
  if (d < 0.001) return { x: TRACK_RADIUS, y: 0 }

  const inner = TRACK_RADIUS - TRACK_HALF_WIDTH
  const outer = TRACK_RADIUS + TRACK_HALF_WIDTH

  if (d < inner) {
    const sc = inner / d
    return { x: px * sc, y: py * sc }
  }
  if (d > outer) {
    const sc = outer / d
    return { x: px * sc, y: py * sc }
  }
  return { x: px, y: py }
}

/**
 * Car start position — top of the track, heading right.
 * At angle θ = −π/2, position is (0, −TRACK_RADIUS).
 * The tangent (increasing θ, i.e. going CCW in math = CW visually) is (1, 0) → heading = 0.
 */
export const TRACK_START_X       = 0
export const TRACK_START_Y       = -TRACK_RADIUS
export const TRACK_START_HEADING = 0   // pointing right

// ─── Rendering helpers ────────────────────────────────────────────────────────

/**
 * Samples N evenly-spaced points on the track centreline.
 * Used for drawing the centreline dashes.
 */
export function centreDashes(n: number): Array<{ x: number; y: number; angle: number }> {
  return Array.from({ length: n }, (_, i) => {
    const θ = (i / n) * 2 * Math.PI
    return {
      x: TRACK_RADIUS * Math.cos(θ),
      y: TRACK_RADIUS * Math.sin(θ),
      angle: θ + Math.PI / 2, // tangent direction
    }
  })
}

/** Track kerb/rumble strip sample points. */
export function kerbPoints(radius: number, n: number): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => {
    const θ = (i / n) * 2 * Math.PI
    return { x: radius * Math.cos(θ), y: radius * Math.sin(θ) }
  })
}
