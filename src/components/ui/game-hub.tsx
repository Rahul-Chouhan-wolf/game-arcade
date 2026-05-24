"use client"

import { motion } from "motion/react"
import { Play } from "lucide-react"
import Link from "next/link"
import React from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type TileState = "correct" | "present" | "absent" | "empty"

interface Game {
  id:           string
  name:         string
  tagline:      string
  description:  string
  tags:         string[]
  accent:       string
  href?:        string
  learnHref?:   string
  studyHref?:   string
  isLive?:      boolean
  isNew?:       boolean
  comingSoon?:  boolean
  preview?:     TileState[][]
  dotPreview?:  boolean
  goPreview?:   boolean
  hexPreview?:  boolean
  orbitalPreview?: boolean
  cryptogramPreview?: boolean
}

// ── Game registry ─────────────────────────────────────────────────────────────

const GAMES: Game[] = [
  {
    id: "lexle",
    name: "Lexle",
    tagline: "Guess the hidden word in 6 tries",
    description: "Each guess must be a real word. Green = correct spot. Yellow = wrong spot.",
    tags: ["Word", "5 Letters", "Solo"],
    accent: "#538d4e",
    href: "/lexle",
    learnHref: "/learn/lexle",
    isLive: true,
    preview: [
      ["correct",  "absent",   "present", "absent",  "correct" ],
      ["absent",   "correct",  "absent",  "present", "absent"  ],
      ["correct",  "correct",  "correct", "correct", "correct" ],
    ],
  },
  {
    id: "boxle",
    name: "Boxle",
    tagline: "Claim boxes, outsmart your rival",
    description: "Take turns drawing lines between dots. Complete a box to score and play again. Most boxes wins.",
    tags: ["Strategy", "2 Players", "Local"],
    accent: "#c77dff",
    href: "/boxle",
    learnHref: "/learn/boxle",
    isLive: true,
    dotPreview: true,
  },
  {
    id: "go",
    name: "Go",
    tagline: "Ancient strategy, modern arena",
    description: "Place stones to claim territory. Connect groups for strength. Capture your rival's stones. Most territory wins.",
    tags: ["Strategy", "2 Players", "Board"],
    accent: "#e8b86d",
    href: "/go",
    learnHref: "/learn",
    isLive: true,
    goPreview: true,
  },
  {
    id: "hexle",
    name: "Hexle",
    tagline: "Connect your sides before they do",
    description: "Take turns placing stones on a hex grid. Blue connects left-to-right. Red connects top-to-bottom. First path wins.",
    tags: ["Strategy", "2 Players", "Hex"],
    accent: "#22d3ee",
    href: "/hexle",
    learnHref: "/learn/hexle",
    isLive: true,
    isNew: true,
    hexPreview: true,
  },
]

// ── Tile colours ──────────────────────────────────────────────────────────────

const TILE_BG: Record<TileState, string> = {
  correct: "#538d4e",
  present: "#b59f3b",
  absent:  "#3a3a3c",
  empty:   "transparent",
}

// ── Dots-and-boxes mini preview ───────────────────────────────────────────────

const DOT_MINI = 14
const DOT_R    = 2.5

type MLine = { isH: boolean; r: number; c: number; player: 1 | 2 }
type MBox  = { r: number; c: number; player: 1 | 2 }

const MINI_N = 4
const MINI_LINES: MLine[] = [
  { isH: true,  r: 0, c: 0, player: 1 }, { isH: true,  r: 0, c: 1, player: 1 },
  { isH: true,  r: 1, c: 0, player: 1 }, { isH: false, r: 0, c: 1, player: 1 },
  { isH: false, r: 0, c: 0, player: 1 },
  { isH: true,  r: 0, c: 2, player: 2 }, { isH: false, r: 0, c: 3, player: 2 },
  { isH: true,  r: 1, c: 2, player: 2 }, { isH: false, r: 0, c: 2, player: 2 },
  { isH: true,  r: 2, c: 0, player: 2 }, { isH: false, r: 1, c: 0, player: 2 },
  { isH: true,  r: 3, c: 1, player: 2 }, { isH: false, r: 2, c: 2, player: 2 },
]
const MINI_BOXES: MBox[] = [
  { r: 0, c: 0, player: 1 }, { r: 0, c: 1, player: 1 },
  { r: 0, c: 2, player: 2 },
]

function BoxMiniBoard() {
  const size = (MINI_N - 1) * DOT_MINI
  const x = (c: number) => 4 + c * DOT_MINI
  const y = (r: number) => 4 + r * DOT_MINI
  const P_COLOR = { 1: "#538d4e", 2: "#c77dff" } as const
  const P_BG    = { 1: "#538d4e40", 2: "#c77dff40" } as const

  return (
    <svg viewBox={`0 0 ${size + 8} ${size + 8}`} width={size + 8} height={size + 8}>
      {MINI_BOXES.map((b, i) => (
        <motion.rect
          key={i}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.08, duration: 0.3, ease: "backOut" }}
          style={{ transformOrigin: `${x(b.c) + DOT_MINI / 2}px ${y(b.r) + DOT_MINI / 2}px` }}
          x={x(b.c) + 1} y={y(b.r) + 1}
          width={DOT_MINI - 2} height={DOT_MINI - 2}
          rx={2}
          fill={P_BG[b.player]}
        />
      ))}
      {MINI_LINES.map((l, i) => (
        <motion.line
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.04 }}
          x1={x(l.c)} y1={y(l.r)}
          x2={l.isH ? x(l.c + 1) : x(l.c)}
          y2={l.isH ? y(l.r)     : y(l.r + 1)}
          stroke={P_COLOR[l.player]}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}
      {Array.from({ length: MINI_N }, (_, r) =>
        Array.from({ length: MINI_N }, (_, c) => (
          <circle key={`${r}-${c}`} cx={x(c)} cy={y(r)} r={DOT_R} fill="#818384" />
        ))
      )}
    </svg>
  )
}

// ── Lexle tile preview ────────────────────────────────────────────────────────

function MiniBoard({ rows, accent }: { rows: TileState[][]; accent: string }) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((state, ci) => (
            <motion.div
              key={ci}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + ri * 0.1 + ci * 0.04, duration: 0.25, ease: "backOut" }}
              style={{
                width: 18, height: 18, borderRadius: 3,
                background: TILE_BG[state],
                border: `1.5px solid ${state === "empty" ? "#565758" : TILE_BG[state]}`,
                boxShadow: state !== "empty" && state !== "absent"
                  ? `0 0 6px ${accent}55` : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Go mini board ─────────────────────────────────────────────────────────────

const GO_SIZE = 5
const GO_CELL = 12
const GO_PAD  = 8
type GoMiniStone = { r: number; c: number; player: 1 | 2 }

const GO_STONES: GoMiniStone[] = [
  { r: 1, c: 1, player: 1 }, { r: 1, c: 3, player: 1 },
  { r: 2, c: 2, player: 1 }, { r: 3, c: 1, player: 1 },
  { r: 0, c: 2, player: 2 }, { r: 2, c: 0, player: 2 },
  { r: 2, c: 4, player: 2 }, { r: 3, c: 3, player: 2 },
  { r: 4, c: 2, player: 2 },
]

function GoMiniBoard() {
  const total = 2 * GO_PAD + (GO_SIZE - 1) * GO_CELL
  const x = (c: number) => GO_PAD + c * GO_CELL
  const y = (r: number) => GO_PAD + r * GO_CELL
  return (
    <svg viewBox={`0 0 ${total} ${total}`} width={total} height={total}>
      <rect x={0} y={0} width={total} height={total} rx={4} fill="#1c1408" />
      {Array.from({ length: GO_SIZE }, (_, i) => (
        <g key={i}>
          <line x1={x(0)} y1={y(i)} x2={x(GO_SIZE - 1)} y2={y(i)} stroke="#5c3d1e" strokeWidth={0.8} />
          <line x1={x(i)} y1={y(0)} x2={x(i)} y2={y(GO_SIZE - 1)} stroke="#5c3d1e" strokeWidth={0.8} />
        </g>
      ))}
      {GO_STONES.map((s, i) => (
        <motion.circle
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.07, type: "spring", damping: 14, stiffness: 260 }}
          style={{ transformOrigin: `${x(s.c)}px ${y(s.r)}px` }}
          cx={x(s.c)} cy={y(s.r)}
          r={GO_CELL * 0.42}
          fill={s.player === 1 ? "#1a1a1a" : "#e8e8e8"}
          stroke={s.player === 1 ? "#000" : "#b0b0b0"}
          strokeWidth={0.5}
        />
      ))}
    </svg>
  )
}

// ── Hexle mini board ──────────────────────────────────────────────────────────

const HEX_MINI_R   = 10
const HEX_MINI_PAD = 14
const HEX_MINI_N   = 5
type HexMiniStone = { r: number; c: number; player: 1 | 2 }

const HEX_MINI_STONES: HexMiniStone[] = [
  { r: 0, c: 0, player: 1 }, { r: 1, c: 0, player: 1 }, { r: 1, c: 1, player: 1 },
  { r: 2, c: 1, player: 1 }, { r: 2, c: 2, player: 1 },
  { r: 0, c: 2, player: 2 }, { r: 0, c: 3, player: 2 }, { r: 1, c: 3, player: 2 },
  { r: 3, c: 1, player: 2 }, { r: 3, c: 2, player: 2 },
]

function HexMiniBoard() {
  const R   = HEX_MINI_R
  const pad = HEX_MINI_PAD
  const n   = HEX_MINI_N
  const w   = Math.sqrt(3) * R
  const svgW = pad + (n - 1) * 1.5 * w + w / 2 + pad
  const svgH = pad + (n - 1) * 1.5 * R + R + pad

  function hexPts(cx: number, cy: number) {
    const pts: string[] = []
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      pts.push(`${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`)
    }
    return pts.join(" ")
  }

  const cx = (r: number, c: number) => pad + c * w + r * w * 0.5
  const cy = (r: number) => pad + r * 1.5 * R
  const WIN_CELLS = new Set(["0,0","1,0","1,1","2,1","2,2"])

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH}>
      <defs>
        <radialGradient id="hm-p1" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#7dd3fc" /><stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
        <radialGradient id="hm-p2" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fca5a5" /><stop offset="100%" stopColor="#9f1239" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={svgW} height={svgH} rx={4} fill="#0a0a12" />
      {Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => {
          const isLR = c === 0 || c === n - 1
          const isTB = r === 0 || r === n - 1
          const fill = isLR && isTB ? "#0e0e1e" : isLR ? "#081828" : isTB ? "#1e0810" : "#0f0f1a"
          return <polygon key={`${r}-${c}`} points={hexPts(cx(r, c), cy(r))} fill={fill} stroke="#1e1e30" strokeWidth={0.5} />
        })
      )}
      {Array.from(WIN_CELLS).map((key, i) => {
        const [r, c] = key.split(",").map(Number)
        return (
          <motion.polygon key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            points={hexPts(cx(r, c), cy(r))} fill="#e8b86d30" stroke="#e8b86d50" strokeWidth={0.8} />
        )
      })}
      {HEX_MINI_STONES.map((s, i) => (
        <motion.circle key={i}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25 + i * 0.06, type: "spring", damping: 14, stiffness: 280 }}
          style={{ transformOrigin: `${cx(s.r, s.c)}px ${cy(s.r)}px` }}
          cx={cx(s.r, s.c)} cy={cy(s.r)} r={R * 0.44}
          fill={`url(#hm-p${s.player})`} />
      ))}
    </svg>
  )
}

// ── Orbital orrery mini preview ───────────────────────────────────────────────

function OrbitalMiniPreview() {
  const W = 88, H = 72, cx = W / 2, cy = H / 2
  const orbit1 = { rx: 26, ry: 18 }
  const orbit2 = { rx: 38, ry: 28 }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="om-star" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fde68a" /><stop offset="60%" stopColor="#f97316" /><stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id="om-p1" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#93c5fd" /><stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
        <radialGradient id="om-p2" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#c4b5fd" /><stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
        <filter id="om-glo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x={0} y={0} width={W} height={H} rx={6} fill="#05051a" />
      {[12,28,65,78,14,55,72,33].map((v, i) => (
        <circle key={i} cx={(v * 11 + i * 7) % W} cy={(v * 7 + i * 13) % H} r={0.7}
          fill="white" opacity={0.4 + (i % 3) * 0.2} />
      ))}
      <ellipse cx={cx} cy={cy} rx={orbit1.rx} ry={orbit1.ry} fill="none" stroke="#818cf8" strokeWidth={0.6} strokeDasharray="2 3" opacity={0.35} />
      <ellipse cx={cx} cy={cy} rx={orbit2.rx} ry={orbit2.ry} fill="none" stroke="#6366f1" strokeWidth={0.5} strokeDasharray="2 4" opacity={0.25} />
      <circle cx={cx} cy={cy} r={7.5} fill="url(#om-star)" filter="url(#om-glo)" />
      <motion.circle cx={cx} cy={cy} r={3.5} fill="url(#om-p1)"
        animate={{ cx: [cx+orbit1.rx,cx,cx-orbit1.rx,cx,cx+orbit1.rx], cy: [cy,cy-orbit1.ry,cy,cy+orbit1.ry,cy] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }} />
      <motion.circle cx={cx} cy={cy} r={2.8} fill="url(#om-p2)"
        animate={{ cx: [cx-orbit2.rx,cx,cx+orbit2.rx,cx,cx-orbit2.rx], cy: [cy,cy+orbit2.ry,cy,cy-orbit2.ry,cy] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }} />
      <motion.path d={`M ${cx-orbit2.rx-4} ${cy} Q ${cx} ${cy-orbit2.ry-10} ${cx+orbit2.rx+4} ${cy}`}
        fill="none" stroke="#a5f3fc" strokeWidth={1} strokeDasharray="2 3" opacity={0.55}
        animate={{ opacity: [0.3,0.7,0.3] }} transition={{ duration: 2.5, repeat: Infinity }} />
      <motion.circle r={2} fill="#e0e7ff"
        animate={{ cx: [cx-orbit2.rx-4,cx,cx+orbit2.rx+4], cy: [cy,cy-orbit2.ry-10,cy] }}
        transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }} />
    </svg>
  )
}

// ── Cryptogram mini preview ───────────────────────────────────────────────────

function CryptogramMiniPreview() {
  const W = 88, H = 72
  const ACCENT_CG = "#00d4aa"
  const GOLD_CG   = "#f0b429"
  const GREEN_CG  = "#22c55e"
  const cells = [
    { cipher: "X", guess: "T", correct: true,  x: 14 },
    { cipher: "Y", guess: "H", correct: true,  x: 34 },
    { cipher: "Z", guess: "E", correct: true,  x: 54 },
    { cipher: "W", guess: "",  correct: false, x: 74 },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <rect x={0} y={0} width={W} height={H} rx={6} fill="#060a12" />
      {[14, 42, 68].map((bx, i) => (
        <motion.text key={i} x={bx} y={18} textAnchor="middle"
          style={{ fontFamily: "monospace", fontSize: 9, fill: ACCENT_CG }}
          animate={{ opacity: [0.08, 0.18, 0.08] }}
          transition={{ duration: 2.5 + i * 0.7, repeat: Infinity }}>
          {["A","N","E"][i]}
        </motion.text>
      ))}
      {cells.map(({ cipher, guess, correct, x }, i) => {
        const borderCol = correct ? GREEN_CG : guess ? ACCENT_CG : "rgba(255,255,255,0.15)"
        const textCol   = correct ? GREEN_CG : "#fff"
        return (
          <g key={i}>
            <motion.rect x={x-8} y={22} width={16} height={16} rx={3}
              fill={correct ? `${GREEN_CG}18` : "transparent"}
              stroke={borderCol} strokeWidth={1.2}
              initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.18, type: "spring", damping: 14, stiffness: 260 }}
              style={{ transformOrigin: `${x}px 30px` }} />
            {guess && (
              <motion.text x={x} y={34} textAnchor="middle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.45 + i * 0.18 }}
                style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, fill: textCol }}>
                {guess}
              </motion.text>
            )}
            <line x1={x-7} y1={50} x2={x+7} y2={50} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <text x={x} y={49} textAnchor="middle"
              style={{ fontFamily: "monospace", fontSize: 8, fill: "rgba(255,255,255,0.35)" }}>
              {cipher}
            </text>
          </g>
        )
      })}
      <motion.rect x={74-8} y={22} width={16} height={16} rx={3}
        fill="transparent" stroke={GOLD_CG} strokeWidth={1.5}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }} />
      <text x={W/2} y={66} textAnchor="middle"
        style={{ fontFamily: "monospace", fontSize: 7, fill: ACCENT_CG, opacity: 0.35, letterSpacing: "0.15em" }}>
        DECODE
      </text>
    </svg>
  )
}

// ── Preview dispatcher ────────────────────────────────────────────────────────

function GamePreview({ game }: { game: Game }) {
  if (game.cryptogramPreview) return <CryptogramMiniPreview />
  if (game.orbitalPreview)    return <OrbitalMiniPreview />
  if (game.hexPreview)        return <HexMiniBoard />
  if (game.goPreview)         return <GoMiniBoard />
  if (game.dotPreview)        return <BoxMiniBoard />
  return <MiniBoard rows={game.preview ?? []} accent={game.accent} />
}

// ── Status badges ─────────────────────────────────────────────────────────────

function LivePip() {
  return (
    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
  )
}

// ── Single game card — redesigned ─────────────────────────────────────────────

function GameCard({ game, index }: { game: Game; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border flex gap-4 p-4 sm:p-5 transition-all duration-300"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.14)"
        ;(e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"
        ;(e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"
      }}
    >
      {/* Per-game accent glow — behind the thumbnail */}
      <div
        className="pointer-events-none absolute opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          inset: 0,
          background: `radial-gradient(circle at 52px 50%, ${game.accent}14, transparent 55%)`,
        }}
      />

      {/* ── Thumbnail ── */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
        style={{
          width: 86, height: 86,
          background: "rgba(0,0,0,0.40)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Accent glow inside thumbnail on hover */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
          style={{ background: `radial-gradient(circle at center, ${game.accent}20, transparent 65%)` }}
        />
        <GamePreview game={game} />
      </div>

      {/* ── Info ── */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">

        {/* Top: name + badges */}
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-white font-bold text-[17px] tracking-tight leading-none">
              {game.name}
            </h2>
            {game.isLive && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                <LivePip /> Live
              </span>
            )}
            {game.isNew && (
              <span
                className="text-[9px] font-black uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-full"
                style={{
                  color: game.accent,
                  background: `${game.accent}18`,
                  border: `1px solid ${game.accent}35`,
                }}
              >
                New
              </span>
            )}
            {game.comingSoon && (
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/20 border border-white/10 px-1.5 py-0.5 rounded-full">
                Soon
              </span>
            )}
          </div>

          <p className="text-white/38 text-[12px] leading-snug">{game.tagline}</p>
        </div>

        {/* Bottom: tags + CTA */}
        <div className="flex items-center justify-between mt-2 gap-2">
          {/* Tags as plain dot-separated text */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {game.tags.slice(0, 3).map((tag, i) => (
              <React.Fragment key={tag}>
                {i > 0 && (
                  <span className="text-white/15 text-[9px] flex-shrink-0">·</span>
                )}
                <span className="text-[10px] uppercase tracking-widest font-medium text-white/25 whitespace-nowrap">
                  {tag}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* CTA */}
          {game.comingSoon ? (
            <span
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest cursor-not-allowed select-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.20)",
              }}
            >
              Soon
            </span>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              {game.learnHref && (
                <Link
                  href={game.learnHref}
                  className="text-[10px] font-bold uppercase tracking-widest transition-colors"
                  style={{ color: "rgba(255,255,255,0.22)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}
                >
                  Guide
                </Link>
              )}
              <Link href={game.href ?? "#"}>
                <motion.span
                  whileTap={{ scale: 0.93 }}
                  className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest select-none"
                  style={{
                    background: game.accent,
                    color: "#000",
                    boxShadow: `0 2px 12px ${game.accent}40`,
                  }}
                >
                  <Play className="w-2.5 h-2.5 fill-black" />
                  Play
                </motion.span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Hub ──────────────────────────────────────────────────────────────────

export function GameHub() {
  const liveCount = GAMES.filter(g => g.isLive).length

  return (
    <div
      className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-12 sm:py-16"
      style={{
        paddingLeft:  "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y:   0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="mb-12 text-center"
      >
        {/* Game count pill */}
        <p className="text-[10px] uppercase tracking-[0.48em] font-semibold mb-5"
          style={{ color: "rgba(255,255,255,0.22)" }}>
          {liveCount}&nbsp;&nbsp;games ready
        </p>

        {/* Wordmark */}
        <h1
          className="text-[68px] sm:text-[88px] font-black uppercase leading-none tracking-[-0.025em] mb-5 select-none"
          style={{
            background: "linear-gradient(175deg, #ffffff 10%, rgba(255,255,255,0.38) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Arcade
        </h1>

        {/* Thin rule */}
        <div
          className="mx-auto mb-5"
          style={{ width: 32, height: 1, background: "rgba(255,255,255,0.12)" }}
        />

        <p
          className="text-sm leading-relaxed max-w-[220px] mx-auto"
          style={{ color: "rgba(255,255,255,0.28)" }}
        >
          Premium browser games.&nbsp;Pick one and play.
        </p>
      </motion.div>

      {/* ── Games grid ── */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {GAMES.map((game, i) => (
          <GameCard key={game.id} game={game} index={i} />
        ))}

        {/* ── Coming soon slot ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: GAMES.length * 0.07 + 0.05, duration: 0.4, ease: "easeOut" }}
          className="rounded-2xl flex items-center justify-center gap-3 py-7 sm:col-span-2"
          style={{
            border: "1px dashed rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <span
            className="text-xl font-light leading-none"
            style={{ color: "rgba(255,255,255,0.14)" }}
          >
            +
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.28em]"
            style={{ color: "rgba(255,255,255,0.16)" }}
          >
            More games coming soon
          </span>
        </motion.div>
      </div>

      {/* ── Footer ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        className="mt-12 flex flex-col items-center gap-1.5"
      >
        <span
          className="text-[9px] uppercase tracking-[0.32em] font-medium"
          style={{ color: "rgba(255,255,255,0.16)" }}
        >
          v1.0 · Game Arcade
        </span>
        <span
          className="text-[9px] tracking-[0.16em]"
          style={{ color: "rgba(255,255,255,0.10)" }}
        >
          Created by Rahul Chouhan
        </span>
      </motion.div>
    </div>
  )
}
