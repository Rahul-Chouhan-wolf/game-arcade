import { describe, it, expect } from 'vitest'
import {
  POWERUP_TYPES, POWERUP_DURATION,
  makePowerupState, tickPowerups, activate, isOn,
  multiplierOf, jumpVelocityFor, jumpPeak,
  JETPACK_ALT, MAGNET_RANGE_Z, pickupTypeFor,
} from '@/lib/subway-surfer/powerups'
import { JUMP_VELOCITY } from '@/lib/subway-surfer/physics'
import { TRAIN_H, BARRIER_H } from '@/lib/subway-surfer/collision'

describe('powerup state', () => {
  it('starts with all powerups inactive', () => {
    const p = makePowerupState()
    for (const t of POWERUP_TYPES) expect(isOn(p, t)).toBe(false)
  })

  it('activate sets the full duration', () => {
    const p = makePowerupState()
    activate(p, 'magnet')
    expect(p.magnet).toBe(POWERUP_DURATION.magnet)
    expect(isOn(p, 'magnet')).toBe(true)
  })

  it('tick counts down and expires at 0', () => {
    const p = makePowerupState()
    activate(p, 'jetpack')
    tickPowerups(p, POWERUP_DURATION.jetpack / 2)
    expect(isOn(p, 'jetpack')).toBe(true)
    tickPowerups(p, POWERUP_DURATION.jetpack)
    expect(p.jetpack).toBe(0)
    expect(isOn(p, 'jetpack')).toBe(false)
  })

  it('tick never goes negative', () => {
    const p = makePowerupState()
    activate(p, 'sneakers')
    tickPowerups(p, 999)
    expect(p.sneakers).toBe(0)
  })

  it('all durations are positive', () => {
    for (const t of POWERUP_TYPES) expect(POWERUP_DURATION[t]).toBeGreaterThan(0)
  })
})

describe('multiplierOf', () => {
  it('is 1 by default and 2 with the multiplier active', () => {
    const p = makePowerupState()
    expect(multiplierOf(p)).toBe(1)
    activate(p, 'multiplier')
    expect(multiplierOf(p)).toBe(2)
  })
})

describe('jumpVelocityFor', () => {
  it('is the base jump velocity without sneakers', () => {
    expect(jumpVelocityFor(makePowerupState())).toBe(JUMP_VELOCITY)
  })

  it('base jump clears a barrier but NOT a train', () => {
    const peak = jumpPeak(JUMP_VELOCITY)
    expect(peak).toBeGreaterThan(BARRIER_H)
    expect(peak).toBeLessThan(TRAIN_H)
  })

  it('sneaker jump clears even a train', () => {
    const p = makePowerupState()
    activate(p, 'sneakers')
    expect(jumpPeak(jumpVelocityFor(p))).toBeGreaterThan(TRAIN_H)
  })
})

describe('constants', () => {
  it('jetpack altitude is above every obstacle', () => {
    expect(JETPACK_ALT).toBeGreaterThan(TRAIN_H)
  })
  it('magnet range is positive', () => {
    expect(MAGNET_RANGE_Z).toBeGreaterThan(0)
  })
})

describe('pickupTypeFor', () => {
  it('is deterministic', () => {
    expect(pickupTypeFor(42)).toBe(pickupTypeFor(42))
  })
  it('produces every powerup type across seeds', () => {
    const seen = new Set<string>()
    for (let s = 0; s < 100; s++) seen.add(pickupTypeFor(s))
    for (const t of POWERUP_TYPES) expect(seen.has(t)).toBe(true)
  })
})
