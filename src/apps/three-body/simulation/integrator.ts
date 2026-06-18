// ─── Three-Body · velocity-Verlet integrator ─────────────────────────────────
// Velocity Verlet is symplectic (2nd order): it conserves total energy and
// momentum extremely well over long runs, which is essential for a faithful
// gravitational simulation. Close encounters are handled by sub-stepping so the
// per-step error stays small even when bodies swing past each other fast.

import { type Body, computeAccelerations, minPairDistance } from './physics'

const TRAIL_MAX = 1600   // flat-array length cap (≈800 points) per body

function verletStep(bodies: Body[], dt: number, G: number): void {
  // x(t+dt) = x + v·dt + ½·a·dt²   (a already holds a(t))
  const half = 0.5 * dt * dt
  for (const b of bodies) {
    b.x += b.vx * dt + b.ax * half
    b.y += b.vy * dt + b.ay * half
    // stash a(t) on the velocity half-kick below
    b.vx += 0.5 * b.ax * dt
    b.vy += 0.5 * b.ay * dt
  }
  computeAccelerations(bodies, G)     // a(t+dt)
  for (const b of bodies) {
    b.vx += 0.5 * b.ax * dt
    b.vy += 0.5 * b.ay * dt
  }
}

/**
 * Advance the system by `dt`, automatically sub-stepping more finely during
 * close encounters (small min-separation ⇒ many small steps) to preserve
 * accuracy and energy conservation.
 */
export function integrate(bodies: Body[], dt: number, G: number, recordTrail = true): void {
  const sep = minPairDistance(bodies)
  // tighter approaches need finer steps; clamp to a sane range
  const substeps = Math.max(1, Math.min(120, Math.ceil(dt / (sep * 0.04 + 1e-4))))
  const h = dt / substeps
  for (let s = 0; s < substeps; s++) verletStep(bodies, h, G)

  if (recordTrail) {
    for (const b of bodies) {
      b.trail.push(b.x, b.y)
      if (b.trail.length > TRAIL_MAX) b.trail.splice(0, b.trail.length - TRAIL_MAX)
    }
  }
}

export function ensureAccel(bodies: Body[], G: number): void {
  computeAccelerations(bodies, G)
}
