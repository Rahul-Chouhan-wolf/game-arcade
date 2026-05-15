"use client"

import { motion } from "motion/react"
import { LiquidButton } from "@/components/ui/liquid-glass-button"
import { Trophy, Flame, BarChart2, Play, HelpCircle, Settings, Medal } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

type TileState = "correct" | "present" | "absent" | "empty"

interface TileProps {
  letter: string
  state: TileState
  delay: number
}

interface StatProps {
  icon: React.ReactNode
  label: string
  value: string | number
}

interface GameStartScreenProps {
  onPlay?: () => void
  onHowToPlay?: () => void
  onSettings?: () => void
  onLeaderboard?: () => void
  stats?: {
    wins: number
    streak: number
    winRate: number
  }
}

// ── Tile colours ─────────────────────────────────────────────────────────────

const TILE_STYLES: Record<TileState, string> = {
  correct: "bg-[#538d4e] border-[#538d4e] text-white",
  present: "bg-[#b59f3b] border-[#b59f3b] text-white",
  absent:  "bg-[#3a3a3c] border-[#3a3a3c] text-[#818384]",
  empty:   "bg-transparent border-[#565758] text-white",
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PreviewTile({ letter, state, delay }: TileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateX: -90, scale: 0.8 }}
      animate={{ opacity: 1, rotateX: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, type: "spring", bounce: 0.35 }}
      className={`
        w-12 h-12 md:w-14 md:h-14 border-2 rounded flex items-center justify-center
        text-lg md:text-xl font-extrabold tracking-wider select-none
        ${TILE_STYLES[state]}
      `}
      style={{ perspective: "250px" }}
    >
      {letter}
    </motion.div>
  )
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5 text-white/40 text-xs">
        {icon}
        <span className="uppercase tracking-widest font-bold">{label}</span>
      </div>
      <span className="text-white text-xl font-extrabold tabular-nums">{value}</span>
    </div>
  )
}

// ── Stagger helper ────────────────────────────────────────────────────────────

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5, ease: "easeOut" as const },
})

// ── Preview word definition ───────────────────────────────────────────────────

const PREVIEW: { letter: string; state: TileState }[] = [
  { letter: "W", state: "correct"  },
  { letter: "O", state: "absent"   },
  { letter: "R", state: "present"  },
  { letter: "D", state: "absent"   },
  { letter: "S", state: "correct"  },
]

// ── Main Component ────────────────────────────────────────────────────────────

export function GameStartScreen({
  onPlay,
  onHowToPlay,
  onSettings,
  onLeaderboard,
  stats = { wins: 24, streak: 3, winRate: 80 },
}: GameStartScreenProps) {
  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-10">

      {/* ── Glass card ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-8 shadow-2xl"
        style={{ backdropFilter: "blur(24px)" }}
      >

        {/* subtle inner glow */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />

        {/* ── Logo ── */}
        <motion.div {...fadeUp(0.1)} className="mb-1 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Word Game</span>
          </div>
          <h1
            className="text-6xl md:text-7xl font-extrabold tracking-[0.18em] uppercase"
            style={{
              background: "linear-gradient(135deg, #fff 30%, #818384 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Lexle
          </h1>
          <p className="mt-2 text-sm text-white/40 tracking-wide">
            Guess the word. Master the language.
          </p>
        </motion.div>

        {/* ── Tile preview ── */}
        <motion.div {...fadeUp(0.25)} className="my-7 flex justify-center gap-2">
          {PREVIEW.map((t, i) => (
            <PreviewTile key={i} letter={t.letter} state={t.state} delay={0.4 + i * 0.08} />
          ))}
        </motion.div>

        {/* ── Legend ── */}
        <motion.div {...fadeUp(0.35)} className="mb-7 flex justify-center gap-5 text-[10px] font-bold uppercase tracking-widest text-white/30">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#538d4e]" /> Correct
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#b59f3b]" /> Misplaced
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#3a3a3c]" /> Absent
          </span>
        </motion.div>

        {/* ── PLAY button ── */}
        <motion.div {...fadeUp(0.45)} className="flex justify-center mb-4">
          <LiquidButton
            size="xl"
            onClick={onPlay}
            className="text-white border border-white/20 rounded-full w-full max-w-xs font-extrabold tracking-widest text-base uppercase gap-3"
          >
            <Play className="w-4 h-4 fill-white" />
            Play
          </LiquidButton>
        </motion.div>

        {/* ── Secondary buttons ── */}
        <motion.div {...fadeUp(0.52)} className="flex justify-center gap-3">
          <button
            onClick={onHowToPlay}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <HelpCircle className="w-3.5 h-3.5" /> How to Play
          </button>
          <button
            onClick={onSettings}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <Settings className="w-3.5 h-3.5" /> Settings
          </button>
          <button
            onClick={onLeaderboard}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <Medal className="w-3.5 h-3.5" /> Ranks
          </button>
        </motion.div>

        {/* ── Divider ── */}
        <motion.div {...fadeUp(0.58)} className="my-6 border-t border-white/10" />

        {/* ── Stats row ── */}
        <motion.div {...fadeUp(0.62)} className="flex justify-around">
          <Stat
            icon={<Trophy className="w-3 h-3" />}
            label="Wins"
            value={stats.wins}
          />
          <div className="w-px bg-white/10" />
          <Stat
            icon={<Flame className="w-3 h-3" />}
            label="Streak"
            value={`${stats.streak} 🔥`}
          />
          <div className="w-px bg-white/10" />
          <Stat
            icon={<BarChart2 className="w-3 h-3" />}
            label="Win Rate"
            value={`${stats.winRate}%`}
          />
        </motion.div>

      </motion.div>

      {/* ── Footer ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.6 }}
        className="mt-6 text-[10px] uppercase tracking-[0.3em] text-white/20"
      >
        A new word every round
      </motion.p>
    </div>
  )
}
