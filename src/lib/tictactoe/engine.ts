// ── Tic Tac Toe · Pure Game Engine ────────────────────────────────────────────
// No React, no DOM — all pure functions for deterministic game logic.

export type Player     = "X" | "O"
export type Cell       = Player | null
export type Board      = [Cell,Cell,Cell,Cell,Cell,Cell,Cell,Cell,Cell]
export type Difficulty = "easy" | "medium" | "hard" | "impossible"

// All 8 winning triplets
export const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
]

export function checkWinner(
  board: Cell[],
): { winner: Player | null; line: [number, number, number] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line }
    }
  }
  return { winner: null, line: null }
}

export function isDraw(board: Cell[]): boolean {
  return board.every(c => c !== null) && checkWinner(board).winner === null
}

// ── Minimax with alpha-beta pruning (Impossible = unbeatable) ─────────────────

function minimax(
  board: Cell[],
  depth: number,
  isMax: boolean,
  alpha: number,
  beta: number,
  ai: Player,
  human: Player,
): number {
  const { winner } = checkWinner(board)
  if (winner === ai)    return 10 - depth
  if (winner === human) return depth - 10
  if (board.every(c => c !== null)) return 0

  if (isMax) {
    let best = -Infinity
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = ai
        best  = Math.max(best, minimax(board, depth + 1, false, alpha, beta, ai, human))
        board[i] = null
        alpha = Math.max(alpha, best)
        if (beta <= alpha) break
      }
    }
    return best
  } else {
    let best = Infinity
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = human
        best  = Math.min(best, minimax(board, depth + 1, true, alpha, beta, ai, human))
        board[i] = null
        beta  = Math.min(beta, best)
        if (beta <= alpha) break
      }
    }
    return best
  }
}

// Returns the index the AI should play, or -1 if board is full.
export function getBestMove(
  board: Cell[],
  aiPlayer: Player,
  difficulty: Difficulty,
): number {
  const humanPlayer: Player = aiPlayer === "X" ? "O" : "X"
  const empty = board.reduce<number[]>((acc, c, i) => (c === null ? [...acc, i] : acc), [])
  if (empty.length === 0) return -1

  // Inject randomness for lower difficulties
  const randomChance =
    difficulty === "easy"   ? 0.75 :
    difficulty === "medium" ? 0.45 :
    difficulty === "hard"   ? 0.12 : 0

  if (Math.random() < randomChance) {
    return empty[Math.floor(Math.random() * empty.length)]
  }

  // Optimal move via minimax
  let bestScore = -Infinity
  let bestMove  = empty[0]
  const b = [...board]

  for (const i of empty) {
    b[i] = aiPlayer
    const score = minimax(b, 0, false, -Infinity, Infinity, aiPlayer, humanPlayer)
    b[i] = null
    if (score > bestScore) { bestScore = score; bestMove = i }
  }
  return bestMove
}

// ── Statistics ────────────────────────────────────────────────────────────────

export interface TTTStats {
  gamesPlayed: number
  xWins:       number
  oWins:       number
  draws:       number
  streak:      number
  bestStreak:  number
  cpu: Record<Difficulty, { wins: number; losses: number; draws: number }>
}

export function defaultStats(): TTTStats {
  return {
    gamesPlayed: 0,
    xWins: 0, oWins: 0, draws: 0,
    streak: 0, bestStreak: 0,
    cpu: {
      easy:       { wins: 0, losses: 0, draws: 0 },
      medium:     { wins: 0, losses: 0, draws: 0 },
      hard:       { wins: 0, losses: 0, draws: 0 },
      impossible: { wins: 0, losses: 0, draws: 0 },
    },
  }
}
