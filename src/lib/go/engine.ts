// ─── Types ────────────────────────────────────────────────────────────────────

export type Cell   = 0 | 1 | 2   // 0 = empty, 1 = black, 2 = white
export type Player = 1 | 2

export interface GameState {
  size:              number
  board:             Cell[][]
  turn:              Player               // 1 = black plays first
  captures:          [number, number]     // stones captured BY each player
  prevBoardSerial:   string | null        // board before last move — Ko detection
  consecutivePasses: number
  done:              boolean
  winner:            Player | null        // null = tie
  komi:              number               // advantage for white (default 6.5)
  moveCount:         number
  lastMove:          [number, number] | null
  // populated only when done === true
  territory:         Cell[][]             // territory owner per intersection (0 = neutral)
  territoryCount:    [number, number]     // [black territory, white territory]
  finalScores:       [number, number]     // [black, white] — white includes komi
}

export interface MoveResult {
  state:    GameState
  error:    string | null
  captured: [number, number][]   // positions of stones removed this move
}

// ─── Board helpers ────────────────────────────────────────────────────────────

export function getNeighbors(size: number, r: number, c: number): [number, number][] {
  const ns: [number, number][] = []
  if (r > 0)        ns.push([r - 1, c])
  if (r < size - 1) ns.push([r + 1, c])
  if (c > 0)        ns.push([r, c - 1])
  if (c < size - 1) ns.push([r, c + 1])
  return ns
}

/**
 * BFS — returns all stones in the same connected group as (r, c).
 * Returns [] if the intersection is empty.
 */
export function findGroup(
  board: Cell[][], size: number, r: number, c: number
): [number, number][] {
  const color = board[r][c]
  if (color === 0) return []

  const visited = new Set<string>()
  const queue:   [number, number][] = [[r, c]]
  const group:   [number, number][] = []

  while (queue.length > 0) {
    const [row, col] = queue.shift()!
    const key = `${row},${col}`
    if (visited.has(key)) continue
    visited.add(key)
    if (board[row][col] !== color) continue
    group.push([row, col])
    for (const [nr, nc] of getNeighbors(size, row, col)) {
      if (!visited.has(`${nr},${nc}`)) queue.push([nr, nc])
    }
  }
  return group
}

/** Count distinct empty neighbors (liberties) shared by a group. */
export function countLiberties(
  board: Cell[][], size: number, group: [number, number][]
): number {
  const seen = new Set<string>()
  let count = 0
  for (const [r, c] of group) {
    for (const [nr, nc] of getNeighbors(size, r, c)) {
      const key = `${nr},${nc}`
      if (!seen.has(key) && board[nr][nc] === 0) {
        seen.add(key)
        count++
      }
    }
  }
  return count
}

function serializeBoard(board: Cell[][]): string {
  return board.map(row => row.join('')).join('|')
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map(row => [...row] as Cell[])
}

// ─── Star points (hoshi) ──────────────────────────────────────────────────────

export function getStarPoints(size: number): [number, number][] {
  if (size === 9)  return [[2,2],[2,6],[6,2],[6,6],[4,4]]
  if (size === 13) return [[3,3],[3,9],[9,3],[9,9],[6,6],[3,6],[6,3],[6,9],[9,6]]
  if (size === 19) return [
    [3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15],
  ]
  return []
}

// ─── Game creation ────────────────────────────────────────────────────────────

export function createGame(size: number, komi = 6.5): GameState {
  return {
    size,
    board:             Array.from({ length: size }, () => new Array<Cell>(size).fill(0)),
    turn:              1,
    captures:          [0, 0],
    prevBoardSerial:   null,
    consecutivePasses: 0,
    done:              false,
    winner:            null,
    komi,
    moveCount:         0,
    lastMove:          null,
    territory:         Array.from({ length: size }, () => new Array<Cell>(size).fill(0)),
    territoryCount:    [0, 0],
    finalScores:       [0, 0],
  }
}

// ─── Place a stone ─────────────────────────────────────────────────────────────

export function placeStone(prev: GameState, r: number, c: number): MoveResult {
  if (prev.done)           return { state: prev, error: 'Game is over',             captured: [] }
  if (prev.board[r][c] !== 0) return { state: prev, error: 'Intersection occupied', captured: [] }

  const p        = prev.turn
  const opponent = (p === 1 ? 2 : 1) as Player
  const size     = prev.size

  const newBoard = cloneBoard(prev.board)
  newBoard[r][c] = p

  // ── Step 1: Remove all opponent groups that now have zero liberties ──────────
  const captured:      [number, number][] = []
  const checkedGroups = new Set<string>()

  for (const [nr, nc] of getNeighbors(size, r, c)) {
    if (newBoard[nr][nc] !== opponent) continue
    const gKey = `${nr},${nc}`
    if (checkedGroups.has(gKey)) continue

    const group = findGroup(newBoard, size, nr, nc)
    group.forEach(([gr, gc]) => checkedGroups.add(`${gr},${gc}`))

    if (countLiberties(newBoard, size, group) === 0) {
      for (const [gr, gc] of group) {
        newBoard[gr][gc] = 0
        captured.push([gr, gc])
      }
    }
  }

  // ── Step 2: Suicide check — after captures, does our group have liberties? ───
  const placedGroup = findGroup(newBoard, size, r, c)
  if (countLiberties(newBoard, size, placedGroup) === 0) {
    return { state: prev, error: 'Illegal: suicide move', captured: [] }
  }

  // ── Step 3: Ko check — does result recreate the board from before last move? ─
  const newSerial = serializeBoard(newBoard)
  if (prev.prevBoardSerial !== null && newSerial === prev.prevBoardSerial) {
    return { state: prev, error: 'Illegal: Ko rule', captured: [] }
  }

  // ── Apply ────────────────────────────────────────────────────────────────────
  const newCaptures: [number, number] = [prev.captures[0], prev.captures[1]]
  newCaptures[p - 1] += captured.length

  return {
    state: {
      ...prev,
      board:             newBoard,
      turn:              opponent,
      captures:          newCaptures,
      prevBoardSerial:   serializeBoard(prev.board), // pre-move snapshot for next Ko check
      consecutivePasses: 0,
      moveCount:         prev.moveCount + 1,
      lastMove:          [r, c],
    },
    error:    null,
    captured,
  }
}

// ─── Pass ─────────────────────────────────────────────────────────────────────

export function passTurn(prev: GameState): GameState {
  if (prev.done) return prev

  const opponent  = (prev.turn === 1 ? 2 : 1) as Player
  const newPasses = prev.consecutivePasses + 1

  const next: GameState = {
    ...prev,
    turn:              opponent,
    consecutivePasses: newPasses,
    moveCount:         prev.moveCount + 1,
    lastMove:          null,
    prevBoardSerial:   null,   // Ko restriction lifts after a pass
  }

  return newPasses >= 2 ? finalizeGame(next) : next
}

// ─── Resign ───────────────────────────────────────────────────────────────────

export function resign(prev: GameState): GameState {
  if (prev.done) return prev
  const opponent = (prev.turn === 1 ? 2 : 1) as Player
  return { ...prev, done: true, winner: opponent }
}

// ─── Territory scoring (Japanese-style) ──────────────────────────────────────

function finalizeGame(state: GameState): GameState {
  const { size, board, captures, komi } = state
  const territory: Cell[][] = Array.from({ length: size }, () => new Array<Cell>(size).fill(0))
  const visited = new Set<string>()
  let blackT = 0
  let whiteT = 0

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== 0 || visited.has(`${r},${c}`)) continue

      // BFS across this empty region — collect cells and surrounding stone colors
      const region:       [number, number][] = []
      const borderColors: Set<Cell>          = new Set()
      const queue:        [number, number][] = [[r, c]]

      while (queue.length > 0) {
        const [row, col] = queue.shift()!
        const key = `${row},${col}`
        if (visited.has(key)) continue
        visited.add(key)

        if (board[row][col] !== 0) {
          borderColors.add(board[row][col])
          continue
        }

        region.push([row, col])
        for (const [nr, nc] of getNeighbors(size, row, col)) {
          if (!visited.has(`${nr},${nc}`)) queue.push([nr, nc])
        }
      }

      // Single-color border → owned territory; mixed → neutral (dame)
      if (borderColors.size === 1) {
        const owner = [...borderColors][0] as Cell
        for (const [tr, tc] of region) {
          territory[tr][tc] = owner
          if (owner === 1) blackT++
          else             whiteT++
        }
      }
    }
  }

  // Japanese scoring:
  //   Black = black territory + white stones Black captured
  //   White = white territory + black stones White captured + komi
  const blackScore = blackT + captures[0]
  const whiteScore = whiteT + captures[1] + komi

  const winner: Player | null =
    blackScore > whiteScore ? 1 :
    whiteScore > blackScore ? 2 :
    null

  return {
    ...state,
    done:           true,
    winner,
    territory,
    territoryCount: [blackT, whiteT],
    finalScores:    [blackScore, whiteScore],
  }
}

// ─── Move validation (for hover preview) ─────────────────────────────────────

export function isValidMove(state: GameState, r: number, c: number): boolean {
  return placeStone(state, r, c).error === null
}
