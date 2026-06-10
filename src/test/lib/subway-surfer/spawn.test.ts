import { describe, it, expect } from 'vitest'
import { spawnRow, coinLane } from '@/lib/subway-surfer/spawn'

describe('spawnRow', () => {
  it('always leaves at least one clear lane', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { clearLanes } = spawnRow(seed)
      expect(clearLanes.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('blocked + clear lanes always sum to 3', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { obstacles, clearLanes } = spawnRow(seed)
      expect(obstacles.length + clearLanes.length).toBe(3)
    }
  })

  it('is deterministic — same seed gives same result', () => {
    const a = spawnRow(42)
    const b = spawnRow(42)
    expect(a.obstacles.map(o => o.lane)).toEqual(b.obstacles.map(o => o.lane))
    expect(a.clearLanes).toEqual(b.clearLanes)
  })

  it('all lane indices are 0, 1, or 2', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { obstacles, clearLanes } = spawnRow(seed)
      const all = [...obstacles.map(o => o.lane), ...clearLanes]
      all.forEach(l => expect([0, 1, 2]).toContain(l))
    }
  })

  it('never has duplicate lane entries', () => {
    for (let seed = 0; seed < 100; seed++) {
      const { obstacles, clearLanes } = spawnRow(seed)
      const all = [...obstacles.map(o => o.lane), ...clearLanes]
      expect(new Set(all).size).toBe(all.length)
    }
  })

  it('blocks at most 2 lanes', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(spawnRow(seed).obstacles.length).toBeLessThanOrEqual(2)
    }
  })

  it('varies between 1 and 2 blocked lanes across seeds', () => {
    const counts = new Set<number>()
    for (let seed = 0; seed < 200; seed++) counts.add(spawnRow(seed).obstacles.length)
    expect(counts.has(1)).toBe(true)
    expect(counts.has(2)).toBe(true)
  })
})

describe('coinLane', () => {
  it('always returns a clear lane', () => {
    for (let seed = 0; seed < 200; seed++) {
      const cl = coinLane(seed)
      const { clearLanes } = spawnRow(seed)
      expect(clearLanes).toContain(cl)
    }
  })

  it('is deterministic', () => {
    expect(coinLane(99)).toBe(coinLane(99))
  })
})
