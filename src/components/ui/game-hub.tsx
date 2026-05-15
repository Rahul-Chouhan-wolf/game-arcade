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
  isLive?: boolean
  isNew?: boolean
  comingSoon?: boolean
  preview?: TileState[][]   // word-tile preview (Lexle)
  dotPreview?: boolean      // dots-and-boxes preview (Boxle)
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
    isLive: true,
    isNew: true,
    dotPreview: true,
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

// ── Single game card ──────────────────────────────────────────────────────────

function GameCard({ game, index }: { game: Game; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.12, duration: 0.5, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 flex gap-5 items-start transition-all duration-300 hover:border-white/20 hover:bg-black/50"
      style={{ backdropFilter: "blur(20px)" }}
    >
      {/* accent glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top left, ${game.accent}18 0%, transparent 65%)` }}
      />

      {/* ── Mini board ── */}
      <div className="flex-shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 p-3">
        {game.dotPreview
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

        {/* play button */}
        {game.comingSoon ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/20 cursor-not-allowed select-none">
            Coming Soon
          </span>
        ) : (
          <Link
            href={game.href ?? "#"}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-white transition-all duration-200
              bg-[#538d4e] hover:bg-[#6aaf65] active:scale-95 shadow-lg shadow-[#538d4e]/30 hover:shadow-[#538d4e]/50"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Play Now
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Hub ──────────────────────────────────────────────────────────────────

export function GameHub() {
  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-12">

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
          className="text-5xl md:text-6xl font-extrabold tracking-[0.15em] uppercase mb-3"
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
        className="mt-10 text-[10px] uppercase tracking-[0.3em] text-white/15"
      >
        Powered by Lexle Engine
      </motion.p>
    </div>
  )
}
