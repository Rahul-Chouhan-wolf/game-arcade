// ─── Types ────────────────────────────────────────────────────────────────────

export type HexCell   = 0 | 1 | 2   // 0 = empty, 1 = P1 (left↔right blue), 2 = P2 (top↔bottom red)
export type HexPlayer = 1 | 2

export interface HexState {
  size:      number
  board:     HexCell[][]
  turn:      HexPlayer
  winner:    HexPlayer | null
  winPath:   [number, number][]   // cells in the winning connection path
  moveCount: number
  lastMove:  [number, number] | null
}

export interface HexMoveResult {
  state: HexState
  error: string | null
}

// ─── Neighbor logic ────────────────────────────────────────────────────────────
// Offset hex grid — each row shifts right by half a cell.
// Six neighbor directions:
//   [-1,0]  upper-left    [-1,1]  upper-right
//   [ 0,-1] left          [ 0,1]  right
//   [ 1,-1] lower-left    [ 1,0]  lower-right

const NEIGHBOR_DELTAS: readonly [number, number][] = [
  [-1,  0], [-1,  1],
  [ 0, -1], [ 0,  1],
  [ 1, -1], [ 1,  0],
] as const

export function getHexNeighbors(size: number, r: number, c: number): [number, number][] {
  const result: [number, number][] = []
  for (const [dr, dc] of NEIGHBOR_DELTAS) {
    const nr = r + dr, nc = c + dc
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      result.push([nr, nc])
    }
  }
  return result
}

// ─── Win detection ─────────────────────────────────────────────────────────────
// BFS from all of the player's start-edge cells.
// Returns the winning path (start→end) or null.
//
//   Player 1: left edge (col 0) → right edge (col size-1)
//   Player 2: top edge  (row 0) → bottom edge (row size-1)

export function findWinningPath(
  board: HexCell[][], size: number, player: HexPlayer,
): [number, number][] | null {
  const isStart = player === 1
    ? (_r: number, c: number) => c === 0
    : (r: number, _c: number) => r === 0
  const isEnd = player === 1
    ? (_r: number, c: number) => c === size - 1
    : (r: number, _c: number) => r === size - 1

  const visited = new Set<string>()
  const parent  = new Map<string, string | null>()
  const queue:  [number, number][] = []

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === player && isStart(r, c)) {
        const key = `${r},${c}`
        if (!visited.has(key)) {
          visited.add(key)
          parent.set(key, null)
          queue.push([r, c])
        }
      }
    }
  }

  let endKey: string | null = null

  outer: while (queue.length > 0) {
    const [r, c] = queue.shift()!
    if (isEnd(r, c)) { endKey = `${r},${c}`; break outer }

    for (const [nr, nc] of getHexNeighbors(size, r, c)) {
      const nkey = `${nr},${nc}`
      if (!visited.has(nkey) && board[nr][nc] === player) {
        visited.add(nkey)
        parent.set(nkey, `${r},${c}`)
        queue.push([nr, nc])
      }
    }
  }

  if (!endKey) return null

  // Reconstruct path from end → start, then reverse
  const path: [number, number][] = []
  let cur: string | null = endKey
  while (cur !== null) {
    const [r, c] = cur.split(',').map(Number) as [number, number]
    path.push([r, c])
    cur = parent.get(cur) ?? null
  }
  return path.reverse()
}

// ─── Game creation ─────────────────────────────────────────────────────────────

export function createHexGame(size: number): HexState {
  return {
    size,
    board:     Array.from({ length: size }, () => new Array<HexCell>(size).fill(0)),
    turn:      1,
    winner:    null,
    winPath:   [],
    moveCount: 0,
    lastMove:  null,
  }
}

// ─── Place stone ───────────────────────────────────────────────────────────────

export function placeHexStone(prev: HexState, r: number, c: number): HexMoveResult {
  if (prev.winner !== null)    return { state: prev, error: 'Game is over' }
  if (prev.board[r][c] !== 0) return { state: prev, error: 'Cell is occupied' }

  const newBoard = prev.board.map(row => [...row] as HexCell[])
  newBoard[r][c] = prev.turn

  const winPath = findWinningPath(newBoard, prev.size, prev.turn)
  const winner  = winPath ? prev.turn : null
  const opponent = (prev.turn === 1 ? 2 : 1) as HexPlayer

  return {
    state: {
      ...prev,
      board:     newBoard,
      turn:      winner ? prev.turn : opponent,
      winner,
      winPath:   winPath ?? [],
      moveCount: prev.moveCount + 1,
      lastMove:  [r, c],
    },
    error: null,
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/** True if placing at (r,c) is legal right now. */
export function isValidHexMove(state: HexState, r: number, c: number): boolean {
  return state.winner === null && state.board[r][c] === 0
}
