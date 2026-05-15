/**
 * Go AI — heuristic-based engine with optional 1-ply opponent lookahead (Hard).
 *
 * Architecture:
 *   computeAIMove()       — public async entry point (yields to UI thread)
 *   computeMoveSync()     — synchronous core dispatcher
 *   scoreAllMoves()       — evaluate every legal intersection
 *   scoreMove()           — single-move heuristic score (returns null if illegal)
 *     ├─ capture bonus
 *     ├─ group-safety delta (before/after)
 *     ├─ atari threat against opponent
 *     ├─ self-atari penalty
 *     ├─ positional table value
 *     ├─ territory influence
 *     ├─ extension from own stones
 *     └─ connection bonus (merging groups)
 */

import {
  type GameState, type Cell, type Player,
  placeStone, passTurn,
  findGroup, countLiberties, getNeighbors,
} from './engine'

// ─── Public types ──────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard'

interface ScoredMove {
  r:     number
  c:     number
  score: number
}

// ─── Positional tables ─────────────────────────────────────────────────────────
// Values represent the inherent strategic worth of each intersection.
// Star points (3-3, 4-4 on 9×9) and corner approaches are highest.

const POS_9: readonly number[][] = [
  [ -5,  2,  8, 12,  8, 12,  8,  2, -5 ],
  [  2, 18, 14, 12, 10, 12, 14, 18,  2 ],
  [  8, 14, 26, 18, 14, 18, 26, 14,  8 ],  // 3-3 corners: high
  [ 12, 12, 18, 24, 18, 24, 18, 12, 12 ],  // 4-4 star pts: high
  [  8, 10, 14, 18, 16, 18, 14, 10,  8 ],  // tengen area
  [ 12, 12, 18, 24, 18, 24, 18, 12, 12 ],
  [  8, 14, 26, 18, 14, 18, 26, 14,  8 ],
  [  2, 18, 14, 12, 10, 12, 14, 18,  2 ],
  [ -5,  2,  8, 12,  8, 12,  8,  2, -5 ],
] as const

/** Returns the positional table value for a given board size and coordinate. */
function getPosValue(size: number, r: number, c: number): number {
  if (size === 9) return POS_9[r][c]

  // Formula-based for 13×13 / 19×19: distance from nearest edge drives value
  const edgeDist = Math.min(r, c, size - 1 - r, size - 1 - c)
  if (edgeDist === 0) return -5
  if (edgeDist === 1) return  8
  if (edgeDist === 2) return 18  // 3-point line — good territory line
  if (edgeDist === 3) return 16  // 4-point line — good influence line
  return 12                       // interior
}

// ─── Sub-heuristics ────────────────────────────────────────────────────────────

/**
 * Score based on empty intersections within Manhattan distance ≤3 of (r, c).
 * Closer empty points = more potential territory.
 * Opponent stones nearby = contested value (slight bonus for tension).
 */
function getTerritoryInfluence(
  board: Cell[][], size: number, r: number, c: number, player: Player
): number {
  const opponent = player === 1 ? 2 : 1
  let score = 0

  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      const dist = Math.abs(dr) + Math.abs(dc)
      if (dist === 0 || dist > 3) continue
      const nr = r + dr, nc = c + dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue

      const weight = 4 - dist   // 3 at dist-1, 2 at dist-2, 1 at dist-3
      const cell = board[nr][nc]
      if (cell === 0)        score += weight * 2       // empty = potential territory
      else if (cell === (opponent as number)) score += weight     // opponent stone = contested
    }
  }
  return score
}

/**
 * Bonus for playing near our own stones at the right "extension" distances.
 * Go extensions: 2-space (skip 1) ≈ most common; 3-space if open board.
 * Adjacent placement (dist 1) is low value — already connected.
 */
function getExtensionBonus(
  board: Cell[][], size: number, r: number, c: number, player: Player
): number {
  let minDist = Infinity

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] !== player) continue
      const d = Math.abs(row - r) + Math.abs(col - c)
      if (d < minDist) minDist = d
    }
  }

  if (minDist === Infinity) return 0  // no stones yet
  if (minDist === 1)        return  3  // already adjacent — very low bonus
  if (minDist === 2)        return 14  // knight's-move extension — great
  if (minDist === 3)        return  9  // 2-space extension
  if (minDist === 4)        return  4  // 3-space — decent if open
  return 0
}

/**
 * Bonus when a move touches stones from two or more distinct groups of ours.
 * Connecting groups dramatically improves their safety (shared liberties).
 */
function getConnectionBonus(
  board: Cell[][], size: number, r: number, c: number, player: Player
): number {
  const groups: Set<string>[] = []

  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (board[nr][nc] !== player) continue

    let found = false
    for (const g of groups) {
      if (g.has(`${nr},${nc}`)) { found = true; break }
    }

    if (!found) {
      const group = findGroup(board, size, nr, nc)
      groups.push(new Set(group.map(([gr, gc]) => `${gr},${gc}`)))
    }
  }

  if (groups.length >= 2) return 50   // connecting ≥2 groups = high value
  return 0
}

// ─── Core move scorer ─────────────────────────────────────────────────────────

/**
 * Returns a heuristic score for placing a stone at (r, c).
 * Returns null if the move is illegal.
 *
 * Score components (approximate weight ranges):
 *   capture bonus       0–300+
 *   save endangered    0–200
 *   atari threat       0–150
 *   self-atari penalty 0 to -150
 *   connection bonus   0–50
 *   extension bonus    0–14
 *   positional value   -5–26  (scaled by game phase)
 *   territory          0–18
 */
function scoreMove(state: GameState, r: number, c: number): number | null {
  const { board, size, turn, moveCount } = state
  if (board[r][c] !== 0) return null

  const result = placeStone(state, r, c)
  if (result.error !== null) return null

  const { state: next, captured } = result
  const opponent = (turn === 1 ? 2 : 1) as Player
  let score = 0

  // ── 1. Capture value ────────────────────────────────────────────────────────
  // Large stones = more valuable (removing a 4-stone group is huge)
  score += captured.length * 150

  // ── 2. Group-safety analysis for our newly placed stone ─────────────────────
  const myGroup = findGroup(next.board, size, r, c)
  const myLibs  = countLiberties(next.board, size, myGroup)

  if (myLibs <= 1 && captured.length === 0) {
    score -= 130   // self-atari with no gain — very bad
  } else if (myLibs === 2 && captured.length === 0 && myGroup.length === 1) {
    score -= 25    // isolated stone with only 2 libs — slightly risky
  }

  // Gentle liberty bonus (prefer breathing room)
  score += Math.min(myLibs, 5) * 4

  // ── 3. Saving our endangered adjacent groups ─────────────────────────────────
  const savedGroupKeys = new Set<string>()
  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (board[nr][nc] !== turn) continue
    if (savedGroupKeys.has(`${nr},${nc}`)) continue

    const preGroup = findGroup(board, size, nr, nc)
    preGroup.forEach(([gr, gc]) => savedGroupKeys.add(`${gr},${gc}`))
    const preLibs = countLiberties(board, size, preGroup)

    if (preLibs <= 2) {
      const postGroup = findGroup(next.board, size, nr, nc)
      const postLibs  = countLiberties(next.board, size, postGroup)
      const gained    = postLibs - preLibs
      // More urgent (fewer pre-libs) = bigger bonus
      score += gained * 75 + (3 - preLibs) * 55
    }
  }

  // ── 4. Atari threats against the opponent ────────────────────────────────────
  const threatenedKeys = new Set<string>()
  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (next.board[nr][nc] !== opponent) continue
    if (threatenedKeys.has(`${nr},${nc}`)) continue

    const oppGroup = findGroup(next.board, size, nr, nc)
    oppGroup.forEach(([or, oc]) => threatenedKeys.add(`${or},${oc}`))
    const oppLibs = countLiberties(next.board, size, oppGroup)

    if (oppLibs === 1) {
      // Atari! Bigger group = more valuable to threaten
      score += 80 + oppGroup.length * 22
    } else if (oppLibs === 2) {
      score += 28 + oppGroup.length * 7
    }
  }

  // ── 5. Positional value (scaled by game phase — more impactful early) ────────
  const boardArea   = size * size
  const phaseFactor = Math.max(0.2, 1 - moveCount / (boardArea * 0.65))
  score += getPosValue(size, r, c) * (0.25 + 0.75 * phaseFactor)

  // ── 6. Territory influence ───────────────────────────────────────────────────
  score += getTerritoryInfluence(board, size, r, c, turn)

  // ── 7. Extension from own stones ─────────────────────────────────────────────
  score += getExtensionBonus(board, size, r, c, turn)

  // ── 8. Connection bonus ──────────────────────────────────────────────────────
  score += getConnectionBonus(board, size, r, c, turn)

  return score
}

// ─── Candidate generation ──────────────────────────────────────────────────────

function scoreAllMoves(state: GameState): ScoredMove[] {
  const { size, board } = state
  const moves: ScoredMove[] = []

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== 0) continue
      const s = scoreMove(state, r, c)
      if (s !== null) moves.push({ r, c, score: s })
    }
  }

  return moves
}

// ─── Should the AI pass? ──────────────────────────────────────────────────────

function shouldPass(state: GameState, bestScore: number): boolean {
  const boardArea = state.size * state.size
  // Only consider passing if a meaningful portion of the board is filled
  const filled = state.board.flat().filter(c => c !== 0).length
  if (filled < boardArea * 0.35) return false  // too early to pass

  return bestScore < 4   // no worthwhile move found
}

// ─── Difficulty-specific selection ────────────────────────────────────────────

function applyNoise(moves: ScoredMove[], scale: number): ScoredMove[] {
  return moves.map(m => ({
    ...m,
    score: m.score + (Math.random() - 0.5) * 2 * scale,
  }))
}

function pickFromPool(sorted: ScoredMove[], poolSize: number): ScoredMove {
  const n = Math.min(poolSize, sorted.length)
  return sorted[Math.floor(Math.random() * n)]
}

// ─── 1-ply opponent lookahead (Hard mode) ─────────────────────────────────────
// For each of our top-N candidates, simulate the opponent's best response.
// Penalise candidates that give the opponent a strong follow-up.

function applyLookahead(state: GameState, candidates: ScoredMove[]): ScoredMove[] {
  const maxPool = state.size <= 9 ? 8 : state.size <= 13 ? 5 : 3

  return candidates.slice(0, maxPool).map(candidate => {
    const simResult = placeStone(state, candidate.r, candidate.c)
    if (simResult.error) return candidate

    // Find opponent's best response
    let opponentBest = 0
    const { board, size } = simResult.state
    const oppTurn = simResult.state.turn

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== 0) continue
        const s = scoreMove(simResult.state, r, c)
        if (s !== null && s > opponentBest) opponentBest = s
      }
    }

    // Discount candidate if opponent gains a lot
    return {
      ...candidate,
      score: candidate.score - opponentBest * 0.42,
    }
  })
}

// ─── Core synchronous computation ────────────────────────────────────────────

function computeMoveSync(state: GameState, difficulty: Difficulty): { r: number; c: number } | 'pass' {
  const rawMoves = scoreAllMoves(state)

  if (rawMoves.length === 0) return 'pass'

  // Apply noise and sort descending
  const noiseScale = difficulty === 'easy' ? 38 : difficulty === 'medium' ? 14 : 2
  const noisyMoves = applyNoise(rawMoves, noiseScale)
  noisyMoves.sort((a, b) => b.score - a.score)

  const bestScore = noisyMoves[0].score

  // Pass when no worthwhile move exists
  if (shouldPass(state, bestScore)) return 'pass'

  if (difficulty === 'easy') {
    // Pick randomly from top-6 — makes occasional "mistakes"
    return pickFromPool(noisyMoves, 6)
  }

  if (difficulty === 'medium') {
    return pickFromPool(noisyMoves, 2)
  }

  // Hard: 1-ply lookahead on top candidates, then pick best
  const adjusted = applyLookahead(state, noisyMoves)
  adjusted.sort((a, b) => b.score - a.score)
  // Tiny residual noise so Hard isn't perfectly deterministic
  return pickFromPool(adjusted, 2)
}

// ─── Public async API ─────────────────────────────────────────────────────────

/**
 * Computes the AI's next move asynchronously (yields to the render thread first).
 *
 * Returns `{ r, c }` for a stone placement, or `'pass'`.
 * Never throws — falls back to `'pass'` on any error.
 */
export async function computeAIMove(
  state: GameState,
  difficulty: Difficulty
): Promise<{ r: number; c: number } | 'pass'> {
  return new Promise(resolve => {
    // Yield to let React flush pending renders, then compute
    setTimeout(() => {
      try {
        resolve(computeMoveSync(state, difficulty))
      } catch {
        resolve('pass')
      }
    }, 0)
  })
}

// ─── (Optional) CPU-vs-CPU simulation for debugging ──────────────────────────

/** Run a full game between two AI players synchronously and return the final state. */
export function simulateCPUGame(
  size: number,
  blackDiff: Difficulty = 'medium',
  whiteDiff: Difficulty = 'medium',
  maxMoves = 300
): GameState {
  const { createGame } = require('./engine') as typeof import('./engine')
  let state: GameState = createGame(size)

  for (let i = 0; i < maxMoves && !state.done; i++) {
    const diff = state.turn === 1 ? blackDiff : whiteDiff
    const move = computeMoveSync(state, diff)

    if (move === 'pass') {
      state = passTurn(state)
    } else {
      const result = placeStone(state, move.r, move.c)
      state = result.error ? passTurn(state) : result.state
    }
  }

  return state
}
