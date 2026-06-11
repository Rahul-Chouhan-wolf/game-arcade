import { describe, it, expect } from 'vitest'
import {
  isHit, isCoinCollected,
  TRAIN_H, BARRIER_H, LOWBAR_H, HIT_Z, OBSTACLE_LEN,
} from '@/lib/subway-surfer/collision'
import { PLAYER_STAND_H, PLAYER_ROLL_H, JUMP_VELOCITY, GRAVITY } from '@/lib/subway-surfer/physics'

const CENTER = 1 // lane index

describe('isHit — train', () => {
  it('hits a train in the same lane at z≈0', () => {
    expect(isHit(CENTER, 0, false, CENTER, 0, 'train')).toBe(true)
  })

  it('jumping does NOT clear a train (peak jump < TRAIN_H)', () => {
    const peak = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * Math.abs(GRAVITY))
    expect(peak).toBeLessThan(TRAIN_H)
    expect(isHit(CENTER, peak, false, CENTER, 0, 'train')).toBe(true)
  })

  it('rolling does NOT clear a train', () => {
    expect(isHit(CENTER, 0, true, CENTER, 0, 'train')).toBe(true)
  })

  it('different lane is safe even alongside a train body', () => {
    expect(isHit(CENTER, 0, false, 0, -5, 'train')).toBe(false)
  })

  it('train body is long — still hits when its nose has passed the player', () => {
    // Nose at z=-10, body extends to -10+16=6 → overlaps the player zone
    expect(isHit(CENTER, 0, false, CENTER, -10, 'train')).toBe(true)
  })

  it('no hit once the full train body has passed', () => {
    const past = -(OBSTACLE_LEN.train + HIT_Z + 0.1)
    expect(isHit(CENTER, 0, false, CENTER, past, 'train')).toBe(false)
  })
})

describe('isHit — barrier', () => {
  it('hits a barrier in the same lane at z≈0', () => {
    expect(isHit(CENTER, 0, false, CENTER, 0, 'barrier')).toBe(true)
  })

  it('no hit when obstacle is in a different lane', () => {
    expect(isHit(CENTER, 0, false, 0, 0, 'barrier')).toBe(false)
  })

  it('no hit when obstacle is far away (z > HIT_Z)', () => {
    expect(isHit(CENTER, 0, false, CENTER, HIT_Z + 1, 'barrier')).toBe(false)
  })

  it('jumping over a barrier — player Y clears barrier height', () => {
    // playerY high enough to be fully above the barrier
    expect(isHit(CENTER, BARRIER_H + 0.1, false, CENTER, 0, 'barrier')).toBe(false)
  })

  it('rolling does NOT clear a barrier', () => {
    // Rolling player is still in the hit zone
    expect(isHit(CENTER, 0, true, CENTER, 0, 'barrier')).toBe(true)
  })
})

describe('isHit — lowbar', () => {
  it('standing player hits a lowbar', () => {
    expect(isHit(CENTER, 0, false, CENTER, 0, 'lowbar')).toBe(true)
  })

  it('rolling player clears a lowbar', () => {
    // PLAYER_ROLL_H should be less than LOWBAR_H
    expect(PLAYER_ROLL_H).toBeLessThan(LOWBAR_H)
    expect(isHit(CENTER, 0, true, CENTER, 0, 'lowbar')).toBe(false)
  })

  it('jumping player clears a lowbar', () => {
    // playerY above lowbar height
    expect(isHit(CENTER, LOWBAR_H + 0.1, false, CENTER, 0, 'lowbar')).toBe(false)
  })
})

describe('isCoinCollected', () => {
  it('collects coin in same lane at z≈0', () => {
    expect(isCoinCollected(CENTER, 0, CENTER, 0)).toBe(true)
  })

  it('does not collect coin in different lane', () => {
    expect(isCoinCollected(CENTER, 0, 0, 0)).toBe(false)
  })

  it('does not collect coin that is far in z', () => {
    expect(isCoinCollected(CENTER, 0, CENTER, 10)).toBe(false)
  })
})

describe('constants', () => {
  it('BARRIER_H > PLAYER_STAND_H (must jump to clear)', () => {
    // Peak jump height must exceed BARRIER_H
    const peak = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * Math.abs(GRAVITY))
    expect(peak).toBeGreaterThan(BARRIER_H)
  })

  it('LOWBAR_H > PLAYER_ROLL_H (rolling clears it)', () => {
    expect(LOWBAR_H).toBeGreaterThan(PLAYER_ROLL_H)
  })

  it('LOWBAR_H < PLAYER_STAND_H (standing hits it)', () => {
    expect(LOWBAR_H).toBeLessThan(PLAYER_STAND_H)
  })
})
