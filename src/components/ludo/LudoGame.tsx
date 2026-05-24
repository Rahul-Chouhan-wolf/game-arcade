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
  getMovePath,
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
// Traditional Ludo Colors — bright & vivid
// ─────────────────────────────────────────

const COLOR_PALETTE: Record<
  PlayerColor,
  { primary: string; light: string; dark: string; yard: string; text: string }
> = {
  red:    { primary: "#D32F2F", light: "#EF5350", dark: "#B71C1C", yard: "#FFCDD2", text: "#fff" },
  green:  { primary: "#388E3C", light: "#66BB6A", dark: "#1B5E20", yard: "#C8E6C9", text: "#fff" },
  yellow: { primary: "#F9A825", light: "#FFEE58", dark: "#F57F17", yard: "#FFF9C4", text: "#000" },
  blue:   { primary: "#1565C0", light: "#42A5F5", dark: "#0D47A1", yard: "#BBDEFB", text: "#fff" },
};

// ─────────────────────────────────────────
// Audio singleton
// ─────────────────────────────────────────

const audio = new LudoAudio();

// ─────────────────────────────────────────
// Dice Component — white dice with colored dots
// ─────────────────────────────────────────

const DICE_DOTS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
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
  const [displayValue, setDisplayValue] = useState(value || 1);

  useEffect(() => {
    if (!rolling) {
      setDisplayValue(value || 1);
      return;
    }
    const iv = setInterval(() => {
      setDisplayValue(Math.ceil(Math.random() * 6));
    }, 80);
    return () => clearInterval(iv);
  }, [rolling, value]);

  return (
    <motion.button
      onClick={canRoll ? onRoll : undefined}
      disabled={!canRoll || rolling}
      whileHover={canRoll && !rolling ? { scale: 1.1, y: -3 } : {}}
      whileTap={canRoll && !rolling ? { scale: 0.92 } : {}}
      animate={
        rolling
          ? { rotateX: [0, 360, 720], rotateY: [0, 180, 360], rotateZ: [0, 90, 0] }
          : { rotateX: 0, rotateY: 0, rotateZ: 0 }
      }
      transition={rolling ? { duration: 0.65, ease: "easeInOut" } : { duration: 0.3 }}
      style={{
        width: 68,
        height: 68,
        borderRadius: 12,
        background: "white",
        border: canRoll ? `3px solid ${pal.primary}` : "3px solid #ccc",
        boxShadow: canRoll
          ? `0 4px 20px ${pal.primary}40, 0 2px 8px rgba(0,0,0,0.2)`
          : "0 2px 8px rgba(0,0,0,0.15)",
        cursor: canRoll && !rolling ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
        perspective: 600,
      }}
    >
      <svg width="52" height="52" viewBox="0 0 100 100">
        {(DICE_DOTS[displayValue] || DICE_DOTS[1]).map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={9}
            fill={displayValue === 6 && !rolling ? pal.primary : "#333"}
          />
        ))}
      </svg>
    </motion.button>
  );
}

// ─────────────────────────────────────────
// Pin/Pointer Token SVG shape
// ─────────────────────────────────────────

/**
 * Generates an SVG path for a map-pin / pointer shape.
 * The pin is centered horizontally; tip points down.
 * @param r - head circle radius
 */
function pinPath(r: number): string {
  const tipY = r * 1.7;
  return [
    `M 0 ${tipY}`,
    `C ${-r * 0.55} ${r * 0.35} ${-r} ${-r * 0.15} ${-r} ${-r * 0.55}`,
    `A ${r} ${r} 0 1 1 ${r} ${-r * 0.55}`,
    `C ${r} ${-r * 0.15} ${r * 0.55} ${r * 0.35} 0 ${tipY}`,
    `Z`,
  ].join(" ");
}

// ─────────────────────────────────────────
// Token Component — pointer/pin shaped
// ─────────────────────────────────────────

interface TokenPieceProps {
  token: Token;
  cellSize: number;
  isMovable: boolean;
  isSelected: boolean;
  onClick: () => void;
  overridePos?: [number, number]; // [row, col] override for animation
}

function TokenPiece({
  token,
  cellSize,
  isMovable,
  isSelected,
  onClick,
  overridePos,
}: TokenPieceProps) {
  const pal = COLOR_PALETTE[token.color];
  const pos = overridePos ?? getTokenCoord(token, token.color);
  const [row, col] = pos;

  const x = col * cellSize + cellSize / 2;
  const y = row * cellSize + cellSize / 2;
  const r = Math.max(7, cellSize * 0.3);

  return (
    <motion.g
      onClick={isMovable ? onClick : undefined}
      style={{ cursor: isMovable ? "pointer" : "default" }}
      animate={{ x, y: y - r * 0.4 }}
      transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
      initial={false}
    >
      {/* Pulsing ring for movable tokens */}
      {isMovable && (
        <motion.circle
          cx={0}
          cy={-r * 0.55}
          r={r + 5}
          fill="none"
          stroke={pal.primary}
          strokeWidth={2.5}
          animate={{ r: [r + 3, r + 8, r + 3], opacity: [0.8, 0.3, 0.8] }}
          transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
        />
      )}
      {/* Drop shadow */}
      <ellipse cx={1} cy={r * 1.9} rx={r * 0.6} ry={r * 0.2} fill="rgba(0,0,0,0.25)" />
      {/* Pin body */}
      <path
        d={pinPath(r)}
        fill={`url(#pin-grad-${token.color})`}
        stroke={isSelected ? "#fff" : pal.dark}
        strokeWidth={isSelected ? 2.5 : 1.2}
      />
      {/* Inner white circle (face of pin) */}
      <circle
        cx={0}
        cy={-r * 0.55}
        r={r * 0.52}
        fill="white"
        stroke={pal.dark}
        strokeWidth={0.5}
        opacity={0.92}
      />
      {/* Color dot inside */}
      <circle cx={0} cy={-r * 0.55} r={r * 0.28} fill={pal.primary} />
    </motion.g>
  );
}

// ─────────────────────────────────────────
// Board background helpers
// ─────────────────────────────────────────

function isTrackCell(row: number, col: number): boolean {
  return MAIN_TRACK_COORDS.some(([r, c]) => r === row && c === col);
}

function isHomeStretchCell(
  row: number,
  col: number
): PlayerColor | null {
  for (const color of ["red", "green", "yellow", "blue"] as PlayerColor[]) {
    if (HOME_STRETCH_COORDS[color].some(([r, c]) => r === row && c === col)) {
      return color;
    }
  }
  return null;
}

function getCellQuadrantColor(row: number, col: number): PlayerColor | null {
  if (row <= 5 && col <= 5) return "red";
  if (row <= 5 && col >= 9) return "green";
  if (row >= 9 && col >= 9) return "yellow";
  if (row >= 9 && col <= 5) return "blue";
  return null;
}

// ─────────────────────────────────────────
// Ludo Board SVG — traditional bright style
// ─────────────────────────────────────────

interface BoardProps {
  state: LudoState;
  selectedToken: string | null;
  onTokenClick: (tokenId: string) => void;
  cellSize: number;
  animatingToken: string | null;
  animPos: [number, number] | null;
}

function LudoBoard({
  state,
  selectedToken,
  onTokenClick,
  cellSize,
  animatingToken,
  animPos,
}: BoardProps) {
  const size = 15 * cellSize;
  const movableSet = new Set(state.movablePieces);

  // Track map for stacking
  const trackTokenMap = useMemo(() => {
    const map = new Map<number, Token[]>();
    for (const player of state.players) {
      for (const token of player.tokens) {
        if (token.state !== "track" && token.state !== "home") continue;
        const key = token.trackPos;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(token);
      }
    }
    return map;
  }, [state]);

  // Build set of track cell indices for quick lookup
  const trackCellSet = useMemo(() => {
    const s = new Set<string>();
    MAIN_TRACK_COORDS.forEach(([r, c]) => s.add(`${r},${c}`));
    for (const color of ["red", "green", "yellow", "blue"] as PlayerColor[]) {
      HOME_STRETCH_COORDS[color].forEach(([r, c]) => s.add(`${r},${c}`));
    }
    return s;
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", borderRadius: 10 }}
    >
      <defs>
        {/* Pin gradients for each color */}
        {(["red", "green", "yellow", "blue"] as PlayerColor[]).map((color) => {
          const pal = COLOR_PALETTE[color];
          return (
            <linearGradient
              key={color}
              id={`pin-grad-${color}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={pal.light} />
              <stop offset="60%" stopColor={pal.primary} />
              <stop offset="100%" stopColor={pal.dark} />
            </linearGradient>
          );
        })}
        <filter id="inner-shadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
          <feOffset dx="1" dy="1" result="offsetBlur" />
          <feFlood floodColor="rgba(0,0,0,0.15)" result="color" />
          <feComposite in2="offsetBlur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Board background — white */}
      <rect x={0} y={0} width={size} height={size} fill="#f5f0e8" rx={10} />

      {/* Quadrant colored backgrounds */}
      {(
        [
          { color: "red" as PlayerColor, x: 0, y: 0 },
          { color: "green" as PlayerColor, x: 9, y: 0 },
          { color: "yellow" as PlayerColor, x: 9, y: 9 },
          { color: "blue" as PlayerColor, x: 0, y: 9 },
        ] as const
      ).map(({ color, x, y }) => {
        const pal = COLOR_PALETTE[color];
        return (
          <g key={color}>
            {/* Quadrant fill */}
            <rect
              x={x * cellSize}
              y={y * cellSize}
              width={6 * cellSize}
              height={6 * cellSize}
              fill={pal.primary}
            />
            {/* Inner white yard area */}
            <rect
              x={(x + 0.6) * cellSize}
              y={(y + 0.6) * cellSize}
              width={4.8 * cellSize}
              height={4.8 * cellSize}
              fill="white"
              rx={cellSize * 0.5}
              filter="url(#inner-shadow)"
            />
            {/* 4 token slots in yard */}
            {YARD_COORDS[color].map(([yr, yc], i) => (
              <circle
                key={i}
                cx={yc * cellSize + cellSize / 2}
                cy={yr * cellSize + cellSize / 2}
                r={cellSize * 0.38}
                fill={pal.yard}
                stroke={pal.primary}
                strokeWidth={1.5}
              />
            ))}
          </g>
        );
      })}

      {/* Track cells — white cells with borders */}
      {MAIN_TRACK_COORDS.map(([r, c], idx) => {
        // Color the track cell if it's an entry cell or safe/star cell
        const isEntry = Object.entries(ENTRY_CELLS).find(([, eIdx]) => eIdx === idx);
        const isSafe = SAFE_CELLS.has(idx);
        let fill = "white";
        if (isEntry) {
          fill = COLOR_PALETTE[isEntry[0] as PlayerColor].yard;
        }

        return (
          <g key={`track-${idx}`}>
            <rect
              x={c * cellSize + 0.5}
              y={r * cellSize + 0.5}
              width={cellSize - 1}
              height={cellSize - 1}
              fill={fill}
              stroke="#bbb"
              strokeWidth={0.8}
            />
            {/* Star on safe cells */}
            {isSafe && (
              <text
                x={c * cellSize + cellSize / 2}
                y={r * cellSize + cellSize / 2 + cellSize * 0.18}
                textAnchor="middle"
                fontSize={cellSize * 0.48}
                fill={isEntry ? COLOR_PALETTE[isEntry[0] as PlayerColor].dark : "#ccc"}
                style={{ pointerEvents: "none" }}
              >
                ★
              </text>
            )}
            {/* Arrow on entry cells */}
            {isEntry && !isSafe && (
              <circle
                cx={c * cellSize + cellSize / 2}
                cy={r * cellSize + cellSize / 2}
                r={cellSize * 0.15}
                fill={COLOR_PALETTE[isEntry[0] as PlayerColor].primary}
                opacity={0.5}
              />
            )}
          </g>
        );
      })}

      {/* Home stretch colored cells */}
      {(["red", "green", "yellow", "blue"] as PlayerColor[]).map((color) =>
        HOME_STRETCH_COORDS[color].slice(0, 5).map(([r, c], i) => {
          const pal = COLOR_PALETTE[color];
          return (
            <rect
              key={`hs-${color}-${i}`}
              x={c * cellSize + 0.5}
              y={r * cellSize + 0.5}
              width={cellSize - 1}
              height={cellSize - 1}
              fill={pal.primary}
              stroke={pal.dark}
              strokeWidth={0.5}
              opacity={0.85}
            />
          );
        })
      )}

      {/* Center home — 4 colored triangles */}
      {(() => {
        const cx = 7 * cellSize + cellSize / 2;
        const cy = 7 * cellSize + cellSize / 2;
        const half = cellSize * 1.5;
        const colors: PlayerColor[] = ["red", "green", "yellow", "blue"];
        // Triangle points: top, right, bottom, left of center square
        const corners: Array<[number, number]> = [
          [cx, cy - half],
          [cx + half, cy],
          [cx, cy + half],
          [cx - half, cy],
        ];
        return colors.map((color, i) => {
          const c1 = corners[i];
          const c2 = corners[(i + 1) % 4];
          return (
            <polygon
              key={color}
              points={`${cx},${cy} ${c1[0]},${c1[1]} ${c2[0]},${c2[1]}`}
              fill={COLOR_PALETTE[color].primary}
              stroke="white"
              strokeWidth={1.5}
            />
          );
        });
      })()}

      {/* Center circle */}
      <circle
        cx={7 * cellSize + cellSize / 2}
        cy={7 * cellSize + cellSize / 2}
        r={cellSize * 0.4}
        fill="white"
        stroke="#ddd"
        strokeWidth={1}
      />

      {/* All tokens — yard, track, home stretch */}
      {state.players.flatMap((player) =>
        player.tokens.map((token) => {
          if (token.state === "finished") {
            // Finished tokens show small in center
            const angle =
              (token.index * 90 +
                { red: -45, green: 45, yellow: 135, blue: 225 }[token.color]) *
              (Math.PI / 180);
            const cx2 = 7 * cellSize + cellSize / 2;
            const cy2 = 7 * cellSize + cellSize / 2;
            const fr = cellSize * 0.6;
            const fx = cx2 + fr * Math.cos(angle);
            const fy = cy2 + fr * Math.sin(angle);
            return (
              <motion.circle
                key={token.id}
                cx={fx}
                cy={fy}
                r={cellSize * 0.2}
                fill={COLOR_PALETTE[token.color].primary}
                stroke="white"
                strokeWidth={1.5}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
            );
          }

          // Stacking offset for tokens sharing a cell
          let stackOffset: [number, number] | undefined;
          if (token.state === "track" || token.state === "home") {
            const tokensHere = trackTokenMap.get(token.trackPos) ?? [];
            if (tokensHere.length > 1) {
              const idx = tokensHere.findIndex((t) => t.id === token.id);
              const offsets: Array<[number, number]> = [
                [-0.3, -0.3],
                [0.3, -0.3],
                [-0.3, 0.3],
                [0.3, 0.3],
              ];
              stackOffset = offsets[idx % 4];
            }
          }

          const isAnimating = animatingToken === token.id;
          let overridePos: [number, number] | undefined;
          if (isAnimating && animPos) {
            overridePos = animPos;
          }
          if (stackOffset && !overridePos) {
            // Apply stack offset via a slightly different position
            const base = getTokenCoord(token, token.color);
            overridePos = [
              base[0] + stackOffset[0],
              base[1] + stackOffset[1],
            ];
          }

          return (
            <TokenPiece
              key={token.id}
              token={token}
              cellSize={cellSize}
              isMovable={movableSet.has(token.id)}
              isSelected={selectedToken === token.id}
              onClick={() => onTokenClick(token.id)}
              overridePos={overridePos}
            />
          );
        })
      )}
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

  return (
    <motion.div
      animate={{
        boxShadow: isCurrentTurn
          ? `0 0 0 2px ${pal.primary}, 0 0 16px ${pal.primary}50`
          : "0 0 0 1px #e0e0e0",
      }}
      transition={{ duration: 0.3 }}
      style={{
        borderRadius: 12,
        padding: "10px 14px",
        background: isCurrentTurn ? pal.yard : "#fafafa",
        border: `2px solid ${isCurrentTurn ? pal.primary : "#e0e0e0"}`,
        opacity: player.hasFinished ? 0.6 : 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: pal.primary,
            flexShrink: 0,
            border: `2px solid ${pal.dark}`,
          }}
        />
        <span style={{ color: "#333", fontWeight: 700, fontSize: 13 }}>
          {player.name}
          {player.type === "ai" && (
            <span
              style={{
                color: "#888",
                fontWeight: 400,
                fontSize: 10,
                marginLeft: 4,
              }}
            >
              ({player.aiLevel})
            </span>
          )}
        </span>
        {finishPosition !== undefined && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 13,
              fontWeight: 700,
              color: finishPosition === 1 ? "#F9A825" : "#888",
            }}
          >
            {finishPosition === 1 ? "🏆" : `#${finishPosition}`}
          </span>
        )}
      </div>

      {/* Token status dots */}
      <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
        {player.tokens.map((t) => (
          <div
            key={t.id}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background:
                t.state === "finished"
                  ? pal.primary
                  : t.state === "yard"
                  ? "#ddd"
                  : pal.light,
              border: `1.5px solid ${
                t.state === "finished" ? pal.dark : t.state === "yard" ? "#bbb" : pal.primary
              }`,
            }}
          />
        ))}
      </div>

      {isCurrentTurn && (
        <motion.div
          style={{
            position: "absolute",
            top: 4,
            right: 8,
            fontSize: 9,
            color: pal.dark,
            fontWeight: 700,
            letterSpacing: 1,
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

function MenuScreen({
  stats,
  onStart,
}: {
  stats: LudoStats;
  onStart: (config: MenuConfig) => void;
}) {
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(2);
  const [playerTypes, setPlayerTypes] = useState<
    Array<{ type: PlayerType; aiLevel?: AILevel }>
  >([
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
        next[i] = { type: "ai", aiLevel: "easy" };
      } else if (next[i].aiLevel === "easy") {
        next[i] = { type: "ai", aiLevel: "medium" };
      } else if (next[i].aiLevel === "medium") {
        next[i] = { type: "ai", aiLevel: "hard" };
      } else {
        next[i] = { type: "human" };
      }
      return next;
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #fffde7 0%, #fff3e0 50%, #e3f2fd 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "white",
          border: "1px solid #e0e0e0",
          borderRadius: 24,
          padding: "36px 32px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.1)",
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: -1,
              background:
                "linear-gradient(135deg, #D32F2F, #F9A825, #388E3C, #1565C0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 8,
            }}
          >
            LUDO
          </h1>
          <p style={{ color: "#888", fontSize: 14 }}>
            Race your tokens home — roll, capture, win
          </p>
        </div>

        {/* Stats */}
        {stats.gamesPlayed > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginBottom: 28,
            }}
          >
            {[
              { label: "Wins", value: stats.wins, color: "#388E3C" },
              { label: "Losses", value: stats.losses, color: "#D32F2F" },
              { label: "Streak", value: stats.winStreak, color: "#F9A825" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "#fafafa",
                  borderRadius: 10,
                  padding: "8px 4px",
                  textAlign: "center",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 10, color: "#999", letterSpacing: 0.5 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Number of players */}
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              color: "#666",
              fontSize: 12,
              marginBottom: 10,
              letterSpacing: 1,
              fontWeight: 700,
            }}
          >
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
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border:
                    numPlayers === n
                      ? "2px solid #1565C0"
                      : "2px solid #e0e0e0",
                  background: numPlayers === n ? "#e3f2fd" : "white",
                  color: numPlayers === n ? "#1565C0" : "#666",
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {n}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Player configuration */}
        <div style={{ marginBottom: 28 }}>
          <p
            style={{
              color: "#666",
              fontSize: 12,
              marginBottom: 10,
              letterSpacing: 1,
              fontWeight: 700,
            }}
          >
            SETUP
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {colors.map((color, i) => {
              const pal = COLOR_PALETTE[color];
              const cfg = playerTypes[i];
              const label =
                cfg.type === "human" ? "Human" : `AI · ${cfg.aiLevel}`;
              return (
                <motion.button
                  key={color}
                  onClick={() => togglePlayerType(i)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `2px solid ${pal.primary}30`,
                    background: pal.yard,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: pal.primary,
                      flexShrink: 0,
                      border: `2px solid ${pal.dark}`,
                    }}
                  />
                  <span
                    style={{ color: "#333", fontWeight: 600, fontSize: 14, flex: 1 }}
                  >
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </span>
                  <span
                    style={{
                      color: cfg.type === "human" ? "#1565C0" : "#388E3C",
                      fontSize: 12,
                      fontWeight: 600,
                      background:
                        cfg.type === "human"
                          ? "rgba(21,101,192,0.1)"
                          : "rgba(56,142,60,0.1)",
                      padding: "4px 10px",
                      borderRadius: 6,
                    }}
                  >
                    {label}
                  </span>
                </motion.button>
              );
            })}
          </div>
          <p style={{ color: "#aaa", fontSize: 11, marginTop: 8 }}>
            Click to cycle: Human → AI Easy → Medium → Hard → Human
          </p>
        </div>

        {/* Start button */}
        <motion.button
          onClick={() => {
            audio.click();
            onStart({
              numPlayers,
              playerTypes: playerTypes.slice(0, numPlayers),
            });
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: "100%",
            padding: "14px 0",
            background:
              "linear-gradient(135deg, #D32F2F, #F9A825, #388E3C, #1565C0)",
            border: "none",
            borderRadius: 12,
            color: "white",
            fontSize: 18,
            fontWeight: 800,
            cursor: "pointer",
            letterSpacing: 2,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
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

function GameOverScreen({
  state,
  stats,
  onPlayAgain,
  onMenu,
}: {
  state: LudoState;
  stats: LudoStats;
  onPlayAgain: () => void;
  onMenu: () => void;
}) {
  const winner = state.finishOrder[0];
  const pal = winner ? COLOR_PALETTE[winner] : COLOR_PALETTE.red;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        style={{
          width: "90%",
          maxWidth: 380,
          background: "white",
          border: `3px solid ${pal.primary}`,
          borderRadius: 24,
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: `0 8px 60px rgba(0,0,0,0.2)`,
        }}
      >
        <motion.div
          style={{ fontSize: 56, marginBottom: 8 }}
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          🏆
        </motion.div>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: pal.primary,
            marginBottom: 4,
          }}
        >
          {winner
            ? `${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins!`
            : "Game Over"}
        </h2>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
          {state.players.find((p) => p.color === winner)?.type === "human"
            ? "Congratulations!"
            : "The AI won this round."}
        </p>

        {/* Finish order */}
        <div style={{ marginBottom: 24 }}>
          {state.finishOrder.map((color, i) => (
            <div
              key={color}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 12px",
                borderRadius: 8,
                marginBottom: 4,
                background: i === 0 ? "#FFF9C4" : "#fafafa",
              }}
            >
              <span style={{ fontSize: 16 }}>
                {["🥇", "🥈", "🥉", "4️⃣"][i]}
              </span>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: COLOR_PALETTE[color].primary,
                }}
              />
              <span style={{ color: "#333", fontWeight: 600, fontSize: 13 }}>
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <motion.button
            onClick={onMenu}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 10,
              border: "2px solid #e0e0e0",
              background: "white",
              color: "#666",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Menu
          </motion.button>
          <motion.button
            onClick={onPlayAgain}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 10,
              border: `2px solid ${pal.primary}`,
              background: pal.primary,
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
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
    if (typeof window === "undefined")
      return {
        wins: 0,
        losses: 0,
        captures: 0,
        gamesPlayed: 0,
        winStreak: 0,
        bestStreak: 0,
      };
    return loadStats();
  });
  const [captureFlash, setCaptureFlash] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameCaptures, setGameCaptures] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // Step-by-step animation state
  const [animatingToken, setAnimatingToken] = useState<string | null>(null);
  const [animPos, setAnimPos] = useState<[number, number] | null>(null);
  const animLockRef = useRef(false);

  const stateRef = useRef<LudoState | null>(null);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const isProcessingRef = useRef(false);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Responsive cell size
  const [cellSize, setCellSize] = useState(36);
  useEffect(() => {
    function handleResize() {
      const vw = Math.min(window.innerWidth * 0.95, 600);
      const vh = window.innerHeight * 0.6;
      const maxBoard = Math.min(vw, vh);
      setCellSize(Math.max(22, Math.floor(maxBoard / 15)));
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showStatus = useCallback((msg: string, duration = 2000) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), duration);
  }, []);

  /**
   * Animate a token along waypoints step-by-step, then apply the final state.
   */
  const animateAndApply = useCallback(
    (
      tokenId: string,
      result: MoveResult,
      callback?: () => void
    ) => {
      const path = result.movePath;

      if (path.length === 0) {
        // No movement path (shouldn't happen but safety)
        setGameState(result.newState);
        if (callback) callback();
        return;
      }

      animLockRef.current = true;
      setAnimatingToken(tokenId);

      let step = 0;
      const stepDelay = Math.max(80, 160 - path.length * 10); // faster for longer moves

      const doStep = () => {
        if (step >= path.length) {
          // Animation done — apply the real state
          setAnimatingToken(null);
          setAnimPos(null);
          animLockRef.current = false;

          // Sound effects for the final result
          if (result.enteredBoard) {
            audio.tokenEnter();
            showStatus("Token entered the board!");
          } else if (result.finished) {
            audio.tokenFinish();
            showStatus("Token finished! 🎉");
          } else if (result.enteredHome) {
            audio.homeStretch();
            showStatus("Home stretch!");
          }

          if (result.captured && result.capturedToken) {
            audio.capture();
            setCaptureFlash(result.capturedToken.color);
            setGameCaptures((c) => c + 1);
            showStatus(
              `${result.capturedToken!.color.toUpperCase()} captured!`,
              2500
            );
            setTimeout(() => setCaptureFlash(null), 800);
          }

          setGameState(result.newState);

          if (result.newState.phase === "gameover") {
            audio.victory();
            const humanPlayer = result.newState.players.find(
              (p) => p.type === "human"
            );
            const humanWon = humanPlayer
              ? result.newState.finishOrder[0] === humanPlayer.color
              : false;
            const updatedStats = updateStats(
              stats,
              humanWon,
              gameCaptures + (result.captured ? 1 : 0)
            );
            setStats(updatedStats);
            saveStats(updatedStats);
            setTimeout(() => setShowGameOver(true), 1200);
          }

          if (callback) callback();
          return;
        }

        setAnimPos(path[step]);
        audio.tokenStep();
        step++;
        setTimeout(doStep, stepDelay);
      };

      doStep();
    },
    [stats, gameCaptures, showStatus]
  );

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

    aiTimeoutRef.current = setTimeout(() => {
      const currentState = stateRef.current;
      if (!currentState) {
        isProcessingRef.current = false;
        return;
      }

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
          next.consecutiveSixes =
            diceValue === 6 ? next.consecutiveSixes + 1 : 0;
          const movable = getMovableTokens(next);
          next.movablePieces = movable;
          return next;
        });

        setTimeout(() => {
          const updatedState = stateRef.current;
          if (!updatedState) {
            isProcessingRef.current = false;
            return;
          }

          const movable = updatedState.movablePieces;
          if (movable.length === 0) {
            const newState = handleNoMoves(updatedState);
            setGameState(newState);
            isProcessingRef.current = false;
            return;
          }

          if (
            updatedState.dice === 6 &&
            updatedState.consecutiveSixes >= 3
          ) {
            const newState = handleNoMoves(updatedState);
            setGameState(newState);
            isProcessingRef.current = false;
            return;
          }

          const tokenId = getAIMove(updatedState);
          if (!tokenId) {
            isProcessingRef.current = false;
            return;
          }

          const result = applyMove(updatedState, tokenId);
          animateAndApply(tokenId, result, () => {
            isProcessingRef.current = false;
          });
        }, 500);
      }, 700);
    }, 600);
  }, [animateAndApply]);

  // Watch for AI turn
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing") return;
    if (diceRolling || animLockRef.current) return;
    const currentPlayer = getCurrentPlayer(gameState);
    if (currentPlayer.type !== "ai") return;
    if (gameState.diceRolled) return;

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
    animLockRef.current = false;
    setAnimatingToken(null);
    setAnimPos(null);
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (!menuConfig) return;
    setShowGameOver(false);
    handleStart(menuConfig);
  }, [menuConfig, handleStart]);

  const handleRollDice = useCallback(() => {
    if (!gameState) return;
    if (gameState.diceRolled) return;
    if (diceRolling || animLockRef.current) return;
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
        next.consecutiveSixes =
          diceValue === 6 ? next.consecutiveSixes + 1 : 0;
        const movable = getMovableTokens(next);
        next.movablePieces = movable;
        return next;
      });
    }, 700);
  }, [gameState, diceRolling]);

  // Auto-advance when no moves available after dice roll (human)
  useEffect(() => {
    if (!gameState) return;
    if (!gameState.diceRolled) return;
    if (gameState.movablePieces.length > 0) return;
    if (diceRolling || animLockRef.current) return;

    const currentPlayer = getCurrentPlayer(gameState);
    if (currentPlayer.type !== "human") return;

    const timeout = setTimeout(() => {
      showStatus("No moves available — skipping turn", 1500);
      setGameState((prev) => (prev ? handleNoMoves(prev) : prev));
    }, 1200);
    return () => clearTimeout(timeout);
  }, [gameState, diceRolling, showStatus]);

  const handleTokenClick = useCallback(
    (tokenId: string) => {
      if (!gameState) return;
      if (!gameState.diceRolled) return;
      if (!gameState.movablePieces.includes(tokenId)) return;
      if (isProcessingRef.current || animLockRef.current) return;

      const currentPlayer = getCurrentPlayer(gameState);
      if (currentPlayer.type !== "human") return;

      audio.click();
      setSelectedToken(tokenId);

      const state = stateRef.current;
      if (!state) return;
      const result = applyMove(state, tokenId);

      setSelectedToken(null);
      animateAndApply(tokenId, result);
    },
    [gameState, animateAndApply]
  );

  if (screen === "menu") {
    return <MenuScreen stats={stats} onStart={handleStart} />;
  }

  if (!gameState) return null;

  const currentPlayer = getCurrentPlayer(gameState);
  const pal = COLOR_PALETTE[currentPlayer.color];
  const boardSize = 15 * cellSize;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(160deg, #fffde7 0%, #fff3e0 50%, #e3f2fd 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 8px",
        gap: 10,
      }}
    >
      {/* Capture flash */}
      <AnimatePresence>
        {captureFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              pointerEvents: "none",
              background:
                COLOR_PALETTE[captureFlash as PlayerColor].primary,
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: boardSize + 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <motion.button
          onClick={() => setScreen("menu")}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            color: "#666",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ← Menu
        </motion.button>
        <h1
          style={{
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: 3,
            background:
              "linear-gradient(135deg, #D32F2F, #F9A825, #388E3C, #1565C0)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
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
              padding: "6px 18px",
              borderRadius: 20,
              background: "white",
              border: "1px solid #e0e0e0",
              color: "#333",
              fontSize: 12,
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            {statusMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          width: "100%",
          maxWidth: boardSize + 260,
        }}
      >
        {/* Player panels */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${gameState.numPlayers}, 1fr)`,
            gap: 8,
            width: "100%",
            maxWidth: boardSize + 40,
          }}
        >
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
        <div
          style={{
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.12), 0 0 0 2px rgba(0,0,0,0.06)",
            border: "2px solid #d0d0d0",
          }}
        >
          <LudoBoard
            state={gameState}
            selectedToken={selectedToken}
            onTokenClick={handleTokenClick}
            cellSize={cellSize}
            animatingToken={animatingToken}
            animPos={animPos}
          />
        </div>

        {/* Dice + controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 20px",
            borderRadius: 16,
            background: "white",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <Dice
            value={gameState.dice}
            rolling={diceRolling}
            canRoll={
              !gameState.diceRolled &&
              !diceRolling &&
              !animLockRef.current &&
              currentPlayer.type === "human" &&
              gameState.phase === "playing"
            }
            onRoll={handleRollDice}
            playerColor={currentPlayer.color}
          />
          <div>
            <div
              style={{
                color: pal.primary,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {currentPlayer.name}&apos;s Turn
              {currentPlayer.type === "ai" && " (AI)"}
            </div>
            <div
              style={{ color: "#999", fontSize: 11, marginTop: 2 }}
            >
              {!gameState.diceRolled
                ? currentPlayer.type === "human"
                  ? "Tap dice to roll"
                  : "AI is thinking..."
                : gameState.movablePieces.length > 0
                ? currentPlayer.type === "human"
                  ? "Tap a token to move"
                  : "AI is choosing..."
                : "No moves available"}
            </div>
            {gameState.dice === 6 && gameState.diceRolled && (
              <motion.div
                style={{
                  color: "#F9A825",
                  fontSize: 11,
                  fontWeight: 700,
                  marginTop: 2,
                }}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                ✨ Rolled 6 — bonus turn!
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
      <rect x={0} y={0} width={100} height={100} fill="#f5f0e8" rx={4} />

      {/* Yard quadrants */}
      <rect x={2} y={2} width={38} height={38} fill="#D32F2F" rx={4} />
      <rect x={60} y={2} width={38} height={38} fill="#388E3C" rx={4} />
      <rect x={60} y={60} width={38} height={38} fill="#F9A825" rx={4} />
      <rect x={2} y={60} width={38} height={38} fill="#1565C0" rx={4} />

      {/* Inner white yards */}
      <rect x={6} y={6} width={30} height={30} fill="white" rx={4} />
      <rect x={64} y={6} width={30} height={30} fill="white" rx={4} />
      <rect x={64} y={64} width={30} height={30} fill="white" rx={4} />
      <rect x={6} y={64} width={30} height={30} fill="white" rx={4} />

      {/* Cross track */}
      <rect x={42} y={2} width={16} height={96} fill="white" stroke="#ddd" strokeWidth={0.5} />
      <rect x={2} y={42} width={96} height={16} fill="white" stroke="#ddd" strokeWidth={0.5} />

      {/* Center triangles */}
      <polygon points="50,50 42,42 58,42" fill="#D32F2F" />
      <polygon points="50,50 58,42 58,58" fill="#388E3C" />
      <polygon points="50,50 58,58 42,58" fill="#F9A825" />
      <polygon points="50,50 42,58 42,42" fill="#1565C0" />

      {/* Tokens in yard */}
      <circle cx={14} cy={14} r={5} fill="#D32F2F" stroke="#B71C1C" strokeWidth={1} />
      <circle cx={28} cy={14} r={5} fill="#D32F2F" stroke="#B71C1C" strokeWidth={1} opacity={0.6} />
      <circle cx={78} cy={14} r={5} fill="#388E3C" stroke="#1B5E20" strokeWidth={1} />
      <circle cx={78} cy={78} r={5} fill="#F9A825" stroke="#F57F17" strokeWidth={1} />
      <circle cx={14} cy={78} r={5} fill="#1565C0" stroke="#0D47A1" strokeWidth={1} />

      {/* Pin token on track */}
      <path d="M 50 22 C 47 18 45 14 45 12 A 5 5 0 1 1 55 12 C 55 14 53 18 50 22 Z"
        fill="#D32F2F" stroke="white" strokeWidth={0.8} />
      <circle cx={50} cy={12} r={2} fill="white" />

      {/* Star */}
      <text x={50} y={72} textAnchor="middle" fontSize={8} fill="#F9A825">★</text>
    </svg>
  );
}
