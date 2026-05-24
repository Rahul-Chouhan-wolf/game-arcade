"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LudoState,
  LudoStats,
  PlayerColor,
  PlayerType,
  AILevel,
  Token,
  Player,
  MoveResult,
  createInitialState,
  rollDice,
  getMovableTokens,
  applyMove,
  handleNoMoves,
  getAIMove,
  getTokenCoord,
  MAIN_TRACK_COORDS,
  HOME_STRETCH_COORDS,
  YARD_COORDS,
  SAFE_CELLS,
  ENTRY_CELLS,
  PLAYER_COLORS_BY_COUNT,
  loadStats,
  saveStats,
  updateStats,
  getCurrentPlayer,
  deepCloneState,
} from "@/lib/ludo/engine";
import { LudoAudio } from "@/lib/ludo/audio";

// ─────────────────────────────────────────
// Constants & Colors
// ─────────────────────────────────────────

const COLOR_PALETTE: Record<PlayerColor, {
  primary: string;
  light: string;
  dark: string;
  glow: string;
  text: string;
  yard: string;
}> = {
  red:    { primary: "#ef4444", light: "#fca5a5", dark: "#991b1b", glow: "#ef444455", text: "#fff", yard: "rgba(239,68,68,0.18)" },
  green:  { primary: "#22c55e", light: "#86efac", dark: "#15803d", glow: "#22c55e55", text: "#fff", yard: "rgba(34,197,94,0.18)" },
  yellow: { primary: "#eab308", light: "#fde68a", dark: "#a16207", glow: "#eab30855", text: "#000", yard: "rgba(234,179,8,0.18)" },
  blue:   { primary: "#3b82f6", light: "#93c5fd", dark: "#1d4ed8", glow: "#3b82f655", text: "#fff", yard: "rgba(59,130,246,0.18)" },
};

// Safe star cells
const STAR_CELLS = [8, 13, 21, 26, 34, 39, 47];

// ─────────────────────────────────────────
// Audio singleton
// ─────────────────────────────────────────

const audio = new LudoAudio();

// ─────────────────────────────────────────
// Dice Component
// ─────────────────────────────────────────

const DICE_DOTS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
};

interface DiceProps {
  value: number;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  playerColor: PlayerColor;
}

function Dice({ value, rolling, canRoll, onRoll, playerColor }: DiceProps) {
  const pal = COLOR_PALETTE[playerColor];
  const displayValue = rolling ? Math.ceil(Math.random() * 6) : value;

  return (
    <motion.button
      onClick={canRoll ? onRoll : undefined}
      disabled={!canRoll || rolling}
      whileHover={canRoll && !rolling ? { scale: 1.08, y: -2 } : {}}
      whileTap={canRoll && !rolling ? { scale: 0.94 } : {}}
      style={{
        width: 72,
        height: 72,
        borderRadius: 14,
        background: canRoll
          ? `linear-gradient(135deg, ${pal.primary}, ${pal.dark})`
          : "rgba(40,40,60,0.7)",
        border: `2px solid ${canRoll ? pal.primary : "rgba(255,255,255,0.1)"}`,
        boxShadow: canRoll ? `0 0 24px ${pal.glow}, 0 4px 16px rgba(0,0,0,0.5)` : "0 4px 16px rgba(0,0,0,0.4)",
        cursor: canRoll && !rolling ? "pointer" : "default",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
      }}
      animate={rolling ? { rotateX: [0, 180, 360, 540, 720], rotateY: [0, 90, 270, 90, 0] } : {}}
      transition={rolling ? { duration: 0.7, ease: "easeInOut" } : {}}
    >
      <svg width="60" height="60" viewBox="0 0 100 100">
        {(DICE_DOTS[displayValue] || DICE_DOTS[1]).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={10} fill={canRoll ? "white" : "rgba(255,255,255,0.3)"} />
        ))}
      </svg>
    </motion.button>
  );
}

// ─────────────────────────────────────────
// Board Cell
// ─────────────────────────────────────────

interface CellProps {
  row: number;
  col: number;
  cellSize: number;
  children?: React.ReactNode;
  bg?: string;
  border?: string;
  isSafe?: boolean;
  isEntry?: Record<PlayerColor, boolean>;
}

// The Ludo board color regions
function getCellBackground(row: number, col: number): string {
  // Home yards
  if (row <= 5 && col <= 5) return "rgba(239,68,68,0.12)";      // red top-left
  if (row <= 5 && col >= 9) return "rgba(34,197,94,0.12)";       // green top-right
  if (row >= 9 && col >= 9) return "rgba(234,179,8,0.12)";       // yellow bottom-right
  if (row >= 9 && col <= 5) return "rgba(59,130,246,0.12)";      // blue bottom-left

  // Colored track cells
  // Red column (col 6, rows 1-5) — going up
  if (col === 7 && row >= 1 && row <= 5) return "rgba(239,68,68,0.35)";
  // Green row (row 6, cols 9-13) — going right from green's turn
  if (row === 6 && col >= 9 && col <= 13) return "rgba(34,197,94,0.35)";
  // Yellow column (col 7, rows 9-13) — going down
  if (col === 7 && row >= 9 && row <= 13) return "rgba(234,179,8,0.35)";
  // Blue row (row 8, cols 1-5) — going left
  if (row === 8 && col >= 1 && col <= 5) return "rgba(59,130,246,0.35)";

  // Center triangle areas
  if (row === 7 && col === 7) return "rgba(255,255,255,0.08)"; // exact center

  return "rgba(255,255,255,0.04)";
}

// ─────────────────────────────────────────
// Token Component
// ─────────────────────────────────────────

interface TokenProps {
  token: Token;
  cellSize: number;
  isMovable: boolean;
  isSelected: boolean;
  onClick: () => void;
  yardOffset?: [number, number]; // sub-position within yard cell
}

function TokenPiece({ token, cellSize, isMovable, isSelected, onClick, yardOffset }: TokenProps) {
  const pal = COLOR_PALETTE[token.color];
  const [row, col] = getTokenCoord(token, token.color);

  // If multiple tokens on same cell in yard, offset slightly
  const dx = yardOffset ? yardOffset[0] * (cellSize * 0.28) : 0;
  const dy = yardOffset ? yardOffset[1] * (cellSize * 0.28) : 0;

  const x = col * cellSize + cellSize / 2 + dx;
  const y = row * cellSize + cellSize / 2 + dy;
  const r = Math.max(8, cellSize * 0.32);

  return (
    <motion.g
      onClick={isMovable ? onClick : undefined}
      style={{ cursor: isMovable ? "pointer" : "default" }}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      initial={{ x, y }}
    >
      {/* Glow */}
      {(isMovable || isSelected) && (
        <motion.circle
          cx={0} cy={0} r={r + 6}
          fill="none"
          stroke={isSelected ? "white" : pal.primary}
          strokeWidth={2}
          opacity={0.7}
          animate={{ r: [r + 4, r + 9, r + 4], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        />
      )}
      {/* Shadow */}
      <circle cx={1} cy={2} r={r} fill="rgba(0,0,0,0.4)" />
      {/* Body */}
      <circle
        cx={0} cy={0} r={r}
        fill={`url(#token-grad-${token.color})`}
        stroke={isSelected ? "white" : pal.dark}
        strokeWidth={isSelected ? 2.5 : 1.5}
      />
      {/* Inner dot */}
      <circle cx={0} cy={-r * 0.28} r={r * 0.3} fill="rgba(255,255,255,0.35)" />
    </motion.g>
  );
}

// ─────────────────────────────────────────
// Ludo Board SVG
// ─────────────────────────────────────────

interface BoardProps {
  state: LudoState;
  selectedToken: string | null;
  onTokenClick: (tokenId: string) => void;
  cellSize: number;
}

function LudoBoard({ state, selectedToken, onTokenClick, cellSize }: BoardProps) {
  const size = 15 * cellSize;

  // Build a map of trackPos → tokens for rendering stacked tokens
  const trackTokenMap = useMemo(() => {
    const map = new Map<string, Token[]>();
    for (const player of state.players) {
      for (const token of player.tokens) {
        if (token.state === "yard" || token.state === "finished") continue;
        const key = `${token.trackPos}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(token);
      }
    }
    return map;
  }, [state]);

  // Build yard token map
  const yardTokenMap = useMemo(() => {
    const map = new Map<PlayerColor, Token[]>();
    for (const player of state.players) {
      const inYard = player.tokens.filter((t) => t.state === "yard");
      if (inYard.length > 0) map.set(player.color, inYard);
    }
    return map;
  }, [state]);

  const movableSet = new Set(state.movablePieces);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", borderRadius: 12 }}
    >
      <defs>
        {/* Token gradients */}
        {(["red", "green", "yellow", "blue"] as PlayerColor[]).map((color) => {
          const pal = COLOR_PALETTE[color];
          return (
            <radialGradient key={color} id={`token-grad-${color}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor={pal.light} />
              <stop offset="100%" stopColor={pal.primary} />
            </radialGradient>
          );
        })}
        {/* Board glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Clip to board */}
        <clipPath id="board-clip">
          <rect x={0} y={0} width={size} height={size} rx={12} />
        </clipPath>
      </defs>

      <g clipPath="url(#board-clip)">
        {/* Board background */}
        <rect x={0} y={0} width={size} height={size} fill="#0f0f1a" />

        {/* Grid cells */}
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 15 }, (_, col) => {
            const bg = getCellBackground(row, col);
            const isSafe = SAFE_CELLS.has(MAIN_TRACK_COORDS.findIndex(([r, c]) => r === row && c === col));
            const trackIdx = MAIN_TRACK_COORDS.findIndex(([r, c]) => r === row && c === col);
            const isEntry = Object.entries(ENTRY_CELLS).find(([, idx]) => idx === trackIdx);

            return (
              <g key={`${row}-${col}`}>
                <rect
                  x={col * cellSize}
                  y={row * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={bg}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={0.5}
                />
                {/* Safe star */}
                {SAFE_CELLS.has(trackIdx) && trackIdx >= 0 && (
                  <text
                    x={col * cellSize + cellSize / 2}
                    y={row * cellSize + cellSize / 2 + 5}
                    textAnchor="middle"
                    fontSize={cellSize * 0.5}
                    fill="rgba(255,215,0,0.55)"
                  >
                    ★
                  </text>
                )}
                {/* Entry markers */}
                {isEntry && (
                  <circle
                    cx={col * cellSize + cellSize / 2}
                    cy={row * cellSize + cellSize / 2}
                    r={cellSize * 0.18}
                    fill={COLOR_PALETTE[isEntry[0] as PlayerColor].primary}
                    opacity={0.4}
                  />
                )}
              </g>
            );
          })
        )}

        {/* Home yard backgrounds */}
        {(state.players.map((p) => p.color)).map((color) => {
          const pal = COLOR_PALETTE[color];
          const yardCoords: Record<PlayerColor, [number, number, number, number]> = {
            red:    [0.5, 0.5, 5, 5],
            green:  [9.5, 0.5, 5, 5],
            yellow: [9.5, 9.5, 5, 5],
            blue:   [0.5, 9.5, 5, 5],
          };
          const [cx, cy, w, h] = yardCoords[color];
          return (
            <rect
              key={color}
              x={cy * cellSize}
              y={cx * cellSize}
              width={w * cellSize}
              height={h * cellSize}
              fill={pal.yard}
              stroke={pal.primary}
              strokeWidth={1.5}
              strokeOpacity={0.4}
              rx={cellSize * 0.4}
            />
          );
        })}

        {/* Center finish triangle */}
        {(["red", "green", "yellow", "blue"] as PlayerColor[]).map((color, i) => {
          const cx = 7 * cellSize + cellSize / 2;
          const cy2 = 7 * cellSize + cellSize / 2;
          const r = cellSize * 1.3;
          const angle = (i * 90 - 45) * (Math.PI / 180);
          const angle2 = ((i + 1) * 90 - 45) * (Math.PI / 180);
          const x1 = cx + r * Math.cos(angle);
          const y1 = cy2 + r * Math.sin(angle);
          const x2 = cx + r * Math.cos(angle2);
          const y2 = cy2 + r * Math.sin(angle2);
          return (
            <polygon
              key={color}
              points={`${cx},${cy2} ${x1},${y1} ${x2},${y2}`}
              fill={COLOR_PALETTE[color].primary}
              opacity={0.5}
            />
          );
        })}

        {/* Home stretch colored paths */}
        {state.players.map((p) =>
          HOME_STRETCH_COORDS[p.color].slice(0, 5).map(([r, c], i) => {
            const pal = COLOR_PALETTE[p.color];
            return (
              <rect
                key={`hs-${p.color}-${i}`}
                x={c * cellSize + 1}
                y={r * cellSize + 1}
                width={cellSize - 2}
                height={cellSize - 2}
                fill={pal.primary}
                opacity={0.25}
                rx={2}
              />
            );
          })
        )}

        {/* Track tokens (not in yard) */}
        {state.players.flatMap((player) =>
          player.tokens
            .filter((t) => t.state === "track" || t.state === "home")
            .map((token) => {
              const tokensAtSamePos = (trackTokenMap.get(`${token.trackPos}`) ?? []);
              const posIndex = tokensAtSamePos.findIndex((t) => t.id === token.id);
              const total = tokensAtSamePos.length;
              let yardOffset: [number, number] | undefined;
              if (total > 1) {
                const offsets: Array<[number, number]> = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
                yardOffset = offsets[posIndex % 4];
              }
              return (
                <TokenPiece
                  key={token.id}
                  token={token}
                  cellSize={cellSize}
                  isMovable={movableSet.has(token.id)}
                  isSelected={selectedToken === token.id}
                  onClick={() => onTokenClick(token.id)}
                  yardOffset={yardOffset}
                />
              );
            })
        )}

        {/* Yard tokens */}
        {state.players.flatMap((player) => {
          const yardTokens = yardTokenMap.get(player.color) ?? [];
          return yardTokens.map((token, i) => (
            <TokenPiece
              key={token.id}
              token={token}
              cellSize={cellSize}
              isMovable={movableSet.has(token.id)}
              isSelected={selectedToken === token.id}
              onClick={() => onTokenClick(token.id)}
            />
          ));
        })}

        {/* Finished tokens in center */}
        {state.players.flatMap((player) =>
          player.tokens
            .filter((t) => t.state === "finished")
            .map((token, i) => {
              const pal = COLOR_PALETTE[token.color];
              const cx2 = 7 * cellSize + cellSize / 2;
              const cy3 = 7 * cellSize + cellSize / 2;
              const angle = (i * 90 + { red: 0, green: 90, yellow: 180, blue: 270 }[token.color]) * (Math.PI / 180);
              const fx = cx2 + (cellSize * 0.5) * Math.cos(angle);
              const fy = cy3 + (cellSize * 0.5) * Math.sin(angle);
              return (
                <motion.circle
                  key={token.id}
                  cx={fx}
                  cy={fy}
                  r={cellSize * 0.25}
                  fill={pal.primary}
                  stroke="white"
                  strokeWidth={1}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                />
              );
            })
        )}
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────
// Player Panel
// ─────────────────────────────────────────

interface PlayerPanelProps {
  player: Player;
  isCurrentTurn: boolean;
  finishPosition?: number;
}

function PlayerPanel({ player, isCurrentTurn, finishPosition }: PlayerPanelProps) {
  const pal = COLOR_PALETTE[player.color];
  const finished = player.tokens.filter((t) => t.state === "finished").length;
  const inYard = player.tokens.filter((t) => t.state === "yard").length;

  return (
    <motion.div
      animate={{
        boxShadow: isCurrentTurn
          ? [`0 0 0 2px ${pal.primary}`, `0 0 20px ${pal.glow}`, `0 0 0 2px ${pal.primary}`]
          : "0 0 0 1px rgba(255,255,255,0.08)",
      }}
      transition={{ repeat: isCurrentTurn ? Infinity : 0, duration: 1.5 }}
      style={{
        borderRadius: 12,
        padding: "10px 14px",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${isCurrentTurn ? pal.primary : "rgba(255,255,255,0.08)"}`,
        opacity: player.hasFinished ? 0.6 : 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isCurrentTurn && (
        <motion.div
          style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(135deg, ${pal.glow}, transparent)`,
            pointerEvents: "none",
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          background: pal.primary,
          boxShadow: `0 0 8px ${pal.glow}`,
          flexShrink: 0,
        }} />
        <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>
          {player.name}
          {player.type === "ai" && (
            <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 10, marginLeft: 4 }}>
              ({player.aiLevel})
            </span>
          )}
        </span>
        {finishPosition && (
          <span style={{
            marginLeft: "auto", fontSize: 11, fontWeight: 700,
            color: finishPosition === 1 ? "#ffd700" : "rgba(255,255,255,0.5)",
          }}>
            {finishPosition === 1 ? "🏆" : `#${finishPosition}`}
          </span>
        )}
      </div>

      {/* Token status */}
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {player.tokens.map((t) => (
          <div
            key={t.id}
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background: t.state === "finished" ? pal.primary :
                         t.state === "yard" ? "rgba(255,255,255,0.15)" :
                         t.state === "home" ? pal.light : pal.primary,
              border: `1px solid ${t.state === "finished" ? "white" : pal.dark}`,
              boxShadow: t.state === "track" || t.state === "home" ? `0 0 6px ${pal.glow}` : "none",
              opacity: t.state === "yard" ? 0.4 : 1,
            }}
          />
        ))}
      </div>

      {isCurrentTurn && (
        <motion.div
          style={{
            position: "absolute", top: 4, right: 8,
            fontSize: 9, color: pal.light, fontWeight: 700, letterSpacing: 1,
          }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 0.9 }}
        >
          TURN
        </motion.div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Menu Screen
// ─────────────────────────────────────────

interface MenuConfig {
  numPlayers: 2 | 3 | 4;
  playerTypes: Array<{ type: PlayerType; aiLevel?: AILevel }>;
}

interface MenuScreenProps {
  stats: LudoStats;
  onStart: (config: MenuConfig) => void;
}

function MenuScreen({ stats, onStart }: MenuScreenProps) {
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(2);
  const [playerTypes, setPlayerTypes] = useState<Array<{ type: PlayerType; aiLevel?: AILevel }>>([
    { type: "human" },
    { type: "ai", aiLevel: "medium" },
    { type: "ai", aiLevel: "medium" },
    { type: "ai", aiLevel: "medium" },
  ]);

  const colors = PLAYER_COLORS_BY_COUNT[numPlayers];

  const togglePlayerType = (i: number) => {
    setPlayerTypes((prev) => {
      const next = [...prev];
      if (next[i].type === "human") {
        next[i] = { type: "ai", aiLevel: "medium" };
      } else if (next[i].aiLevel === "easy") {
        next[i] = { type: "human" };
      } else if (next[i].aiLevel === "medium") {
        next[i] = { type: "ai", aiLevel: "hard" };
      } else {
        next[i] = { type: "ai", aiLevel: "easy" };
      }
      return next;
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a0a1a 0%, #0d0720 50%, #0a0a1a 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
    }}>
      {/* Ambient blobs */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden",
      }}>
        {["#ef444422", "#22c55e22", "#eab30822", "#3b82f622"].map((color, i) => (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: 400, height: 400,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color}, transparent 70%)`,
              left: `${[10, 60, 10, 60][i]}%`,
              top: `${[10, 10, 60, 60][i]}%`,
              transform: "translate(-50%, -50%)",
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ repeat: Infinity, duration: 4 + i * 1.5, ease: "easeInOut" }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: "100%", maxWidth: 460,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          padding: "36px 32px",
          backdropFilter: "blur(20px)",
          position: "relative", zIndex: 1,
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <motion.h1
            style={{
              fontSize: 42, fontWeight: 900, letterSpacing: -1,
              background: "linear-gradient(135deg, #ef4444, #eab308, #22c55e, #3b82f6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: 8,
            }}
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ repeat: Infinity, duration: 5 }}
          >
            LUDO
          </motion.h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
            Race your tokens home — roll, capture, win
          </p>
        </div>

        {/* Stats */}
        {stats.gamesPlayed > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8, marginBottom: 28,
          }}>
            {[
              { label: "Wins", value: stats.wins, color: "#22c55e" },
              { label: "Losses", value: stats.losses, color: "#ef4444" },
              { label: "Streak", value: stats.winStreak, color: "#eab308" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: 10, padding: "8px 4px", textAlign: "center",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Number of players */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 10, letterSpacing: 1, fontWeight: 600 }}>
            PLAYERS
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {([2, 3, 4] as const).map((n) => (
              <motion.button
                key={n}
                onClick={() => setNumPlayers(n)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  border: numPlayers === n ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  background: numPlayers === n ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                  color: "white", fontSize: 18, fontWeight: 700, cursor: "pointer",
                }}
              >
                {n}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Player configuration */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 10, letterSpacing: 1, fontWeight: 600 }}>
            SETUP
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {colors.map((color, i) => {
              const pal = COLOR_PALETTE[color];
              const cfg = playerTypes[i];
              const label = cfg.type === "human" ? "Human" : `AI · ${cfg.aiLevel}`;
              return (
                <motion.button
                  key={color}
                  onClick={() => togglePlayerType(i)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 10,
                    border: `1px solid ${pal.primary}44`,
                    background: `${pal.yard}`,
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: pal.primary, flexShrink: 0,
                    boxShadow: `0 0 8px ${pal.glow}`,
                  }} />
                  <span style={{ color: "white", fontWeight: 600, fontSize: 13, flex: 1 }}>
                    {pal.text === "#000" ? (
                      <span style={{ background: pal.primary, color: "#000", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>
                        {pal.primary === "#eab308" ? "Yellow" : "Blue"}
                      </span>
                    ) : color.charAt(0).toUpperCase() + color.slice(1)}
                  </span>
                  <span style={{
                    color: cfg.type === "human" ? "#60a5fa" : "#34d399",
                    fontSize: 12, fontWeight: 600,
                    background: cfg.type === "human" ? "rgba(96,165,250,0.15)" : "rgba(52,211,153,0.15)",
                    padding: "3px 10px", borderRadius: 6,
                  }}>
                    {label}
                  </span>
                </motion.button>
              );
            })}
          </div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 8 }}>
            Click a player to cycle: Human → AI Easy → AI Medium → AI Hard → Human
          </p>
        </div>

        {/* Start button */}
        <motion.button
          onClick={() => {
            audio.click();
            onStart({ numPlayers, playerTypes: playerTypes.slice(0, numPlayers) });
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: "100%", padding: "14px 0",
            background: "linear-gradient(135deg, #ef4444, #eab308, #22c55e, #3b82f6)",
            border: "none", borderRadius: 12,
            color: "white", fontSize: 16, fontWeight: 800,
            cursor: "pointer", letterSpacing: 1,
            boxShadow: "0 0 32px rgba(239,68,68,0.3), 0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          PLAY
        </motion.button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────
// Game Over Screen
// ─────────────────────────────────────────

interface GameOverProps {
  state: LudoState;
  stats: LudoStats;
  onPlayAgain: () => void;
  onMenu: () => void;
}

function GameOverScreen({ state, stats, onPlayAgain, onMenu }: GameOverProps) {
  const winner = state.finishOrder[0];
  const pal = winner ? COLOR_PALETTE[winner] : COLOR_PALETTE.red;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(12px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        style={{
          width: "90%", maxWidth: 360,
          background: "rgba(20,20,40,0.95)",
          border: `2px solid ${pal.primary}`,
          borderRadius: 24, padding: "36px 28px",
          textAlign: "center",
          boxShadow: `0 0 60px ${pal.glow}, 0 0 120px ${pal.glow}40`,
        }}
      >
        <motion.div
          style={{ fontSize: 56, marginBottom: 8 }}
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          🏆
        </motion.div>
        <h2 style={{
          fontSize: 28, fontWeight: 900, color: pal.primary,
          marginBottom: 4, letterSpacing: -0.5,
        }}>
          {winner ? `${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins!` : "Game Over"}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24 }}>
          {state.players.find((p) => p.color === winner)?.type === "human"
            ? "Congratulations! You raced all tokens home."
            : "The AI won this round."}
        </p>

        {/* Finish order */}
        <div style={{ marginBottom: 24 }}>
          {state.finishOrder.map((color, i) => {
            const p = COLOR_PALETTE[color];
            return (
              <div key={color} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 12px", borderRadius: 8, marginBottom: 4,
                background: i === 0 ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.04)",
              }}>
                <span style={{ fontSize: 16 }}>{["🥇","🥈","🥉","4️⃣"][i]}</span>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.primary }} />
                <span style={{ color: "white", fontWeight: 600, fontSize: 13 }}>
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 8, marginBottom: 24,
        }}>
          {[
            { label: "Total Wins", value: stats.wins },
            { label: "Win Streak", value: stats.winStreak },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.05)", borderRadius: 10,
              padding: "8px 4px", border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>{value}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <motion.button
            onClick={onMenu}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.07)",
              color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Menu
          </motion.button>
          <motion.button
            onClick={onPlayAgain}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              border: `1px solid ${pal.primary}`,
              background: `linear-gradient(135deg, ${pal.primary}, ${pal.dark})`,
              color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 0 16px ${pal.glow}`,
            }}
          >
            Play Again
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Main Game Component
// ─────────────────────────────────────────

type GameScreen = "menu" | "game";

export function LudoGame() {
  const [screen, setScreen] = useState<GameScreen>("menu");
  const [gameState, setGameState] = useState<LudoState | null>(null);
  const [menuConfig, setMenuConfig] = useState<MenuConfig | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [stats, setStats] = useState<LudoStats>(() => {
    if (typeof window === "undefined") return {
      wins: 0, losses: 0, captures: 0, gamesPlayed: 0, winStreak: 0, bestStreak: 0,
    };
    return loadStats();
  });
  const [captureFlash, setCaptureFlash] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameCaptures, setGameCaptures] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const stateRef = useRef<LudoState | null>(null);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isProcessingRef = useRef(false);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Responsive cell size
  const [cellSize, setCellSize] = useState(36);
  useEffect(() => {
    function handleResize() {
      const vw = Math.min(window.innerWidth * 0.95, 600);
      const vh = window.innerHeight * 0.65;
      const maxBoard = Math.min(vw, vh);
      setCellSize(Math.max(24, Math.floor(maxBoard / 15)));
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showStatus = useCallback((msg: string, duration = 2000) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), duration);
  }, []);

  const handleMoveResult = useCallback((result: MoveResult) => {
    if (result.enteredBoard) {
      audio.tokenEnter();
      showStatus("Token entered the board!");
    } else if (result.finished) {
      audio.tokenFinish();
      showStatus("Token finished! 🎉");
    } else if (result.enteredHome) {
      audio.homeStretch();
      showStatus("Home stretch!");
    } else {
      audio.tokenStep();
    }

    if (result.captured && result.capturedToken) {
      audio.capture();
      setCaptureFlash(result.capturedToken.color);
      setGameCaptures((c) => c + 1);
      showStatus(`${result.capturedToken!.color.toUpperCase()} token captured! 😱`, 2500);
      setTimeout(() => setCaptureFlash(null), 800);
    }

    setGameState(result.newState);

    if (result.newState.phase === "gameover") {
      audio.victory();
      // Update stats
      const humanPlayer = result.newState.players.find((p) => p.type === "human");
      const humanWon = humanPlayer ? result.newState.finishOrder[0] === humanPlayer.color : false;
      const updatedStats = updateStats(stats, humanWon, gameCaptures + (result.captured ? 1 : 0));
      setStats(updatedStats);
      saveStats(updatedStats);
      setTimeout(() => setShowGameOver(true), 1200);
    }
  }, [stats, gameCaptures, showStatus]);

  // AI turn logic
  const runAITurn = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const player = getCurrentPlayer(state);
    if (player.type !== "ai") {
      isProcessingRef.current = false;
      return;
    }

    // Roll dice with delay
    aiTimeoutRef.current = setTimeout(() => {
      const currentState = stateRef.current;
      if (!currentState) { isProcessingRef.current = false; return; }

      setDiceRolling(true);
      audio.diceShake();

      setTimeout(() => {
        setDiceRolling(false);
        const diceValue = rollDice();

        if (diceValue === 6) audio.sixRolled();
        else audio.diceLand(diceValue);

        setGameState((prev) => {
          if (!prev) return prev;
          const next = deepCloneState(prev);
          next.dice = diceValue;
          next.diceRolled = true;
          next.consecutiveSixes = diceValue === 6 ? next.consecutiveSixes + 1 : 0;
          const movable = getMovableTokens(next);
          next.movablePieces = movable;
          return next;
        });

        // Choose and apply move
        setTimeout(() => {
          const updatedState = stateRef.current;
          if (!updatedState) { isProcessingRef.current = false; return; }

          const movable = updatedState.movablePieces;
          if (movable.length === 0) {
            // No moves
            const newState = handleNoMoves(updatedState);
            setGameState(newState);
            isProcessingRef.current = false;
            return;
          }

          // Consecutive sixes forfeit
          if (updatedState.dice === 6 && updatedState.consecutiveSixes >= 3) {
            const newState = handleNoMoves(updatedState);
            setGameState(newState);
            isProcessingRef.current = false;
            return;
          }

          const tokenId = getAIMove(updatedState);
          if (!tokenId) { isProcessingRef.current = false; return; }

          const result = applyMove(updatedState, tokenId);
          handleMoveResult(result);
          isProcessingRef.current = false;
        }, 600);
      }, 700);
    }, 800);
  }, [handleMoveResult]);

  // Watch for AI turn
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing") return;
    if (diceRolling) return;
    const currentPlayer = getCurrentPlayer(gameState);
    if (currentPlayer.type !== "ai") return;
    if (gameState.diceRolled) return; // mid-turn, handled by runAITurn callback

    const timeout = setTimeout(() => {
      runAITurn();
    }, 300);
    return () => clearTimeout(timeout);
  }, [gameState, diceRolling, runAITurn]);

  const handleStart = useCallback((config: MenuConfig) => {
    const state = createInitialState(config.numPlayers, config.playerTypes);
    setMenuConfig(config);
    setGameState(state);
    setScreen("game");
    setSelectedToken(null);
    setShowGameOver(false);
    setGameCaptures(0);
    isProcessingRef.current = false;
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (!menuConfig) return;
    setShowGameOver(false);
    handleStart(menuConfig);
  }, [menuConfig, handleStart]);

  const handleRollDice = useCallback(() => {
    if (!gameState) return;
    if (gameState.diceRolled) return;
    if (diceRolling) return;
    if (isProcessingRef.current) return;

    const currentPlayer = getCurrentPlayer(gameState);
    if (currentPlayer.type !== "human") return;

    setDiceRolling(true);
    audio.diceShake();

    setTimeout(() => {
      setDiceRolling(false);
      const diceValue = rollDice();
      if (diceValue === 6) audio.sixRolled();
      else audio.diceLand(diceValue);

      setGameState((prev) => {
        if (!prev) return prev;
        const next = deepCloneState(prev);
        next.dice = diceValue;
        next.diceRolled = true;
        next.consecutiveSixes = diceValue === 6 ? next.consecutiveSixes + 1 : 0;
        const movable = getMovableTokens(next);
        next.movablePieces = movable;

        if (movable.length === 0) {
          // Auto-advance after brief pause
          return next; // handled in effect
        }
        return next;
      });
    }, 700);
  }, [gameState, diceRolling]);

  // Auto-advance when no moves available after dice roll
  useEffect(() => {
    if (!gameState) return;
    if (!gameState.diceRolled) return;
    if (gameState.movablePieces.length > 0) return;
    if (diceRolling) return;

    const currentPlayer = getCurrentPlayer(gameState);
    if (currentPlayer.type !== "human") return;

    const timeout = setTimeout(() => {
      setGameState((prev) => {
        if (!prev) return prev;
        showStatus("No moves available — skipping turn", 1500);
        return handleNoMoves(prev);
      });
    }, 1200);
    return () => clearTimeout(timeout);
  }, [gameState, diceRolling, showStatus]);

  const handleTokenClick = useCallback((tokenId: string) => {
    if (!gameState) return;
    if (!gameState.diceRolled) return;
    if (!gameState.movablePieces.includes(tokenId)) return;
    if (isProcessingRef.current) return;

    const currentPlayer = getCurrentPlayer(gameState);
    if (currentPlayer.type !== "human") return;

    audio.click();
    setSelectedToken(tokenId);

    setTimeout(() => {
      setSelectedToken(null);
      const state = stateRef.current;
      if (!state) return;
      const result = applyMove(state, tokenId);
      handleMoveResult(result);
    }, 150);
  }, [gameState, handleMoveResult]);

  if (screen === "menu") {
    return <MenuScreen stats={stats} onStart={handleStart} />;
  }

  if (!gameState) return null;

  const currentPlayer = getCurrentPlayer(gameState);
  const pal = COLOR_PALETTE[currentPlayer.color];
  const boardSize = 15 * cellSize;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a0a1a 0%, #0d0720 50%, #0a0a1a 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "16px 8px",
      gap: 12,
    }}>
      {/* Capture flash */}
      <AnimatePresence>
        {captureFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none",
              background: `radial-gradient(circle, ${COLOR_PALETTE[captureFlash as PlayerColor].glow}, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{
        width: "100%", maxWidth: boardSize + 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8,
      }}>
        <motion.button
          onClick={() => setScreen("menu")}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          style={{
            padding: "6px 14px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer",
          }}
        >
          ← Menu
        </motion.button>
        <h1 style={{
          color: "white", fontWeight: 900, fontSize: 20, letterSpacing: 2,
          background: "linear-gradient(135deg, #ef4444, #eab308, #22c55e, #3b82f6)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          LUDO
        </h1>
        <div style={{ width: 70 }} />
      </div>

      {/* Status message */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              padding: "6px 16px", borderRadius: 20,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white", fontSize: 12, fontWeight: 600,
            }}
          >
            {statusMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        width: "100%",
        maxWidth: boardSize + 260,
      }}>
        {/* Player panels — top row on desktop */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gameState.numPlayers}, 1fr)`,
          gap: 8,
          width: "100%",
          maxWidth: boardSize + 40,
        }}>
          {gameState.players.map((player, i) => (
            <PlayerPanel
              key={player.color}
              player={player}
              isCurrentTurn={i === gameState.currentPlayerIndex}
              finishPosition={
                gameState.finishOrder.indexOf(player.color) >= 0
                  ? gameState.finishOrder.indexOf(player.color) + 1
                  : undefined
              }
            />
          ))}
        </div>

        {/* Board */}
        <div style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 0 0 2px rgba(255,255,255,0.06), 0 0 60px ${pal.glow}40, 0 8px 40px rgba(0,0,0,0.7)`,
          border: `2px solid rgba(255,255,255,0.08)`,
        }}>
          <LudoBoard
            state={gameState}
            selectedToken={selectedToken}
            onTokenClick={handleTokenClick}
            cellSize={cellSize}
          />
        </div>

        {/* Dice + controls */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "12px 20px", borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <Dice
            value={gameState.dice}
            rolling={diceRolling}
            canRoll={
              !gameState.diceRolled &&
              !diceRolling &&
              currentPlayer.type === "human" &&
              gameState.phase === "playing"
            }
            onRoll={handleRollDice}
            playerColor={currentPlayer.color}
          />
          <div>
            <div style={{
              color: pal.primary, fontWeight: 700, fontSize: 13,
              textShadow: `0 0 12px ${pal.glow}`,
            }}>
              {currentPlayer.name}&apos;s Turn
              {currentPlayer.type === "ai" && " (AI)"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
              {!gameState.diceRolled
                ? currentPlayer.type === "human" ? "Click dice to roll" : "AI is thinking..."
                : gameState.movablePieces.length > 0
                ? currentPlayer.type === "human" ? "Choose a token to move" : "AI is choosing..."
                : "No moves available"}
            </div>
            {gameState.dice === 6 && gameState.diceRolled && (
              <motion.div
                style={{ color: "#ffd700", fontSize: 11, fontWeight: 700, marginTop: 2 }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                ✨ Rolled a 6 — bonus turn!
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Game over overlay */}
      <AnimatePresence>
        {showGameOver && (
          <GameOverScreen
            state={gameState}
            stats={stats}
            onPlayAgain={handlePlayAgain}
            onMenu={() => setScreen("menu")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────
// Mini Preview for Hub
// ─────────────────────────────────────────

export function LudoMiniPreview() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <rect x={0} y={0} width={100} height={100} fill="#0a0a1a" rx={4} />

      {/* Yard quadrants */}
      <rect x={2} y={2} width={38} height={38} fill="rgba(239,68,68,0.2)" rx={4} stroke="#ef4444" strokeWidth={0.8} strokeOpacity={0.5} />
      <rect x={60} y={2} width={38} height={38} fill="rgba(34,197,94,0.2)" rx={4} stroke="#22c55e" strokeWidth={0.8} strokeOpacity={0.5} />
      <rect x={60} y={60} width={38} height={38} fill="rgba(234,179,8,0.2)" rx={4} stroke="#eab308" strokeWidth={0.8} strokeOpacity={0.5} />
      <rect x={2} y={60} width={38} height={38} fill="rgba(59,130,246,0.2)" rx={4} stroke="#3b82f6" strokeWidth={0.8} strokeOpacity={0.5} />

      {/* Cross track */}
      <rect x={42} y={2} width={16} height={96} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
      <rect x={2} y={42} width={96} height={16} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

      {/* Home stretch colors */}
      <rect x={42} y={42} width={16} height={6} fill="rgba(239,68,68,0.5)" />   {/* red */}
      <rect x={52} y={42} width={6} height={16} fill="rgba(34,197,94,0.5)" />   {/* green */}
      <rect x={42} y={52} width={16} height={6} fill="rgba(234,179,8,0.5)" />  {/* yellow */}
      <rect x={42} y={42} width={6} height={16} fill="rgba(59,130,246,0.5)" /> {/* blue */}

      {/* Center triangles */}
      <polygon points="50,50 42,42 58,42" fill="#ef444466" />
      <polygon points="50,50 58,42 58,58" fill="#22c55e66" />
      <polygon points="50,50 58,58 42,58" fill="#eab30866" />
      <polygon points="50,50 42,58 42,42" fill="#3b82f666" />

      {/* Tokens */}
      <circle cx={14} cy={14} r={5} fill="#ef4444" stroke="#991b1b" strokeWidth={1} />
      <circle cx={26} cy={14} r={5} fill="#ef4444" stroke="#991b1b" strokeWidth={1} opacity={0.6} />
      <circle cx={78} cy={22} r={5} fill="#22c55e" stroke="#15803d" strokeWidth={1} />
      <circle cx={78} cy={78} r={5} fill="#eab308" stroke="#a16207" strokeWidth={1} />
      <circle cx={22} cy={78} r={5} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={1} />

      {/* Token on track */}
      <circle cx={50} cy={30} r={4} fill="#ef4444" stroke="white" strokeWidth={0.8}
        style={{ filter: "drop-shadow(0 0 4px #ef444488)" }} />

      {/* Star safe cell */}
      <text x={50} y={73} textAnchor="middle" fontSize={8} fill="rgba(255,215,0,0.7)">★</text>
    </svg>
  );
}
