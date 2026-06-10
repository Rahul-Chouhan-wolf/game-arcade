import { describe, it, expect } from 'vitest'
import {
  integrateJump, lerpLane,
  JUMP_VELOCITY, GRAVITY, ROLL_DURATION,
  PLAYER_STAND_H, PLAYER_ROLL_H,
} from '@/lib/subway-surfer/physics'

describe('integrateJump', () => {
  it('player returns to ground given enough time', () => {
    let y = 0, vy = JUMP_VELOCITY
    let landed = false
    for (let i = 0; i < 200; i++) {
      const r = integrateJump(y, vy, 0.016)
      y = r.y; vy = r.vy
      if (r.landed) { landed = true; break }
    }
    expect(landed).toBe(true)
    expect(y).toBe(0)
  })

  it('peak jump height clears PLAYER_STAND_H obstacles', () => {
    let y = 0, vy = JUMP_VELOCITY, peak = 0
    for (let i = 0; i < 200; i++) {
      const r = integrateJump(y, vy, 0.016)
      y = r.y; vy = r.vy; peak = Math.max(peak, y)
      if (r.landed) break
    }
    expect(peak).toBeGreaterThan(PLAYER_STAND_H * 1.3)
  })

  it('does not go below y=0', () => {
    let y = 0, vy = JUMP_VELOCITY
    for (let i = 0; i < 300; i++) {
      const r = integrateJump(y, vy, 0.016)
      y = r.y; vy = r.vy
      expect(y).toBeGreaterThanOrEqual(0)
      if (r.landed) break
    }
  })

  it('GRAVITY constant is negative', () => expect(GRAVITY).toBeLessThan(0))
})

describe('lerpLane', () => {
  it('snaps to target when close enough', () => {
    const result = lerpLane(0.99, 1, 1)
    expect(result).toBe(1)
  })

  it('moves toward target', () => {
    const r = lerpLane(-1, 1, 0.05)
    expect(r).toBeGreaterThan(-1)
    expect(r).toBeLessThan(1)
  })

  it('never overshoots target', () => {
    const r = lerpLane(-1, 1, 100)
    expect(r).toBe(1)
  })
})

describe('constants', () => {
  it('ROLL_DURATION is positive', () => expect(ROLL_DURATION).toBeGreaterThan(0))
  it('PLAYER_ROLL_H < PLAYER_STAND_H', () => expect(PLAYER_ROLL_H).toBeLessThan(PLAYER_STAND_H))
})
