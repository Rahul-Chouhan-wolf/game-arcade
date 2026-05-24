"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Player, Cell, Board, Difficulty,
  WIN_LINES, checkWinner, isDraw as checkDraw,
  getBestMove, TTTStats, defaultStats,
} from "@/lib/tictactoe/engine"
import { TicTacToeAudio } from "@/lib/tictactoe/audio"

// ── Types ─────────────────────────────────────────────────────────────────────

type GameMode  = "pvp" | "cpu"
type GamePhase = "menu" | "game" | "ended"

interface Score { X: number; O: number; draws: number }

interface Particle {
  id: number; tx: number; ty: number
  size: number; color: string; dur: number; delay: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const X_COLOR   = "#ff2d87"
const O_COLOR   = "#00d8ff"
const WIN_COLOR = "#ffd700"
const GRID_COLOR = "rgba(0,216,255,0.28)"

// Win line SVG coordinates (300×300 viewBox, grid lines at 100 and 200)
const WIN_LINE_COORDS: Record<string, [number, number, number, number]> = {
  "0,1,2": [14, 50, 286, 50],
  "3,4,5": [14, 150, 286, 150],
  "6,7,8": [14, 250, 286, 250],
  "0,3,6": [50, 14, 50, 286],
  "1,4,7": [150, 14, 150, 286],
  "2,5,8": [250, 14, 250, 286],
  "0,4,8": [14, 14, 286, 286],
  "2,4,6": [286, 14, 14, 286],
}

const DIFFICULTY_LABELS: Record<Difficulty, { label: string; desc: string; color: string }> = {
  easy:       { label: "Easy",       desc: "Makes mistakes",   color: "#4ade80" },
  medium:     { label: "Medium",     desc: "Decent strategy",  color: "#fbbf24" },
  hard:       { label: "Hard",       desc: "Plays well",       color: "#f97316" },
  impossible: { label: "Impossible", desc: "Never loses",      color: "#ef4444" },
}

// ── SVG Symbol components ─────────────────────────────────────────────────────

function XSymbol({
  size = 80, color = X_COLOR, ghost = false, animate: anim = true,
}: {
  size?: number; color?: string; ghost?: boolean; animate?: boolean
}) {
  const pad = 20
  const sw  = 9
  return (
    <svg
      viewBox="0 0 100 100"
      width={size} height={size}
      style={{ opacity: ghost ? 0.22 : 1, overflow: "visible" }}
    >
      {!ghost && (
        <defs>
          <filter id={`xglow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      )}
      <motion.line
        x1={pad} y1={pad} x2={100 - pad} y2={100 - pad}
        stroke={color} strokeWidth={sw} strokeLinecap="round"
        filter={ghost ? undefined : `url(#xglow-${size})`}
        initial={{ pathLength: anim ? 0 : 1 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />
      <motion.line
        x1={100 - pad} y1={pad} x2={pad} y2={100 - pad}
        stroke={color} strokeWidth={sw} strokeLinecap="round"
        filter={ghost ? undefined : `url(#xglow-${size})`}
        initial={{ pathLength: anim ? 0 : 1 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, delay: anim ? 0.14 : 0, ease: "easeOut" }}
      />
    </svg>
  )
}

function OSymbol({
  size = 80, color = O_COLOR, ghost = false, animate: anim = true,
}: {
  size?: number; color?: string; ghost?: boolean; animate?: boolean
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size} height={size}
      style={{ opacity: ghost ? 0.22 : 1, overflow: "visible" }}
    >
      {!ghost && (
        <defs>
          <filter id={`oglow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      )}
      <motion.circle
        cx={50} cy={50} r={30}
        stroke={color} strokeWidth={9} strokeLinecap="round" fill="none"
        filter={ghost ? undefined : `url(#oglow-${size})`}
        initial={{ pathLength: anim ? 0 : 1, rotate: -90 }}
        animate={{ pathLength: 1, rotate: -90 }}
        style={{ transformOrigin: "50px 50px" }}
        transition={{ duration: anim ? 0.38 : 0, ease: "easeOut" }}
      />
    </svg>
  )
}

// ── Win line overlay ──────────────────────────────────────────────────────────

function WinLineOverlay({ line }: { line: [number, number, number] }) {
  const key    = line.join(",")
  const coords = WIN_LINE_COORDS[key]
  if (!coords) return null
  const [x1, y1, x2, y2] = coords
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 300 300"
    >
      <defs>
        <filter id="wl-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <motion.line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={WIN_COLOR} strokeWidth={5} strokeLinecap="round"
        filter="url(#wl-glow)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </svg>
  )
}

// ── Board cell ────────────────────────────────────────────────────────────────

interface CellProps {
  index:         number
  cell:          Cell
  isWinCell:     boolean
  currentPlayer: Player
  disabled:      boolean
  showGhost:     boolean
  onClick:       () => void
  onEnter:       () => void
  onLeave:       () => void
}

function BoardCell({
  index, cell, isWinCell, currentPlayer, disabled, showGhost, onClick, onEnter, onLeave,
}: CellProps) {
  const canInteract = !disabled && !cell

  return (
    <motion.div
      className="relative flex items-center justify-center select-none"
      style={{
        cursor: canInteract ? "pointer" : "default",
        background: isWinCell ? `${WIN_COLOR}08` : "transparent",
        transition: "background 0.3s",
      }}
      onMouseEnter={canInteract ? onEnter : undefined}
      onMouseLeave={onLeave}
      onClick={canInteract ? onClick : undefined}
      onTouchEnd={canInteract ? (e) => { e.preventDefault(); onClick() } : undefined}
      whileHover={canInteract ? { background: "rgba(255,255,255,0.04)" } : {}}
    >
      {/* Ghost preview on hover */}
      <AnimatePresence>
        {showGhost && canInteract && (
          <motion.div
            key="ghost"
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.65 }}
            transition={{ duration: 0.12 }}
          >
            {currentPlayer === "X"
              ? <XSymbol size={60} ghost animate={false} />
              : <OSymbol size={60} ghost animate={false} />
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* Placed symbol */}
      <AnimatePresence>
        {cell && (
          <motion.div
            key={`${index}-${cell}`}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 13, stiffness: 220, mass: 0.6 }}
          >
            {cell === "X"
              ? <XSymbol size={66} color={isWinCell ? WIN_COLOR : X_COLOR} />
              : <OSymbol size={66} color={isWinCell ? WIN_COLOR : O_COLOR} />
            }
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Board grid ────────────────────────────────────────────────────────────────

interface BoardProps {
  board:         Cell[]
  winLine:       [number, number, number] | null
  current:       Player
  disabled:      boolean
  onMove:        (i: number) => void
}

function GameBoard({ board, winLine, current, disabled, onMove }: BoardProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const winSet = new Set(winLine ?? [])

  return (
    <div className="relative w-full" style={{ maxWidth: 360, aspectRatio: "1 / 1" }}>
      {/* SVG grid lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 300 300"
      >
        <defs>
          <filter id="grid-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Vertical lines */}
        {[100, 200].map((x, i) => (
          <motion.line
            key={`v${i}`}
            x1={x} y1={12} x2={x} y2={288}
            stroke={GRID_COLOR} strokeWidth={1.5}
            filter="url(#grid-glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.08 + i * 0.08, ease: "easeOut" }}
          />
        ))}
        {/* Horizontal lines */}
        {[100, 200].map((y, i) => (
          <motion.line
            key={`h${i}`}
            x1={12} y1={y} x2={288} y2={y}
            stroke={GRID_COLOR} strokeWidth={1.5}
            filter="url(#grid-glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.12 + i * 0.08, ease: "easeOut" }}
          />
        ))}

        {/* Win line */}
        {winLine && <WinLineOverlay line={winLine} />}
      </svg>

      {/* Cell grid */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {board.map((cell, i) => (
          <BoardCell
            key={i}
            index={i}
            cell={cell}
            isWinCell={winSet.has(i)}
            currentPlayer={current}
            disabled={disabled}
            showGhost={hovered === i}
            onClick={() => onMove(i)}
            onEnter={() => setHovered(i)}
            onLeave={() => setHovered(null)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Turn indicator ────────────────────────────────────────────────────────────

function TurnIndicator({
  current, mode, cpuSymbol, cpuThinking, winner, isDraw,
}: {
  current: Player; mode: GameMode; cpuSymbol: Player
  cpuThinking: boolean; winner: Player | null; isDraw: boolean
}) {
  if (winner || isDraw) return null

  const isYourTurn = mode === "pvp" || current !== cpuSymbol
  const color      = current === "X" ? X_COLOR : O_COLOR
  const label      = mode === "cpu" && !isYourTurn
    ? cpuThinking ? "Thinking" : "CPU's Turn"
    : `${current}'s Turn`

  return (
    <div className="flex items-center justify-center gap-3">
      <motion.div
        key={current}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 260 }}
      >
        {current === "X"
          ? <XSymbol size={28} animate={false} />
          : <OSymbol size={28} animate={false} />
        }
      </motion.div>

      <motion.span
        key={label}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="text-sm font-bold uppercase tracking-widest"
        style={{ color }}
      >
        {label}
        {cpuThinking && (
          <span className="inline-flex gap-0.5 ml-1">
            {[0,1,2].map(i => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }}
                style={{ color }}
              >·</motion.span>
            ))}
          </span>
        )}
      </motion.span>
    </div>
  )
}

// ── Score panel ───────────────────────────────────────────────────────────────

function ScorePanel({
  score, mode, cpuSymbol,
}: {
  score: Score; mode: GameMode; cpuSymbol: Player
}) {
  const xLabel = mode === "cpu" && cpuSymbol === "X" ? "CPU" : "Player X"
  const oLabel = mode === "cpu" && cpuSymbol === "O" ? "CPU" : "Player O"

  function ScoreBox({
    player, label, value,
  }: { player: Player; label: string; value: number }) {
    const color = player === "X" ? X_COLOR : O_COLOR
    return (
      <div className="flex flex-col items-center gap-0.5 flex-1">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.22em]"
          style={{ color: `${color}80` }}
        >
          {label}
        </span>
        <motion.span
          key={value}
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 14, stiffness: 280 }}
          className="text-2xl font-extrabold tabular-nums"
          style={{ color }}
        >
          {value}
        </motion.span>
      </div>
    )
  }

  return (
    <div
      className="flex items-stretch gap-0 rounded-2xl overflow-hidden border border-white/10"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(16px)" }}
    >
      <ScoreBox player="X" label={xLabel} value={score.X} />
      <div className="flex flex-col items-center justify-center gap-0.5 px-4 border-l border-r border-white/10">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">Draws</span>
        <span className="text-xl font-extrabold text-white/40 tabular-nums">{score.draws}</span>
      </div>
      <ScoreBox player="O" label={oLabel} value={score.O} />
    </div>
  )
}

// ── Result overlay ────────────────────────────────────────────────────────────

interface ResultOverlayProps {
  winner:    Player | null
  isDraw:    boolean
  mode:      GameMode
  cpuSymbol: Player
  particles: Particle[]
  onRematch: () => void
  onMenu:    () => void
}

function ResultOverlay({
  winner, isDraw, mode, cpuSymbol, particles, onRematch, onMenu,
}: ResultOverlayProps) {
  const isWin = winner !== null

  const titleColor = isWin
    ? winner === "X" ? X_COLOR : O_COLOR
    : "rgba(255,255,255,0.55)"

  const winnerLabel = () => {
    if (isDraw) return "Draw!"
    if (mode === "cpu") {
      return winner === cpuSymbol ? "CPU Wins!" : "You Win!"
    }
    return `${winner} Wins!`
  }

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl overflow-hidden z-20"
      style={{ backdropFilter: "blur(8px)", background: "rgba(3,0,24,0.78)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: p.size, height: p.size,
            background: p.color,
            top: "50%", left: "50%",
            x: "-50%", y: "-50%",
            boxShadow: `0 0 ${p.size * 1.5}px ${p.color}`,
          }}
          initial={{ x: "-50%", y: "-50%", opacity: 1, scale: 1 }}
          animate={{ x: `calc(-50% + ${p.tx}px)`, y: `calc(-50% + ${p.ty}px)`, opacity: 0, scale: 0.2 }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeOut" }}
        />
      ))}

      {/* Result text */}
      <motion.div
        className="flex flex-col items-center gap-5"
        initial={{ scale: 0.7, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", damping: 14, stiffness: 200 }}
      >
        {isWin && (
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          >
            {winner === "X"
              ? <XSymbol size={72} animate={false} />
              : <OSymbol size={72} animate={false} />
            }
          </motion.div>
        )}

        <div className="text-center">
          <motion.div
            className="text-4xl font-extrabold uppercase tracking-widest mb-1"
            style={{
              color: titleColor,
              textShadow: isWin ? `0 0 30px ${titleColor}` : undefined,
            }}
          >
            {winnerLabel()}
          </motion.div>
          {isWin && mode === "cpu" && winner === cpuSymbol && (
            <p className="text-white/35 text-xs uppercase tracking-widest">Better luck next time</p>
          )}
          {isWin && mode === "cpu" && winner !== cpuSymbol && (
            <p className="text-white/35 text-xs uppercase tracking-widest">Outstanding play</p>
          )}
        </div>

        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
            onClick={onRematch}
            className="px-6 py-3 rounded-full text-xs font-extrabold uppercase tracking-widest text-white"
            style={{
              background: isWin
                ? `linear-gradient(135deg, ${winner === "X" ? X_COLOR : O_COLOR}, ${winner === "X" ? "#c0006a" : "#0090ab"})`
                : "rgba(255,255,255,0.14)",
              boxShadow: isWin ? `0 0 20px ${winner === "X" ? X_COLOR : O_COLOR}44` : undefined,
            }}
          >
            Rematch
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
            onClick={onMenu}
            className="px-6 py-3 rounded-full text-xs font-extrabold uppercase tracking-widest text-white/50 border border-white/15"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            Menu
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Menu screen ───────────────────────────────────────────────────────────────

interface MenuProps {
  onStart:      (mode: GameMode, diff: Difficulty, sym: Player) => void
  stats:        TTTStats
}

function MenuScreen({ onStart, stats }: MenuProps) {
  const [mode,       setMode]       = useState<GameMode>("cpu")
  const [difficulty, setDifficulty] = useState<Difficulty>("hard")
  const [symbol,     setSymbol]     = useState<Player>("X")

  return (
    <motion.div
      className="flex flex-col items-center gap-6 w-full"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Title */}
      <div className="text-center">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.35em] mb-2"
          style={{ color: "rgba(0,216,255,0.5)" }}
        >
          Arcade Classic
        </div>
        <h1
          className="text-5xl sm:text-6xl font-extrabold tracking-[0.15em] uppercase mb-1"
          style={{
            background: `linear-gradient(135deg, #fff 20%, ${O_COLOR} 55%, ${X_COLOR} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 24px ${X_COLOR}40)`,
          }}
        >
          TIC TAC TOE
        </h1>
        <p className="text-white/25 text-xs tracking-wide">The classic — elevated.</p>
      </div>

      {/* Mini board preview (static) */}
      <svg
        viewBox="0 0 180 180"
        width={140} height={140}
        className="opacity-70"
      >
        <defs>
          <filter id="menu-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Grid */}
        {[60, 120].map(v => (
          <g key={v}>
            <line x1={v} y1={8} x2={v} y2={172} stroke={GRID_COLOR} strokeWidth={1.2} filter="url(#menu-glow)" />
            <line x1={8} y1={v} x2={172} y2={v} stroke={GRID_COLOR} strokeWidth={1.2} filter="url(#menu-glow)" />
          </g>
        ))}
        {/* X at 0 */}
        <line x1={16} y1={16} x2={44} y2={44} stroke={X_COLOR} strokeWidth={6} strokeLinecap="round" filter="url(#menu-glow)" />
        <line x1={44} y1={16} x2={16} y2={44} stroke={X_COLOR} strokeWidth={6} strokeLinecap="round" filter="url(#menu-glow)" />
        {/* O at 4 */}
        <circle cx={90} cy={90} r={18} stroke={O_COLOR} strokeWidth={6} fill="none" filter="url(#menu-glow)" />
        {/* X at 8 */}
        <line x1={136} y1={136} x2={164} y2={164} stroke={X_COLOR} strokeWidth={6} strokeLinecap="round" filter="url(#menu-glow)" />
        <line x1={164} y1={136} x2={136} y2={164} stroke={X_COLOR} strokeWidth={6} strokeLinecap="round" filter="url(#menu-glow)" />
        {/* Win line diagonal */}
        <line x1={8} y1={172} x2={172} y2={8} stroke={WIN_COLOR} strokeWidth={3} strokeLinecap="round" filter="url(#menu-glow)" opacity={0.7} />
        {/* O at 2 */}
        <circle cx={150} cy={30} r={18} stroke={O_COLOR} strokeWidth={6} fill="none" filter="url(#menu-glow)" />
        {/* X at 6 */}
        <line x1={16} y1={136} x2={44} y2={164} stroke={X_COLOR} strokeWidth={6} strokeLinecap="round" filter="url(#menu-glow)" />
        <line x1={44} y1={136} x2={16} y2={164} stroke={X_COLOR} strokeWidth={6} strokeLinecap="round" filter="url(#menu-glow)" />
      </svg>

      {/* Mode selector */}
      <div
        className="w-full max-w-[340px] rounded-2xl border border-white/10 p-5 flex flex-col gap-5"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(16px)" }}
      >
        {/* Mode */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Mode</div>
          <div className="flex gap-2">
            {(["pvp", "cpu"] as GameMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all"
                style={{
                  background: mode === m
                    ? `linear-gradient(135deg, ${X_COLOR}, ${O_COLOR})`
                    : "rgba(255,255,255,0.05)",
                  color: mode === m ? "#fff" : "rgba(255,255,255,0.35)",
                  border: mode === m ? "none" : "1px solid rgba(255,255,255,0.10)",
                  boxShadow: mode === m ? `0 0 16px ${X_COLOR}30` : undefined,
                }}
              >
                {m === "pvp" ? "2 Players" : "vs CPU"}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty (CPU only) */}
        <AnimatePresence>
          {mode === "cpu" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                CPU Difficulty
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["easy", "medium", "hard", "impossible"] as Difficulty[]).map(d => {
                  const info = DIFFICULTY_LABELS[d]
                  const active = difficulty === d
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className="flex flex-col items-start gap-0.5 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: active ? `${info.color}15` : "rgba(255,255,255,0.04)",
                        border: active ? `1px solid ${info.color}55` : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span
                        className="text-[11px] font-extrabold uppercase tracking-widest"
                        style={{ color: active ? info.color : "rgba(255,255,255,0.4)" }}
                      >
                        {info.label}
                      </span>
                      <span className="text-[9px] text-white/25">{info.desc}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Symbol choice (CPU mode) */}
        <AnimatePresence>
          {mode === "cpu" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                Play as
              </div>
              <div className="flex gap-2">
                {(["X", "O"] as Player[]).map(s => {
                  const color = s === "X" ? X_COLOR : O_COLOR
                  return (
                    <button
                      key={s}
                      onClick={() => setSymbol(s)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all"
                      style={{
                        background: symbol === s ? `${color}18` : "rgba(255,255,255,0.04)",
                        border: symbol === s ? `1px solid ${color}55` : "1px solid rgba(255,255,255,0.08)",
                        color: symbol === s ? color : "rgba(255,255,255,0.35)",
                      }}
                    >
                      {s === "X"
                        ? <XSymbol size={20} animate={false} />
                        : <OSymbol size={20} animate={false} />
                      }
                      {s}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats row */}
      <div className="flex gap-5 text-center">
        {[
          { label: "Wins", value: stats.xWins },
          { label: "Draws", value: stats.draws },
          { label: "Losses", value: stats.oWins },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-lg font-extrabold text-white tabular-nums">{value}</div>
            <div className="text-[9px] uppercase tracking-widest text-white/25">{label}</div>
          </div>
        ))}
      </div>

      {/* Play button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => onStart(mode, difficulty, symbol)}
        className="px-12 py-4 rounded-full text-sm font-extrabold uppercase tracking-[0.22em] text-white"
        style={{
          background: `linear-gradient(135deg, ${X_COLOR}, ${O_COLOR})`,
          boxShadow: `0 0 32px ${X_COLOR}40`,
        }}
      >
        ▶ Start Game
      </motion.button>

      {/* How to play */}
      <p className="text-[10px] uppercase tracking-widest text-white/20">
        ← → ↑ ↓ keys · click or tap to play
      </p>
    </motion.div>
  )
}

// ── Main Game Component ───────────────────────────────────────────────────────

const STATS_KEY = "tictactoe-stats"

export function TicTacToeGame() {
  // ── Phase & mode ──────────────────────────────────────────────────────────
  const [phase,      setPhase]      = useState<GamePhase>("menu")
  const [mode,       setMode]       = useState<GameMode>("cpu")
  const [difficulty, setDifficulty] = useState<Difficulty>("hard")
  const [playerSym,  setPlayerSym]  = useState<Player>("X")

  const cpuSymbol: Player = playerSym === "X" ? "O" : "X"

  // ── Game state ────────────────────────────────────────────────────────────
  const [board,   setBoard]   = useState<Cell[]>(Array(9).fill(null))
  const [current, setCurrent] = useState<Player>("X")
  const [winner,  setWinner]  = useState<Player | null>(null)
  const [winLine, setWinLine] = useState<[number, number, number] | null>(null)
  const [isDraw,  setIsDraw]  = useState(false)
  const [score,   setScore]   = useState<Score>({ X: 0, O: 0, draws: 0 })

  // ── Refs for async safety (prevent stale closures in setTimeout) ──────────
  const boardRef      = useRef<Cell[]>(board)
  const currentRef    = useRef<Player>(current)
  const gameEndedRef  = useRef(false)
  const inputLockRef  = useRef(false)
  const cpuActiveRef  = useRef(false)
  const cpuTimerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Always keep refs in sync with state
  boardRef.current   = board
  currentRef.current = current

  // ── Visual state ──────────────────────────────────────────────────────────
  const [cpuThinking, setCpuThinking] = useState(false)
  const [particles,   setParticles]   = useState<Particle[]>([])

  // ── Audio ─────────────────────────────────────────────────────────────────
  const audioRef = useRef<TicTacToeAudio | null>(null)
  useEffect(() => {
    audioRef.current = new TicTacToeAudio()
    return () => { audioRef.current?.dispose(); audioRef.current = null }
  }, [])

  // ── Stats persistence ─────────────────────────────────────────────────────
  const [stats, setStats] = useState<TTTStats>(() => {
    if (typeof window === "undefined") return defaultStats()
    try {
      const s = localStorage.getItem(STATS_KEY)
      return s ? JSON.parse(s) : defaultStats()
    } catch { return defaultStats() }
  })

  const saveStats = useCallback((next: TTTStats) => {
    setStats(next)
    try { localStorage.setItem(STATS_KEY, JSON.stringify(next)) } catch {}
  }, [])

  // ── Core: process a move ──────────────────────────────────────────────────
  const processMove = useCallback((index: number) => {
    if (inputLockRef.current || gameEndedRef.current) return
    if (boardRef.current[index] !== null) return

    inputLockRef.current = true

    const newBoard = [...boardRef.current] as Cell[]
    newBoard[index] = currentRef.current
    const movingPlayer = currentRef.current
    setBoard(newBoard)

    // Play sound
    if (movingPlayer === "X") audioRef.current?.placeX()
    else                       audioRef.current?.placeO()

    // Check result
    const { winner: w, line } = checkWinner(newBoard)
    const draw = !w && checkDraw(newBoard)

    if (w) {
      gameEndedRef.current = true
      // Brief delay so the symbol animation plays before overlay appears
      setTimeout(() => {
        setWinner(w)
        setWinLine(line)
        setPhase("ended")
        setScore(prev => ({ ...prev, [w]: prev[w] + 1 }))
        audioRef.current?.win()

        // Particles
        const color = w === "X" ? X_COLOR : O_COLOR
        setParticles(Array.from({ length: 28 }, (_, i) => ({
          id: i,
          tx: (Math.random() - 0.5) * 320,
          ty: (Math.random() - 0.5) * 320,
          size: 4 + Math.random() * 9,
          color: Math.random() > 0.4 ? color : WIN_COLOR,
          dur: 0.55 + Math.random() * 0.45,
          delay: Math.random() * 0.18,
        })))

        // Update stats
        setStats(prev => {
          const next = { ...prev, gamesPlayed: prev.gamesPlayed + 1 }
          if (w === "X") next.xWins++
          else            next.oWins++
          if (mode === "cpu") {
            const side = w === cpuSymbol ? "losses" : "wins"
            next.cpu = {
              ...prev.cpu,
              [difficulty]: {
                ...prev.cpu[difficulty],
                [side]: prev.cpu[difficulty][side] + 1,
              },
            }
          }
          saveStats(next)
          return next
        })

        inputLockRef.current = false
      }, 120)
      return
    }

    if (draw) {
      gameEndedRef.current = true
      setTimeout(() => {
        setIsDraw(true)
        setPhase("ended")
        setScore(prev => ({ ...prev, draws: prev.draws + 1 }))
        audioRef.current?.draw()

        setStats(prev => {
          const next = {
            ...prev,
            gamesPlayed: prev.gamesPlayed + 1,
            draws: prev.draws + 1,
          }
          if (mode === "cpu") {
            next.cpu = {
              ...prev.cpu,
              [difficulty]: {
                ...prev.cpu[difficulty],
                draws: prev.cpu[difficulty].draws + 1,
              },
            }
          }
          saveStats(next)
          return next
        })

        inputLockRef.current = false
      }, 120)
      return
    }

    // Continue — switch turn
    const nextPlayer: Player = movingPlayer === "X" ? "O" : "X"
    setCurrent(nextPlayer)
    inputLockRef.current = false
  }, [mode, difficulty, cpuSymbol, saveStats])

  // ── CPU turn logic ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "game" || mode !== "cpu") return
    if (current !== cpuSymbol) return
    if (gameEndedRef.current || inputLockRef.current) return
    if (cpuActiveRef.current) return

    cpuActiveRef.current = true
    setCpuThinking(true)
    audioRef.current?.cpuThink()

    const thinkMs = (difficulty === "easy" ? 400 : difficulty === "medium" ? 650 : 900)
      + Math.random() * 280

    cpuTimerRef.current = setTimeout(() => {
      setCpuThinking(false)
      if (!gameEndedRef.current && !inputLockRef.current) {
        const move = getBestMove([...boardRef.current], cpuSymbol, difficulty)
        if (move >= 0) processMove(move)
      }
      cpuActiveRef.current = false
    }, thinkMs)

    return () => {
      clearTimeout(cpuTimerRef.current)
      cpuActiveRef.current = false
      setCpuThinking(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, phase])

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "game") return

    const handleKey = (e: KeyboardEvent) => {
      // Future: numpad/arrow navigation
      if (e.key >= "1" && e.key <= "9") {
        const map: Record<string, number> = {
          "7": 0, "8": 1, "9": 2,
          "4": 3, "5": 4, "6": 5,
          "1": 6, "2": 7, "3": 8,
        }
        const idx = map[e.key]
        if (idx !== undefined) {
          e.preventDefault()
          if (mode === "pvp" || current === playerSym) processMove(idx)
        }
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [phase, mode, current, playerSym, processMove])

  // ── Start / reset ─────────────────────────────────────────────────────────
  const startGame = useCallback((
    m: GameMode, d: Difficulty, sym: Player,
  ) => {
    clearTimeout(cpuTimerRef.current)
    cpuActiveRef.current  = false
    inputLockRef.current  = false
    gameEndedRef.current  = false

    setMode(m)
    setDifficulty(d)
    setPlayerSym(sym)
    setBoard(Array(9).fill(null))
    setCurrent("X")
    setWinner(null)
    setWinLine(null)
    setIsDraw(false)
    setParticles([])
    setCpuThinking(false)
    setPhase("game")

    audioRef.current?.resume()
    audioRef.current?.select()
  }, [])

  const rematch = useCallback(() => {
    clearTimeout(cpuTimerRef.current)
    cpuActiveRef.current  = false
    inputLockRef.current  = false
    gameEndedRef.current  = false

    setBoard(Array(9).fill(null))
    setCurrent("X")
    setWinner(null)
    setWinLine(null)
    setIsDraw(false)
    setParticles([])
    setCpuThinking(false)
    setPhase("game")

    audioRef.current?.select()
  }, [])

  const goMenu = useCallback(() => {
    clearTimeout(cpuTimerRef.current)
    cpuActiveRef.current = false
    inputLockRef.current = false
    gameEndedRef.current = false
    setPhase("menu")
    setScore({ X: 0, O: 0, draws: 0 })
    setCpuThinking(false)
  }, [])

  // ── Determine if board input should be locked ─────────────────────────────
  const boardDisabled =
    phase === "ended" ||
    (mode === "cpu" && current === cpuSymbol) ||
    cpuThinking

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-8 overflow-hidden"
      style={{ background: "linear-gradient(160deg, #030018 0%, #050024 50%, #030018 100%)" }}
    >
      {/* Background grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.045]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,216,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,216,255,0.6) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{
          position: "absolute", top: "15%", left: "10%",
          width: 360, height: 360, borderRadius: "50%",
          background: `radial-gradient(circle, ${X_COLOR}12 0%, transparent 70%)`,
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: "15%", right: "10%",
          width: 320, height: 320, borderRadius: "50%",
          background: `radial-gradient(circle, ${O_COLOR}10 0%, transparent 70%)`,
          filter: "blur(40px)",
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          {phase === "menu" ? (
            <MenuScreen key="menu" onStart={startGame} stats={stats} />
          ) : (
            <motion.div
              key="game"
              className="w-full flex flex-col items-center gap-5"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {/* Header */}
              <div className="w-full flex items-center justify-between">
                <button
                  onClick={goMenu}
                  className="text-[10px] font-bold uppercase tracking-widest text-white/25 hover:text-white/50 transition-colors px-2 py-1"
                >
                  ← Menu
                </button>
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.25em]"
                  style={{ color: "rgba(0,216,255,0.4)" }}
                >
                  {mode === "cpu"
                    ? `vs CPU · ${DIFFICULTY_LABELS[difficulty].label}`
                    : "Local 2P"
                  }
                </div>
                <div className="w-16" />
              </div>

              {/* Score */}
              <div className="w-full px-1">
                <ScorePanel score={score} mode={mode} cpuSymbol={cpuSymbol} />
              </div>

              {/* Turn indicator */}
              <TurnIndicator
                current={current}
                mode={mode}
                cpuSymbol={cpuSymbol}
                cpuThinking={cpuThinking}
                winner={winner}
                isDraw={isDraw}
              />

              {/* Board + result overlay */}
              <div className="relative w-full">
                <GameBoard
                  board={board}
                  winLine={winLine}
                  current={current}
                  disabled={boardDisabled}
                  onMove={processMove}
                />

                <AnimatePresence>
                  {phase === "ended" && (
                    <ResultOverlay
                      winner={winner}
                      isDraw={isDraw}
                      mode={mode}
                      cpuSymbol={cpuSymbol}
                      particles={particles}
                      onRematch={rematch}
                      onMenu={goMenu}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Numpad hint */}
              <p className="text-[9px] uppercase tracking-widest text-white/15 text-center">
                {mode === "pvp"
                  ? "Use numpad 1–9 to place"
                  : `Use numpad 1–9 · ${DIFFICULTY_LABELS[difficulty].label} CPU`
                }
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
