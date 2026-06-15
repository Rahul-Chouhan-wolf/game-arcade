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
