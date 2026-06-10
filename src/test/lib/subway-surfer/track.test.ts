import { describe, it, expect } from 'vitest'
import {
  LANE_OFFSETS, SPAWN_Z, RECYCLE_Z,
  speedAtDistance, spawnIntervalAt,
} from '@/lib/subway-surfer/track'

describe('LANE_OFFSETS', () => {
  it('has three lanes', () => expect(LANE_OFFSETS).toHaveLength(3))
  it('centre lane offset is 0', () => expect(LANE_OFFSETS[1]).toBe(0))
  it('left/right offsets are symmetric', () => expect(LANE_OFFSETS[0]).toBe(-LANE_OFFSETS[2]))
})

describe('SPAWN_Z / RECYCLE_Z', () => {
  it('SPAWN_Z is positive (ahead of player)', () => expect(SPAWN_Z).toBeGreaterThan(0))
  it('RECYCLE_Z is negative (behind player)',  () => expect(RECYCLE_Z).toBeLessThan(0))
})

describe('speedAtDistance', () => {
  it('starts at a reasonable base speed', () => expect(speedAtDistance(0)).toBeGreaterThanOrEqual(15))
  it('speed increases with distance', () => expect(speedAtDistance(2000)).toBeGreaterThan(speedAtDistance(0)))
  it('caps at max speed', () => {
    const s1 = speedAtDistance(10000)
    const s2 = speedAtDistance(100000)
    expect(s1).toBeCloseTo(s2, 1)
  })
  it('never exceeds 60 u/s', () => expect(speedAtDistance(999999)).toBeLessThanOrEqual(60))
})

describe('spawnIntervalAt', () => {
  it('starts with a longer interval (more gap)', () => expect(spawnIntervalAt(0)).toBeGreaterThan(10))
  it('interval decreases as distance grows', () => expect(spawnIntervalAt(2000)).toBeLessThan(spawnIntervalAt(0)))
  it('never drops below 5 metres', () => expect(spawnIntervalAt(999999)).toBeGreaterThanOrEqual(5))
})
