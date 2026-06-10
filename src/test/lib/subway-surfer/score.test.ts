import { describe, it, expect, beforeEach, vi } from 'vitest'
import { calcScore, loadHigh, saveHigh, COIN_VALUE, DIST_DIVISOR } from '@/lib/subway-surfer/score'

// Provide a localStorage mock for the Node/jsdom test environment.
const store: Record<string, string> = {}
const lsMock = {
  getItem:    (k: string) => store[k] ?? null,
  setItem:    (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear:      () => { for (const k in store) delete store[k] },
}
vi.stubGlobal('localStorage', lsMock)

describe('calcScore', () => {
  it('is 0 for distance=0 and coins=0', () => expect(calcScore(0, 0)).toBe(0))
  it('increases with distance', () => expect(calcScore(100, 0)).toBeGreaterThan(calcScore(50, 0)))
  it('adds COIN_VALUE per coin', () => {
    expect(calcScore(0, 5)).toBe(COIN_VALUE * 5)
  })
  it('combines distance and coin scores', () => {
    const d = 200, c = 3
    expect(calcScore(d, c)).toBe(Math.floor(d / DIST_DIVISOR) + c * COIN_VALUE)
  })
  it('DIST_DIVISOR divides evenly', () => {
    expect(calcScore(DIST_DIVISOR, 0)).toBe(1)
  })
})

describe('localStorage high score', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loadHigh returns 0 with no stored value', () => {
    expect(loadHigh()).toBe(0)
  })

  it('saveHigh stores a new high score', () => {
    saveHigh(500)
    expect(loadHigh()).toBe(500)
  })

  it('saveHigh does not overwrite with a lower score', () => {
    saveHigh(500)
    saveHigh(200)
    expect(loadHigh()).toBe(500)
  })

  it('saveHigh overwrites with a higher score', () => {
    saveHigh(500)
    saveHigh(800)
    expect(loadHigh()).toBe(800)
  })
})
