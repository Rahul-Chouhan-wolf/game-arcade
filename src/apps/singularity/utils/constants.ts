// ─── Singularity · tunable constants ─────────────────────────────────────────

import type { Level } from './math'

export const MAX_BLACK_HOLES = 6

// Particle grid sizes (count = side²). Auto-selected per device capability.
export const PARTICLE_SIDES: Record<Level, number> = {
  low: 256,    // ~65k
  medium: 384, // ~147k
  high: 512,   // ~262k
}

// Gravity / motion
export const G = 0.55            // gravitational constant (tuned, not physical)
export const SWIRL = 0.9         // tangential force → orbital swirl
export const DAMPING = 0.992     // velocity damping per step
export const MAX_SPEED = 2.4
export const SOFTENING = 0.015   // avoids singularity blow-up at r→0

// Black-hole lifecycle
export const BH_BIRTH_MASS = 0.06
export const BH_GROW_RATE = 0.9        // mass/sec while held
export const BH_FEED_PER_PARTICLE = 0.00018
export const BH_MAX_MASS = 3.2         // white-hole threshold
export const BH_MERGE_DIST = 0.05
export const EVENT_HORIZON_K = 0.06    // horizon radius = k * sqrt(mass)
export const DISK_K = 0.5              // accretion disk radius factor

// Visuals
export const BLOOM_ITERATIONS = 7
export const BLOOM_INTENSITY = 0.85
export const BLOOM_THRESHOLD = 0.45
export const STARFIELD_COUNT = 1800

export const UI_AUTOHIDE_MS = 3400
export const REPLAY_SECONDS = 10

// ─── Cosmic body catalogue ───────────────────────────────────────────────────
// gravSign: +1 attracts, -1 repels (white hole). consume: pulls in particles
// (a recycle radius so the field keeps flowing). grows: gains mass while held.
import type { BodyKind } from '../types'

export interface BodyConfig {
  label: string
  mass: number
  gravSign: 1 | -1
  grows: boolean
  consume: number        // particle recycle radius (clip); 0 = none
  color: [number, number, number]
  radius: number         // base visual radius (clip)
  rays: boolean          // emissive outward rays (white hole)
}

export const BODY_CONFIG: Record<BodyKind, BodyConfig> = {
  blackhole: { label: 'Black Hole', mass: 0.06, gravSign: 1,  grows: true,  consume: 0,     color: [0.55, 0.4, 1.0],  radius: 0.05, rays: false },
  star:      { label: 'Star',       mass: 0.5,  gravSign: 1,  grows: false, consume: 0.03,  color: [1.0, 0.78, 0.3],  radius: 0.05, rays: false },
  whitestar: { label: 'White Star', mass: 0.6,  gravSign: 1,  grows: false, consume: 0.03,  color: [0.7, 0.85, 1.0],  radius: 0.05, rays: false },
  sun:       { label: 'Sun',        mass: 1.1,  gravSign: 1,  grows: false, consume: 0.05,  color: [1.0, 0.66, 0.2],  radius: 0.085, rays: false },
  planet:    { label: 'Planet',     mass: 0.12, gravSign: 1,  grows: false, consume: 0.012, color: [0.45, 0.7, 0.95], radius: 0.03, rays: false },
  whitehole: { label: 'White Hole', mass: 0.7,  gravSign: -1, grows: false, consume: 0,     color: [0.8, 0.95, 1.0],  radius: 0.06, rays: true },
}

export const BODY_ORDER: BodyKind[] = ['blackhole', 'star', 'whitestar', 'sun', 'planet', 'whitehole']

