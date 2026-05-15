import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWordPool } from '@/hooks/useWordPool'
import { FALLBACK } from '@/lib/lexle/fallback'

// ── Fetch mock helpers ────────────────────────────────────────────────────────

function mockFetchSuccess(words: string[]) {
  const data = words.map(w => ({ word: w, score: 1 }))
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response)
}

function mockFetchFailure() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

function mockDictionarySuccess() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{
      word: 'crane',
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [{ definition: 'A large bird.', example: 'The crane flew.' }],
      }],
    }]),
  } as Response)
}

describe('useWordPool', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  // ── fetchPool ───────────────────────────────────────────────────────────────

  it('fetchPool returns words from Datamuse API', async () => {
    mockFetchSuccess(['crane', 'brave', 'store', 'tiger', 'flame'])
    const { result } = renderHook(() => useWordPool())
    let pool!: string[]
    await act(async () => { pool = await result.current.fetchPool(5) })
    expect(pool).toContain('crane')
    expect(pool.every(w => w.length === 5)).toBe(true)
  })

  it('fetchPool falls back to FALLBACK words when API fails', async () => {
    mockFetchFailure()
    const { result } = renderHook(() => useWordPool())
    let pool!: string[]
    await act(async () => { pool = await result.current.fetchPool(5) })
    expect(pool.length).toBeGreaterThan(0)
    expect(pool).toEqual(expect.arrayContaining(FALLBACK[5].slice(0, 3)))
  })

  it('fetchPool caches results — second call skips fetch', async () => {
    mockFetchSuccess(['crane', 'brave', 'store'])
    const { result } = renderHook(() => useWordPool())
    await act(async () => { await result.current.fetchPool(5) })
    const callCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length

    await act(async () => { await result.current.fetchPool(5) })
    // No extra fetch calls
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount)
  })

  it('fetchPool filters out non-alphabetic words', async () => {
    mockFetchSuccess(['crane', 'br4ve', 'store', 'fi5ht'])
    const { result } = renderHook(() => useWordPool())
    let pool!: string[]
    await act(async () => { pool = await result.current.fetchPool(5) })
    pool.forEach(w => expect(w).toMatch(/^[a-z]+$/))
  })

  // ── isValidWord ─────────────────────────────────────────────────────────────

  it('isValidWord returns true for a word in the pool cache', async () => {
    mockFetchSuccess(['crane', 'brave'])
    const { result } = renderHook(() => useWordPool())
    await act(async () => { await result.current.fetchPool(5) })

    let valid!: boolean
    await act(async () => { valid = await result.current.isValidWord('crane') })
    expect(valid).toBe(true)
  })

  it('isValidWord returns true when dictionary API returns 200', async () => {
    mockDictionarySuccess()
    const { result } = renderHook(() => useWordPool())
    let valid!: boolean
    await act(async () => { valid = await result.current.isValidWord('crane') })
    expect(valid).toBe(true)
  })

  it('isValidWord returns false when dictionary returns 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) } as Response)
    const { result } = renderHook(() => useWordPool())
    let valid!: boolean
    await act(async () => { valid = await result.current.isValidWord('zxqvk') })
    expect(valid).toBe(false)
  })

  it('isValidWord returns true on network error (fail-open)', async () => {
    mockFetchFailure()
    const { result } = renderHook(() => useWordPool())
    let valid!: boolean
    await act(async () => { valid = await result.current.isValidWord('crane') })
    expect(valid).toBe(true)
  })

  it('isValidWord caches results — second call skips fetch', async () => {
    mockDictionarySuccess()
    const { result } = renderHook(() => useWordPool())
    await act(async () => { await result.current.isValidWord('crane') })
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await act(async () => { await result.current.isValidWord('crane') })
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls)
  })

  // ── getRandomWord ───────────────────────────────────────────────────────────

  it('getRandomWord returns a word of the correct length', async () => {
    mockFetchSuccess(['crane', 'brave', 'store', 'tiger', 'flame'])
    const { result } = renderHook(() => useWordPool())
    await act(async () => { await result.current.fetchPool(5) })
    const word = result.current.getRandomWord(5, 'any', new Set())
    expect(word.length).toBe(5)
  })

  it('getRandomWord avoids used words when pool allows', async () => {
    // Use 20+ words so the hook doesn't fall back to FALLBACK (threshold is <20)
    const poolWords = Array.from({ length: 25 }, (_, i) => `word${i}`.padEnd(5, 'a').slice(0, 5))
    // ensure unique valid 5-letter a-z words
    const valid5 = ['crane','brave','store','tiger','flame','shelf','trick','night',
      'ghost','pizza','joker','queen','blend','crisp','draft','flint','graze',
      'hover','jewel','knack','lower','mirth','novel','outdo','plumb']
    mockFetchSuccess(valid5)
    const { result } = renderHook(() => useWordPool())
    await act(async () => { await result.current.fetchPool(5) })

    // Mark all but 'store' as used
    const used = new Set(valid5.filter(w => w !== 'store'))
    const word = result.current.getRandomWord(5, 'any', used)
    expect(word).toBe('store')
  })

  it('getRandomWord uses category pool when category is set', async () => {
    const { result } = renderHook(() => useWordPool())
    const { CATEGORY_DATA } = await import('@/lib/lexle/categories')
    const allAnimals5 = CATEGORY_DATA.animals.words![5]
    const word = result.current.getRandomWord(5, 'animals', new Set())
    expect(allAnimals5).toContain(word)
  })

  // ── preCacheAllCategories ───────────────────────────────────────────────────

  it('preCacheAllCategories marks category words as valid', async () => {
    mockFetchFailure() // Dictionary API should NOT be called for cached words
    const { result } = renderHook(() => useWordPool())
    act(() => { result.current.preCacheAllCategories() })

    // 'italy' is a country word — should be valid without hitting API
    let valid!: boolean
    await act(async () => { valid = await result.current.isValidWord('italy') })
    expect(valid).toBe(true)
    // fetch should not have been called for 'italy'
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('preCacheAllCategories marks animals as valid', async () => {
    global.fetch = vi.fn()
    const { result } = renderHook(() => useWordPool())
    act(() => { result.current.preCacheAllCategories() })

    let valid!: boolean
    await act(async () => { valid = await result.current.isValidWord('tiger') })
    expect(valid).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // ── loading state ───────────────────────────────────────────────────────────

  it('loading is false initially', () => {
    const { result } = renderHook(() => useWordPool())
    expect(result.current.loading).toBe(false)
  })

  it('loading becomes true during fetch and false after', async () => {
    let resolveFetch!: (value: unknown) => void
    global.fetch = vi.fn().mockReturnValue(
      new Promise(resolve => { resolveFetch = resolve })
    )
    const { result } = renderHook(() => useWordPool())
    act(() => { result.current.fetchPool(5) })

    await waitFor(() => expect(result.current.loading).toBe(true))

    act(() => {
      resolveFetch({
        ok: true,
        json: () => Promise.resolve([{ word: 'crane' }]),
      })
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
