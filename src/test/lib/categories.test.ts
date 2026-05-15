import { describe, it, expect } from 'vitest'
import { CATEGORY_DATA } from '@/lib/lexle/categories'
import { FALLBACK } from '@/lib/lexle/fallback'

const WORD_LENGTHS = [4, 5, 6, 7] as const

// ── CATEGORY_DATA ─────────────────────────────────────────────────────────────

describe('CATEGORY_DATA', () => {
  it('has all expected categories', () => {
    const expected = ['any', 'animals', 'countries', 'fruits', 'foods', 'sports', 'colors']
    expected.forEach(cat => expect(CATEGORY_DATA).toHaveProperty(cat))
  })

  it('"any" category has null words (uses Datamuse pool)', () => {
    expect(CATEGORY_DATA.any.words).toBeNull()
  })

  it('every non-any category has a label and emoji', () => {
    Object.entries(CATEGORY_DATA).forEach(([key, cat]) => {
      if (key === 'any') return
      expect(cat.label).toBeTruthy()
      expect(cat.emoji).toBeTruthy()
    })
  })

  it('every category word list covers all 4 word lengths', () => {
    Object.entries(CATEGORY_DATA).forEach(([key, cat]) => {
      if (key === 'any' || !cat.words) return
      WORD_LENGTHS.forEach(len => {
        expect(cat.words).toHaveProperty(String(len))
        expect((cat.words as Record<number, string[]>)[len].length).toBeGreaterThan(0)
      })
    })
  })

  it('every word has the correct length for its bucket', () => {
    Object.entries(CATEGORY_DATA).forEach(([key, cat]) => {
      if (key === 'any' || !cat.words) return
      WORD_LENGTHS.forEach(len => {
        const words = (cat.words as Record<number, string[]>)[len]
        words.forEach(word => {
          expect(word.length).toBe(len)
        })
      })
    })
  })

  it('every word is lowercase', () => {
    Object.entries(CATEGORY_DATA).forEach(([key, cat]) => {
      if (key === 'any' || !cat.words) return
      WORD_LENGTHS.forEach(len => {
        const words = (cat.words as Record<number, string[]>)[len]
        words.forEach(word => {
          expect(word).toBe(word.toLowerCase())
        })
      })
    })
  })

  it('every word contains only a-z characters', () => {
    Object.entries(CATEGORY_DATA).forEach(([key, cat]) => {
      if (key === 'any' || !cat.words) return
      WORD_LENGTHS.forEach(len => {
        const words = (cat.words as Record<number, string[]>)[len]
        words.forEach(word => {
          expect(word).toMatch(/^[a-z]+$/)
        })
      })
    })
  })

  it('has no duplicate words within a category+length bucket', () => {
    Object.entries(CATEGORY_DATA).forEach(([key, cat]) => {
      if (key === 'any' || !cat.words) return
      WORD_LENGTHS.forEach(len => {
        const words = (cat.words as Record<number, string[]>)[len]
        const unique = new Set(words)
        expect(unique.size).toBe(words.length)
      })
    })
  })

  it('countries bucket contains expected entries', () => {
    const countries5 = CATEGORY_DATA.countries.words![5]
    expect(countries5).toContain('india')
    expect(countries5).toContain('italy')
    expect(countries5).toContain('japan')
    expect(countries5).toContain('china')
  })

  it('animals bucket contains expected entries', () => {
    const animals5 = CATEGORY_DATA.animals.words![5]
    expect(animals5).toContain('tiger')
    expect(animals5).toContain('shark')
    expect(animals5).toContain('eagle')
  })
})

// ── FALLBACK ──────────────────────────────────────────────────────────────────

describe('FALLBACK', () => {
  it('covers all 4 word lengths', () => {
    WORD_LENGTHS.forEach(len => {
      expect(FALLBACK).toHaveProperty(String(len))
      expect(FALLBACK[len].length).toBeGreaterThan(0)
    })
  })

  it('every fallback word has the correct length', () => {
    WORD_LENGTHS.forEach(len => {
      FALLBACK[len].forEach(word => {
        expect(word.length).toBe(len)
      })
    })
  })

  it('every fallback word is lowercase a-z only', () => {
    WORD_LENGTHS.forEach(len => {
      FALLBACK[len].forEach(word => {
        expect(word).toMatch(/^[a-z]+$/)
      })
    })
  })

  it('has at least 20 fallback words per length', () => {
    WORD_LENGTHS.forEach(len => {
      expect(FALLBACK[len].length).toBeGreaterThanOrEqual(20)
    })
  })

  it('has no duplicates per length', () => {
    WORD_LENGTHS.forEach(len => {
      const unique = new Set(FALLBACK[len])
      expect(unique.size).toBe(FALLBACK[len].length)
    })
  })
})
