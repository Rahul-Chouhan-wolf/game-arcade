/**
 * Ludo Engine — pure game logic, no UI dependencies
 *
 * Board layout:
 *  - 52-cell outer ring (main track), indexed 0–51
 *  - Each player has a 5-cell home stretch (indices 52–56 per player)
 *  - Each player has a 4-token yard (unplaced tokens)
 *  - Safe cells: 8 star positions on the main track
 *  - Each player's entry cell and home-column entry are distinct
 */

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type PlayerColor = "red" | "green" | "yellow" | "blue";
export type TokenState = "yard" | "track" | "home" | "finished";
export type GamePhase = "menu" | "playing" | "gameover";
export type AILevel = "easy" | "medium" | "hard";
export type PlayerType = "human" | "ai";

export interface Token {
  id: string;            // e.g. "red-0"
  color: PlayerColor;
  index: number;         // index in token array (0-3)
  state: TokenState;
  trackPos: number;      // 0-51 on main track; 100-104 in home stretch; -1 in yard/finished
  progress: number;      // 0-56, total steps from entry (used to determine finish)
}

export interface Player {
  color: PlayerColor;
  type: PlayerType;
  aiLevel?: AILevel;
  tokens: Token[];
  name: string;
  isActive: boolean;
  hasFinished: boolean;
  finishOrder?: number;
}

export interface LudoState {
  players: Player[];
  currentPlayerIndex: number;
  dice: number;
  diceRolled: boolean;
  extraTurn: boolean;
  consecutiveSixes: number;
  phase: GamePhase;
  winner: PlayerColor | null;
  finishOrder: PlayerColor[];
  numPlayers: number;
  turnNumber: number;
  movablePieces: string[]; // token IDs that can move
}

export interface LudoStats {
  wins: number;
  losses: number;
  captures: number;
  gamesPlayed: number;
  winStreak: number;
  bestStreak: number;
}

export interface MoveResult {
  newState: LudoState;
  captured: boolean;
  capturedToken?: Token;
  enteredBoard: boolean;
  enteredHome: boolean;
  finished: boolean;
  /** Intermediate positions for step-by-step animation */
  movePath: Array<[number, number]>;
}

// ─────────────────────────────────────────
// Board constants
// ─────────────────────────────────────────

// Main track: 52 cells (0–51), counter-clockwise
// Safe cells (star positions): 8 cells on the main track
export const SAFE_CELLS: Set<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Each player's entry cell on the main track (when they roll a 6 from yard)
export const ENTRY_CELLS: Record<PlayerColor, number> = {
  red:    0,
  green:  13,
  yellow: 26,
  blue:   39,
};

// The cell just before a player's home stretch (they turn into home stretch after this)
export const HOME_ENTRY_CELLS: Record<PlayerColor, number> = {
  red:    50,
  green:  11,
  yellow: 24,
  blue:   37,
};

// Progress value at which a token enters its home stretch
// (Total steps from entry cell to turn into home stretch = 51)
export const HOME_STRETCH_START_PROGRESS = 51;

// Total progress to reach finish = 57 (51 main track steps + 6 home stretch steps including finish)
export const FINISH_PROGRESS = 57;

// Players used in 2/3/4 player modes
export const PLAYER_COLORS_BY_COUNT: Record<number, PlayerColor[]> = {
  2: ["red", "yellow"],
  3: ["red", "green", "yellow"],
  4: ["red", "green", "yellow", "blue"],
};

// ─────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────

export function createToken(color: PlayerColor, index: number): Token {
  return {
    id: `${color}-${index}`,
    color,
    index,
    state: "yard",
    trackPos: -1,
    progress: 0,
  };
}

export function createPlayer(
  color: PlayerColor,
  type: PlayerType,
  aiLevel?: AILevel
): Player {
  const names: Record<PlayerColor, string> = {
    red: "Red",
    green: "Green",
    yellow: "Yellow",
    blue: "Blue",
  };
  return {
    color,
    type,
    aiLevel,
    tokens: [0, 1, 2, 3].map((i) => createToken(color, i)),
    name: names[color],
    isActive: false,
    hasFinished: false,
  };
}

export function createInitialState(
  numPlayers: 2 | 3 | 4,
  playerConfigs: Array<{ type: PlayerType; aiLevel?: AILevel }>
): LudoState {
  const colors = PLAYER_COLORS_BY_COUNT[numPlayers];
  const players: Player[] = colors.map((color, i) => {
    const cfg = playerConfigs[i] ?? { type: "human" };
    return createPlayer(color, cfg.type, cfg.aiLevel);
  });

  players[0].isActive = true;

  return {
    players,
    currentPlayerIndex: 0,
    dice: 0,
    diceRolled: false,
    extraTurn: false,
    consecutiveSixes: 0,
    phase: "playing",
    winner: null,
    finishOrder: [],
    numPlayers,
    turnNumber: 0,
    movablePieces: [],
  };
}

// ─────────────────────────────────────────
// Dice
// ─────────────────────────────────────────

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ─────────────────────────────────────────
// Path / Position logic
// ─────────────────────────────────────────

/**
 * Given a token's current progress and dice value, return next progress.
 * Returns null if the move is invalid (overshoot finish).
 */
export function getNextProgress(token: Token, dice: number): number | null {
  if (token.state === "yard") {
    // Can only enter on 6
    if (dice !== 6) return null;
    return 0; // enters at progress 0 = their entry cell
  }
  if (token.state === "finished") return null;

  const next = token.progress + dice;
  // Cannot overshoot finish — must land exactly on or be able to reach
  if (next > FINISH_PROGRESS) return null;
  return next;
}

/**
 * Convert a token's progress + color to its actual track position (0-51) or home-stretch pos (100-104).
 * Progress 0-50 = main track; progress 51-56 = home stretch; progress 57 = finished.
 */
export function progressToTrackPos(color: PlayerColor, progress: number): number {
  if (progress >= FINISH_PROGRESS) return -1; // finished
  if (progress >= HOME_STRETCH_START_PROGRESS) {
    // Home stretch: 100 = entry of home, 104 = last cell before finish
    return 100 + (progress - HOME_STRETCH_START_PROGRESS);
  }
  const entry = ENTRY_CELLS[color];
  return (entry + progress) % 52;
}

/**
 * Convert cell board position to actual grid coordinate (for rendering).
 * Returns {row, col} in a 15x15 grid.
 */
export function cellToGrid(cellIndex: number): { row: number; col: number } {
  // The Ludo board is a 15×15 grid.
  // Cells go: right along bottom row, up right column, left along top row, down left column.
  // This mapping follows standard Ludo layout.
  const PATH: Array<[number, number]> = MAIN_TRACK_COORDS;
  return { row: PATH[cellIndex][0], col: PATH[cellIndex][1] };
}

/**
 * 52-cell main track grid coordinates (row, col) on a 15×15 board.
 * Standard Ludo layout: each side of the cross has 3 lanes of 6 cells.
 * Row 0 = top, Col 0 = left.
 *
 * Layout:
 *   Red home = top-left (rows 0-5, cols 0-5)
 *   Green home = top-right (rows 0-5, cols 9-14)
 *   Yellow home = bottom-right (rows 9-14, cols 9-14)
 *   Blue home = bottom-left (rows 9-14, cols 0-5)
 *   Center = rows 6-8, cols 6-8
 *
 * Track starts at Red's entry (cell 0) = row 6, col 1 (going right)
 */
export const MAIN_TRACK_COORDS: Array<[number, number]> = [
  // Red entry side: going right along row 6 (left side → center)
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],      // 0-4
  // Turn up through green home column
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],  // 5-10  (going up)
  // Green entry side: going right
  [0, 7],                                          // 11
  // Continue down green side
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],  // 12-17 (going down) — 13 = green entry
  // Turn right at top-right
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], // 18-23 (going right)
  // Yellow entry side: going down
  [7, 14],                                         // 24
  // Continue left along bottom-right
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],  // 25-30 (going left) — 26 = yellow entry
  // Turn down at right
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],  // 31-36 (going down)
  // Blue entry side: going left
  [14, 7],                                         // 37
  // Continue up blue side
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],  // 38-43 (going up) — 39 = blue entry
  // Turn left at bottom-left
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],  // 44-49 (going left)
  // Turn up on left side
  [7, 0],                                          // 50
  [6, 0],                                          // 51
];

// Home stretch coordinates for each color (5 cells + finish)
export const HOME_STRETCH_COORDS: Record<PlayerColor, Array<[number, number]>> = {
  red:    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],   // 100-105 (6 steps to center)
  green:  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue:   [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

// Yard positions for each color's 4 tokens
export const YARD_COORDS: Record<PlayerColor, Array<[number, number]>> = {
  red:    [[1, 1], [1, 4], [4, 1], [4, 4]],
  green:  [[1, 10], [1, 13], [4, 10], [4, 13]],
  yellow: [[10, 10], [10, 13], [13, 10], [13, 13]],
  blue:   [[10, 1], [10, 4], [13, 1], [13, 4]],
};

// ─────────────────────────────────────────
// Path calculation (for step-by-step animation)
// ─────────────────────────────────────────

/**
 * Returns the sequence of (row,col) waypoints for a token move,
 * one per step. Used by the UI for step-by-step animation.
 */
export function getMovePath(
  token: Token,
  dice: number,
  color: PlayerColor
): Array<[number, number]> {
  const path: Array<[number, number]> = [];

  if (token.state === "yard" && dice === 6) {
    // Entering: just the entry cell
    const entryPos = ENTRY_CELLS[color];
    path.push(MAIN_TRACK_COORDS[entryPos]);
    return path;
  }

  if (token.state === "finished") return path;

  for (let step = 1; step <= dice; step++) {
    const progress = token.progress + step;
    if (progress >= FINISH_PROGRESS) {
      path.push([7, 7]); // center (finished)
      break;
    }
    if (progress >= HOME_STRETCH_START_PROGRESS) {
      const hsIdx = progress - HOME_STRETCH_START_PROGRESS;
      const coord = HOME_STRETCH_COORDS[color][hsIdx];
      if (coord) path.push(coord);
    } else {
      const trackPos = progressToTrackPos(color, progress);
      const coord = MAIN_TRACK_COORDS[trackPos];
      if (coord) path.push(coord);
    }
  }

  return path;
}

// ─────────────────────────────────────────
// Move logic
// ─────────────────────────────────────────

/**
 * Check if a token can capture at a given track position.
 * Safe cells and occupied-by-same-color cells cannot be captured.
 */
export function canCapture(
  state: LudoState,
  movingColor: PlayerColor,
  trackPos: number
): { canCapture: boolean; tokensThere: Token[] } {
  if (trackPos < 0 || trackPos >= 100) return { canCapture: false, tokensThere: [] };
  if (SAFE_CELLS.has(trackPos)) return { canCapture: false, tokensThere: [] };

  const tokensAtPos: Token[] = [];
  for (const player of state.players) {
    if (player.color === movingColor) continue;
    for (const token of player.tokens) {
      if (token.state === "track" && token.trackPos === trackPos) {
        tokensAtPos.push(token);
      }
    }
  }

  return { canCapture: tokensAtPos.length > 0, tokensThere: tokensAtPos };
}

/**
 * Get all movable tokens for the current player given dice value.
 */
export function getMovableTokens(state: LudoState): string[] {
  const player = state.players[state.currentPlayerIndex];
  const dice = state.dice;
  const movable: string[] = [];

  for (const token of player.tokens) {
    if (token.state === "finished") continue;

    if (token.state === "yard") {
      if (dice === 6) movable.push(token.id);
      continue;
    }

    // On track or in home stretch
    const nextProgress = getNextProgress(token, dice);
    if (nextProgress === null) continue; // overshoot

    // Check for blockade (2+ same-color tokens at destination, but that's actually a feature that blocks enemies)
    // Standard Ludo: you can always move your own token unless overshoot
    movable.push(token.id);
  }

  return movable;
}

/**
 * Apply a move — move the token and return new state + side effects.
 */
export function applyMove(
  state: LudoState,
  tokenId: string
): MoveResult {
  // Deep clone state
  const newState = deepCloneState(state);
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  const token = currentPlayer.tokens.find((t) => t.id === tokenId);

  // Compute animation path BEFORE mutating state
  const movePath = token
    ? getMovePath(token, newState.dice, currentPlayer.color)
    : [];

  if (!token) {
    return { newState, captured: false, enteredBoard: false, enteredHome: false, finished: false, movePath: [] };
  }

  let captured = false;
  let capturedToken: Token | undefined;
  let enteredBoard = false;
  let enteredHome = false;
  let finished = false;

  if (token.state === "yard" && newState.dice === 6) {
    // Enter the board
    token.state = "track";
    token.progress = 0;
    token.trackPos = ENTRY_CELLS[token.color];
    enteredBoard = true;

    // Check for capture at entry cell — always allowed when entering from yard
    // (even on safe/star cells, entering from yard can capture)
    const tokensAtEntry: Token[] = [];
    for (const player of newState.players) {
      if (player.color === token.color) continue;
      for (const t of player.tokens) {
        if (t.state === "track" && t.trackPos === token.trackPos) {
          tokensAtEntry.push(t);
        }
      }
    }
    if (tokensAtEntry.length > 0) {
      for (const enemy of tokensAtEntry) {
        sendTokenToYard(newState, enemy);
        captured = true;
        capturedToken = enemy;
      }
    }
  } else if (token.state === "track" || token.state === "home") {
    const nextProgress = getNextProgress(token, newState.dice)!;

    // Check if entering home stretch
    if (token.progress < HOME_STRETCH_START_PROGRESS && nextProgress >= HOME_STRETCH_START_PROGRESS) {
      enteredHome = true;
    }

    token.progress = nextProgress;

    if (nextProgress >= FINISH_PROGRESS) {
      // Token finished!
      token.state = "finished";
      token.trackPos = -1;
      finished = true;
    } else if (nextProgress >= HOME_STRETCH_START_PROGRESS) {
      // In home stretch
      token.state = "home";
      const hsIdx = nextProgress - HOME_STRETCH_START_PROGRESS;
      token.trackPos = 100 + hsIdx;
    } else {
      // Still on main track
      token.state = "track";
      token.trackPos = progressToTrackPos(token.color, nextProgress);

      // Check for capture
      if (!SAFE_CELLS.has(token.trackPos)) {
        const { tokensThere } = canCapture(newState, token.color, token.trackPos);
        if (tokensThere.length > 0) {
          for (const enemy of tokensThere) {
            sendTokenToYard(newState, enemy);
            captured = true;
            capturedToken = enemy;
          }
        }
      }
    }
  }

  // Check if all tokens of this player are finished
  const allFinished = currentPlayer.tokens.every((t) => t.state === "finished");
  if (allFinished && !currentPlayer.hasFinished) {
    currentPlayer.hasFinished = true;
    newState.finishOrder.push(currentPlayer.color);
    if (!newState.winner) {
      newState.winner = currentPlayer.color;
    }
  }

  // Check game over (only 1 active player left, or all players finished)
  const activePlayers = newState.players.filter((p) => !p.hasFinished);
  if (activePlayers.length <= 1) {
    // Add last player to finish order
    for (const p of newState.players) {
      if (!newState.finishOrder.includes(p.color)) {
        newState.finishOrder.push(p.color);
      }
    }
    newState.phase = "gameover";
  }

  // Determine next turn
  const rolledSix = newState.dice === 6;
  const isConsecSixes = rolledSix && newState.consecutiveSixes >= 2; // 3 sixes = forfeit

  if (newState.phase !== "gameover") {
    if ((rolledSix || captured) && !isConsecSixes) {
      // Extra turn
      newState.extraTurn = true;
      newState.consecutiveSixes = rolledSix ? newState.consecutiveSixes + 1 : 0;
    } else {
      // Move to next player
      advanceTurn(newState);
    }
  }

  newState.diceRolled = false;
  newState.movablePieces = [];

  return { newState, captured, capturedToken, enteredBoard, enteredHome, finished, movePath };
}

function sendTokenToYard(state: LudoState, token: Token): void {
  // Find the token in state and reset it
  for (const player of state.players) {
    const t = player.tokens.find((tk) => tk.id === token.id);
    if (t) {
      t.state = "yard";
      t.trackPos = -1;
      t.progress = 0;
      break;
    }
  }
}

export function advanceTurn(state: LudoState): void {
  state.players[state.currentPlayerIndex].isActive = false;
  state.extraTurn = false;
  state.consecutiveSixes = 0;

  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  // Skip finished players
  let loopCount = 0;
  while (state.players[nextIndex].hasFinished && loopCount < state.players.length) {
    nextIndex = (nextIndex + 1) % state.players.length;
    loopCount++;
  }

  state.currentPlayerIndex = nextIndex;
  state.players[nextIndex].isActive = true;
  state.turnNumber++;
}

/**
 * After rolling dice but getting no movable pieces (stuck), auto-advance turn.
 */
export function handleNoMoves(state: LudoState): LudoState {
  const newState = deepCloneState(state);

  // Three consecutive sixes: forfeit turn
  if (newState.dice === 6) {
    newState.consecutiveSixes++;
    if (newState.consecutiveSixes >= 3) {
      advanceTurn(newState);
      return newState;
    }
  }

  advanceTurn(newState);
  newState.diceRolled = false;
  return newState;
}

// ─────────────────────────────────────────
// AI
// ─────────────────────────────────────────

/**
 * Evaluate a move for AI scoring.
 * Returns a score — higher is better for the AI player.
 */
function evaluateMove(state: LudoState, tokenId: string, aiColor: PlayerColor): number {
  const result = applyMove(state, tokenId);
  let score = 0;

  // Find the moved token
  const aiPlayer = result.newState.players.find((p) => p.color === aiColor)!;
  const movedToken = aiPlayer.tokens.find((t) => t.id === tokenId)!;

  // Heavily reward finishing
  if (movedToken.state === "finished") score += 10000;

  // Reward entering home stretch
  if (movedToken.state === "home") score += 500;

  // Reward captures
  if (result.captured) score += 300;

  // Reward entering the board
  if (result.enteredBoard) score += 200;

  // Reward progress (tokens further along are better)
  score += movedToken.progress * 5;

  // Penalize tokens on non-safe cells (risk of capture)
  if (
    movedToken.state === "track" &&
    movedToken.trackPos >= 0 &&
    !SAFE_CELLS.has(movedToken.trackPos)
  ) {
    // Check if any enemy is close behind
    for (const player of result.newState.players) {
      if (player.color === aiColor) continue;
      for (const enemyToken of player.tokens) {
        if (enemyToken.state !== "track") continue;
        const dist = (movedToken.trackPos - enemyToken.trackPos + 52) % 52;
        if (dist > 0 && dist <= 6) score -= 80;
      }
    }
  }

  return score;
}

export function getAIMove(state: LudoState): string | null {
  const player = state.players[state.currentPlayerIndex];
  if (player.type !== "ai" || state.movablePieces.length === 0) return null;

  const level = player.aiLevel ?? "easy";

  if (level === "easy") {
    // Random valid move
    const idx = Math.floor(Math.random() * state.movablePieces.length);
    return state.movablePieces[idx];
  }

  if (level === "medium") {
    // Priority: finish > capture > enter home > advance furthest token
    // Score each move simply
    let best = state.movablePieces[0];
    let bestScore = -Infinity;

    for (const tokenId of state.movablePieces) {
      const score = evaluateMove(state, tokenId, player.color);
      if (score > bestScore) {
        bestScore = score;
        best = tokenId;
      }
    }
    return best;
  }

  // Hard: same as medium with slight lookahead
  let best = state.movablePieces[0];
  let bestScore = -Infinity;

  for (const tokenId of state.movablePieces) {
    let score = evaluateMove(state, tokenId, player.color);

    // Add small random noise to avoid predictability
    score += Math.random() * 10;

    if (score > bestScore) {
      bestScore = score;
      best = tokenId;
    }
  }
  return best;
}

// ─────────────────────────────────────────
// Stats
// ─────────────────────────────────────────

export const DEFAULT_STATS: LudoStats = {
  wins: 0,
  losses: 0,
  captures: 0,
  gamesPlayed: 0,
  winStreak: 0,
  bestStreak: 0,
};

export const STATS_STORAGE_KEY = "ludo-stats";

export function loadStats(): LudoStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return JSON.parse(raw) as LudoStats;
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveStats(stats: LudoStats): void {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {}
}

export function updateStats(
  stats: LudoStats,
  won: boolean,
  captures: number
): LudoStats {
  const next = { ...stats };
  next.gamesPlayed++;
  next.captures += captures;
  if (won) {
    next.wins++;
    next.winStreak++;
    if (next.winStreak > next.bestStreak) next.bestStreak = next.winStreak;
  } else {
    next.losses++;
    next.winStreak = 0;
  }
  return next;
}

// ─────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────

export function deepCloneState(state: LudoState): LudoState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      tokens: p.tokens.map((t) => ({ ...t })),
    })),
    finishOrder: [...state.finishOrder],
    movablePieces: [...state.movablePieces],
  };
}

export function getCurrentPlayer(state: LudoState): Player {
  return state.players[state.currentPlayerIndex];
}

export function getTokenCoord(
  token: Token,
  color: PlayerColor
): [number, number] {
  if (token.state === "yard") {
    return YARD_COORDS[color][token.index];
  }
  if (token.state === "finished") {
    // Center of board
    return [7, 7];
  }
  if (token.state === "home") {
    const hsIdx = token.trackPos - 100;
    return HOME_STRETCH_COORDS[color][hsIdx] ?? [7, 7];
  }
  // On main track
  return MAIN_TRACK_COORDS[token.trackPos] ?? [7, 7];
}

/**
 * Check if a token at a given track position is blocked by 2+ enemy tokens (blockade).
 * In some Ludo variants, a blockade of 2+ same-colored tokens cannot be passed.
 * We implement a soft version: blockades by 2+ tokens on non-safe cells.
 */
export function isBlockaded(
  state: LudoState,
  movingColor: PlayerColor,
  trackPos: number
): boolean {
  if (trackPos < 0 || trackPos >= 100) return false;
  const counts: Record<string, number> = {};
  for (const player of state.players) {
    if (player.color === movingColor) continue;
    for (const token of player.tokens) {
      if (token.state === "track" && token.trackPos === trackPos) {
        counts[player.color] = (counts[player.color] ?? 0) + 1;
      }
    }
  }
  return Object.values(counts).some((c) => c >= 2);
}
