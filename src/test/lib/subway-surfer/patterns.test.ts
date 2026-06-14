import { describe, it, expect } from 'vitest'
import { coinPattern, skyLine } from '@/lib/subway-surfer/patterns'
import { spawnRow } from '@/lib/subway-surfer/spawn'
import { BARRIER_H } from '@/lib/subway-surfer/collision'

describe('coinPattern', () => {
  it('is deterministic for a given seed', () => {
    const row = spawnRow(5)
    expect(coinPattern(5, row)).toEqual(coinPattern(5, row))
  })

  it('always returns at least 5 coins', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(coinPattern(seed, spawnRow(seed)).length).toBeGreaterThanOrEqual(5)
    }
  })

  it('coin heights are never negative', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const c of coinPattern(seed, spawnRow(seed))) {
        expect(c.y).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('coins only spawn in clear lanes or barrier lanes (never trains/lowbars)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const row = spawnRow(seed)
      for (const c of coinPattern(seed, row)) {
        const obst = row.obstacles.find(o => o.lane === c.lane)
        if (obst) expect(obst.type).toBe('barrier')
      }
    }
  })

  it('arc patterns peak above barrier height (a jump can collect them)', () => {
    let sawArc = false
    for (let seed = 0; seed < 300; seed++) {
      const coins = coinPattern(seed, spawnRow(seed))
      const peak = Math.max(...coins.map(c => c.y))
      if (peak > 0) {
        sawArc = true
        expect(peak).toBeGreaterThan(BARRIER_H)
      }
    }
    expect(sawArc).toBe(true)
  })

  it('raised coins only appear over barrier lanes or clear lanes (never trains)', () => {
    for (let seed = 0; seed < 300; seed++) {
      const row = spawnRow(seed)
      for (const c of coinPattern(seed, row)) {
        if (c.y > 0) {
          const obst = row.obstacles.find(o => o.lane === c.lane)
          if (obst) expect(obst.type).toBe('barrier')
        }
      }
    }
  })

  it('all lanes are valid indices', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const c of coinPattern(seed, spawnRow(seed))) {
        expect([0, 1, 2]).toContain(c.lane)
      }
    }
  })
})

describe('skyLine', () => {
  it('places every coin at the given altitude', () => {
    for (const c of skyLine(1, 5.5)) expect(c.y).toBe(5.5)
  })
  it('returns the requested count', () => {
    expect(skyLine(0, 5, 6)).toHaveLength(6)
  })
})
