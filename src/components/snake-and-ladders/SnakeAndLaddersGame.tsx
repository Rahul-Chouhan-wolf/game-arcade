"use client"

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Player, GameState, PlayerMode, AILevel, PlayerColor,
  SNAKES, LADDERS, SNAKE_HEADS, LADDER_BASES,
  COLOR_HEX, COLOR_DIM,
  tileToRC, createInitialState, rollDice, calculateMove,
  getMovePath, AI_DELAYS, PLAYER_COLORS,
} from "@/lib/snake-and-ladders/engine"
import { SNLAudio } from "@/lib/snake-and-ladders/audio"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const BOARD_COLS = 10
const STEP_DELAY_MS = 140   // ms per tile step
const SNAKE_DELAY_MS = 1400 // ms before snake slide
const LADDER_DELAY_MS = 900  // ms before ladder ascent
const SETTLE_DELAY_MS = 600  // ms after snake/ladder before next turn

const GLOW: Record<PlayerColor, string> = {
  cyan:    "0 0 18px #22d3ee88, 0 0 36px #22d3ee44",
  rose:    "0 0 18px #fb718588, 0 0 36px #fb718544",
  amber:   "0 0 18px #fbbf2488, 0 0 36px #fbbf2444",
  emerald: "0 0 18px #34d39988, 0 0 36px #34d39944",
}

// ─────────────────────────────────────────────────────────────
// Audio singleton
// ─────────────────────────────────────────────────────────────

const audio = new SNLAudio()

// ─────────────────────────────────────────────────────────────
// Board geometry helpers
// ─────────────────────────────────────────────────────────────

/** px offset of tile centre given cell size */
function tileXY(n: number, cs: number): [number, number] {
  const [r, c] = tileToRC(n)
  return [c * cs + cs / 2, r * cs + cs / 2]
}

/** Offset multiple tokens stacked on same tile */
function tokenOffset(playerIndex: number, total: number, r: number): [number, number] {
  if (total === 1) return [0, 0]
  const angle = ((playerIndex / total) * Math.PI * 2) - Math.PI / 2
  return [Math.cos(angle) * r, Math.sin(angle) * r]
}

// ─────────────────────────────────────────────────────────────
// Particle system (CSS keyframe particles)
// ─────────────────────────────────────────────────────────────

interface Particle { id: number; x: number; y: number; color: string; angle: number; dist: number }

function Particles({ particles }: { particles: Particle[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{ width: 6, height: 6, background: p.color, left: p.x - 3, top: p.y - 3 }}
          initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          animate={{
            opacity: 0, scale: 0,
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist,
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Dice — CSS 3D cube
// ─────────────────────────────────────────────────────────────

const DICE_FACE_ROTATIONS: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0,   ry: 0   },
  2: { rx: -90, ry: 0   },
  3: { rx: 0,   ry: -90 },
  4: { rx: 0,   ry: 90  },
  5: { rx: 90,  ry: 0   },
  6: { rx: 0,   ry: 180 },
}

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
}

function DiceFace({ value, accent }: { value: number; accent: string }) {
  const dots = DICE_DOTS[value] ?? []
  return (
    <div className="w-full h-full relative"
      style={{ background: "linear-gradient(135deg, #1a1a3e 0%, #0e0e28 100%)", borderRadius: 8 }}>
      {dots.map(([x, y], i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            width: 10, height: 10,
            background: accent,
            boxShadow: `0 0 8px ${accent}cc, 0 0 16px ${accent}66`,
            left: `${x}%`, top: `${y}%`,
            transform: "translate(-50%, -50%)",
          }} />
      ))}
    </div>
  )
}

function Dice3D({
  value, rolling, accent,
}: {
  value: number; rolling: boolean; accent: string
}) {
  const sz = 56
  const half = sz / 2
  const faces: Array<{ v: number; transform: string }> = [
    { v: 1, transform: `translateZ(${half}px)` },
    { v: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { v: 4, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { v: 3, transform: `rotateY(90deg) translateZ(${half}px)` },
    { v: 2, transform: `rotateX(-90deg) translateZ(${half}px)` },
    { v: 5, transform: `rotateX(90deg) translateZ(${half}px)` },
  ]

  const settled = DICE_FACE_ROTATIONS[value] ?? { rx: 0, ry: 0 }

  return (
    <div style={{ perspective: 300, width: sz, height: sz }}>
      <motion.div
        style={{ width: sz, height: sz, position: "relative", transformStyle: "preserve-3d" }}
        animate={
          rolling
            ? {
                rotateX: [0, 360, 720, 1080],
                rotateY: [0, 270, 540, 810],
              }
            : {
                rotateX: settled.rx,
                rotateY: settled.ry,
              }
        }
        transition={
          rolling
            ? { duration: 0.9, ease: "easeIn" }
            : { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
        }
      >
        {faces.map(({ v, transform }) => (
          <div
            key={v}
            style={{
              position: "absolute", width: sz, height: sz,
              transform,
              border: `1px solid ${accent}44`,
              boxShadow: `inset 0 0 12px ${accent}22`,
            }}
          >
            <DiceFace value={v} accent={accent} />
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Board SVG overlay — snakes and ladders
// ─────────────────────────────────────────────────────────────

function cubicBezierSnake(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const perp = { x: -dy / len, y: dx / len }
  const curve = len * 0.28
  return `M ${x1} ${y1} C ${mx + perp.x * curve} ${my + perp.y * curve} ${mx - perp.x * curve} ${my - perp.y * curve} ${x2} ${y2}`
}

function BoardOverlay({ cs, activeSnake, activeLadder }: {
  cs: number
  activeSnake: number | null   // snake head tile
  activeLadder: number | null  // ladder base tile
}) {
  const boardPx = cs * BOARD_COLS

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: boardPx, height: boardPx, pointerEvents: "none", overflow: "visible" }}
      viewBox={`0 0 ${boardPx} ${boardPx}`}
    >
      <defs>
        {Object.entries(SNAKES).map(([head, tail]) => {
          const id = `sg-${head}`
          const isActive = activeSnake === Number(head)
          return (
            <linearGradient key={id} id={id} gradientUnits="userSpaceOnUse"
              x1={tileXY(Number(head), cs)[0]} y1={tileXY(Number(head), cs)[1]}
              x2={tileXY(tail, cs)[0]} y2={tileXY(tail, cs)[1]}
            >
              <stop offset="0%" stopColor={isActive ? "#ff4500" : "#ef4444"} stopOpacity="1" />
              <stop offset="50%" stopColor={isActive ? "#ff6b00" : "#f97316"} stopOpacity="0.9" />
              <stop offset="100%" stopColor={isActive ? "#ffd700" : "#fbbf24"} stopOpacity="0.8" />
            </linearGradient>
          )
        })}
        {Object.entries(LADDERS).map(([base, top]) => {
          const id = `lg-${base}`
          const isActive = activeLadder === Number(base)
          return (
            <linearGradient key={id} id={id} gradientUnits="userSpaceOnUse"
              x1={tileXY(Number(base), cs)[0]} y1={tileXY(Number(base), cs)[1]}
              x2={tileXY(top, cs)[0]} y2={tileXY(top, cs)[1]}
            >
              <stop offset="0%" stopColor={isActive ? "#fde047" : "#fbbf24"} stopOpacity="1" />
              <stop offset="100%" stopColor={isActive ? "#86efac" : "#4ade80"} stopOpacity="0.9" />
            </linearGradient>
          )
        })}
        <filter id="snake-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="snake-glow-active">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ladder-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Ladders ── */}
      {Object.entries(LADDERS).map(([base, top]) => {
        const bNum = Number(base)
        const isActive = activeLadder === bNum
        const [bx, by] = tileXY(bNum, cs)
        const [tx, ty] = tileXY(top, cs)
        const dx = tx - bx, dy = ty - by
        const len = Math.sqrt(dx * dx + dy * dy)
        const nx = -dy / len * (cs * 0.14)
        const ny = dx / len * (cs * 0.14)
        const rungCount = Math.max(3, Math.floor(len / (cs * 0.55)))
        const gradId = `lg-${base}`
        const filter = "url(#ladder-glow)"
        const opacity = isActive ? 1 : 0.7
        const strokeW = isActive ? cs * 0.07 : cs * 0.055

        return (
          <g key={`ladder-${base}`} opacity={opacity} filter={filter}>
            {/* Rails */}
            <line x1={bx - nx} y1={by - ny} x2={tx - nx} y2={ty - ny}
              stroke={`url(#${gradId})`} strokeWidth={strokeW} strokeLinecap="round" />
            <line x1={bx + nx} y1={by + ny} x2={tx + nx} y2={ty + ny}
              stroke={`url(#${gradId})`} strokeWidth={strokeW} strokeLinecap="round" />
            {/* Rungs */}
            {Array.from({ length: rungCount }, (_, i) => {
              const t = (i + 1) / (rungCount + 1)
              const rx = bx + dx * t, ry = by + dy * t
              return (
                <line key={i}
                  x1={rx - nx} y1={ry - ny} x2={rx + nx} y2={ry + ny}
                  stroke={`url(#${gradId})`} strokeWidth={strokeW * 0.75} strokeLinecap="round" />
              )
            })}
            {/* Base circle */}
            <circle cx={bx} cy={by} r={cs * 0.18}
              fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeW * 0.6} opacity={0.6} />
            {/* Top star */}
            <circle cx={tx} cy={ty} r={cs * 0.15}
              fill={isActive ? "#fde04788" : "#fbbf2455"} stroke={`url(#${gradId})`} strokeWidth={strokeW * 0.5} />
          </g>
        )
      })}

      {/* ── Snakes ── */}
      {Object.entries(SNAKES).map(([head, tail]) => {
        const hNum = Number(head)
        const isActive = activeSnake === hNum
        const [hx, hy] = tileXY(hNum, cs)
        const [tx, ty] = tileXY(tail, cs)
        const path = cubicBezierSnake(hx, hy, tx, ty)
        const gradId = `sg-${head}`
        const snakeWidth = isActive ? cs * 0.22 : cs * 0.16
        const filter = isActive ? "url(#snake-glow-active)" : "url(#snake-glow)"
        const opacity = isActive ? 1 : 0.65

        return (
          <g key={`snake-${head}`} opacity={opacity} filter={filter}>
            {/* Body shadow */}
            <path d={path} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={snakeWidth + 2} strokeLinecap="round" />
            {/* Main body */}
            <path d={path} fill="none" stroke={`url(#${gradId})`} strokeWidth={snakeWidth} strokeLinecap="round" />
            {/* Scale pattern — dashed overlay */}
            <path d={path} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={snakeWidth * 0.3}
              strokeDasharray={`${cs * 0.12} ${cs * 0.1}`} strokeLinecap="round" />
            {/* Head */}
            <circle cx={hx} cy={hy} r={cs * 0.2}
              fill="#ef4444" stroke="#fca5a5" strokeWidth={isActive ? 2 : 1} />
            <circle cx={hx - cs * 0.06} cy={hy - cs * 0.06} r={cs * 0.055} fill="white" />
            <circle cx={hx + cs * 0.06} cy={hy - cs * 0.06} r={cs * 0.055} fill="white" />
            <circle cx={hx - cs * 0.06} cy={hy - cs * 0.06} r={cs * 0.03} fill="#111" />
            <circle cx={hx + cs * 0.06} cy={hy - cs * 0.06} r={cs * 0.03} fill="#111" />
            {/* Tail tip */}
            <circle cx={tx} cy={ty} r={cs * 0.1} fill="#fbbf24" opacity={0.7} />
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Board cells
// ─────────────────────────────────────────────────────────────

const ZONE_COLORS = [
  // rows 9..8 (tiles 1..20) — ocean teal
  ["rgba(6,50,70,0.88)",  "rgba(4,40,56,0.88)"],
  ["rgba(6,50,70,0.88)",  "rgba(4,40,56,0.88)"],
  // rows 7..6 (tiles 21..40) — forest
  ["rgba(6,46,24,0.88)",  "rgba(4,36,18,0.88)"],
  ["rgba(6,46,24,0.88)",  "rgba(4,36,18,0.88)"],
  // rows 5..4 (tiles 41..60) — amber
  ["rgba(56,36,4,0.88)",  "rgba(46,28,2,0.88)"],
  ["rgba(56,36,4,0.88)",  "rgba(46,28,2,0.88)"],
  // rows 3..2 (tiles 61..80) — rose/crimson
  ["rgba(56,6,18,0.88)",  "rgba(46,4,14,0.88)"],
  ["rgba(56,6,18,0.88)",  "rgba(4,4,14,0.88)"],
  // rows 1..0 (tiles 81..100) — royal purple
  ["rgba(38,6,70,0.88)",  "rgba(28,4,56,0.88)"],
  ["rgba(38,6,70,0.88)",  "rgba(28,4,56,0.88)"],
]

function cellBg(tile: number): string {
  const row = Math.floor((tile - 1) / 10)          // 0 = bottom
  const screenRow = 9 - row                         // 0 = top
  const col = (tile - 1) % 10
  const pair = ZONE_COLORS[screenRow] ?? ZONE_COLORS[0]
  return pair[(screenRow + col) % 2]
}

function cellBorder(tile: number): string {
  if (tile === 100) return "2px solid #a855f7"
  if (tile === 1)   return "1px solid rgba(255,255,255,0.2)"
  if (SNAKE_HEADS.has(tile)) return "1px solid rgba(239,68,68,0.45)"
  if (LADDER_BASES.has(tile)) return "1px solid rgba(251,191,36,0.45)"
  return "1px solid rgba(255,255,255,0.06)"
}

function cellGlow(tile: number): string {
  if (tile === 100) return "inset 0 0 18px rgba(168,85,247,0.4), inset 0 0 8px rgba(168,85,247,0.25)"
  if (SNAKE_HEADS.has(tile))  return "inset 0 0 10px rgba(239,68,68,0.25)"
  if (LADDER_BASES.has(tile)) return "inset 0 0 10px rgba(251,191,36,0.25)"
  return "none"
}

interface BoardCellsProps {
  cs: number
  occupiedByPlayer: Record<number, PlayerColor[]>
}

function BoardCells({ cs, occupiedByPlayer }: BoardCellsProps) {
  const cells = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => i + 1)
  }, [])

  return (
    <>
      {cells.map(tile => {
        const [r, c] = tileToRC(tile)
        const hasToken = (occupiedByPlayer[tile]?.length ?? 0) > 0
        return (
          <div key={tile}
            style={{
              position: "absolute",
              left: c * cs, top: r * cs,
              width: cs, height: cs,
              background: cellBg(tile),
              border: cellBorder(tile),
              boxShadow: cellGlow(tile),
              boxSizing: "border-box",
            }}
          >
            {/* Tile number */}
            <span style={{
              position: "absolute", right: 3, top: 2,
              fontSize: Math.max(7, cs * 0.18), fontWeight: 600,
              color: tile === 100 ? "#d8b4fe" : "rgba(255,255,255,0.28)",
              userSelect: "none", lineHeight: 1,
            }}>
              {tile}
            </span>

            {/* Active token glow pulse */}
            {hasToken && (
              <motion.div
                animate={{ opacity: [0.15, 0.4, 0.15] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(circle at center, ${COLOR_HEX[occupiedByPlayer[tile][0]]}44, transparent 70%)`,
                }}
              />
            )}

            {/* Special cell labels */}
            {tile === 100 && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <motion.span
                  animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ fontSize: cs * 0.32, filter: "drop-shadow(0 0 8px #a855f7)" }}
                >
                  ★
                </motion.span>
              </div>
            )}
            {tile === 1 && (
              <div style={{
                position: "absolute", bottom: 2, left: 0, right: 0,
                textAlign: "center",
                fontSize: Math.max(6, cs * 0.14), color: "rgba(255,255,255,0.35)",
                userSelect: "none",
              }}>
                START
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Token
// ─────────────────────────────────────────────────────────────

interface TokenProps {
  player: Player
  visualPosition: number  // 0 = pre-board, shown off to side
  cs: number
  isMoving: boolean
  offsetIndex: number
  offsetTotal: number
  isCurrentPlayer: boolean
}

function Token({ player, visualPosition, cs, isMoving, offsetIndex, offsetTotal, isCurrentPlayer }: TokenProps) {
  const hex = COLOR_HEX[player.color]
  const r = Math.max(9, cs * 0.21)
  const offR = cs * 0.22
  const [offX, offY] = tokenOffset(offsetIndex, offsetTotal, offR)

  let cx: number, cy: number
  if (visualPosition === 0) {
    // Pre-board — park off to the side
    cx = -cs * 2.2 + player.id * cs * 1.1
    cy = cs * (9 - player.id * 0.5) + cs / 2
  } else {
    const [row, col] = tileToRC(visualPosition)
    cx = col * cs + cs / 2 + offX
    cy = row * cs + cs / 2 + offY
  }

  return (
    <motion.div
      layoutId={`token-${player.id}`}
      animate={{ x: cx - r, y: cy - r }}
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 28,
        mass: 0.8,
      }}
      style={{
        position: "absolute",
        width: r * 2, height: r * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, ${hex}, ${COLOR_DIM[player.color]})`,
        border: `2px solid ${hex}`,
        boxShadow: isCurrentPlayer ? GLOW[player.color] : `0 0 8px ${hex}44`,
        zIndex: isMoving ? 30 : (isCurrentPlayer ? 20 : 10),
      }}
    >
      {/* Inner gem highlight */}
      <div style={{
        position: "absolute",
        width: r * 0.45, height: r * 0.45,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.45)",
        top: r * 0.15, left: r * 0.15,
      }} />
      {/* Idle float animation for current player */}
      {isCurrentPlayer && !isMoving && (
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: 0, borderRadius: "50%" }}
        />
      )}
      {/* Moving trail ring */}
      {isMoving && (
        <motion.div
          animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
          transition={{ duration: 0.4, repeat: Infinity }}
          style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: `2px solid ${hex}`,
          }}
        />
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Event overlay (snake / ladder announcement)
// ─────────────────────────────────────────────────────────────

function EventOverlay({ event, playerColor }: {
  event: "snake" | "ladder" | null
  playerColor: PlayerColor
}) {
  const hex = COLOR_HEX[playerColor]
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 320, damping: 25 }}
          style={{
            position: "fixed", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, pointerEvents: "none",
          }}
        >
          <div style={{
            background: event === "snake"
              ? "linear-gradient(135deg, rgba(30,4,4,0.92) 0%, rgba(20,2,2,0.96) 100%)"
              : "linear-gradient(135deg, rgba(20,30,4,0.92) 0%, rgba(10,20,2,0.96) 100%)",
            border: `1px solid ${event === "snake" ? "#ef444455" : "#fbbf2455"}`,
            backdropFilter: "blur(24px)",
            borderRadius: 24,
            padding: "28px 44px",
            textAlign: "center",
            boxShadow: event === "snake"
              ? "0 0 60px rgba(239,68,68,0.4), 0 8px 32px rgba(0,0,0,0.6)"
              : "0 0 60px rgba(251,191,36,0.4), 0 8px 32px rgba(0,0,0,0.6)",
          }}>
            <motion.div
              animate={{ scale: [1, 1.12, 1], rotate: event === "snake" ? [0, -5, 5, 0] : [0, 3, -3, 0] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              style={{ fontSize: 52, marginBottom: 8 }}
            >
              {event === "snake" ? "🐍" : "🪜"}
            </motion.div>
            <div style={{
              fontSize: 22, fontWeight: 800, letterSpacing: "0.05em",
              color: event === "snake" ? "#fca5a5" : "#fde047",
            }}>
              {event === "snake" ? "SNAKE!" : "LADDER!"}
            </div>
            <div style={{
              fontSize: 13, color: "rgba(255,255,255,0.5)",
              marginTop: 6,
            }}>
              {event === "snake" ? "Watch out — sliding down!" : "Lucky! Climbing up!"}
            </div>
            {/* Player color indicator */}
            <div style={{
              marginTop: 12,
              width: 32, height: 4, borderRadius: 2,
              background: hex,
              margin: "12px auto 0",
              boxShadow: `0 0 12px ${hex}`,
            }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────
// Victory screen
// ─────────────────────────────────────────────────────────────

function VictoryScreen({ winner, onPlayAgain, onSetup }: {
  winner: Player
  onPlayAgain: () => void
  onSetup: () => void
}) {
  const hex = COLOR_HEX[winner.color]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, backdropFilter: "blur(12px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.7, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
        style={{
          background: "linear-gradient(160deg, rgba(12,8,28,0.97) 0%, rgba(6,4,18,0.99) 100%)",
          border: `1px solid ${hex}44`,
          borderRadius: 28,
          padding: "44px 52px",
          textAlign: "center",
          maxWidth: 380,
          boxShadow: `0 0 80px ${hex}33, 0 0 160px ${hex}18, 0 24px 64px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Crown */}
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: 72, marginBottom: 8 }}
        >
          👑
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div style={{ fontSize: 13, letterSpacing: "0.28em", color: "rgba(255,255,255,0.38)", textTransform: "uppercase", marginBottom: 8 }}>
            Winner
          </div>
          <div style={{
            fontSize: 32, fontWeight: 900,
            background: `linear-gradient(90deg, ${hex}, white, ${hex})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 6,
          }}>
            {winner.name}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 36 }}>
            Reached 100 — Victory!
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${hex}44, transparent)`, marginBottom: 28 }} />

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={onPlayAgain}
              style={{
                background: `linear-gradient(135deg, ${hex}cc, ${hex}88)`,
                color: "#000", fontWeight: 800, fontSize: 13,
                letterSpacing: "0.14em", textTransform: "uppercase",
                border: "none", borderRadius: 40, padding: "12px 28px",
                cursor: "pointer", boxShadow: `0 4px 18px ${hex}55`,
              }}
            >
              Play Again
            </button>
            <button
              onClick={onSetup}
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: 13,
                letterSpacing: "0.12em", textTransform: "uppercase",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 40, padding: "12px 24px",
                cursor: "pointer",
              }}
            >
              New Game
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Confetti particles */}
      <ConfettiEffect color={hex} />
    </motion.div>
  )
}

function ConfettiEffect({ color }: { color: string }) {
  const particles = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 400),
      y: -20,
      color: [color, "#ffffff", "#a855f7", "#22d3ee"][i % 4],
      vx: (Math.random() - 0.5) * 300,
      vy: 200 + Math.random() * 300,
      size: 4 + Math.random() * 8,
      delay: Math.random() * 0.8,
    })), [color])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 201 }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            width: p.size, height: p.size * 0.5,
            background: p.color,
            borderRadius: 2,
            left: p.x, top: p.y,
          }}
          initial={{ y: p.y, x: 0, opacity: 1, rotate: 0 }}
          animate={{
            y: p.y + p.vy,
            x: p.vx,
            opacity: [1, 1, 0],
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1) * 3,
          }}
          transition={{ duration: 2.5 + Math.random(), delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Setup screen
// ─────────────────────────────────────────────────────────────

interface SetupConfig {
  numPlayers: number
  modes: PlayerMode[]
  aiLevels: AILevel[]
  requireExactRoll: boolean
}

function SetupScreen({ onStart }: { onStart: (cfg: SetupConfig) => void }) {
  const [numPlayers, setNumPlayers] = useState(2)
  const [modes, setModes] = useState<PlayerMode[]>(["human", "cpu", "cpu", "cpu"])
  const [aiLevels, setAiLevels] = useState<AILevel[]>(["medium", "medium", "medium", "medium"])
  const [exactRoll, setExactRoll] = useState(true)

  const setMode = (i: number, m: PlayerMode) => {
    const n = [...modes]; n[i] = m; setModes(n)
  }
  const setAiLevel = (i: number, l: AILevel) => {
    const n = [...aiLevels]; n[i] = l; setAiLevels(n)
  }

  const COLOR_LABELS: Record<PlayerColor, string> = {
    cyan: "Cyan", rose: "Rose", amber: "Amber", emerald: "Emerald",
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "#04041a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      {/* Ambient background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(88,28,135,0.18) 0%, transparent 70%)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 40% 40% at 20% 80%, rgba(6,182,212,0.08) 0%, transparent 60%)",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        style={{
          width: "100%", maxWidth: 440,
          background: "rgba(8,8,26,0.92)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24, padding: "36px 32px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(88,28,135,0.12)",
          position: "relative", zIndex: 1,
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 }}>
            Arcade · Board Game
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #a855f7 0%, #22d3ee 60%, #4ade80 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 4,
          }}>
            Snake & Ladders
          </h1>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            Choose your rivals and begin
          </div>
        </div>

        {/* Player count */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
            Players
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => setNumPlayers(n)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid",
                  borderColor: numPlayers === n ? "#a855f7" : "rgba(255,255,255,0.1)",
                  background: numPlayers === n ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.03)",
                  color: numPlayers === n ? "#d8b4fe" : "rgba(255,255,255,0.4)",
                  fontWeight: 700, fontSize: 15, cursor: "pointer",
                  boxShadow: numPlayers === n ? "0 0 16px rgba(168,85,247,0.25)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {n}P
              </button>
            ))}
          </div>
        </div>

        {/* Player config */}
        <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: numPlayers }, (_, i) => {
            const col = PLAYER_COLORS[i]
            const hex = COLOR_HEX[col]
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${hex}22`,
                borderRadius: 12, padding: "10px 14px",
              }}>
                {/* Color dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: hex, boxShadow: `0 0 8px ${hex}`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", flex: 1 }}>
                  {COLOR_LABELS[col]}
                </span>
                {/* Mode toggle */}
                <div style={{ display: "flex", gap: 4 }}>
                  {(["human", "cpu"] as PlayerMode[]).map(m => (
                    <button key={m} onClick={() => setMode(i, m)}
                      style={{
                        padding: "4px 12px", borderRadius: 8, border: "1px solid",
                        borderColor: modes[i] === m ? hex : "rgba(255,255,255,0.1)",
                        background: modes[i] === m ? `${hex}22` : "transparent",
                        color: modes[i] === m ? hex : "rgba(255,255,255,0.3)",
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                        textTransform: "uppercase", cursor: "pointer", transition: "all 0.12s",
                      }}
                    >
                      {m === "human" ? "Human" : "CPU"}
                    </button>
                  ))}
                  {/* AI level (shown for CPU) */}
                  {modes[i] === "cpu" && (
                    <select
                      value={aiLevels[i]}
                      onChange={e => setAiLevel(i, e.target.value as AILevel)}
                      style={{
                        background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.55)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                        padding: "4px 8px", fontSize: 10, cursor: "pointer",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Med</option>
                      <option value="hard">Hard</option>
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Rules */}
        <div style={{ marginBottom: 28 }}>
          <button onClick={() => setExactRoll(!exactRoll)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "10px 14px", cursor: "pointer",
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              background: exactRoll ? "rgba(168,85,247,0.8)" : "rgba(255,255,255,0.08)",
              border: `1.5px solid ${exactRoll ? "#a855f7" : "rgba(255,255,255,0.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.15s",
            }}>
              {exactRoll && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "left" }}>
                Exact roll to win
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "left" }}>
                Must land exactly on 100
              </div>
            </div>
          </button>
        </div>

        {/* Start button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            audio.click()
            onStart({ numPlayers, modes, aiLevels, requireExactRoll: exactRoll })
          }}
          style={{
            width: "100%", padding: "15px", borderRadius: 16, border: "none",
            background: "linear-gradient(135deg, #7c3aed, #a855f7, #22d3ee)",
            color: "white", fontWeight: 800, fontSize: 15,
            letterSpacing: "0.14em", textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(168,85,247,0.45), 0 0 0 1px rgba(168,85,247,0.3)",
          }}
        >
          Start Game
        </motion.button>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// HUD
// ─────────────────────────────────────────────────────────────

function PlayerHUD({ state, onRoll, onToggleAudio, audioOn, visualPositions }: {
  state: GameState
  onRoll: () => void
  onToggleAudio: () => void
  audioOn: boolean
  visualPositions: number[]
}) {
  const { players, currentIndex, phase, diceValue } = state
  const currentPlayer = players[currentIndex]
  const hex = COLOR_HEX[currentPlayer.color]
  const canRoll = phase === "playing" && currentPlayer.mode === "human"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      {/* Current turn header */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        style={{
          background: "rgba(8,8,26,0.88)",
          border: `1px solid ${hex}33`,
          borderRadius: 16, padding: "14px 18px",
          backdropFilter: "blur(16px)",
          boxShadow: `0 0 24px ${hex}22`,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.24em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 6 }}>
          Turn {state.turnCount + 1}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <motion.div
            animate={{ boxShadow: [`0 0 8px ${hex}66`, `0 0 20px ${hex}aa`, `0 0 8px ${hex}66`] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              width: 12, height: 12, borderRadius: "50%",
              background: hex, flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 800, color: "white" }}>
            {currentPlayer.name}
          </span>
          {currentPlayer.mode === "cpu" && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: hex,
              background: `${hex}1a`, border: `1px solid ${hex}33`,
              borderRadius: 6, padding: "2px 6px", textTransform: "uppercase",
            }}>
              CPU
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
          {phase === "rolling" ? "Rolling…"
            : phase === "moving" ? "Moving…"
            : phase === "snake" ? "Snake! Sliding down…"
            : phase === "ladder" ? "Ladder! Climbing up!"
            : visualPositions[currentIndex] === 0 ? "Ready to enter the board"
            : `Tile ${visualPositions[currentIndex]}`}
        </div>
      </motion.div>

      {/* Dice + Roll button */}
      <div style={{
        background: "rgba(8,8,26,0.88)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "16px 18px",
        backdropFilter: "blur(16px)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}>
        <Dice3D
          value={diceValue ?? 1}
          rolling={phase === "rolling"}
          accent={hex}
        />
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onRoll}
          disabled={!canRoll}
          style={{
            width: "100%", padding: "11px", borderRadius: 12, border: "none",
            background: canRoll
              ? `linear-gradient(135deg, ${hex}cc, ${hex}88)`
              : "rgba(255,255,255,0.06)",
            color: canRoll ? "#000" : "rgba(255,255,255,0.25)",
            fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
            textTransform: "uppercase", cursor: canRoll ? "pointer" : "default",
            boxShadow: canRoll ? `0 4px 16px ${hex}44` : "none",
            transition: "all 0.18s",
          }}
        >
          {phase === "rolling" ? "…" : phase === "playing" && currentPlayer.mode === "cpu" ? "CPU Turn" : "Roll Dice"}
        </motion.button>
      </div>

      {/* Player scoreboard */}
      <div style={{
        background: "rgba(8,8,26,0.88)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "14px 16px",
        backdropFilter: "blur(16px)",
      }}>
        <div style={{ fontSize: 10, letterSpacing: "0.24em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 10 }}>
          Players
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {players.map((p, i) => {
            const ph = COLOR_HEX[p.color]
            const pos = visualPositions[i]
            const isActive = i === currentIndex
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                opacity: isActive ? 1 : 0.6,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: ph,
                  boxShadow: isActive ? `0 0 8px ${ph}` : "none",
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 400, color: "rgba(255,255,255,0.8)", flex: 1 }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                  {pos === 0 ? "Start" : `${pos}`}
                </span>
                {/* Progress bar */}
                <div style={{
                  width: 40, height: 3, borderRadius: 2,
                  background: "rgba(255,255,255,0.08)",
                  position: "relative", overflow: "hidden",
                }}>
                  <motion.div
                    animate={{ width: `${pos}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    style={{
                      position: "absolute", left: 0, top: 0, height: "100%",
                      background: ph, borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Audio toggle */}
      <button
        onClick={onToggleAudio}
        style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10, padding: "8px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 600,
        }}
      >
        {audioOn ? "🔊" : "🔇"} {audioOn ? "Sound On" : "Sound Off"}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Starfield background (canvas)
// ─────────────────────────────────────────────────────────────

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf: number
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.2,
      a: 0.2 + Math.random() * 0.6,
      speed: 0.0002 + Math.random() * 0.0004,
      phase: Math.random() * Math.PI * 2,
    }))

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const draw = (t: number) => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      stars.forEach(s => {
        const opacity = s.a * (0.6 + 0.4 * Math.sin(t * s.speed * 1000 + s.phase))
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${opacity})`
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// Main game orchestrator
// ─────────────────────────────────────────────────────────────

export function SnakeAndLaddersGame() {
  const [screen, setScreen] = useState<"setup" | "game">("setup")
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [visualPositions, setVisualPositions] = useState<number[]>([0, 0, 0, 0])
  const [activeEvent, setActiveEvent] = useState<"snake" | "ladder" | null>(null)
  const [activeSnakeTile, setActiveSnakeTile] = useState<number | null>(null)
  const [activeLadderTile, setActiveLadderTile] = useState<number | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [audioOn, setAudioOn] = useState(true)
  const [boardSize, setBoardSize] = useState(480)

  const phaseRef = useRef<string>("setup")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const nextParticleId = useRef(0)
  const configRef = useRef<SetupConfig | null>(null)

  // ── Responsive board size ──
  useEffect(() => {
    const calc = () => {
      const pad = 32 + 200  // side panel approx
      const maxBoard = Math.min(
        window.innerWidth - pad,
        window.innerHeight - 80,
        520,
      )
      setBoardSize(Math.max(280, maxBoard))
    }
    calc()
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [])

  const cs = boardSize / BOARD_COLS

  // ── Cleanup timers ──
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
  }, [])

  // ── Emit particles ──
  const emitParticles = useCallback((tile: number, colors: string[]) => {
    const [x, y] = tileXY(tile, cs)
    const newP: Particle[] = Array.from({ length: 12 }, (_, i) => ({
      id: nextParticleId.current++,
      x, y,
      color: colors[i % colors.length],
      angle: (i / 12) * Math.PI * 2,
      dist: 30 + Math.random() * 50,
    }))
    setParticles(prev => [...prev, ...newP])
    later(() => setParticles(prev => prev.filter(p => !newP.find(q => q.id === p.id))), 900)
  }, [cs, later])

  // ── Audio toggle ──
  useEffect(() => { audio.setEnabled(audioOn) }, [audioOn])

  // ── Compute occupancy map ──
  const occupiedByPlayer = useMemo<Record<number, PlayerColor[]>>(() => {
    const map: Record<number, PlayerColor[]> = {}
    visualPositions.forEach((pos, i) => {
      if (pos === 0 || !gameState) return
      const col = gameState.players[i].color
      if (!map[pos]) map[pos] = []
      map[pos].push(col)
    })
    return map
  }, [visualPositions, gameState])

  // ── Advance turn to next player ──
  const advanceTurn = useCallback((state: GameState) => {
    const next = (state.currentIndex + 1) % state.numPlayers
    const newState: GameState = {
      ...state,
      currentIndex: next,
      phase: "playing",
      diceValue: null,
      eventFrom: 0, eventTo: 0,
      turnCount: state.turnCount + 1,
    }
    setGameState(newState)
    phaseRef.current = "playing"
    setActiveEvent(null)
    setActiveSnakeTile(null)
    setActiveLadderTile(null)
    return newState
  }, [])

  // ── Trigger AI roll after delay ──
  const scheduleAIRoll = useCallback((state: GameState) => {
    const player = state.players[state.currentIndex]
    if (player.mode !== "cpu" || state.phase !== "playing") return
    const delay = AI_DELAYS[player.aiLevel]
    later(() => {
      if (phaseRef.current === "playing") {
        doRoll(state)
      }
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [later])

  // ── Execute a roll ──
  const doRoll = useCallback((state: GameState) => {
    if (phaseRef.current !== "playing") return
    audio.diceRoll()
    phaseRef.current = "rolling"
    const rolledValue = rollDice()

    const rollingState: GameState = { ...state, phase: "rolling", diceValue: rolledValue }
    setGameState(rollingState)
    phaseRef.current = "rolling"

    later(() => {
      audio.diceLand(rolledValue)
      const currentPlayer = state.players[state.currentIndex]
      const fromPos = currentPlayer.position
      const result = calculateMove(fromPos, rolledValue, state.requireExactRoll)

      if (result.blocked) {
        audio.blocked()
        const blockedState: GameState = {
          ...rollingState,
          phase: "playing",
          movingFrom: fromPos,
          movingTo: fromPos,
        }
        setGameState(blockedState)
        phaseRef.current = "playing"
        later(() => {
          const nextState = advanceTurn(blockedState)
          scheduleAIRoll(nextState)
        }, 900)
        return
      }

      // Animate movement step-by-step
      const path = getMovePath(fromPos, result.newPosition)
      phaseRef.current = "moving"
      const movingState: GameState = {
        ...rollingState,
        phase: "moving",
        movingFrom: fromPos,
        movingTo: result.newPosition,
      }
      setGameState(movingState)

      let step = 0
      const animateStep = () => {
        if (step < path.length) {
          audio.tokenStep()
          const stepPos = path[step]
          setVisualPositions(prev => {
            const n = [...prev]
            n[state.currentIndex] = stepPos
            return n
          })
          step++
          later(animateStep, STEP_DELAY_MS)
        } else {
          // Movement complete — check for win
          if (result.won) {
            const wonState: GameState = {
              ...movingState,
              phase: "won",
              winnerIndex: state.currentIndex,
            }
            // Update player position
            wonState.players = wonState.players.map((p, i) =>
              i === state.currentIndex ? { ...p, position: 100 } : p
            )
            setGameState(wonState)
            phaseRef.current = "won"
            emitParticles(100, ["#a855f7", "#22d3ee", "#fbbf24", "#fff"])
            later(() => audio.victory(), 200)
            return
          }

          // Update real position
          const updatedPlayers = movingState.players.map((p, i) =>
            i === state.currentIndex ? { ...p, position: result.newPosition } : p
          )

          if (result.snakeEncountered) {
            const snakeState: GameState = {
              ...movingState,
              phase: "snake",
              eventFrom: result.newPosition,
              eventTo: result.finalPosition,
              players: updatedPlayers,
            }
            setGameState(snakeState)
            phaseRef.current = "snake"
            setActiveSnakeTile(result.newPosition)
            setActiveEvent("snake")
            emitParticles(result.newPosition, ["#ef4444", "#f97316", "#dc2626"])
            audio.snakeHiss()

            later(() => {
              audio.snakeSlide()
              setActiveEvent(null)
              setActiveSnakeTile(null)
              setVisualPositions(prev => {
                const n = [...prev]
                n[state.currentIndex] = result.finalPosition
                return n
              })
              // Update player position
              const finalPlayers = snakeState.players.map((p, i) =>
                i === state.currentIndex ? { ...p, position: result.finalPosition } : p
              )
              const postSnake: GameState = { ...snakeState, players: finalPlayers }
              setGameState(postSnake)

              later(() => {
                const nextState = advanceTurn(postSnake)
                scheduleAIRoll(nextState)
              }, SETTLE_DELAY_MS)
            }, SNAKE_DELAY_MS)

          } else if (result.ladderEncountered) {
            const ladderState: GameState = {
              ...movingState,
              phase: "ladder",
              eventFrom: result.newPosition,
              eventTo: result.finalPosition,
              players: updatedPlayers,
            }
            setGameState(ladderState)
            phaseRef.current = "ladder"
            setActiveLadderTile(result.newPosition)
            setActiveEvent("ladder")
            emitParticles(result.newPosition, ["#fbbf24", "#4ade80", "#fde047"])
            audio.ladderChime()

            later(() => {
              audio.ladderAscend()
              setActiveEvent(null)
              setActiveLadderTile(null)
              setVisualPositions(prev => {
                const n = [...prev]
                n[state.currentIndex] = result.finalPosition
                return n
              })
              const finalPlayers = ladderState.players.map((p, i) =>
                i === state.currentIndex ? { ...p, position: result.finalPosition } : p
              )
              const postLadder: GameState = { ...ladderState, players: finalPlayers }
              setGameState(postLadder)

              later(() => {
                const nextState = advanceTurn(postLadder)
                scheduleAIRoll(nextState)
              }, SETTLE_DELAY_MS)
            }, LADDER_DELAY_MS)

          } else {
            // Normal move — advance turn
            const normalState: GameState = {
              ...movingState,
              phase: "playing",
              players: updatedPlayers,
            }
            setGameState(normalState)
            phaseRef.current = "playing"
            emitParticles(result.newPosition, [COLOR_HEX[state.players[state.currentIndex].color]])

            later(() => {
              audio.turnEnd()
              const nextState = advanceTurn(normalState)
              scheduleAIRoll(nextState)
            }, 500)
          }
        }
      }
      animateStep()
    }, 950)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [later, advanceTurn, emitParticles, scheduleAIRoll])

  // ── Handle human roll ──
  const handleRoll = useCallback(() => {
    if (!gameState) return
    if (gameState.phase !== "playing") return
    if (gameState.players[gameState.currentIndex].mode !== "human") return
    doRoll(gameState)
  }, [gameState, doRoll])

  // ── Start game ──
  const handleStart = useCallback((cfg: SetupConfig) => {
    clearTimers()
    configRef.current = cfg
    const state = createInitialState(cfg.numPlayers, cfg.modes, cfg.aiLevels, cfg.requireExactRoll)
    setGameState(state)
    setVisualPositions(Array(cfg.numPlayers).fill(0))
    setActiveEvent(null)
    setActiveSnakeTile(null)
    setActiveLadderTile(null)
    setParticles([])
    phaseRef.current = "playing"
    setScreen("game")

    // Kick off first CPU turn if needed
    later(() => scheduleAIRoll(state), 600)
  }, [clearTimers, later, scheduleAIRoll])

  // ── Play again ──
  const handlePlayAgain = useCallback(() => {
    if (!configRef.current) return
    handleStart(configRef.current)
  }, [handleStart])

  // ── Cleanup on unmount ──
  useEffect(() => () => { clearTimers(); audio.dispose() }, [clearTimers])

  // ── Schedule AI on initial game load ──
  useEffect(() => {
    if (screen !== "game" || !gameState) return
    if (gameState.phase === "playing" && gameState.players[gameState.currentIndex].mode === "cpu") {
      scheduleAIRoll(gameState)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  if (screen === "setup") {
    return <SetupScreen onStart={handleStart} />
  }

  if (!gameState) return null

  const winner = gameState.winnerIndex !== null ? gameState.players[gameState.winnerIndex] : null

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(180deg, #02020e 0%, #04041a 40%, #060620 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background */}
      <StarField />

      {/* Ambient glow orbs */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 50% 40% at 50% 100%, rgba(88,28,135,0.12) 0%, transparent 70%)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 30% 30% at 10% 50%, rgba(6,182,212,0.06) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 30% 30% at 90% 30%, rgba(251,191,36,0.06) 0%, transparent 60%)",
      }} />

      {/* Main layout */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", gap: 20, alignItems: "flex-start",
        maxWidth: "100%",
      }}>
        {/* Board container */}
        <div style={{
          position: "relative",
          flexShrink: 0,
        }}>
          {/* Board glow */}
          <div style={{
            position: "absolute",
            inset: -8,
            borderRadius: 20,
            background: "transparent",
            boxShadow: "0 0 60px rgba(88,28,135,0.25), 0 0 120px rgba(88,28,135,0.12)",
            pointerEvents: "none",
          }} />

          {/* Board frame */}
          <div style={{
            position: "relative",
            width: boardSize, height: boardSize,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.5)",
            overflow: "hidden",
            background: "#04041a",
          }}>
            {/* Cells */}
            <BoardCells cs={cs} occupiedByPlayer={occupiedByPlayer} />

            {/* Snakes & Ladders overlay */}
            <BoardOverlay cs={cs} activeSnake={activeSnakeTile} activeLadder={activeLadderTile} />

            {/* Tokens */}
            {gameState.players.map((player, i) => {
              const pos = visualPositions[i]
              const tokensThere = pos > 0
                ? gameState.players.filter((_, j) => visualPositions[j] === pos).length
                : 1
              const myIndexInGroup = pos > 0
                ? gameState.players.filter((_, j) => visualPositions[j] === pos).indexOf(player)
                : 0

              return (
                <Token
                  key={player.id}
                  player={player}
                  visualPosition={pos}
                  cs={cs}
                  isMoving={gameState.phase === "moving" && i === gameState.currentIndex}
                  offsetIndex={myIndexInGroup}
                  offsetTotal={tokensThere}
                  isCurrentPlayer={i === gameState.currentIndex}
                />
              )
            })}

            {/* Particles */}
            <Particles particles={particles} />
          </div>

          {/* Board label */}
          <div style={{
            textAlign: "center", marginTop: 10,
            fontSize: 10, letterSpacing: "0.3em", color: "rgba(255,255,255,0.2)",
            textTransform: "uppercase",
          }}>
            Snake &amp; Ladders
          </div>
        </div>

        {/* HUD panel */}
        <div style={{ width: 188, flexShrink: 0 }}>
          <PlayerHUD
            state={gameState}
            onRoll={handleRoll}
            onToggleAudio={() => setAudioOn(v => !v)}
            audioOn={audioOn}
            visualPositions={visualPositions}
          />
        </div>
      </div>

      {/* Event overlay */}
      <EventOverlay
        event={activeEvent}
        playerColor={gameState.players[gameState.currentIndex].color}
      />

      {/* Victory */}
      {winner && (
        <VictoryScreen
          winner={winner}
          onPlayAgain={handlePlayAgain}
          onSetup={() => setScreen("setup")}
        />
      )}
    </div>
  )
}
