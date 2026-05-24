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
// Colors — bright traditional Ludo
// ─────────────────────────────────────────

const C: Record<
  PlayerColor,
  { bg: string; fg: string; dk: string; yard: string; border: string }
> = {
  red:    { bg: "#D32F2F", fg: "#EF5350", dk: "#B71C1C", yard: "#FFCDD2", border: "#C62828" },
  green:  { bg: "#388E3C", fg: "#66BB6A", dk: "#1B5E20", yard: "#C8E6C9", border: "#2E7D32" },
  yellow: { bg: "#F9A825", fg: "#FFEE58", dk: "#F57F17", yard: "#FFF9C4", border: "#F57F17" },
  blue:   { bg: "#1565C0", fg: "#42A5F5", dk: "#0D47A1", yard: "#BBDEFB", border: "#0D47A1" },
};

// Yard pixel centers (grid coords) for dice placement
const YARD_CENTER: Record<PlayerColor, [number, number]> = {
  red:    [2.8, 2.8],
  green:  [2.8, 12.2],
  yellow: [12.2, 12.2],
  blue:   [12.2, 2.8],
};

const audio = new LudoAudio();

// ─────────────────────────────────────────
// Pin / pointer token SVG path
// ─────────────────────────────────────────

function pinPath(r: number): string {
  const t = r * 1.7;
  return `M 0 ${t} C ${-r * 0.55} ${r * 0.35} ${-r} ${-r * 0.15} ${-r} ${-r * 0.55} A ${r} ${r} 0 1 1 ${r} ${-r * 0.55} C ${r} ${-r * 0.15} ${r * 0.55} ${r * 0.35} 0 ${t} Z`;
}

// ─────────────────────────────────────────
// Token — pin shaped with hop animation
// ─────────────────────────────────────────

interface TokenPieceProps {
  token: Token;
  cs: number; // cellSize
  movable: boolean;
  selected: boolean;
  onClick: () => void;
  overridePos?: [number, number];
  hopKey?: number; // changes each step to trigger hop
}

function TokenPiece({ token, cs, movable, selected, onClick, overridePos, hopKey }: TokenPieceProps) {
  const p = C[token.color];
  const pos = overridePos ?? getTokenCoord(token, token.color);
  const x = pos[1] * cs + cs / 2;
  const y = pos[0] * cs + cs / 2;
  const r = Math.max(7, cs * 0.3);
  const hop = cs * 0.8;

  return (
    <motion.g
      onClick={movable ? onClick : undefined}
      style={{ cursor: movable ? "pointer" : "default" }}
      animate={{ x, y: y - r * 0.3 }}
      transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
      initial={false}
    >
      {/* Hop bounce — re-triggers when hopKey changes */}
      <motion.g
        key={hopKey ?? "s"}
        initial={hopKey != null ? { y: 0 } : false}
        animate={hopKey != null ? { y: [0, -hop, -hop * 0.15, 0] } : { y: 0 }}
        transition={hopKey != null ? { duration: 0.32, times: [0, 0.38, 0.72, 1], ease: "easeOut" } : { duration: 0 }}
      >
        {/* Pulsing ring on movable */}
        {movable && (
          <motion.circle
            cx={0} cy={-r * 0.55} r={r + 4}
            fill="none" stroke={p.bg} strokeWidth={2.5}
            animate={{ r: [r + 3, r + 7, r + 3], opacity: [0.9, 0.35, 0.9] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
          />
        )}
        {/* Shadow */}
        <ellipse cx={1} cy={r * 1.9} rx={r * 0.55} ry={r * 0.18} fill="rgba(0,0,0,0.2)" />
        {/* Pin body */}
        <path d={pinPath(r)} fill={`url(#pg-${token.color})`} stroke={selected ? "#fff" : p.dk} strokeWidth={selected ? 2.5 : 1.2} />
        {/* White face */}
        <circle cx={0} cy={-r * 0.55} r={r * 0.5} fill="white" opacity={0.93} />
        {/* Color dot */}
        <circle cx={0} cy={-r * 0.55} r={r * 0.26} fill={p.bg} />
      </motion.g>
    </motion.g>
  );
}

// ─────────────────────────────────────────
// Dice dots layout
// ─────────────────────────────────────────

const DOTS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
};

// ─────────────────────────────────────────
// Board SVG
// ─────────────────────────────────────────

interface BoardProps {
  state: LudoState;
  sel: string | null;
  onTok: (id: string) => void;
  cs: number;
  animTok: string | null;
  animPos: [number, number] | null;
  hopKey: number;
}

function LudoBoard({ state, sel, onTok, cs, animTok, animPos, hopKey }: BoardProps) {
  const sz = 15 * cs;
  const movSet = new Set(state.movablePieces);

  const stackMap = useMemo(() => {
    const m = new Map<number, Token[]>();
    for (const pl of state.players)
      for (const t of pl.tokens) {
        if (t.state !== "track" && t.state !== "home") continue;
        if (!m.has(t.trackPos)) m.set(t.trackPos, []);
        m.get(t.trackPos)!.push(t);
      }
    return m;
  }, [state]);

  return (
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ display: "block", borderRadius: 8 }}>
      <defs>
        {(["red", "green", "yellow", "blue"] as PlayerColor[]).map((c) => (
          <linearGradient key={c} id={`pg-${c}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C[c].fg} />
            <stop offset="60%" stopColor={C[c].bg} />
            <stop offset="100%" stopColor={C[c].dk} />
          </linearGradient>
        ))}
      </defs>

      {/* Board bg */}
      <rect x={0} y={0} width={sz} height={sz} fill="#f5f0e6" rx={8} />

      {/* 4 colored quadrants + white inner yards */}
      {([
        { color: "red" as PlayerColor, gx: 0, gy: 0 },
        { color: "green" as PlayerColor, gx: 9, gy: 0 },
        { color: "yellow" as PlayerColor, gx: 9, gy: 9 },
        { color: "blue" as PlayerColor, gx: 0, gy: 9 },
      ]).map(({ color, gx, gy }) => {
        const p = C[color];
        const player = state.players.find((pl) => pl.color === color);
        const finIdx = state.finishOrder.indexOf(color);
        return (
          <g key={color}>
            <rect x={gx * cs} y={gy * cs} width={6 * cs} height={6 * cs} fill={p.bg} />
            {/* White inner yard */}
            <rect
              x={(gx + 0.7) * cs} y={(gy + 0.7) * cs}
              width={4.6 * cs} height={4.6 * cs}
              fill="white" rx={cs * 0.45}
              stroke="rgba(0,0,0,0.06)" strokeWidth={1}
            />
            {/* 4 token slots */}
            {YARD_COORDS[color].map(([yr, yc], i) => (
              <circle key={i} cx={yc * cs + cs / 2} cy={yr * cs + cs / 2} r={cs * 0.36}
                fill={p.yard} stroke={p.bg} strokeWidth={1.5} />
            ))}
            {/* Player name */}
            {player && (
              <text
                x={(gx + 3) * cs}
                y={gy === 0 ? (gy + 5.7) * cs : (gy + 0.45) * cs}
                textAnchor="middle"
                fontSize={cs * 0.38}
                fontWeight={700}
                fill="white"
                style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
              >
                {player.name}{player.type === "ai" ? ` (${player.aiLevel})` : ""}
              </text>
            )}
            {/* Finish badge */}
            {finIdx >= 0 && (
              <text
                x={(gx + 3) * cs}
                y={(gy + 3) * cs + cs * 0.15}
                textAnchor="middle"
                fontSize={cs * 1.2}
                style={{ pointerEvents: "none" }}
              >
                {["🏆", "🥈", "🥉", "4️⃣"][finIdx]}
              </text>
            )}
          </g>
        );
      })}

      {/* Track cells */}
      {MAIN_TRACK_COORDS.map(([r, c2], idx) => {
        const entry = Object.entries(ENTRY_CELLS).find(([, eIdx]) => eIdx === idx);
        const safe = SAFE_CELLS.has(idx);
        let fill = "white";
        if (entry) fill = C[entry[0] as PlayerColor].yard;
        return (
          <g key={`t${idx}`}>
            <rect x={c2 * cs + 0.5} y={r * cs + 0.5} width={cs - 1} height={cs - 1}
              fill={fill} stroke="#c0c0c0" strokeWidth={0.6} />
            {safe && (
              <text x={c2 * cs + cs / 2} y={r * cs + cs / 2 + cs * 0.17}
                textAnchor="middle" fontSize={cs * 0.45}
                fill={entry ? C[entry[0] as PlayerColor].dk : "#d0d0d0"}
                style={{ pointerEvents: "none" }}>★</text>
            )}
          </g>
        );
      })}

      {/* Home stretch colored cells */}
      {(["red", "green", "yellow", "blue"] as PlayerColor[]).map((color) =>
        HOME_STRETCH_COORDS[color].slice(0, 5).map(([r, c2], i) => (
          <rect key={`h${color}${i}`} x={c2 * cs + 0.5} y={r * cs + 0.5}
            width={cs - 1} height={cs - 1} fill={C[color].bg} stroke={C[color].dk}
            strokeWidth={0.4} opacity={0.85} />
        ))
      )}

      {/* Center home triangles */}
      {(() => {
        const cx = 7 * cs + cs / 2, cy = 7 * cs + cs / 2, h = cs * 1.5;
        const corners: Array<[number, number]> = [[cx, cy - h], [cx + h, cy], [cx, cy + h], [cx - h, cy]];
        return (["red", "green", "yellow", "blue"] as PlayerColor[]).map((color, i) => (
          <polygon key={color}
            points={`${cx},${cy} ${corners[i][0]},${corners[i][1]} ${corners[(i + 1) % 4][0]},${corners[(i + 1) % 4][1]}`}
            fill={C[color].bg} stroke="white" strokeWidth={1.5} />
        ));
      })()}

      {/* Active player yard glow */}
      {(() => {
        const cp = state.players[state.currentPlayerIndex];
        const yardPos: Record<PlayerColor, [number, number]> = {
          red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9],
        };
        const [gx, gy] = yardPos[cp.color];
        return (
          <rect x={gx * cs} y={gy * cs} width={6 * cs} height={6 * cs}
            fill="none" stroke="white" strokeWidth={3}
            strokeDasharray={`${cs * 0.8} ${cs * 0.4}`}
            opacity={0.7} rx={2}
          />
        );
      })()}

      {/* Tokens */}
      {state.players.flatMap((player) =>
        player.tokens.map((token) => {
          if (token.state === "finished") {
            const ang = (token.index * 90 + { red: -45, green: 45, yellow: 135, blue: 225 }[token.color]) * (Math.PI / 180);
            const cx2 = 7 * cs + cs / 2, cy2 = 7 * cs + cs / 2;
            return (
              <motion.circle key={token.id}
                cx={cx2 + cs * 0.55 * Math.cos(ang)} cy={cy2 + cs * 0.55 * Math.sin(ang)}
                r={cs * 0.2} fill={C[token.color].bg} stroke="white" strokeWidth={1.5}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }} />
            );
          }

          let oPos: [number, number] | undefined;
          if (animTok === token.id && animPos) {
            oPos = animPos;
          } else if ((token.state === "track" || token.state === "home") && !oPos) {
            const here = stackMap.get(token.trackPos) ?? [];
            if (here.length > 1) {
              const si = here.findIndex((t) => t.id === token.id);
              const off: Array<[number, number]> = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];
              const base = getTokenCoord(token, token.color);
              oPos = [base[0] + off[si % 4][0], base[1] + off[si % 4][1]];
            }
          }

          return (
            <TokenPiece key={token.id} token={token} cs={cs}
              movable={movSet.has(token.id)} selected={sel === token.id}
              onClick={() => onTok(token.id)}
              overridePos={oPos}
              hopKey={animTok === token.id ? hopKey : undefined} />
          );
        })
      )}
    </svg>
  );
}

// ─────────────────────────────────────────
// Menu Screen
// ─────────────────────────────────────────

interface MenuConfig {
  numPlayers: 2 | 3 | 4;
  playerTypes: Array<{ type: PlayerType; aiLevel?: AILevel }>;
}

function MenuScreen({ stats, onStart }: { stats: LudoStats; onStart: (c: MenuConfig) => void }) {
  const [num, setNum] = useState<2 | 3 | 4>(4);
  const [pt, setPt] = useState<Array<{ type: PlayerType; aiLevel?: AILevel }>>([
    { type: "human" },
    { type: "ai", aiLevel: "medium" },
    { type: "ai", aiLevel: "medium" },
    { type: "ai", aiLevel: "medium" },
  ]);
  const colors = PLAYER_COLORS_BY_COUNT[num];

  const toggle = (i: number) => {
    setPt((prev) => {
      const n = [...prev];
      if (n[i].type === "human") n[i] = { type: "ai", aiLevel: "easy" };
      else if (n[i].aiLevel === "easy") n[i] = { type: "ai", aiLevel: "medium" };
      else if (n[i].aiLevel === "medium") n[i] = { type: "ai", aiLevel: "hard" };
      else n[i] = { type: "human" };
      return n;
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#fffde7 0%,#fff3e0 50%,#e3f2fd 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
    }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{
          width: "100%", maxWidth: 440, background: "white",
          border: "1px solid #e0e0e0", borderRadius: 24,
          padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.1)",
        }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{
            fontSize: 48, fontWeight: 900, letterSpacing: -1,
            background: "linear-gradient(135deg,#D32F2F,#F9A825,#388E3C,#1565C0)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6,
          }}>LUDO</h1>
          <p style={{ color: "#888", fontSize: 13 }}>Roll, race, capture — be the first home!</p>
        </div>

        {stats.gamesPlayed > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
            {[
              { l: "Wins", v: stats.wins, c: "#388E3C" },
              { l: "Played", v: stats.gamesPlayed, c: "#1565C0" },
              { l: "Streak", v: stats.winStreak, c: "#F9A825" },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: "#fafafa", borderRadius: 10, padding: "8px 4px", textAlign: "center", border: "1px solid #eee" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: "#999" }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        <p style={{ color: "#666", fontSize: 11, letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>PLAYERS</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {([2, 3, 4] as const).map((n) => (
            <motion.button key={n} onClick={() => setNum(n)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10,
                border: num === n ? "2px solid #1565C0" : "2px solid #e0e0e0",
                background: num === n ? "#e3f2fd" : "white",
                color: num === n ? "#1565C0" : "#666", fontSize: 18, fontWeight: 700, cursor: "pointer",
              }}>{n}</motion.button>
          ))}
        </div>

        <p style={{ color: "#666", fontSize: 11, letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>SETUP</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {colors.map((color, i) => {
            const p = C[color]; const cfg = pt[i];
            const label = cfg.type === "human" ? "Human" : `AI · ${cfg.aiLevel}`;
            return (
              <motion.button key={color} onClick={() => toggle(i)} whileTap={{ scale: 0.98 }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 10,
                  border: `2px solid ${p.bg}30`, background: p.yard,
                  cursor: "pointer", textAlign: "left",
                }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: p.bg, border: `2px solid ${p.dk}`, flexShrink: 0 }} />
                <span style={{ color: "#333", fontWeight: 600, fontSize: 13, flex: 1 }}>
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </span>
                <span style={{
                  color: cfg.type === "human" ? "#1565C0" : "#388E3C",
                  fontSize: 11, fontWeight: 600,
                  background: cfg.type === "human" ? "rgba(21,101,192,0.1)" : "rgba(56,142,60,0.1)",
                  padding: "3px 10px", borderRadius: 6,
                }}>{label}</span>
              </motion.button>
            );
          })}
        </div>

        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => { audio.click(); onStart({ numPlayers: num, playerTypes: pt.slice(0, num) }); }}
          style={{
            width: "100%", padding: "14px 0",
            background: "linear-gradient(135deg,#D32F2F,#F9A825,#388E3C,#1565C0)",
            border: "none", borderRadius: 12, color: "white", fontSize: 18,
            fontWeight: 800, cursor: "pointer", letterSpacing: 2,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}>PLAY</motion.button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────
// Main Game Component
// ─────────────────────────────────────────

export function LudoGame() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [gs, setGs] = useState<LudoState | null>(null);
  const [menuCfg, setMenuCfg] = useState<MenuConfig | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [stats, setStats] = useState<LudoStats>(() => {
    if (typeof window === "undefined") return { wins: 0, losses: 0, captures: 0, gamesPlayed: 0, winStreak: 0, bestStreak: 0 };
    return loadStats();
  });
  const [toast, setToast] = useState("");
  const [gameCaptures, setGameCaptures] = useState(0);

  // Animation
  const [animTok, setAnimTok] = useState<string | null>(null);
  const [animPos, setAnimPos] = useState<[number, number] | null>(null);
  const [hopKey, setHopKey] = useState(0);
  const animLock = useRef(false);
  const gsRef = useRef<LudoState | null>(null);
  const processing = useRef(false);

  // Dice display value during roll
  const [diceDisplay, setDiceDisplay] = useState(1);

  useEffect(() => { gsRef.current = gs; }, [gs]);

  // Responsive: fill screen
  const [cs, setCs] = useState(36);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Board + thin top bar (36px) + dice label below (if needed)
      const avail = Math.min(w - 8, h - 44);
      setCs(Math.max(20, Math.floor(avail / 15)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const boardSz = 15 * cs;

  const flash = useCallback((msg: string, dur = 1800) => {
    setToast(msg);
    setTimeout(() => setToast(""), dur);
  }, []);

  // ── Step-by-step animate then apply ───
  const animateAndApply = useCallback(
    (tokenId: string, result: MoveResult, cb?: () => void) => {
      const path = result.movePath;
      if (path.length === 0) {
        // No path (e.g. entering from yard with 0-length path shouldn't happen, but safety)
        applyFinal(result, cb);
        return;
      }

      animLock.current = true;
      setAnimTok(tokenId);
      let step = 0;
      const delay = 280; // ms per hop — slow, visible hop

      const doStep = () => {
        if (step >= path.length) {
          setAnimTok(null);
          setAnimPos(null);
          animLock.current = false;
          applyFinal(result, cb);
          return;
        }
        setAnimPos(path[step]);
        setHopKey((k) => k + 1);
        if (step > 0 || path.length === 1) audio.tokenStep();
        step++;
        setTimeout(doStep, delay);
      };

      // First step immediately
      doStep();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, gameCaptures]
  );

  function applyFinal(result: MoveResult, cb?: () => void) {
    if (result.enteredBoard) { audio.tokenEnter(); flash("Token entered!"); }
    else if (result.finished) { audio.tokenFinish(); flash("Token home! 🎉"); }
    else if (result.enteredHome) { audio.homeStretch(); flash("Home stretch!"); }

    if (result.captured && result.capturedToken) {
      audio.capture();
      setGameCaptures((c) => c + 1);
      flash(`${result.capturedToken.color.toUpperCase()} captured!`, 2200);
    }

    setGs(result.newState);

    // Check game end
    if (result.newState.phase === "gameover") {
      audio.victory();
      const hp = result.newState.players.find((p) => p.type === "human");
      const won = hp ? result.newState.finishOrder[0] === hp.color : false;
      const ns = updateStats(stats, won, gameCaptures + (result.captured ? 1 : 0));
      setStats(ns);
      saveStats(ns);
    }

    cb?.();
  }

  // ── AI turn ───
  const runAI = useCallback(() => {
    const st = gsRef.current;
    if (!st) return;
    if (processing.current) return;
    processing.current = true;

    setTimeout(() => {
      const cur = gsRef.current;
      if (!cur) { processing.current = false; return; }

      setRolling(true);
      audio.diceShake();
      // Animate dice display during roll
      const rollIv = setInterval(() => setDiceDisplay(Math.ceil(Math.random() * 6)), 80);

      setTimeout(() => {
        clearInterval(rollIv);
        setRolling(false);
        const dv = rollDice();
        setDiceDisplay(dv);
        if (dv === 6) audio.sixRolled(); else audio.diceLand(dv);

        setGs((prev) => {
          if (!prev) return prev;
          const n = deepCloneState(prev);
          n.dice = dv; n.diceRolled = true;
          n.consecutiveSixes = dv === 6 ? n.consecutiveSixes + 1 : 0;
          n.movablePieces = getMovableTokens(n);
          return n;
        });

        setTimeout(() => {
          const us = gsRef.current;
          if (!us) { processing.current = false; return; }
          if (us.movablePieces.length === 0 || (us.dice === 6 && us.consecutiveSixes >= 3)) {
            setGs(handleNoMoves(us));
            processing.current = false;
            return;
          }
          const tid = getAIMove(us);
          if (!tid) { processing.current = false; return; }
          const res = applyMove(us, tid);
          animateAndApply(tid, res, () => { processing.current = false; });
        }, 450);
      }, 650);
    }, 500);
  }, [animateAndApply]);

  useEffect(() => {
    if (!gs || gs.phase !== "playing" || rolling || animLock.current) return;
    const cp = getCurrentPlayer(gs);
    if (cp.type !== "ai" || gs.diceRolled) return;
    const t = setTimeout(runAI, 250);
    return () => clearTimeout(t);
  }, [gs, rolling, runAI]);

  // ── Handlers ───
  const handleStart = useCallback((cfg: MenuConfig) => {
    const s = createInitialState(cfg.numPlayers, cfg.playerTypes);
    setMenuCfg(cfg);
    setGs(s);
    setScreen("game");
    setSel(null);
    setGameCaptures(0);
    processing.current = false;
    animLock.current = false;
    setAnimTok(null);
    setAnimPos(null);
    setDiceDisplay(1);
  }, []);

  const handleRoll = useCallback(() => {
    if (!gs || gs.diceRolled || rolling || animLock.current || processing.current) return;
    if (getCurrentPlayer(gs).type !== "human") return;

    setRolling(true);
    audio.diceShake();
    const rollIv = setInterval(() => setDiceDisplay(Math.ceil(Math.random() * 6)), 80);

    setTimeout(() => {
      clearInterval(rollIv);
      setRolling(false);
      const dv = rollDice();
      setDiceDisplay(dv);
      if (dv === 6) audio.sixRolled(); else audio.diceLand(dv);

      setGs((prev) => {
        if (!prev) return prev;
        const n = deepCloneState(prev);
        n.dice = dv; n.diceRolled = true;
        n.consecutiveSixes = dv === 6 ? n.consecutiveSixes + 1 : 0;
        n.movablePieces = getMovableTokens(n);
        return n;
      });
    }, 650);
  }, [gs, rolling]);

  // Auto-skip when human has no moves
  useEffect(() => {
    if (!gs || !gs.diceRolled || gs.movablePieces.length > 0 || rolling || animLock.current) return;
    if (getCurrentPlayer(gs).type !== "human") return;
    const t = setTimeout(() => {
      flash("No moves — skipping", 1200);
      setGs((p) => p ? handleNoMoves(p) : p);
    }, 1000);
    return () => clearTimeout(t);
  }, [gs, rolling, flash]);

  const handleTok = useCallback((tid: string) => {
    if (!gs || !gs.diceRolled || !gs.movablePieces.includes(tid)) return;
    if (processing.current || animLock.current) return;
    if (getCurrentPlayer(gs).type !== "human") return;
    audio.click();
    setSel(tid);
    const st = gsRef.current;
    if (!st) return;
    const res = applyMove(st, tid);
    setSel(null);
    animateAndApply(tid, res);
  }, [gs, animateAndApply]);

  // ── Render ───
  if (screen === "menu") return <MenuScreen stats={stats} onStart={handleStart} />;
  if (!gs) return null;

  const cp = getCurrentPlayer(gs);
  const pal = C[cp.color];
  const isGameOver = gs.phase === "gameover";

  // Dice position — in current player's yard
  const [dRow, dCol] = YARD_CENTER[cp.color];
  const diceLeft = dCol * cs;
  const diceTop = dRow * cs;

  // Can roll?
  const canRoll = !gs.diceRolled && !rolling && !animLock.current && cp.type === "human" && !isGameOver;

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: "linear-gradient(160deg,#fffde7 0%,#fff3e0 50%,#e3f2fd 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", position: "relative", overflow: "hidden",
    }}>
      {/* Fixed toast — no layout shift */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{
              position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 200,
              padding: "7px 22px", borderRadius: 20,
              background: "white", border: "1px solid #e0e0e0",
              color: "#333", fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)", pointerEvents: "none",
            }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button — top left */}
      <motion.button
        onClick={() => setScreen("menu")}
        whileTap={{ scale: 0.92 }}
        style={{
          position: "fixed", top: 8, left: 8, zIndex: 100,
          padding: "5px 14px", borderRadius: 8,
          border: "1px solid #ddd", background: "white",
          color: "#555", fontSize: 12, cursor: "pointer", fontWeight: 600,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}>← Menu</motion.button>

      {/* Board container — centered, full size */}
      <div style={{ position: "relative", borderRadius: 10, overflow: "visible" }}>
        <div style={{
          borderRadius: 10, overflow: "hidden",
          boxShadow: "0 6px 30px rgba(0,0,0,0.12), 0 0 0 2px rgba(0,0,0,0.05)",
        }}>
          <LudoBoard state={gs} sel={sel} onTok={handleTok} cs={cs}
            animTok={animTok} animPos={animPos} hopKey={hopKey} />
        </div>

        {/* Dice overlay — positioned in current player's yard */}
        {!isGameOver && (
          <motion.div
            animate={{ left: diceLeft, top: diceTop }}
            transition={{ type: "spring", stiffness: 200, damping: 22, mass: 0.8 }}
            style={{
              position: "absolute",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
            }}
          >
            <motion.button
              onClick={canRoll ? handleRoll : undefined}
              disabled={!canRoll}
              whileHover={canRoll ? { scale: 1.12 } : {}}
              whileTap={canRoll ? { scale: 0.88 } : {}}
              animate={
                rolling
                  ? { rotateX: [0, 360, 720], rotateY: [0, 180, 360], rotateZ: [0, 120, 0] }
                  : { rotateX: 0, rotateY: 0, rotateZ: 0 }
              }
              transition={rolling ? { duration: 0.6, ease: "easeInOut" } : { duration: 0.3 }}
              style={{
                width: Math.max(48, cs * 1.6),
                height: Math.max(48, cs * 1.6),
                borderRadius: Math.max(8, cs * 0.3),
                background: gs.diceRolled ? "white" : pal.bg,
                border: `3px solid ${pal.bg}`,
                boxShadow: canRoll
                  ? `0 4px 24px ${pal.bg}55, 0 2px 8px rgba(0,0,0,0.2)`
                  : "0 2px 8px rgba(0,0,0,0.15)",
                cursor: canRoll ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                outline: "none", perspective: 600,
                opacity: gs.diceRolled && !rolling ? 0.85 : 1,
                pointerEvents: gs.diceRolled && !rolling ? "none" : "auto",
              }}
            >
              <svg width="80%" height="80%" viewBox="0 0 100 100">
                {(DOTS[diceDisplay] || DOTS[1]).map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r={10}
                    fill={gs.diceRolled ? "#333" : "white"} />
                ))}
              </svg>
            </motion.button>

            {/* Turn label under dice */}
            {!rolling && !gs.diceRolled && cp.type === "human" && (
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                style={{
                  textAlign: "center", marginTop: 4,
                  fontSize: Math.max(9, cs * 0.28), fontWeight: 700,
                  color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  pointerEvents: "none",
                }}>
                TAP
              </motion.div>
            )}

            {/* Rolled 6 indicator */}
            {gs.dice === 6 && gs.diceRolled && !rolling && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                style={{
                  textAlign: "center", marginTop: 2,
                  fontSize: Math.max(9, cs * 0.26), fontWeight: 800,
                  color: "#F9A825", textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  pointerEvents: "none",
                }}>
                ✨ 6!
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Game-over inline results — replaces dice area */}
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{
              position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
              background: "white", borderRadius: 16,
              padding: "16px 24px", textAlign: "center",
              boxShadow: "0 6px 30px rgba(0,0,0,0.15)",
              border: "2px solid #e0e0e0", zIndex: 20,
              minWidth: Math.min(boardSz * 0.7, 320),
            }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#333", marginBottom: 10 }}>
              🏆 {gs.finishOrder[0]?.charAt(0).toUpperCase()}{gs.finishOrder[0]?.slice(1)} Wins!
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 14 }}>
              {gs.finishOrder.map((clr, i) => (
                <div key={clr} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 14 }}>{["🥇", "🥈", "🥉", "4️⃣"][i]}</span>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: C[clr].bg }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setScreen("menu")}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  border: "2px solid #e0e0e0", background: "white",
                  color: "#666", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Menu</button>
              <button onClick={() => menuCfg && handleStart(menuCfg)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  border: "none", background: C[gs.finishOrder[0]].bg,
                  color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>Again</button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Turn status — fixed bottom */}
      {!isGameOver && (
        <div style={{
          position: "fixed", bottom: 8, left: "50%", transform: "translateX(-50%)",
          background: "white", borderRadius: 20,
          padding: "6px 20px", fontSize: 12, fontWeight: 600,
          color: pal.bg, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: `2px solid ${pal.bg}30`, zIndex: 50, whiteSpace: "nowrap",
        }}>
          {cp.name}&apos;s Turn
          {cp.type === "ai" && " (AI)"}
          {!gs.diceRolled && cp.type === "human" ? " — Tap dice" : ""}
          {gs.diceRolled && gs.movablePieces.length > 0 && cp.type === "human" ? " — Tap a token" : ""}
        </div>
      )}
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
      <rect x={2} y={2} width={38} height={38} fill="#D32F2F" rx={4} />
      <rect x={60} y={2} width={38} height={38} fill="#388E3C" rx={4} />
      <rect x={60} y={60} width={38} height={38} fill="#F9A825" rx={4} />
      <rect x={2} y={60} width={38} height={38} fill="#1565C0" rx={4} />
      <rect x={6} y={6} width={30} height={30} fill="white" rx={4} />
      <rect x={64} y={6} width={30} height={30} fill="white" rx={4} />
      <rect x={64} y={64} width={30} height={30} fill="white" rx={4} />
      <rect x={6} y={64} width={30} height={30} fill="white" rx={4} />
      <rect x={42} y={2} width={16} height={96} fill="white" stroke="#ddd" strokeWidth={0.5} />
      <rect x={2} y={42} width={96} height={16} fill="white" stroke="#ddd" strokeWidth={0.5} />
      <polygon points="50,50 42,42 58,42" fill="#D32F2F" />
      <polygon points="50,50 58,42 58,58" fill="#388E3C" />
      <polygon points="50,50 58,58 42,58" fill="#F9A825" />
      <polygon points="50,50 42,58 42,42" fill="#1565C0" />
      <circle cx={14} cy={14} r={5} fill="#D32F2F" stroke="#B71C1C" strokeWidth={1} />
      <circle cx={28} cy={14} r={5} fill="#D32F2F" stroke="#B71C1C" strokeWidth={1} opacity={0.6} />
      <circle cx={78} cy={14} r={5} fill="#388E3C" stroke="#1B5E20" strokeWidth={1} />
      <circle cx={78} cy={78} r={5} fill="#F9A825" stroke="#F57F17" strokeWidth={1} />
      <circle cx={14} cy={78} r={5} fill="#1565C0" stroke="#0D47A1" strokeWidth={1} />
      <path d="M 50 22 C 47 18 45 14 45 12 A 5 5 0 1 1 55 12 C 55 14 53 18 50 22 Z"
        fill="#D32F2F" stroke="white" strokeWidth={0.8} />
      <circle cx={50} cy={12} r={2} fill="white" />
      <text x={50} y={72} textAnchor="middle" fontSize={8} fill="#F9A825">★</text>
    </svg>
  );
}
