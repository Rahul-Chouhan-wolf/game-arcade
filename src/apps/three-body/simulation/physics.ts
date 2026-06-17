// ─── Three-Body · Newtonian gravity (pure, scientifically grounded) ──────────
// Units are dimensionless with G chosen per scenario. F = G·m₁·m₂ / r².
// The acceleration on body i is  a_i = Σ_{j≠i} G·m_j·(r_j − r_i) / |r_j − r_i|³.

export interface Body {
  x: number; y: number
  vx: number; vy: number
  ax: number; ay: number     // current acceleration (for velocity-Verlet)
  mass: number
  color: string
  label: string
  trail: number[]            // flat [x0,y0,x1,y1,…] world-space history
}

// A small softening length avoids a force singularity at r→0 during very close
// encounters. Kept tiny so periodic orbits (figure-8, Lagrange) stay accurate.
export const SOFTENING = 1e-3

export function computeAccelerations(bodies: Body[], G: number): void {
  for (const b of bodies) { b.ax = 0; b.ay = 0 }
  const eps2 = SOFTENING * SOFTENING
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const r2 = dx * dx + dy * dy + eps2
      const invR = 1 / Math.sqrt(r2)
      const invR3 = invR / r2
      const s = G * invR3
      a.ax += s * b.mass * dx; a.ay += s * b.mass * dy
      b.ax -= s * a.mass * dx; b.ay -= s * a.mass * dy
    }
  }
}

export function kineticEnergy(bodies: Body[]): number {
  let ke = 0
  for (const b of bodies) ke += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy)
  return ke
}

export function potentialEnergy(bodies: Body[], G: number): number {
  let pe = 0
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j]
      const r = Math.hypot(b.x - a.x, b.y - a.y) + SOFTENING
      pe -= (G * a.mass * b.mass) / r
    }
  }
  return pe
}

export function totalEnergy(bodies: Body[], G: number): number {
  return kineticEnergy(bodies) + potentialEnergy(bodies, G)
}

export function momentum(bodies: Body[]): { px: number; py: number; mag: number } {
  let px = 0, py = 0
  for (const b of bodies) { px += b.mass * b.vx; py += b.mass * b.vy }
  return { px, py, mag: Math.hypot(px, py) }
}

export function centerOfMass(bodies: Body[]): { x: number; y: number; vx: number; vy: number } {
  let m = 0, x = 0, y = 0, vx = 0, vy = 0
  for (const b of bodies) { m += b.mass; x += b.mass * b.x; y += b.mass * b.y; vx += b.mass * b.vx; vy += b.mass * b.vy }
  return { x: x / m, y: y / m, vx: vx / m, vy: vy / m }
}

export function minPairDistance(bodies: Body[]): number {
  let min = Infinity
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++)
      min = Math.min(min, Math.hypot(bodies[j].x - bodies[i].x, bodies[j].y - bodies[i].y))
  return min
}

/** Largest separation of any body from the centre of mass (for ejection detection). */
export function maxComDistance(bodies: Body[]): number {
  const c = centerOfMass(bodies)
  let max = 0
  for (const b of bodies) max = Math.max(max, Math.hypot(b.x - c.x, b.y - c.y))
  return max
}
