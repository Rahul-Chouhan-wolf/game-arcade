import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLayout } from '@/hooks/useLayout'

// Mock window dimensions
function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth',  { writable: true, configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height })
}

describe('useLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setWindowSize(375, 812) // iPhone-ish default
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a layout object with all expected keys', () => {
    const { result } = renderHook(() => useLayout(5, 6))
    const { layout } = result.current
    expect(layout).toHaveProperty('tileSize')
    expect(layout).toHaveProperty('tileFontSize')
    expect(layout).toHaveProperty('keyH')
    expect(layout).toHaveProperty('keyFontSize')
    expect(layout).toHaveProperty('isMobile')
    expect(layout).toHaveProperty('scratchTileSz')
  })

  it('tileSize is a positive number', () => {
    const { result } = renderHook(() => useLayout(5, 6))
    expect(result.current.layout.tileSize).toBeGreaterThan(0)
  })

  it('tileFontSize ends in px', () => {
    const { result } = renderHook(() => useLayout(5, 6))
    expect(result.current.layout.tileFontSize).toMatch(/px$/)
  })

  it('keyH is clamped between 38 and 58', () => {
    const { result } = renderHook(() => useLayout(5, 6))
    const { keyH } = result.current.layout
    expect(keyH).toBeGreaterThanOrEqual(38)
    expect(keyH).toBeLessThanOrEqual(58)
  })

  it('isMobile is true for vw < 480', () => {
    setWindowSize(375, 812)
    const { result } = renderHook(() => useLayout(5, 6))
    expect(result.current.layout.isMobile).toBe(true)
  })

  it('isMobile is false for vw >= 480', () => {
    setWindowSize(1024, 768)
    const { result } = renderHook(() => useLayout(5, 6))
    expect(result.current.layout.isMobile).toBe(false)
  })

  it('tileSize is smaller for longer words', () => {
    setWindowSize(375, 812)
    const { result: r5 } = renderHook(() => useLayout(5, 6))
    const { result: r7 } = renderHook(() => useLayout(7, 6))
    // 5-letter cap is 62, 7-letter cap is 44 — longer words are always smaller
    expect(r5.current.layout.tileSize).toBeGreaterThanOrEqual(r7.current.layout.tileSize)
  })

  it('tileSize respects the per-length max cap', () => {
    setWindowSize(1440, 900) // large desktop — unconstrained by viewport
    const maxSizes: Record<number, number> = { 4: 70, 5: 62, 6: 52, 7: 44 }
    ;([4, 5, 6, 7] as const).forEach(len => {
      const { result } = renderHook(() => useLayout(len, 6))
      expect(result.current.layout.tileSize).toBeLessThanOrEqual(maxSizes[len])
    })
  })

  it('tileSize never falls below 28', () => {
    setWindowSize(200, 400) // tiny screen
    const { result } = renderHook(() => useLayout(7, 8))
    expect(result.current.layout.tileSize).toBeGreaterThanOrEqual(28)
  })

  it('recomputes layout when recompute() is called', () => {
    // Use a tiny screen (tileSize will be ~30) then switch to wide (tileSize hits max cap)
    setWindowSize(250, 500)
    const { result } = renderHook(() => useLayout(5, 6))
    const before = result.current.layout.tileSize

    setWindowSize(1440, 900)
    act(() => { result.current.recompute() })

    expect(result.current.layout.tileSize).not.toBe(before)
  })

  it('recomputes on window resize (debounced at 150ms)', () => {
    setWindowSize(250, 500) // tiny — tileSize well below the 62 cap
    const { result } = renderHook(() => useLayout(5, 6))
    const before = result.current.layout.tileSize

    setWindowSize(1440, 900)
    act(() => { window.dispatchEvent(new Event('resize')) })
    // Before debounce fires — still old value
    expect(result.current.layout.tileSize).toBe(before)

    // After debounce fires
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.layout.tileSize).not.toBe(before)
  })
})
