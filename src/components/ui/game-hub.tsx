"use client"

import { motion } from "motion/react"
import { Play, Zap } from "lucide-react"
import Link from "next/link"

// ── Types ─────────────────────────────────────────────────────────────────────

type TileState = "correct" | "present" | "absent" | "empty"

interface Game {
  id: string
  name: string
  tagline: string
  description: string
  tags: string[]
  accent: string
  href?: string
  learnHref?: string        // "How to Play" link
  studyHref?: string        // "Study Guide" link (optional extra)
  isLive?: boolean
  isNew?: boolean
  comingSoon?: boolean
  preview?: TileState[][]      // word-tile preview (Lexle)
  dotPreview?: boolean         // dots-and-boxes preview (Boxle)
  goPreview?: boolean          // go board preview (Go)
  hexPreview?: boolean         // hex board preview (Hexle)
  orbitalPreview?: boolean     // orbital orrery preview
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
    description: "Take turns placing stones on a hex grid. Blue connects left to right. Red connects top to bottom. First path wins.",
    tags: ["Strategy", "2 Players", "Hex"],
    accent: "#22d3ee",
    href: "/hexle",
    learnHref: "/learn/hexle",
    isLive: true,
    hexPreview: true,
  },
  {
    id: "orbital",
    name: "Orbital",
    tagline: "Master gravity. Navigate the cosmos.",
    description: "Launch probes through space. Use planetary gravity to slingshot, arc, and navigate 8 handcrafted trajectory puzzles.",
    tags: ["Space", "Physics", "Puzzle"],
    accent: "#818cf8",
    href: "/orbital",
    isLive: true,
    isNew: true,
    orbitalPreview: true,
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
// Shows a static 4×4-dot grid with a partial game already in progress

const DOT_MINI = 14   // px between dots in the mini preview
const DOT_R    = 2.5  // dot radius

type MLine = { isH: boolean; r: number; c: number; player: 1 | 2 }
type MBox  = { r: number; c: number; player: 1 | 2 }

const MINI_N    = 4   // 4 dots → 3×3 boxes
const MINI_LINES: MLine[] = [
  // P1 (green) lines
  { isH: true,  r: 0, c: 0, player: 1 }, { isH: true,  r: 0, c: 1, player: 1 },
  { isH: true,  r: 1, c: 0, player: 1 }, { isH: false, r: 0, c: 1, player: 1 },
  { isH: false, r: 0, c: 0, player: 1 },
  // P2 (purple) lines
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
      {/* Box fills */}
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

      {/* Lines */}
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

      {/* Dots */}
      {Array.from({ length: MINI_N }, (_, r) =>
        Array.from({ length: MINI_N }, (_, c) => (
          <circle key={`${r}-${c}`} cx={x(c)} cy={y(r)} r={DOT_R} fill="#818384" />
        ))
      )}
    </svg>
  )
}

// ── Mini board preview ────────────────────────────────────────────────────────

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
                width: 18,
                height: 18,
                borderRadius: 3,
                background: TILE_BG[state],
                border: `1.5px solid ${state === "empty" ? "#565758" : TILE_BG[state]}`,
                boxShadow: state !== "empty" && state !== "absent"
                  ? `0 0 6px ${accent}55`
                  : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Go mini board preview ─────────────────────────────────────────────────────

const GO_SIZE   = 5   // show a 5×5 sub-grid for the preview
const GO_CELL   = 12
const GO_PAD    = 8

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
      {/* Board background */}
      <rect x={0} y={0} width={total} height={total} rx={4} fill="#1c1408" />
      {/* Grid */}
      {Array.from({ length: GO_SIZE }, (_, i) => (
        <g key={i}>
          <line x1={x(0)} y1={y(i)} x2={x(GO_SIZE - 1)} y2={y(i)} stroke="#5c3d1e" strokeWidth={0.8} />
          <line x1={x(i)} y1={y(0)} x2={x(i)} y2={y(GO_SIZE - 1)} stroke="#5c3d1e" strokeWidth={0.8} />
        </g>
      ))}
      {/* Stones */}
      {GO_STONES.map((s, i) => (
        <motion.circle
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.07, type: 'spring', damping: 14, stiffness: 260 }}
          style={{ transformOrigin: `${x(s.c)}px ${y(s.r)}px` }}
          cx={x(s.c)} cy={y(s.r)}
          r={GO_CELL * 0.42}
          fill={s.player === 1 ? '#1a1a1a' : '#e8e8e8'}
          stroke={s.player === 1 ? '#000' : '#b0b0b0'}
          strokeWidth={0.5}
        />
      ))}
    </svg>
  )
}

// ── Hexle mini board preview ─────────────────────────────────────────────────

const HEX_MINI_R  = 10
const HEX_MINI_PAD = 14
const HEX_MINI_N  = 5

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
    return pts.join(' ')
  }

  const cx = (r: number, c: number) => pad + c * w + r * w * 0.5
  const cy = (r: number, c: number) => pad + r * 1.5 * R

  const WIN_CELLS = new Set(['0,0','1,0','1,1','2,1','2,2'])

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
          const fill = (isLR && isTB) ? '#0e0e1e' : isLR ? '#081828' : isTB ? '#1e0810' : '#0f0f1a'
          return (
            <polygon
              key={`${r}-${c}`}
              points={hexPts(cx(r, c), cy(r, c))}
              fill={fill} stroke="#1e1e30" strokeWidth={0.5}
            />
          )
        })
      )}
      {WIN_CELLS.size > 0 && Array.from(WIN_CELLS).map((key, i) => {
        const [r, c] = key.split(',').map(Number)
        return (
          <motion.polygon
            key={key}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            points={hexPts(cx(r, c), cy(r, c))}
            fill="#e8b86d30" stroke="#e8b86d50" strokeWidth={0.8}
          />
        )
      })}
      {HEX_MINI_STONES.map((s, i) => (
        <motion.circle
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25 + i * 0.06, type: 'spring', damping: 14, stiffness: 280 }}
          style={{ transformOrigin: `${cx(s.r, s.c)}px ${cy(s.r, s.c)}px` }}
          cx={cx(s.r, s.c)} cy={cy(s.r, s.c)}
          r={R * 0.44}
          fill={`url(#hm-p${s.player})`}
        />
      ))}
    </svg>
  )
}

// ── Orbital orrery mini preview ───────────────────────────────────────────────

function OrbitalMiniPreview() {
  const W = 88, H = 72, cx = W / 2, cy = H / 2

  // Orbit ellipse parameters
  const orbit1 = { rx: 26, ry: 18 }
  const orbit2 = { rx: 38, ry: 28 }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="om-star" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#fde68a" />
          <stop offset="60%"  stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id="om-p1" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
        <radialGradient id="om-p2" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
        <filter id="om-glo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect x={0} y={0} width={W} height={H} rx={6} fill="#05051a" />

      {/* Stars */}
      {[12,28,65,78,14,55,72,33].map((v, i) => (
        <circle key={i} cx={(v * 11 + i * 7) % W} cy={(v * 7 + i * 13) % H} r={0.7}
          fill="white" opacity={0.4 + (i % 3) * 0.2} />
      ))}

      {/* Orbit paths */}
      <ellipse cx={cx} cy={cy} rx={orbit1.rx} ry={orbit1.ry}
        fill="none" stroke="#818cf8" strokeWidth={0.6} strokeDasharray="2 3" opacity={0.35} />
      <ellipse cx={cx} cy={cy} rx={orbit2.rx} ry={orbit2.ry}
        fill="none" stroke="#6366f1" strokeWidth={0.5} strokeDasharray="2 4" opacity={0.25} />

      {/* Star */}
      <circle cx={cx} cy={cy} r={7.5} fill="url(#om-star)" filter="url(#om-glo)" />

      {/* Orbiting planet 1 — animated */}
      <motion.circle
        cx={cx} cy={cy} r={3.5}
        fill="url(#om-p1)"
        animate={{
          cx: [cx + orbit1.rx, cx, cx - orbit1.rx, cx, cx + orbit1.rx],
          cy: [cy, cy - orbit1.ry, cy, cy + orbit1.ry, cy],
        }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'linear' }}
      />

      {/* Orbiting planet 2 — animated, offset phase */}
      <motion.circle
        cx={cx} cy={cy} r={2.8}
        fill="url(#om-p2)"
        animate={{
          cx: [cx - orbit2.rx, cx, cx + orbit2.rx, cx, cx - orbit2.rx],
          cy: [cy, cy + orbit2.ry, cy, cy - orbit2.ry, cy],
        }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'linear' }}
      />

      {/* Probe trajectory arc */}
      <motion.path
        d={`M ${cx - orbit2.rx - 4} ${cy} Q ${cx} ${cy - orbit2.ry - 10} ${cx + orbit2.rx + 4} ${cy}`}
        fill="none" stroke="#a5f3fc" strokeWidth={1}
        strokeDasharray="2 3" opacity={0.55}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Probe dot */}
      <motion.circle
        r={2} fill="#e0e7ff"
        animate={{
          cx: [cx - orbit2.rx - 4, cx, cx + orbit2.rx + 4],
          cy: [cy, cy - orbit2.ry - 10, cy],
        }}
        transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
      />
    </svg>
  )
}

// ── Single game card ──────────────────────────────────────────────────────────

function GameCard({ game, index }: { game: Game; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.12, duration: 0.5, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 flex gap-4 sm:gap-5 items-start transition-all duration-300 hover:border-white/20 hover:bg-black/50"
      style={{ backdropFilter: "blur(20px)" }}
    >
      {/* accent glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top left, ${game.accent}18 0%, transparent 65%)` }}
      />

      {/* ── Mini board ── */}
      <div className="flex-shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 p-3">
        {game.orbitalPreview
          ? <OrbitalMiniPreview />
          : game.hexPreview
          ? <HexMiniBoard />
          : game.goPreview
          ? <GoMiniBoard />
          : game.dotPreview
          ? <BoxMiniBoard />
          : <MiniBoard rows={game.preview ?? []} accent={game.accent} />
        }
      </div>

      {/* ── Info ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h2 className="text-white font-extrabold text-lg tracking-tight">{game.name}</h2>

          {game.isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
              </span>
              Live
            </span>
          )}
          {game.isNew && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#b59f3b] border border-[#b59f3b]/40 bg-[#b59f3b]/10 px-1.5 py-0.5 rounded-full">
              New
            </span>
          )}
          {game.comingSoon && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 border border-white/10 px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          )}
        </div>

        <p className="text-white/40 text-xs mb-2 leading-relaxed">{game.tagline}</p>

        {/* tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {game.tags.map(tag => (
            <span
              key={tag}
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 text-white/30"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* buttons */}
        {game.comingSoon ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/20 cursor-not-allowed select-none">
            Coming Soon
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link
              href={game.href ?? "#"}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-white transition-all duration-200 active:scale-95 shadow-lg min-h-[44px]"
              style={{
                background: game.accent,
                boxShadow: `0 4px 20px ${game.accent}40`,
              }}
            >
              <Play className="w-3 h-3 fill-white" />
              Play
            </Link>
            {game.learnHref && (
              <Link
                href={game.learnHref}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-200 active:scale-95 min-h-[44px]"
                style={{
                  border: `1px solid ${game.accent}50`,
                  color: game.accent,
                  background: `${game.accent}0e`,
                }}
              >
                How to Play
              </Link>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Hub ──────────────────────────────────────────────────────────────────

export function GameHub() {
  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-10 sm:py-12"
      style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
    >

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-10 text-center"
      >
        <div className="inline-flex items-center gap-2 mb-4 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
          <Zap className="w-3 h-3" />
          Game Arcade
        </div>

        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-[0.15em] uppercase mb-3"
          style={{
            background: "linear-gradient(135deg, #fff 30%, #555 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Arcade
        </h1>
        <p className="text-white/30 text-sm tracking-wide max-w-xs mx-auto">
          Pick a game and start playing. New titles dropping soon.
        </p>
      </motion.div>

      {/* ── Game list ── */}
      <div className="w-full max-w-lg flex flex-col gap-3">
        {GAMES.map((game, i) => (
          <GameCard key={game.id} game={game} index={i} />
        ))}

        {/* ── Coming soon placeholder ── */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + GAMES.length * 0.12, duration: 0.5, ease: "easeOut" }}
          className="rounded-2xl border border-dashed border-white/10 p-5 flex items-center justify-center gap-3 text-white/20"
        >
          <span className="text-2xl">＋</span>
          <span className="text-xs font-bold uppercase tracking-widest">More games coming soon</span>
        </motion.div>
      </div>

      {/* ── Footer ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="mt-10 flex flex-col items-center gap-1"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">v1.0 · Game Arcade</span>
        <span className="text-[9px] tracking-[0.15em] text-white/25">Created by Rahul Chouhan</span>
      </motion.p>
    </div>
  )
}
