// ─── Types ────────────────────────────────────────────────────────────────────

export type Owner  = 0 | 1 | 2   // 0 = unowned / undrawn
export type Player = 1 | 2

/**
 * Full deterministic board state. Never mutated — replaced on each move.
 *
 * Box at (br, bc) has edges:
 *   top    = H[br][bc]
 *   bottom = H[br+1][bc]
 *   left   = V[br][bc]
 *   right  = V[br][bc+1]
 */
export interface GameState {
  N: number           // dots per side  (N=5 → 4×4 grid → 16 boxes)
  H: Owner[][]        // horizontal edges  H[row 0..N-1][col 0..N-2]
  V: Owner[][]        // vertical edges    V[row 0..N-2][col 0..N-1]
  B: Owner[][]        // box owners        B[row 0..N-2][col 0..N-2]
  turn: Player
  scores: [number, number]
  done: boolean
  winner: Player | null   // null on tie
  extraTurn: boolean      // current player claimed ≥1 box → stays their turn
  lastGained: number      // boxes claimed on the most-recent move
  newBoxes: string[]      // ordered keys of boxes claimed this move, e.g. "2-1"
}

// ─── Board helpers ────────────────────────────────────────────────────────────

/** Count how many of the 4 edges of box (br, bc) are currently drawn. */
export function edgeCount(H: Owner[][], V: Owner[][], br: number, bc: number): number {
  return (H[br    ][bc    ] !== 0 ? 1 : 0)   // top
       + (H[br + 1][bc    ] !== 0 ? 1 : 0)   // bottom
       + (V[br    ][bc    ] !== 0 ? 1 : 0)   // left
       + (V[br    ][bc + 1] !== 0 ? 1 : 0)   // right
}

/**
 * Scan the board for any unowned box that has exactly 3 edges drawn.
 * Returns the coordinates of the one missing (undrawn) edge.
 * Returns null when no such box exists.
 */
export function findClaimableBox(
  N: number, H: Owner[][], V: Owner[][], B: Owner[][]
): { isH: boolean; r: number; c: number } | null {
  for (let br = 0; br < N - 1; br++) {
    for (let bc = 0; bc < N - 1; bc++) {
      if (B[br][bc] !== 0) continue
      if (edgeCount(H, V, br, bc) !== 3) continue
      if (H[br    ][bc    ] === 0) return { isH: true,  r: br,     c: bc     }
      if (H[br + 1][bc    ] === 0) return { isH: true,  r: br + 1, c: bc     }
      if (V[br    ][bc    ] === 0) return { isH: false, r: br,     c: bc     }
      if (V[br    ][bc + 1] === 0) return { isH: false, r: br,     c: bc + 1 }
    }
  }
  return null
}

/** Create a fresh game state for an N×N dot grid. */
export function createGame(N: number): GameState {
  return {
    N,
    H: Array.from({ length: N },     () => Array<Owner>(N - 1).fill(0)),
    V: Array.from({ length: N - 1 }, () => Array<Owner>(N).fill(0)),
    B: Array.from({ length: N - 1 }, () => Array<Owner>(N - 1).fill(0)),
    turn:       1,
    scores:     [0, 0],
    done:       false,
    winner:     null,
    extraTurn:  false,
    lastGained: 0,
    newBoxes:   [],
  }
}

/**
 * Pure reducer — place one line and return the next game state.
 *
 * Chain-capture rule (canonical Dots and Boxes):
 *   • Completing ≥1 box grants an extra turn; turn only switches on zero completions.
 *   • A single line can simultaneously close 2 adjacent boxes.
 *   • Drawing an already-drawn line is a no-op (returns prev unchanged).
 */
export function placeLine(prev: GameState, isH: boolean, r: number, c: number): GameState {
  if (isH  && prev.H[r][c] !== 0) return prev
  if (!isH && prev.V[r][c] !== 0) return prev

  const s: GameState = {
    ...prev,
    H:          prev.H.map(row => [...row] as Owner[]),
    V:          prev.V.map(row => [...row] as Owner[]),
    B:          prev.B.map(row => [...row] as Owner[]),
    scores:     [...prev.scores] as [number, number],
    extraTurn:  false,
    lastGained: 0,
    newBoxes:   [],
  }

  const p = s.turn
  if (isH) s.H[r][c] = p
  else     s.V[r][c] = p

  const adjacent: [number, number][] = isH
    ? [[r - 1, c], [r, c]]
    : [[r, c - 1], [r, c]]

  let gained = 0
  for (const [br, bc] of adjacent) {
    if (br < 0 || bc < 0 || br >= s.N - 1 || bc >= s.N - 1) continue
    if (s.B[br][bc] !== 0) continue
    if (edgeCount(s.H, s.V, br, bc) === 4) {
      s.B[br][bc] = p
      s.scores[p - 1]++
      gained++
      s.newBoxes.push(`${br}-${bc}`)
    }
  }

  s.lastGained = gained

  const totalBoxes = (s.N - 1) * (s.N - 1)
  if (s.scores[0] + s.scores[1] >= totalBoxes) {
    s.done   = true
    s.winner = s.scores[0] > s.scores[1] ? 1
             : s.scores[1] > s.scores[0] ? 2
             : null
    return s
  }

  if (gained > 0) {
    s.extraTurn = true
  } else {
    s.turn = p === 1 ? 2 : 1
  }

  return s
}
