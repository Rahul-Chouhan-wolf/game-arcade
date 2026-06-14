import { JUMP_VELOCITY, GRAVITY } from './physics'

export type PowerupType = 'magnet' | 'jetpack' | 'multiplier' | 'sneakers'

export const POWERUP_TYPES: PowerupType[] = ['magnet', 'jetpack', 'multiplier', 'sneakers']

export const POWERUP_DURATION: Record<PowerupType, number> = {
  magnet:     9,
  jetpack:    4.5,
  multiplier: 10,
  sneakers:   9,
}

// Remaining seconds per powerup (0 = inactive)
export interface PowerupState {
  magnet:     number
  jetpack:    number
  multiplier: number
  sneakers:   number
}

export function makePowerupState(): PowerupState {
  return { magnet: 0, jetpack: 0, multiplier: 0, sneakers: 0 }
}

export function tickPowerups(p: PowerupState, dt: number): void {
  for (const t of POWERUP_TYPES) p[t] = Math.max(0, p[t] - dt)
}

export function activate(p: PowerupState, type: PowerupType): void {
  p[type] = POWERUP_DURATION[type]
}

export function isOn(p: PowerupState, type: PowerupType): boolean {
  return p[type] > 0
}

export function multiplierOf(p: PowerupState): 1 | 2 {
  return p.multiplier > 0 ? 2 : 1
}

// Super Sneakers jump 1.5× faster — high enough to clear even a train.
export function jumpVelocityFor(p: PowerupState): number {
  return isOn(p, 'sneakers') ? JUMP_VELOCITY * 1.5 : JUMP_VELOCITY
}

export function jumpPeak(v0: number): number {
  return (v0 * v0) / (2 * Math.abs(GRAVITY))
}

// Jetpack cruising altitude (world units) — above every obstacle.
export const JETPACK_ALT = 5.5

// Magnet suction range along Z (world units, any lane).
export const MAGNET_RANGE_Z = 7

// Deterministic pickup type for a given spawn seed.
export function pickupTypeFor(seed: number): PowerupType {
  let x = (seed ^ (seed >>> 16)) * 0x45d9f3b
  x = (x ^ (x >>> 16)) * 0x45d9f3b
  x = (x ^ (x >>> 16)) >>> 0
  return POWERUP_TYPES[x % POWERUP_TYPES.length]
}
