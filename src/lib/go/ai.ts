/**
 * Go AI — heuristic engine with territory awareness, eye detection, life/death
 * analysis, tactical patterns, and 1-ply opponent lookahead (Hard mode).
 *
 * Score components per move:
 *   capture bonus           150 per stone captured
 *   save endangered group   up to 250
 *   atari threat            80–200
 *   self-atari penalty      −130
 *   eye formation           40–120 (creating enclosed space)
 *   eye defense / nakade    up to 180 (protect own eye / destroy opponent's)
 *   life-and-death          up to 200 (secure 2nd eye for group)
 *   cut detection           up to 80 (split opponent groups)
 *   diagonal connection     up to 36 (bamboo joint / knight's move)
 *   connection bonus        50 (merge two groups)
 *   extension bonus         up to 14
 *   territory influence     spreading map, 0–40
 *   positional table        −5–26
 */

import {
  type GameState, type Cell, type Player,
  placeStone, passTurn,
  findGroup, countLiberties, getNeighbors,
} from './engine'

// ─── Public types ──────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard'

interface ScoredMove { r: number; c: number; score: number }

// ─── Positional tables ─────────────────────────────────────────────────────────

const POS_9: readonly number[][] = [
  [ -5,  2,  8, 12,  8, 12,  8,  2, -5 ],
  [  2, 18, 14, 12, 10, 12, 14, 18,  2 ],
  [  8, 14, 26, 18, 14, 18, 26, 14,  8 ],
  [ 12, 12, 18, 24, 18, 24, 18, 12, 12 ],
  [  8, 10, 14, 18, 16, 18, 14, 10,  8 ],
  [ 12, 12, 18, 24, 18, 24, 18, 12, 12 ],
  [  8, 14, 26, 18, 14, 18, 26, 14,  8 ],
  [  2, 18, 14, 12, 10, 12, 14, 18,  2 ],
  [ -5,  2,  8, 12,  8, 12,  8,  2, -5 ],
] as const

function getPosValue(size: number, r: number, c: number): number {
  if (size === 9) return POS_9[r][c]
  const edgeDist = Math.min(r, c, size - 1 - r, size - 1 - c)
  if (edgeDist === 0) return -5
  if (edgeDist === 1) return  8
  if (edgeDist === 2) return 18
  if (edgeDist === 3) return 16
  return 12
}

// ─── Spreading influence map ──────────────────────────────────────────────────
/**
 * Builds a territory-influence map using iterative spread with decay.
 * +1000 = black stone, −1000 = white stone.
 * Empty cells acquire weighted average of neighbours over 6 passes.
 * Result: positive → black influence, negative → white influence.
 */
function buildInfluenceMap(board: Cell[][], size: number): number[][] {
  const inf: number[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      if (board[r][c] === 1) return 1000
      if (board[r][c] === 2) return -1000
      return 0
    })
  )

  const DECAY = 0.76
  for (let pass = 0; pass < 6; pass++) {
    const next = inf.map(row => [...row])
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== 0) continue
        let sum = 0, cnt = 0
        for (const [nr, nc] of getNeighbors(size, r, c)) {
          sum += inf[nr][nc]; cnt++
        }
        next[r][c] = (sum / cnt) * DECAY
      }
    }
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        inf[r][c] = next[r][c]
  }
  return inf
}

/**
 * Territory value of a move at (r,c) based on the influence map.
 * We reward moves in contested or opponent-dominated areas (flipping territory)
 * and penalise moves in already-owned areas (waste).
 */
function getInfluenceScore(
  inf: number[][], size: number, r: number, c: number, player: Player
): number {
  const sign = player === 1 ? 1 : -1
  const myInf = inf[r][c] * sign   // positive = already ours

  // Claim contested / opponent regions — flip value proportional to distance from 0
  if (myInf < -30) return 22    // strongly opponent-controlled → high priority
  if (myInf <  10) return 14    // neutral / slightly theirs → good territory move
  if (myInf <  60) return  6    // lightly ours — still some value
  return 0                        // already securely ours — little gain
}

// ─── Eye detection ─────────────────────────────────────────────────────────────

/**
 * Counts how many orthogonal neighbours of (r,c) are occupied by `player`.
 */
function friendlyNeighbourCount(board: Cell[][], size: number, r: number, c: number, player: Player): number {
  return getNeighbors(size, r, c).filter(([nr, nc]) => board[nr][nc] === player).length
}

/**
 * Returns true if (r,c) is a "solid eye" for `player`:
 * all 4 orthogonal neighbours belong to `player` (or are board edges),
 * AND at least 3 of the (up to 4) diagonal neighbours do too.
 * A solid eye can never be destroyed by the opponent.
 */
function isSolidEye(board: Cell[][], size: number, r: number, c: number, player: Player): boolean {
  if (board[r][c] !== 0) return false
  // All orthogonal must be friendly or off-board
  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (board[nr][nc] !== player) return false
  }
  // Check diagonals
  const diags: [number, number][] = [
    [r-1,c-1],[r-1,c+1],[r+1,c-1],[r+1,c+1],
  ]
  const validDiags = diags.filter(([dr, dc]) => dr >= 0 && dr < size && dc >= 0 && dc < size)
  const friendlyDiags = validDiags.filter(([dr, dc]) => board[dr][dc] === player).length
  // Corner: 1+ friendly diag; edge: 2+; interior: 3+
  const needed = validDiags.length <= 2 ? 1 : validDiags.length === 3 ? 2 : 3
  return friendlyDiags >= needed
}

/**
 * Checks if (r,c) is a "false eye" — enclosed by player but with a diagonal
 * defect that means it's not a reliable second eye.
 */
function isFalseEye(board: Cell[][], size: number, r: number, c: number, player: Player): boolean {
  if (board[r][c] !== 0) return false
  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (board[nr][nc] !== player) return false
  }
  // Orthogonal all friendly — now check diagonals
  const diags: [number, number][] = [
    [r-1,c-1],[r-1,c+1],[r+1,c-1],[r+1,c+1],
  ]
  const validDiags = diags.filter(([dr, dc]) => dr >= 0 && dr < size && dc >= 0 && dc < size)
  const opponentDiags = validDiags.filter(([dr, dc]) => board[dr][dc] !== player && board[dr][dc] !== 0).length
  // If 2+ diagonal opponent stones, it's a false eye
  return opponentDiags >= 2
}

/**
 * Counts genuine enclosed empty regions (candidate eyes) for a group.
 * A region counts if it's surrounded entirely by `player` stones.
 * Returns [true eyes, potential eyes] — true eyes are solid, potential are partial.
 */
function countGroupEyes(board: Cell[][], size: number, group: [number,number][], player: Player): { solid: number, potential: number } {
  const groupSet = new Set(group.map(([r,c]) => `${r},${c}`))
  let solid = 0, potential = 0
  const checkedLibs = new Set<string>()

  for (const [r, c] of group) {
    for (const [nr, nc] of getNeighbors(size, r, c)) {
      const key = `${nr},${nc}`
      if (checkedLibs.has(key) || board[nr][nc] !== 0) continue
      checkedLibs.add(key)

      if (isSolidEye(board, size, nr, nc, player)) { solid++; continue }

      // Potential eye: all orthogonal neighbours are our stones or off-board, some diags ok
      const ns = getNeighbors(size, nr, nc)
      const allFriendly = ns.every(([a,b]) => board[a][b] === player || groupSet.has(`${a},${b}`))
      if (allFriendly && !isFalseEye(board, size, nr, nc, player)) potential++
    }
  }

  return { solid, potential }
}

/**
 * Score bonus for how a move at (r,c) affects eye-creation for `player`.
 * High bonus for moves that secure a second eye for an imperilled group.
 * Also bonuses for moves that help form eye-space in general.
 */
function getEyeScore(
  board: Cell[][], size: number, r: number, c: number, player: Player
): number {
  const tmp = board.map(row => [...row] as Cell[])
  tmp[r][c] = player
  let score = 0

  // Bonus: does placing here create a solid eye nearby?
  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (tmp[nr][nc] !== 0) continue
    if (isSolidEye(tmp, size, nr, nc, player)) score += 80
  }

  // Bonus: does this move help a group form its 2nd eye?
  const myGroup = findGroup(tmp, size, r, c)
  if (myGroup.length > 0) {
    const { solid, potential } = countGroupEyes(tmp, size, myGroup, player)
    if (solid >= 2) score += 120   // group now has 2 solid eyes → unconditionally alive
    else if (solid === 1 && potential >= 1) score += 60
    else if (solid === 1) score += 20
    else if (potential >= 2) score += 30
  }

  // Bonus: does this move close off space that forms eye-like region around group?
  const fn = friendlyNeighbourCount(board, size, r, c, player)
  if (fn >= 3) score += 30   // 3+ friendly neighbours → this is the "closing" move of an eye
  else if (fn === 2) score += 10

  return score
}

/**
 * Score for defending own eyes / attacking opponent eye-formation (nakade).
 * Rewards moves that prevent opponent from forming eyes inside our territory.
 */
function getNakadeScore(
  board: Cell[][], size: number, r: number, c: number, player: Player
): number {
  const opponent = (player === 1 ? 2 : 1) as Player
  let score = 0

  // Check if (r,c) is the vital point inside opponent's eye space
  // If opponent has almost-enclosed space, playing at vital point kills it
  const oppNeighbours = getNeighbors(size, r, c).filter(([nr, nc]) => board[nr][nc] === opponent).length
  if (oppNeighbours >= 3) {
    // This cell is surrounded by opponent — playing here is a nakade (eye-steal)
    score += 180
  } else if (oppNeighbours === 2) {
    // Potential future nakade
    score += 40
  }

  return score
}

// ─── Cut detection ─────────────────────────────────────────────────────────────

/**
 * Bonus for a move that cuts opponent groups (separates connected stones).
 * We detect this by counting distinct opponent groups adjacent to (r,c) after the move.
 * Cutting is one of the most powerful tactics in Go.
 */
function getCutScore(
  board: Cell[][], size: number, r: number, c: number, player: Player
): number {
  const opponent = (player === 1 ? 2 : 1) as Player
  const tmp = board.map(row => [...row] as Cell[])
  tmp[r][c] = player

  const groups: Set<string>[] = []
  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (tmp[nr][nc] !== opponent) continue
    let found = false
    for (const g of groups) {
      if (g.has(`${nr},${nc}`)) { found = true; break }
    }
    if (!found) {
      const grp = findGroup(tmp, size, nr, nc)
      groups.push(new Set(grp.map(([gr, gc]) => `${gr},${gc}`)))
    }
  }

  if (groups.length >= 2) {
    // We are cutting between 2+ opponent groups
    // Larger groups = more valuable cut
    const totalCut = groups.reduce((s, g) => s + g.size, 0)
    return 40 + Math.min(totalCut * 5, 40)
  }
  return 0
}

// ─── Diagonal / bamboo joint connection ───────────────────────────────────────

/**
 * Bonus for diagonal connections to own stones.
 * A "diagonal" or "knight's move" connection (bamboo joint) is
 * nearly as strong as a direct connection and very hard to cut.
 */
function getDiagonalConnectionBonus(
  board: Cell[][], size: number, r: number, c: number, player: Player
): number {
  const diags: [number, number][] = [
    [r-1,c-1],[r-1,c+1],[r+1,c-1],[r+1,c+1],
  ]
  let bonus = 0
  for (const [dr, dc] of diags) {
    if (dr < 0 || dr >= size || dc < 0 || dc >= size) continue
    if (board[dr][dc] !== player) continue
    // Check if this diagonal forms a bamboo joint (the two bridging cells are both empty)
    const bridge1 = board[r][dc], bridge2 = board[dr][c]
    if (bridge1 === 0 && bridge2 === 0) {
      bonus += 18  // true bamboo joint — nearly unbreakable
    } else {
      bonus += 6   // simple diagonal touch
    }
  }
  return Math.min(bonus, 36)
}

// ─── Extension / connection bonus ─────────────────────────────────────────────

function getExtensionBonus(board: Cell[][], size: number, r: number, c: number, player: Player): number {
  let minDist = Infinity
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] !== player) continue
      const d = Math.abs(row - r) + Math.abs(col - c)
      if (d < minDist) minDist = d
    }
  }
  if (minDist === Infinity) return 0
  if (minDist === 1)        return  3
  if (minDist === 2)        return 14
  if (minDist === 3)        return  9
  if (minDist === 4)        return  4
  return 0
}

function getConnectionBonus(board: Cell[][], size: number, r: number, c: number, player: Player): number {
  const groups: Set<string>[] = []
  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (board[nr][nc] !== player) continue
    let found = false
    for (const g of groups) { if (g.has(`${nr},${nc}`)) { found = true; break } }
    if (!found) {
      const grp = findGroup(board, size, nr, nc)
      groups.push(new Set(grp.map(([gr, gc]) => `${gr},${gc}`)))
    }
  }
  return groups.length >= 2 ? 50 : 0
}

// ─── Core move scorer ─────────────────────────────────────────────────────────

function scoreMove(state: GameState, r: number, c: number, infMap: number[][]): number | null {
  const { board, size, turn, moveCount } = state
  if (board[r][c] !== 0) return null

  const result = placeStone(state, r, c)
  if (result.error !== null) return null

  const { state: next, captured } = result
  const opponent = (turn === 1 ? 2 : 1) as Player
  let score = 0

  // ── 1. Capture value ────────────────────────────────────────────────────────
  score += captured.length * 150

  // ── 2. Group-safety analysis ─────────────────────────────────────────────────
  const myGroup = findGroup(next.board, size, r, c)
  const myLibs  = countLiberties(next.board, size, myGroup)

  if (myLibs <= 1 && captured.length === 0) {
    score -= 130    // self-atari with no gain
  } else if (myLibs === 2 && captured.length === 0 && myGroup.length === 1) {
    score -= 25     // isolated stone with only 2 libs
  }
  score += Math.min(myLibs, 5) * 4

  // ── 3. Save endangered adjacent groups ──────────────────────────────────────
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
    if (oppLibs === 1) score += 80 + oppGroup.length * 22
    else if (oppLibs === 2) score += 28 + oppGroup.length * 7
  }

  // ── 5. Eye formation score ──────────────────────────────────────────────────
  score += getEyeScore(board, size, r, c, turn)

  // ── 6. Nakade / eye-steal against opponent ──────────────────────────────────
  score += getNakadeScore(board, size, r, c, turn)

  // ── 7. Cut detection ────────────────────────────────────────────────────────
  score += getCutScore(board, size, r, c, turn)

  // ── 8. Diagonal / bamboo joint connection ───────────────────────────────────
  score += getDiagonalConnectionBonus(board, size, r, c, turn)

  // ── 9. Positional value (scaled by game phase) ──────────────────────────────
  const boardArea   = size * size
  const phaseFactor = Math.max(0.2, 1 - moveCount / (boardArea * 0.65))
  score += getPosValue(size, r, c) * (0.25 + 0.75 * phaseFactor)

  // ── 10. Territory influence (spreading map) ──────────────────────────────────
  score += getInfluenceScore(infMap, size, r, c, turn)

  // ── 11. Extension from own stones ─────────────────────────────────────────────
  score += getExtensionBonus(board, size, r, c, turn)

  // ── 12. Connection bonus ───────────────────────────────────────────────────────
  score += getConnectionBonus(board, size, r, c, turn)

  return score
}

// ─── Candidate generation ──────────────────────────────────────────────────────

function scoreAllMoves(state: GameState): ScoredMove[] {
  const { size, board } = state
  const infMap = buildInfluenceMap(board, size)
  const moves: ScoredMove[] = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== 0) continue
      const s = scoreMove(state, r, c, infMap)
      if (s !== null) moves.push({ r, c, score: s })
    }
  }
  return moves
}

// ─── Should the AI pass? ──────────────────────────────────────────────────────

function shouldPass(state: GameState, bestScore: number): boolean {
  const boardArea = state.size * state.size
  const filled = state.board.flat().filter(c => c !== 0).length
  if (filled < boardArea * 0.35) return false
  return bestScore < 4
}

// ─── Difficulty-specific selection ────────────────────────────────────────────

function applyNoise(moves: ScoredMove[], scale: number): ScoredMove[] {
  return moves.map(m => ({ ...m, score: m.score + (Math.random() - 0.5) * 2 * scale }))
}

function pickFromPool(sorted: ScoredMove[], poolSize: number): ScoredMove {
  const n = Math.min(poolSize, sorted.length)
  return sorted[Math.floor(Math.random() * n)]
}

// ─── 1-ply opponent lookahead (Hard mode) ─────────────────────────────────────

function applyLookahead(state: GameState, candidates: ScoredMove[]): ScoredMove[] {
  const maxPool = state.size <= 9 ? 8 : state.size <= 13 ? 5 : 3
  return candidates.slice(0, maxPool).map(candidate => {
    const simResult = placeStone(state, candidate.r, candidate.c)
    if (simResult.error) return candidate

    const simInfMap = buildInfluenceMap(simResult.state.board, simResult.state.size)
    let opponentBest = 0
    const { board, size } = simResult.state

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== 0) continue
        const s = scoreMove(simResult.state, r, c, simInfMap)
        if (s !== null && s > opponentBest) opponentBest = s
      }
    }

    return { ...candidate, score: candidate.score - opponentBest * 0.42 }
  })
}

// ─── Core synchronous computation ────────────────────────────────────────────

function computeMoveSync(state: GameState, difficulty: Difficulty): { r: number; c: number } | 'pass' {
  const rawMoves = scoreAllMoves(state)
  if (rawMoves.length === 0) return 'pass'

  const noiseScale = difficulty === 'easy' ? 38 : difficulty === 'medium' ? 14 : 2
  const noisyMoves = applyNoise(rawMoves, noiseScale)
  noisyMoves.sort((a, b) => b.score - a.score)

  const bestScore = noisyMoves[0].score
  if (shouldPass(state, bestScore)) return 'pass'

  if (difficulty === 'easy')   return pickFromPool(noisyMoves, 6)
  if (difficulty === 'medium') return pickFromPool(noisyMoves, 2)

  // Hard: 1-ply lookahead
  const adjusted = applyLookahead(state, noisyMoves)
  adjusted.sort((a, b) => b.score - a.score)
  return pickFromPool(adjusted, 2)
}

// ─── Public async API ─────────────────────────────────────────────────────────

export async function computeAIMove(
  state: GameState,
  difficulty: Difficulty
): Promise<{ r: number; c: number } | 'pass'> {
  return new Promise(resolve => {
    setTimeout(() => {
      try { resolve(computeMoveSync(state, difficulty)) }
      catch { resolve('pass') }
    }, 0)
  })
}

// ─── CPU-vs-CPU simulation ────────────────────────────────────────────────────

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
    if (move === 'pass') { state = passTurn(state) }
    else {
      const result = placeStone(state, move.r, move.c)
      state = result.error ? passTurn(state) : result.state
    }
  }
  return state
}
