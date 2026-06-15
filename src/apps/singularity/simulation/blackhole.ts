// ─── Singularity · black-hole lifecycle (CPU state, GPU consumes as uniforms) ──

import type { BlackHole } from '../types'
import {
  BH_BIRTH_MASS, BH_GROW_RATE, BH_MAX_MASS, BH_MERGE_DIST,
  EVENT_HORIZON_K, MAX_BLACK_HOLES, G,
} from '../utils/constants'
import { horizonRadius } from '../utils/math'

let nextId = 1

export function spawnBlackHole(x: number, y: number): BlackHole {
  return { id: nextId++, x, y, vx: 0, vy: 0, mass: BH_BIRTH_MASS, growing: true, spin: 0, dead: false }
}

export function horizonOf(bh: BlackHole) { return horizonRadius(bh.mass, EVENT_HORIZON_K) }

/**
 * Advance all black holes one step: grow held ones, attract each other,
 * integrate motion, merge overlapping pairs, and flag white-hole collapses.
 * Returns ids that just hit max mass (→ supernova ejection burst).
 */
export function stepBlackHoles(holes: BlackHole[], dt: number): { exploded: BlackHole[] } {
  const exploded: BlackHole[] = []

  for (const b of holes) {
    if (b.growing) b.mass = Math.min(BH_MAX_MASS + 0.001, b.mass + BH_GROW_RATE * dt)
    b.spin += dt * (0.6 + b.mass * 0.5)
  }

  // Mutual gravity between black holes.
  for (let i = 0; i < holes.length; i++) {
    for (let j = i + 1; j < holes.length; j++) {
      const a = holes[i], b = holes[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const d2 = dx * dx + dy * dy + 0.0004
      const f = (G * 0.5 * a.mass * b.mass) / d2
      const d = Math.sqrt(d2)
      const fx = (f * dx) / d, fy = (f * dy) / d
      a.vx += (fx / a.mass) * dt; a.vy += (fy / a.mass) * dt
      b.vx -= (fx / b.mass) * dt; b.vy -= (fy / b.mass) * dt
    }
  }

  for (const b of holes) {
    if (!b.growing) {
      b.x += b.vx * dt; b.y += b.vy * dt
      b.vx *= 0.985; b.vy *= 0.985
    }
  }

  // Merge overlapping holes (conserve momentum, sum mass).
  for (let i = 0; i < holes.length; i++) {
    const a = holes[i]
    if (a.dead) continue
    for (let j = i + 1; j < holes.length; j++) {
      const b = holes[j]
      if (b.dead) continue
      const dx = b.x - a.x, dy = b.y - a.y
      if (Math.hypot(dx, dy) < BH_MERGE_DIST + horizonOf(a) + horizonOf(b)) {
        const m = a.mass + b.mass
        a.x = (a.x * a.mass + b.x * b.mass) / m
        a.y = (a.y * a.mass + b.y * b.mass) / m
        a.vx = (a.vx * a.mass + b.vx * b.mass) / m
        a.vy = (a.vy * a.mass + b.vy * b.mass) / m
        a.mass = m
        a.growing = a.growing || b.growing
        b.dead = true
      }
    }
  }

  // White-hole collapse at max mass → mark for ejection burst, then remove.
  for (const b of holes) {
    if (!b.dead && b.mass >= BH_MAX_MASS) { exploded.push({ ...b }); b.dead = true }
  }

  return { exploded }
}

export function pruneDead(holes: BlackHole[]): BlackHole[] {
  return holes.filter(b => !b.dead).slice(-MAX_BLACK_HOLES)
}

/** Pack holes into a Float32Array of vec4(x, y, mass, horizon) for the GPU. */
export function packHoles(holes: BlackHole[], aspect: number): {
  data: Float32Array; count: number
} {
  const data = new Float32Array(MAX_BLACK_HOLES * 4)
  const count = Math.min(holes.length, MAX_BLACK_HOLES)
  for (let i = 0; i < count; i++) {
    const b = holes[i]
    data[i * 4 + 0] = b.x * aspect
    data[i * 4 + 1] = b.y
    data[i * 4 + 2] = b.mass
    data[i * 4 + 3] = horizonOf(b)
  }
  return { data, count }
}
