// ─── Orbital · Physics engine ─────────────────────────────────────────────────
// Deterministic symplectic-Euler integration for stable orbital mechanics.
// Pure functions — no React, no DOM, no side effects.

export type BodyType = 'planet' | 'star' | 'blackhole' | 'neutronstar'

export interface CelestialBody {
  id:      number
  x:       number
  y:       number
  mass:    number   // gravitational mass (arbitrary units)
  radius:  number   // collision + visual radius (world px)
  type:    BodyType
  fixed:   boolean  // bodies are always fixed for determinism
}

export interface Projectile {
  x:        number
  y:        number
  vx:       number
  vy:       number
  radius:   number
  trail:    readonly { x: number; y: number }[]
  alive:    boolean
  absorbed: boolean  // eaten by black hole or planet
}

// ─── Physics constants ────────────────────────────────────────────────────────

export const G             = 800     // gravitational constant (game units²/s²)
export const MAX_SPEED     = 680     // px/s — hard velocity cap
export const SUBSTEPS      = 8       // physics sub-steps per frame
export const TRAIL_MAX     = 140     // max trail history length
export const DRAG_TO_VEL   = 6.0    // screen-px drag → world-px/s launch velocity
export const MAX_LAUNCH_V  = 600     // max launch speed (px/s)
export const BOUNDS        = 1400    // world units — escape distance from origin

// ─── Projectile factory ───────────────────────────────────────────────────────

export function makeProjectile(
  x: number, y: number, vx: number, vy: number,
): Projectile {
  return { x, y, vx, vy, radius: 6, trail: [], alive: true, absorbed: false }
}

// ─── Core physics step ────────────────────────────────────────────────────────
// Symplectic Euler: integrate velocity first, then position.
// This is energy-conserving for orbital mechanics — far superior to naive Euler.

export function stepProjectile(
  proj:   Projectile,
  bodies: readonly CelestialBody[],
  dt:     number,
): Projectile {
  if (!proj.alive) return proj

  const subDt = dt / SUBSTEPS
  let { x, y, vx, vy } = proj
  let absorbed = false

  outer:
  for (let s = 0; s < SUBSTEPS; s++) {
    let ax = 0, ay = 0

    for (const body of bodies) {
      const dx = body.x - x
      const dy = body.y - y
      const r2 = dx * dx + dy * dy
      const r  = Math.sqrt(r2)

      // Black-hole absorption
      if (body.type === 'blackhole' && r < body.radius * 0.55) {
        absorbed = true; break outer
      }
      // Solid-body collision (planet / star / neutronstar)
      if (body.type !== 'blackhole' && r < body.radius + proj.radius) {
        absorbed = true; break outer
      }

      // Softened gravity prevents the singularity at r→0.
      // Force magnitude ∝ G·M / (r² + ε²) where ε = radius × 0.30
      const eps  = body.radius * 0.30
      const soft = r2 + eps * eps
      const force = G * body.mass / soft
      ax += force * dx / r
      ay += force * dy / r
    }

    if (absorbed) break

    // ── Symplectic Euler ──────────────────────────────────────────────────────
    vx += ax * subDt
    vy += ay * subDt

    // Hard speed cap — prevents runaway near singularities
    const spd = vx * vx + vy * vy
    if (spd > MAX_SPEED * MAX_SPEED) {
      const sc = MAX_SPEED / Math.sqrt(spd)
      vx *= sc; vy *= sc
    }

    x += vx * subDt
    y += vy * subDt

    // NaN guard (should never trigger with softening, but be defensive)
    if (!isFinite(x) || !isFinite(y)) {
      return { ...proj, alive: false, absorbed: true }
    }
  }

  const trail = proj.trail.length >= TRAIL_MAX
    ? [...proj.trail.slice(1), { x, y }]
    : [...proj.trail, { x, y }]

  return { ...proj, x, y, vx, vy, trail, alive: !absorbed, absorbed }
}

// ─── Trajectory preview ───────────────────────────────────────────────────────
// Runs the exact same integration ahead in time and returns sampled positions.
// Because it uses the same math as the real sim, the preview is perfectly accurate.

export function previewTrajectory(
  startX:  number,
  startY:  number,
  startVx: number,
  startVy: number,
  bodies:  readonly CelestialBody[],
  steps       = 280,
  dtPerStep   = 0.016,
  sampleEvery = 3,
): { x: number; y: number }[] {
  let proj = makeProjectile(startX, startY, startVx, startVy)
  const path: { x: number; y: number }[] = []

  for (let i = 0; i < steps; i++) {
    proj = stepProjectile(proj, bodies, dtPerStep)
    if (!proj.alive) break
    if (i % sampleEvery === 0) path.push({ x: proj.x, y: proj.y })
  }

  return path
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isEscaped(proj: Projectile): boolean {
  return proj.x * proj.x + proj.y * proj.y > BOUNDS * BOUNDS
}

export function launchVelocity(
  dragDx: number,
  dragDy: number,
): { vx: number; vy: number } {
  let vx = dragDx * DRAG_TO_VEL
  let vy = dragDy * DRAG_TO_VEL
  const spd = Math.sqrt(vx * vx + vy * vy)
  if (spd > MAX_LAUNCH_V) {
    const sc = MAX_LAUNCH_V / spd
    vx *= sc; vy *= sc
  }
  return { vx, vy }
}
