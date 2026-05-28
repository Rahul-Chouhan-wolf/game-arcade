// ─────────────────────────────────────────────────────────────
// Snake & Ladders — Pure deterministic game engine
// ─────────────────────────────────────────────────────────────

export type PlayerColor = "cyan" | "rose" | "amber" | "emerald"
export type PlayerMode  = "human" | "cpu"
export type AILevel     = "easy" | "medium" | "hard"

export type GamePhase =
  | "setup"
  | "playing"   // waiting for current player to roll
  | "rolling"   // dice animation in progress
  | "moving"    // token animating step-by-step
  | "snake"     // snake slide event resolving
  | "ladder"    // ladder climb event resolving
  | "won"       // winner announced

export interface Player {
  id: number
  name: string
  color: PlayerColor
  mode: PlayerMode
  aiLevel: AILevel
  position: number   // 0 = pre-board, 1-100 on board
}

export interface GameState {
  players: Player[]
  numPlayers: number
  currentIndex: number
  phase: GamePhase
  diceValue: number | null
  movingFrom: number
  movingTo: number
  eventFrom: number   // snake head / ladder bottom after move
  eventTo: number     // snake tail / ladder top
  winnerIndex: number | null
  requireExactRoll: boolean
  turnCount: number
}

// ── Board layout ───────────────────────────────────────────────

/** Classic Snake & Ladders board — snake: head→tail, ladder: base→top */
export const SNAKES: Record<number, number> = {
  99: 6,
  95: 24,
  90: 48,
  62: 19,
  54: 34,
  17: 7,
}

export const LADDERS: Record<number, number> = {
  4:  56,
  9:  31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
}

export const SNAKE_HEADS = new Set(Object.keys(SNAKES).map(Number))
export const LADDER_BASES = new Set(Object.keys(LADDERS).map(Number))

// ── Coordinate utilities ──────────────────────────────────────

/**
 * Convert tile number (1–100) to screen [row, col].
 * Row 0 = top of screen, Col 0 = left of screen.
 * The board is boustrophedon (row 0 from bottom → top of board = row 9 on screen).
 */
export function tileToRC(n: number): [number, number] {
  const idx = n - 1
  const rowFromBottom = Math.floor(idx / 10)
  const inRow = idx % 10
  const col = rowFromBottom % 2 === 0 ? inRow : 9 - inRow
  const screenRow = 9 - rowFromBottom
  return [screenRow, col]
}

// ── Player configuration ──────────────────────────────────────

export const PLAYER_COLORS: PlayerColor[] = ["cyan", "rose", "amber", "emerald"]
export const PLAYER_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"]

export const COLOR_HEX: Record<PlayerColor, string> = {
  cyan:    "#22d3ee",
  rose:    "#fb7185",
  amber:   "#fbbf24",
  emerald: "#34d399",
}

export const COLOR_DIM: Record<PlayerColor, string> = {
  cyan:    "#0e7490",
  rose:    "#9f1239",
  amber:   "#92400e",
  emerald: "#065f46",
}

// ── State factory ─────────────────────────────────────────────

export function createInitialState(
  numPlayers: number,
  modes: PlayerMode[],
  aiLevels: AILevel[],
  requireExactRoll = true
): GameState {
  const players: Player[] = Array.from({ length: numPlayers }, (_, i) => ({
    id: i,
    name: PLAYER_NAMES[i],
    color: PLAYER_COLORS[i],
    mode: modes[i] ?? "human",
    aiLevel: aiLevels[i] ?? "medium",
    position: 0,
  }))

  return {
    players,
    numPlayers,
    currentIndex: 0,
    phase: "playing",
    diceValue: null,
    movingFrom: 0,
    movingTo: 0,
    eventFrom: 0,
    eventTo: 0,
    winnerIndex: null,
    requireExactRoll,
    turnCount: 0,
  }
}

// ── Dice ──────────────────────────────────────────────────────

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1
}

// ── Move calculation ──────────────────────────────────────────

export interface MoveResult {
  newPosition: number      // position after dice move (before snake/ladder)
  finalPosition: number    // position after snake/ladder event
  snakeEncountered: boolean
  ladderEncountered: boolean
  won: boolean
  blocked: boolean         // exact-roll rule prevented movement
}

export function calculateMove(
  currentPosition: number,
  diceValue: number,
  requireExactRoll: boolean
): MoveResult {
  const raw = currentPosition + diceValue

  // Exact-roll-to-win: if raw > 100 and require exact, stay
  if (raw > 100 && requireExactRoll) {
    return {
      newPosition: currentPosition,
      finalPosition: currentPosition,
      snakeEncountered: false,
      ladderEncountered: false,
      won: false,
      blocked: true,
    }
  }

  const landed = Math.min(raw, 100)

  if (landed === 100) {
    return {
      newPosition: 100,
      finalPosition: 100,
      snakeEncountered: false,
      ladderEncountered: false,
      won: true,
      blocked: false,
    }
  }

  if (SNAKES[landed] !== undefined) {
    return {
      newPosition: landed,
      finalPosition: SNAKES[landed],
      snakeEncountered: true,
      ladderEncountered: false,
      won: false,
      blocked: false,
    }
  }

  if (LADDERS[landed] !== undefined) {
    return {
      newPosition: landed,
      finalPosition: LADDERS[landed],
      ladderEncountered: true,
      snakeEncountered: false,
      won: false,
      blocked: false,
    }
  }

  return {
    newPosition: landed,
    finalPosition: landed,
    snakeEncountered: false,
    ladderEncountered: false,
    won: false,
    blocked: false,
  }
}

// ── Move path (step-by-step positions for animation) ──────────

export function getMovePath(from: number, to: number): number[] {
  if (from === to) return [from]
  const steps: number[] = []
  const dir = to > from ? 1 : -1
  for (let p = from + dir; p !== to + dir; p += dir) {
    steps.push(p)
  }
  return steps
}

// ── AI ───────────────────────────────────────────────────────

export const AI_DELAYS: Record<AILevel, number> = {
  easy:   1600,
  medium: 1000,
  hard:   600,
}
