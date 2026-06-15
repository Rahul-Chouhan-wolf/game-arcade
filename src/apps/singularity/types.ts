// ─── Singularity · shared types ──────────────────────────────────────────────

import type { Level } from './utils/math'

export type { Level }

// Spawnable cosmic objects. Each interacts with black holes differently.
export type BodyKind =
  | 'blackhole'   // gravity well, consumes matter, grows while held
  | 'star'        // warm sun-like star, attracts + orbits
  | 'whitestar'   // hot blue-white star, brighter
  | 'sun'         // large radiant star with corona
  | 'planet'      // small body, easily captured into orbit
  | 'whitehole'   // repels matter, ejects light; annihilates a black hole

export interface Body {
  id: number
  kind: BodyKind
  x: number          // clip space -1..1 (aspect-corrected on x)
  y: number
  vx: number
  vy: number
  mass: number
  growing: boolean   // mouse held → black holes accrete
  spin: number       // accumulated disk / surface rotation
  dead: boolean
}

/** @deprecated alias kept for older imports */
export type BlackHole = Body

export interface Settings {
  bloom: boolean
  lensing: boolean
  density: Level
  audio: boolean
  uiHidden: boolean
  paused: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  bloom: true,
  lensing: true,
  density: 'medium',
  audio: false,
  uiHidden: false,
  paused: false,
}

export interface PointerSample { x: number; y: number; t: number }

// A colourful nebula cloud born when two black holes merge / collapse.
export interface NebulaBurst {
  x: number          // clip space
  y: number
  age: number        // seconds elapsed
  life: number       // total lifetime (s)
  radius: number     // max expansion radius (clip)
  seed: number
  colors: [[number, number, number], [number, number, number], [number, number, number]]
}
