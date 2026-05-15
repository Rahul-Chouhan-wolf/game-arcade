import { describe, it, expect } from 'vitest'
import { evaluateGuess, checkHardMode } from '@/lib/lexle/evaluate'

// ── evaluateGuess ─────────────────────────────────────────────────────────────

describe('evaluateGuess', () => {
  it('marks all tiles correct when guess equals target', () => {
    const result = evaluateGuess('crane', 'crane')
    expect(result.every(t => t.state === 'correct')).toBe(true)
    expect(result.map(t => t.letter)).toEqual(['C','R','A','N','E'])
  })

  it('marks all tiles absent when no letters match', () => {
    const result = evaluateGuess('xxxxx', 'crane')
    expect(result.every(t => t.state === 'absent')).toBe(true)
  })

  it('marks correct position as correct', () => {
    const result = evaluateGuess('crane', 'crimp')
    expect(result[0]).toEqual({ letter: 'C', state: 'correct' })
    expect(result[1]).toEqual({ letter: 'R', state: 'correct' })
  })

  it('marks present when letter exists but is in wrong position', () => {
    // 'a' is in crane but at position 2, not position 0
    const result = evaluateGuess('abcde', 'crane')
    const a = result[0]
    expect(a.letter).toBe('A')
    expect(a.state).toBe('present')
  })

  it('does not double-count duplicate letters in guess', () => {
    // target has one 'a', guess has two — only one should be present/correct
    const result = evaluateGuess('aabcd', 'crane')
    const aStates = result.filter(t => t.letter === 'A').map(t => t.state)
    const nonAbsent = aStates.filter(s => s !== 'absent')
    expect(nonAbsent.length).toBe(1)
  })

  it('handles duplicate letters in target correctly', () => {
    // target "speed" has two e's
    const result = evaluateGuess('eerie', 'speed')
    // first 'E' in guess (pos 0) — 'e' exists in target → present
    expect(result[0].state).not.toBe('correct')
    // overall: should not mark more e's as present/correct than exist in target
    const eCount = result.filter(t => t.letter === 'E' && t.state !== 'absent').length
    expect(eCount).toBeLessThanOrEqual(2)
  })

  it('correct takes priority over present for same letter', () => {
    // 'r' is correct at pos 0 in target 'react', guess 'rover' has r at 0 (correct) and r at 2 (should be absent)
    const result = evaluateGuess('rover', 'react')
    expect(result[0]).toEqual({ letter: 'R', state: 'correct' }) // r in right spot
    expect(result[2]).toEqual({ letter: 'V', state: 'absent' })
  })

  it('returns uppercase letters', () => {
    const result = evaluateGuess('crane', 'crane')
    result.forEach(t => expect(t.letter).toMatch(/^[A-Z]$/))
  })

  it('works with 4-letter words', () => {
    const result = evaluateGuess('bear', 'beer')
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual({ letter: 'B', state: 'correct' })
    expect(result[1]).toEqual({ letter: 'E', state: 'correct' })
    expect(result[2]).toEqual({ letter: 'A', state: 'absent' })
    expect(result[3]).toEqual({ letter: 'R', state: 'correct' })
  })

  it('works with 7-letter words', () => {
    const result = evaluateGuess('kingdom', 'kindred')
    expect(result).toHaveLength(7)
    expect(result[0]).toEqual({ letter: 'K', state: 'correct' })
    expect(result[1]).toEqual({ letter: 'I', state: 'correct' })
    expect(result[2]).toEqual({ letter: 'N', state: 'correct' })
    expect(result[3]).toEqual({ letter: 'G', state: 'absent' })
  })
})

// ── checkHardMode ─────────────────────────────────────────────────────────────

describe('checkHardMode', () => {
  it('returns null when all constraints are satisfied', () => {
    const hardCorrect = { 0: 'C', 1: 'R' }
    const hardPresent = new Set(['A'])
    expect(checkHardMode('crane', hardCorrect, hardPresent)).toBeNull()
  })

  it('returns error when a correct-position letter is missing', () => {
    const hardCorrect = { 0: 'C' }
    const hardPresent = new Set<string>()
    const err = checkHardMode('brave', hardCorrect, hardPresent)
    expect(err).toBeTruthy()
    expect(err).toContain('Position 1')
    expect(err).toContain('C')
  })

  it('returns error when a present letter is not included', () => {
    const hardCorrect = {}
    const hardPresent = new Set(['R'])
    const err = checkHardMode('spine', hardCorrect, hardPresent)
    expect(err).toBeTruthy()
    expect(err).toContain('R')
  })

  it('returns null with empty constraints', () => {
    expect(checkHardMode('crane', {}, new Set())).toBeNull()
  })

  it('is case-insensitive (normalises to uppercase internally)', () => {
    const hardCorrect = { 0: 'C' }
    const hardPresent = new Set<string>()
    // Pass lowercase word — function should uppercase internally
    expect(checkHardMode('crane', hardCorrect, hardPresent)).toBeNull()
  })

  it('checks correct positions before present letters', () => {
    // Position 0 must be 'C', AND 'R' must be present
    const hardCorrect = { 0: 'C' }
    const hardPresent = new Set(['R'])
    // 'brave' fails position 0
    expect(checkHardMode('brave', hardCorrect, hardPresent)).toContain('Position 1')
    // 'clout' satisfies position 0 but lacks 'R'
    expect(checkHardMode('clout', hardCorrect, hardPresent)).toContain('R')
    // 'crane' satisfies both
    expect(checkHardMode('crane', hardCorrect, hardPresent)).toBeNull()
  })
})
