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
  fixed:   boolean
}

export interface Projectile {
  x:        number
  y:        number
  vx:       number
  vy:       number
  radius:   number
  trail:    readonly { x: number; y: number }[]
  alive:    boolean
  absorbed: boolean
}

// ─── Asteroid definition ───────────────────────────────────────────────────────
// Asteroids follow deterministic circular orbits — no physics integration needed.
// Their position is computed analytically from game time, guaranteeing stability.

export interface AsteroidDef {
  id:           number
  centerX:      number   // world-space orbit centre
  centerY:      number
  orbitRadius:  number   // distance from centre
  speed:        number   // rad / s (positive = CCW, negative = CW)
  phase:        number   // initial angle (radians)
  radius:       number   // visual + collision radius (world px)
}

/** Compute asteroid world-space position at time t (deterministic). */
export function asteroidPos(def: AsteroidDef, t: number): { x: number; y: number } {
  const a = def.phase + def.speed * t
  return {
    x: def.centerX + Math.cos(a) * def.orbitRadius,
    y: def.centerY + Math.sin(a) * def.orbitRadius,
  }
}

/** True if the projectile collides with the asteroid at time t. */
export function asteroidHit(
  def: AsteroidDef,
  proj: Projectile,
  t: number,
): boolean {
  const pos  = asteroidPos(def, t)
  const dx   = proj.x - pos.x
  const dy   = proj.y - pos.y
  const minR = def.radius + proj.radius
  return dx * dx + dy * dy < minR * minR
}

// ─── Physics constants ────────────────────────────────────────────────────────

export const G             = 800
export const MAX_SPEED     = 680
export const SUBSTEPS      = 8
export const TRAIL_MAX     = 140
export const DRAG_TO_VEL   = 6.0
export const MAX_LAUNCH_V  = 600
export const BOUNDS        = 1500

// ─── Projectile factory ───────────────────────────────────────────────────────

export function makeProjectile(
  x: number, y: number, vx: number, vy: number,
): Projectile {
  return { x, y, vx, vy, radius: 6, trail: [], alive: true, absorbed: false }
}

// ─── Core physics step ────────────────────────────────────────────────────────

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

      if (body.type === 'blackhole' && r < body.radius * 0.55) {
        absorbed = true; break outer
      }
      if (body.type !== 'blackhole' && r < body.radius + proj.radius) {
        absorbed = true; break outer
      }

      // Softened gravity — prevents singularity at r→0
      const eps   = body.radius * 0.30
      const soft  = r2 + eps * eps
      const force = G * body.mass / soft
      ax += force * dx / r
      ay += force * dy / r
    }

    if (absorbed) break

    // Symplectic Euler: velocity first, then position
    vx += ax * subDt
    vy += ay * subDt

    const spd2 = vx * vx + vy * vy
    if (spd2 > MAX_SPEED * MAX_SPEED) {
      const sc = MAX_SPEED / Math.sqrt(spd2)
      vx *= sc; vy *= sc
    }

    x += vx * subDt
    y += vy * subDt

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
// Returns sampled future positions + which step (if any) the probe hits an asteroid.
// Because we use the same integration, the preview is perfectly accurate.

export function previewTrajectory(
  startX:     number,
  startY:     number,
  startVx:    number,
  startVy:    number,
  bodies:     readonly CelestialBody[],
  asteroids:  readonly AsteroidDef[],
  gameTime:   number,
  steps       = 300,
  dtPerStep   = 0.016,
  sampleEvery = 3,
): { path: { x: number; y: number }[]; asteroidHitStep: number | null } {
  let proj = makeProjectile(startX, startY, startVx, startVy)
  const path: { x: number; y: number }[] = []
  let asteroidHitStep: number | null = null

  for (let i = 0; i < steps; i++) {
    proj = stepProjectile(proj, bodies, dtPerStep)
    if (!proj.alive) break

    // Check asteroid collision at this simulated time
    const simT = gameTime + i * dtPerStep
    for (const ast of asteroids) {
      if (asteroidHitStep === null && asteroidHit(ast, proj, simT)) {
        asteroidHitStep = i
      }
    }

    if (i % sampleEvery === 0) path.push({ x: proj.x, y: proj.y })
  }

  return { path, asteroidHitStep }
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
