// ─── Singularity · cosmic-body lifecycle (CPU state, GPU consumes uniforms) ────
// Black holes, stars, suns, planets and white holes all live here. Interactions:
//   • black hole + black hole → merge (energy burst)
//   • black hole + white hole → annihilation (large burst, both gone)
//   • black hole + star/sun/planet → tidal disruption (consumed, BH grows)
//   • white hole → repels matter and bodies (negative effective mass)

import type { Body, BodyKind } from '../types'
import {
  BH_GROW_RATE, BH_MAX_MASS, BH_MERGE_DIST, EVENT_HORIZON_K, MAX_BLACK_HOLES, G,
  BODY_CONFIG,
} from '../utils/constants'
import { horizonRadius } from '../utils/math'

let nextId = 1

export function spawnBody(kind: BodyKind, x: number, y: number): Body {
  const c = BODY_CONFIG[kind]
  return { id: nextId++, kind, x, y, vx: 0, vy: 0, mass: c.mass, growing: c.grows, spin: 0, dead: false }
}

/** True event horizon — only black holes have one (consumes + lenses). */
export function eventHorizon(b: Body): number {
  return b.kind === 'blackhole' ? horizonRadius(b.mass, EVENT_HORIZON_K) : 0
}

/** Visual / collision radius for any body. */
export function bodyRadius(b: Body): number {
  const base = BODY_CONFIG[b.kind].radius
  return b.kind === 'blackhole' ? Math.max(base, eventHorizon(b) * 3.0) : base * (0.8 + b.mass * 0.35)
}

/** Particle recycle radius fed to the GPU (keeps the field flowing). */
function recycleRadius(b: Body): number {
  return b.kind === 'blackhole' ? eventHorizon(b) : BODY_CONFIG[b.kind].consume
}

function effMass(b: Body): number { return b.mass * BODY_CONFIG[b.kind].gravSign }

export type BurstKind = 'merge' | 'annihilation' | 'tidal' | 'collapse'
export interface BurstReq { x: number; y: number; mass: number; kind: BurstKind; color?: [number, number, number] }

export function stepBodies(bodies: Body[], dt: number): { bursts: BurstReq[] } {
  const bursts: BurstReq[] = []

  for (const b of bodies) {
    if (b.kind === 'blackhole' && b.growing) b.mass = Math.min(BH_MAX_MASS + 0.001, b.mass + BH_GROW_RATE * dt)
    b.spin += dt * (0.4 + b.mass * 0.5) * (b.kind === 'whitehole' ? -1.4 : 1)
  }

  // Mutual gravity (effective mass → white holes repel).
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const d2 = dx * dx + dy * dy + 0.0004
      const d = Math.sqrt(d2)
      const f = (G * 0.5 * effMass(a) * effMass(b)) / d2
      const fx = (f * dx) / d, fy = (f * dy) / d
      a.vx += (fx / a.mass) * dt; a.vy += (fy / a.mass) * dt
      b.vx -= (fx / b.mass) * dt; b.vy -= (fy / b.mass) * dt
    }
  }

  for (const b of bodies) {
    if (!(b.kind === 'blackhole' && b.growing)) {
      b.x += b.vx * dt; b.y += b.vy * dt
      b.vx *= 0.985; b.vy *= 0.985
    }
  }

  // Pairwise interactions.
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]
    if (a.dead) continue
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]
      if (b.dead) continue
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const kinds = [a.kind, b.kind]
      const isBH = (k: BodyKind) => k === 'blackhole'

      // black hole + white hole → annihilation
      if (kinds.includes('blackhole') && kinds.includes('whitehole')
        && dist < BH_MERGE_DIST + bodyRadius(a) + bodyRadius(b)) {
        bursts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, mass: (a.mass + b.mass) * 1.6, kind: 'annihilation' })
        a.dead = true; b.dead = true
        break
      }

      // black hole + black hole → merge
      if (isBH(a.kind) && isBH(b.kind) && dist < BH_MERGE_DIST + eventHorizon(a) + eventHorizon(b)) {
        const m = a.mass + b.mass
        a.x = (a.x * a.mass + b.x * b.mass) / m
        a.y = (a.y * a.mass + b.y * b.mass) / m
        a.vx = (a.vx * a.mass + b.vx * b.mass) / m
        a.vy = (a.vy * a.mass + b.vy * b.mass) / m
        a.mass = m; a.growing = a.growing || b.growing; b.dead = true
        bursts.push({ x: a.x, y: a.y, mass: m, kind: 'merge' })
        continue
      }

      // black hole + (star/sun/planet/whitestar) → tidal disruption
      const bh = isBH(a.kind) ? a : isBH(b.kind) ? b : null
      const other = bh === a ? b : bh === b ? a : null
      if (bh && other && other.kind !== 'whitehole'
        && dist < eventHorizon(bh) + bodyRadius(other)) {
        bh.mass += other.mass * 0.4
        other.dead = true
        bursts.push({ x: other.x, y: other.y, mass: other.mass, kind: 'tidal', color: BODY_CONFIG[other.kind].color })
      }
    }
  }

  // White-hole collapse of an over-fed black hole.
  for (const b of bodies) {
    if (!b.dead && b.kind === 'blackhole' && b.mass >= BH_MAX_MASS) {
      bursts.push({ x: b.x, y: b.y, mass: b.mass * 1.4, kind: 'collapse' })
      b.dead = true
    }
  }

  return { bursts }
}

export function pruneDead(bodies: Body[]): Body[] {
  // Keep the most recent bodies; only this many feed the GPU gravity uniforms.
  return bodies.filter(b => !b.dead).slice(-MAX_BLACK_HOLES * 2)
}

/** All bodies as gravity sources for the particle shader. */
export function packGravity(bodies: Body[], aspect: number, max: number): { data: Float32Array; count: number } {
  const data = new Float32Array(max * 4)
  const count = Math.min(bodies.length, max)
  for (let i = 0; i < count; i++) {
    const b = bodies[i]
    data[i * 4] = b.x * aspect
    data[i * 4 + 1] = b.y
    data[i * 4 + 2] = effMass(b)
    data[i * 4 + 3] = recycleRadius(b)
  }
  return { data, count }
}

/** Only black holes + white holes bend light (composite lensing). */
export function packLensing(bodies: Body[], aspect: number, max: number): { data: Float32Array; count: number } {
  const data = new Float32Array(max * 4)
  let count = 0
  for (const b of bodies) {
    if (count >= max) break
    if (b.kind !== 'blackhole' && b.kind !== 'whitehole') continue
    data[count * 4] = b.x * aspect
    data[count * 4 + 1] = b.y
    data[count * 4 + 2] = effMass(b)
    data[count * 4 + 3] = eventHorizon(b)
    count++
  }
  return { data, count }
}
