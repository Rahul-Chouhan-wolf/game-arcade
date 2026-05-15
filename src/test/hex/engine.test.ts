import { describe, it, expect } from 'vitest'
import {
  getHexNeighbors, findWinningPath, createHexGame, placeHexStone,
  type HexCell,
} from '@/lib/hex/engine'

// ─── getHexNeighbors ──────────────────────────────────────────────────────────

describe('getHexNeighbors', () => {
  it('center cell has 6 neighbors', () => {
    const ns = getHexNeighbors(7, 3, 3)
    expect(ns).toHaveLength(6)
    expect(ns).toContainEqual([2, 3])  // upper-left
    expect(ns).toContainEqual([2, 4])  // upper-right
    expect(ns).toContainEqual([3, 2])  // left
    expect(ns).toContainEqual([3, 4])  // right
    expect(ns).toContainEqual([4, 2])  // lower-left
    expect(ns).toContainEqual([4, 3])  // lower-right
  })

  it('top-left corner (0,0) has 2 neighbors', () => {
    const ns = getHexNeighbors(7, 0, 0)
    expect(ns).toHaveLength(2)
    expect(ns).toContainEqual([0, 1])
    expect(ns).toContainEqual([1, 0])
  })

  it('top-right corner (0,n-1) has 3 neighbors', () => {
    // (0,6): valid: (0,5), (1,5), (1,6)
    const ns = getHexNeighbors(7, 0, 6)
    expect(ns).toHaveLength(3)
    expect(ns).toContainEqual([0, 5])
    expect(ns).toContainEqual([1, 5])
    expect(ns).toContainEqual([1, 6])
  })

  it('bottom-left corner (n-1,0) has 3 neighbors', () => {
    // (6,0): valid: (5,0), (5,1), (6,1)
    const ns = getHexNeighbors(7, 6, 0)
    expect(ns).toHaveLength(3)
    expect(ns).toContainEqual([5, 0])
    expect(ns).toContainEqual([5, 1])
    expect(ns).toContainEqual([6, 1])
  })

  it('bottom-right corner (n-1,n-1) has 2 neighbors', () => {
    // (6,6): valid: (5,6), (6,5)
    const ns = getHexNeighbors(7, 6, 6)
    expect(ns).toHaveLength(2)
    expect(ns).toContainEqual([5, 6])
    expect(ns).toContainEqual([6, 5])
  })

  it('top edge (0,c) has 4 neighbors', () => {
    // (0,3): (0,2),(0,4),(1,2),(1,3)
    const ns = getHexNeighbors(7, 0, 3)
    expect(ns).toHaveLength(4)
    expect(ns).toContainEqual([0, 2])
    expect(ns).toContainEqual([0, 4])
    expect(ns).toContainEqual([1, 2])
    expect(ns).toContainEqual([1, 3])
  })

  it('left edge (r,0) has 4 neighbors', () => {
    // (3,0): (2,0),(2,1),(3,1),(4,0)
    const ns = getHexNeighbors(7, 3, 0)
    expect(ns).toHaveLength(4)
    expect(ns).toContainEqual([2, 0])
    expect(ns).toContainEqual([2, 1])
    expect(ns).toContainEqual([3, 1])
    expect(ns).toContainEqual([4, 0])
  })

  it('right edge (r,n-1) has 4 neighbors', () => {
    // (3,6): (2,6),(3,5),(4,5),(4,6)
    const ns = getHexNeighbors(7, 3, 6)
    expect(ns).toHaveLength(4)
    expect(ns).toContainEqual([2, 6])
    expect(ns).toContainEqual([3, 5])
    expect(ns).toContainEqual([4, 5])
    expect(ns).toContainEqual([4, 6])
  })

  it('bottom edge (n-1,c) has 4 neighbors', () => {
    // (6,3): (5,3),(5,4),(6,2),(6,4)
    const ns = getHexNeighbors(7, 6, 3)
    expect(ns).toHaveLength(4)
    expect(ns).toContainEqual([5, 3])
    expect(ns).toContainEqual([5, 4])
    expect(ns).toContainEqual([6, 2])
    expect(ns).toContainEqual([6, 4])
  })

  it('never returns out-of-bounds coordinates', () => {
    for (const size of [5, 7, 9, 11]) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          for (const [nr, nc] of getHexNeighbors(size, r, c)) {
            expect(nr).toBeGreaterThanOrEqual(0)
            expect(nr).toBeLessThan(size)
            expect(nc).toBeGreaterThanOrEqual(0)
            expect(nc).toBeLessThan(size)
          }
        }
      }
    }
  })
})

// ─── findWinningPath ──────────────────────────────────────────────────────────

describe('findWinningPath', () => {
  it('returns null for an empty board (P1 and P2)', () => {
    const { board, size } = createHexGame(5)
    expect(findWinningPath(board, size, 1)).toBeNull()
    expect(findWinningPath(board, size, 2)).toBeNull()
  })

  it('detects P1 straight horizontal win (middle row)', () => {
    const { board: b, size } = createHexGame(5)
    const board = b.map(r => [...r] as HexCell[])
    for (let c = 0; c < 5; c++) board[2][c] = 1
    const path = findWinningPath(board, size, 1)
    expect(path).not.toBeNull()
    expect(path!.length).toBe(5)
    // Path covers all 5 columns
    const cols = new Set(path!.map(([, c]) => c))
    expect(cols).toContain(0)
    expect(cols).toContain(4)
  })

  it('detects P2 straight vertical win (middle column)', () => {
    const { board: b, size } = createHexGame(5)
    const board = b.map(r => [...r] as HexCell[])
    for (let r = 0; r < 5; r++) board[r][2] = 2
    const path = findWinningPath(board, size, 2)
    expect(path).not.toBeNull()
    expect(path!.length).toBe(5)
    const rows = new Set(path!.map(([r]) => r))
    expect(rows).toContain(0)
    expect(rows).toContain(4)
  })

  it('detects P1 zigzag win path', () => {
    // Valid path: (0,0)→(0,1)→(1,1)→(1,2)→(2,2)→(2,3)→(3,3)→(3,4)
    // Each step uses delta [0,1] or [1,0] (both valid neighbors)
    const { board: b, size } = createHexGame(5)
    const board = b.map(r => [...r] as HexCell[])
    const cells: [number, number][] = [[0,0],[0,1],[1,1],[1,2],[2,2],[2,3],[3,3],[3,4]]
    for (const [r, c] of cells) board[r][c] = 1
    const path = findWinningPath(board, size, 1)
    expect(path).not.toBeNull()
    const startCols = path!.filter(([, c]) => c === 0)
    const endCols   = path!.filter(([, c]) => c === 4)
    expect(startCols.length).toBeGreaterThan(0)
    expect(endCols.length).toBeGreaterThan(0)
  })

  it('returns null when path is broken by a gap', () => {
    const { board: b, size } = createHexGame(5)
    const board = b.map(r => [...r] as HexCell[])
    // Left half + right half but no connection
    board[2][0] = 1; board[2][1] = 1
    // Gap at (2,2)
    board[2][3] = 1; board[2][4] = 1
    expect(findWinningPath(board, size, 1)).toBeNull()
  })

  it('P1 stones on left/right edge without connection do not win', () => {
    const { board: b, size } = createHexGame(5)
    const board = b.map(r => [...r] as HexCell[])
    // P1 has stones in col 0 and col 4 but no connected path
    board[0][0] = 1; board[4][4] = 1
    expect(findWinningPath(board, size, 1)).toBeNull()
  })

  it('finds shortest/any valid path when multiple paths exist', () => {
    const { board: b, size } = createHexGame(5)
    const board = b.map(r => [...r] as HexCell[])
    // Fill entire top row for P1 (col 0 to col 4)
    for (let c = 0; c < 5; c++) board[0][c] = 1
    // Also fill middle row
    for (let c = 0; c < 5; c++) board[2][c] = 1
    const path = findWinningPath(board, size, 1)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThanOrEqual(5)
  })

  it('does not confuse P1 and P2 stones', () => {
    const { board: b, size } = createHexGame(5)
    const board = b.map(r => [...r] as HexCell[])
    // P2 fills the whole middle row (would win for P2 if checking cols, but this is P2 stones)
    for (let c = 0; c < 5; c++) board[2][c] = 2
    // P1 should NOT win through P2's stones
    expect(findWinningPath(board, size, 1)).toBeNull()
    // P2 path connects top (row 0)?  No — P2 stones are in row 2 but not row 0 or row 4
    expect(findWinningPath(board, size, 2)).toBeNull()
  })

  it('reconstructed path is fully connected', () => {
    const { board: b, size } = createHexGame(7)
    const board = b.map(r => [...r] as HexCell[])
    for (let c = 0; c < 7; c++) board[3][c] = 1
    const path = findWinningPath(board, size, 1)!
    expect(path).not.toBeNull()
    // Verify every consecutive pair in path is a valid neighbor
    for (let i = 0; i + 1 < path.length; i++) {
      const [r1, c1] = path[i]
      const [r2, c2] = path[i + 1]
      const neighbors = getHexNeighbors(size, r1, c1)
      expect(neighbors).toContainEqual([r2, c2])
    }
  })
})

// ─── createHexGame ────────────────────────────────────────────────────────────

describe('createHexGame', () => {
  it('creates correct initial state for 7×7', () => {
    const g = createHexGame(7)
    expect(g.size).toBe(7)
    expect(g.board).toHaveLength(7)
    expect(g.board[0]).toHaveLength(7)
    expect(g.turn).toBe(1)
    expect(g.winner).toBeNull()
    expect(g.winPath).toHaveLength(0)
    expect(g.moveCount).toBe(0)
    expect(g.lastMove).toBeNull()
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++)
        expect(g.board[r][c]).toBe(0)
  })

  it('creates correct initial state for 9×9', () => {
    const g = createHexGame(9)
    expect(g.size).toBe(9)
    expect(g.board).toHaveLength(9)
    expect(g.board[0]).toHaveLength(9)
  })

  it('creates correct initial state for 11×11', () => {
    const g = createHexGame(11)
    expect(g.size).toBe(11)
    expect(g.board).toHaveLength(11)
    expect(g.board[0]).toHaveLength(11)
  })
})

// ─── placeHexStone ────────────────────────────────────────────────────────────

describe('placeHexStone', () => {
  it('places a stone and advances the turn', () => {
    const g = createHexGame(5)
    const res = placeHexStone(g, 2, 2)
    expect(res.error).toBeNull()
    expect(res.state.board[2][2]).toBe(1)
    expect(res.state.turn).toBe(2)
    expect(res.state.moveCount).toBe(1)
    expect(res.state.lastMove).toEqual([2, 2])
  })

  it('rejects placing on an occupied cell', () => {
    const g  = createHexGame(5)
    const g1 = placeHexStone(g, 2, 2).state
    const res = placeHexStone(g1, 2, 2)
    expect(res.error).not.toBeNull()
    expect(res.state.board[2][2]).toBe(1)  // unchanged
    expect(res.state.turn).toBe(2)         // turn unchanged
    expect(res.state.moveCount).toBe(1)    // moveCount unchanged
  })

  it('alternates turns P1→P2→P1', () => {
    let g = createHexGame(5)
    expect(g.turn).toBe(1)
    g = placeHexStone(g, 0, 0).state; expect(g.turn).toBe(2)
    g = placeHexStone(g, 4, 4).state; expect(g.turn).toBe(1)
    g = placeHexStone(g, 0, 1).state; expect(g.turn).toBe(2)
  })

  it('does not mutate the original state', () => {
    const g   = createHexGame(5)
    const orig = g.board[2][2]
    placeHexStone(g, 2, 2)
    expect(g.board[2][2]).toBe(orig)
    expect(g.turn).toBe(1)
    expect(g.moveCount).toBe(0)
  })

  it('detects P1 win and sets winner + winPath', () => {
    // P1: row-2 cells; P2: row-4 cells (harmless). 5 P1 + 4 P2 interleaved = 9 moves
    const sequence: [number, number][] = [
      [2,0],[4,4], [2,1],[4,3], [2,2],[4,2], [2,3],[4,1], [2,4],
    ]
    let g = createHexGame(5)
    for (const [r, c] of sequence.slice(0, -1)) {
      g = placeHexStone(g, r, c).state
    }
    const [wr, wc] = sequence[sequence.length - 1]
    const res = placeHexStone(g, wr, wc)
    expect(res.error).toBeNull()
    expect(res.state.winner).toBe(1)
    expect(res.state.winPath.length).toBeGreaterThanOrEqual(5)
    // winPath must start in col 0 and end in col 4
    const cols = res.state.winPath.map(([, c]) => c)
    expect(Math.min(...cols)).toBe(0)
    expect(Math.max(...cols)).toBe(4)
  })

  it('detects P2 win (top to bottom)', () => {
    // P2: col-2 cells; P1: col-4 cells (harmless). Interleave so P2 gets 5 placements.
    // Turn order: P1 first, so P1 must move before each P2 move.
    const sequence: [number, number][] = [
      [0,4],[0,2], [1,4],[1,2], [2,4],[2,2], [3,4],[3,2], [4,4],[4,2],
    ]
    let g = createHexGame(5)
    for (const [r, c] of sequence.slice(0, -1)) {
      g = placeHexStone(g, r, c).state
    }
    const [wr, wc] = sequence[sequence.length - 1]
    const res = placeHexStone(g, wr, wc)
    expect(res.error).toBeNull()
    expect(res.state.winner).toBe(2)
    expect(res.state.winPath.length).toBeGreaterThanOrEqual(5)
    const rows = res.state.winPath.map(([r]) => r)
    expect(Math.min(...rows)).toBe(0)
    expect(Math.max(...rows)).toBe(4)
  })

  it('locks the board after a win (rejects further moves)', () => {
    const sequence: [number, number][] = [
      [2,0],[4,4], [2,1],[4,3], [2,2],[4,2], [2,3],[4,1], [2,4],
    ]
    let g = createHexGame(5)
    for (const [r, c] of sequence) {
      g = placeHexStone(g, r, c).state
    }
    expect(g.winner).toBe(1)
    const after = placeHexStone(g, 0, 0)
    expect(after.error).not.toBeNull()
    expect(after.state.winner).toBe(1)  // still P1
  })

  it('winPath is connected (every consecutive pair is a neighbor)', () => {
    const sequence: [number, number][] = [
      [2,0],[4,4], [2,1],[4,3], [2,2],[4,2], [2,3],[4,1], [2,4],
    ]
    let g = createHexGame(5)
    for (const [r, c] of sequence) {
      g = placeHexStone(g, r, c).state
    }
    const path = g.winPath
    expect(path.length).toBeGreaterThan(1)
    for (let i = 0; i + 1 < path.length; i++) {
      const [r1, c1] = path[i]
      const [r2, c2] = path[i + 1]
      const ns = getHexNeighbors(g.size, r1, c1)
      expect(ns).toContainEqual([r2, c2])
    }
  })
})
