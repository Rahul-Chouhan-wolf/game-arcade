// ─── Cryptogram · Cipher engine ───────────────────────────────────────────────
// Pure functions — no React, no DOM, no side effects.
// All substitution logic lives here for total determinism.

export const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = (Math.abs(seed ^ 0xdeadbeef) >>> 0) + 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ─── Cipher key ───────────────────────────────────────────────────────────────
// Generates a derangement (bijection with no fixed points):
//   cipherKey[plain]  = cipher  (A → M, B → Q, …)
//   reverseKey[cipher] = plain  (M → A, Q → B, …)

export function buildCipherKey(seed: number): {
  cipherKey:  Record<string, string>
  reverseKey: Record<string, string>
} {
  const rng = seededRng(seed)
  let arr: string[] = []
  let attempts = 0

  // Reject permutations with fixed points (expected ~1.6 tries for 26 letters)
  do {
    arr = [...ALPHA]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    attempts++
  } while (arr.some((ch, i) => ch === ALPHA[i]) && attempts < 30)

  const cipherKey:  Record<string, string> = {}
  const reverseKey: Record<string, string> = {}
  for (let i = 0; i < 26; i++) {
    cipherKey[ALPHA[i]] = arr[i]
    reverseKey[arr[i]]  = ALPHA[i]
  }
  return { cipherKey, reverseKey }
}

// ─── Text encoding ────────────────────────────────────────────────────────────

/** Encode plain text → ciphertext (uppercase, preserves spaces/punctuation). */
export function encodeText(
  plain: string,
  cipherKey: Record<string, string>,
): string {
  return plain
    .toUpperCase()
    .split('')
    .map(ch => (/[A-Z]/.test(ch) ? cipherKey[ch] ?? ch : ch))
    .join('')
}

// ─── User mapping operations ──────────────────────────────────────────────────
// One-to-one enforcement: each plain letter can only be assigned to one cipher.

/**
 * Assign `plainGuess` to `cipherLetter`.
 * Clears any other cipher letter that was previously mapped to `plainGuess`.
 */
export function setGuess(
  cipherLetter: string,
  plainGuess:   string,
  prev:         Record<string, string>,
): Record<string, string> {
  const next = { ...prev }
  // Remove conflicting assignment (one-to-one enforcement)
  for (const k of Object.keys(next)) {
    if (next[k] === plainGuess && k !== cipherLetter) delete next[k]
  }
  if (plainGuess) next[cipherLetter] = plainGuess
  else delete next[cipherLetter]
  return next
}

/** Clear the guess for a single cipher letter. */
export function clearGuess(
  cipherLetter: string,
  prev:         Record<string, string>,
): Record<string, string> {
  const next = { ...prev }
  delete next[cipherLetter]
  return next
}

/** Reset all user guesses. */
export function resetMapping(): Record<string, string> {
  return {}
}

// ─── Completion check ─────────────────────────────────────────────────────────

export interface CompletionState {
  solved:       boolean
  correctCount: number
  totalUnique:  number
}

export function checkCompletion(
  ciphertext:  string,
  reverseKey:  Record<string, string>,
  userMapping: Record<string, string>,
): CompletionState {
  const unique = new Set(
    ciphertext.split('').filter(ch => /[A-Z]/.test(ch))
  )
  let correctCount = 0
  for (const cl of unique) {
    if (userMapping[cl] && userMapping[cl] === reverseKey[cl]) correctCount++
  }
  return { solved: correctCount === unique.size, correctCount, totalUnique: unique.size }
}

// ─── Frequency analysis ───────────────────────────────────────────────────────

export interface FreqEntry {
  letter: string
  count:  number
  pct:    number
}

export function getFrequencies(ciphertext: string): FreqEntry[] {
  const counts: Record<string, number> = {}
  let total = 0
  for (const ch of ciphertext) {
    if (/[A-Z]/.test(ch)) {
      counts[ch] = (counts[ch] ?? 0) + 1
      total++
    }
  }
  return Object.entries(counts)
    .map(([letter, count]) => ({ letter, count, pct: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
}

/** English letter frequency reference (descending). */
export const EN_FREQ: Record<string, number> = {
  E: 0.127, T: 0.091, A: 0.082, O: 0.075, I: 0.070,
  N: 0.067, S: 0.063, H: 0.061, R: 0.060, D: 0.043,
  L: 0.040, C: 0.028, U: 0.028, M: 0.024, W: 0.024,
  F: 0.022, G: 0.020, Y: 0.020, P: 0.019, B: 0.015,
  V: 0.010, K: 0.008, J: 0.002, X: 0.002, Q: 0.001, Z: 0.001,
}

/** Ordered list of unique cipher letters as they first appear in ciphertext. */
export function getUniqueCipherLetters(ciphertext: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const ch of ciphertext) {
    if (/[A-Z]/.test(ch) && !seen.has(ch)) {
      seen.add(ch)
      result.push(ch)
    }
  }
  return result
}

// ─── Hint helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the cipher letters that are still unsolved, ordered by frequency
 * (most frequent first — most impactful hints).
 */
export function getHintCandidates(
  ciphertext:  string,
  reverseKey:  Record<string, string>,
  userMapping: Record<string, string>,
): string[] {
  return getFrequencies(ciphertext)
    .filter(({ letter }) => userMapping[letter] !== reverseKey[letter])
    .map(({ letter }) => letter)
}

/** Apply one hint: reveal the correct plain letter for the given cipher letter. */
export function applyHint(
  cipherLetter: string,
  reverseKey:   Record<string, string>,
  userMapping:  Record<string, string>,
): Record<string, string> {
  return setGuess(cipherLetter, reverseKey[cipherLetter], userMapping)
}
