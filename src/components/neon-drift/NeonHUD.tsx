"use client"

import { motion } from "motion/react"
import { useState, useEffect } from "react"
import { NeonPalette } from "./types"

// ── Gauge ─────────────────────────────────────────────────────────────────────

function SpeedGauge({ speed, maxSpeed = 320, palette }: {
  speed: number; maxSpeed?: number; palette: NeonPalette
}) {
  const R = 56
  const cx = 70, cy = 70
  const startAngle = 210   // degrees, bottom-left
  const endAngle   = 330   // bottom-right (270° sweep)
  const sweep      = endAngle - startAngle   // 120° total

  const toRad = (d: number) => (d * Math.PI) / 180
  const frac  = Math.min(speed / maxSpeed, 1)
  const angle = startAngle + frac * sweep

  const arcX = (a: number) => cx + R * Math.cos(toRad(a - 90))
  const arcY = (a: number) => cy + R * Math.sin(toRad(a - 90))

  // Build arc path
  function arcPath(a1: number, a2: number, r: number) {
    const sx = cx + r * Math.cos(toRad(a1 - 90))
    const sy = cy + r * Math.sin(toRad(a1 - 90))
    const ex = cx + r * Math.cos(toRad(a2 - 90))
    const ey = cy + r * Math.sin(toRad(a2 - 90))
    const large = (a2 - a1) > 180 ? 1 : 0
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`
  }

  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36">
      <defs>
        <linearGradient id={`speedArc-${palette.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.primary} />
          <stop offset="100%" stopColor={palette.accent} />
        </linearGradient>
      </defs>

      {/* Track */}
      <path d={arcPath(startAngle, startAngle + sweep, R)}
        stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="none" strokeLinecap="round" />

      {/* Progress arc */}
      {frac > 0 && (
        <motion.path
          d={arcPath(startAngle, angle, R)}
          stroke={`url(#speedArc-${palette.id})`}
          strokeWidth="8" fill="none" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${palette.glow})` }}
        />
      )}

      {/* Tick marks */}
      {Array.from({ length: 13 }, (_, i) => {
        const a = startAngle + (i / 12) * sweep
        const inner = i % 3 === 0 ? R - 14 : R - 10
        const outer = R + 1
        return (
          <line key={i}
            x1={arcX(a)} y1={arcY(a)}
            x2={cx + inner * Math.cos(toRad(a - 90))}
            y2={cy + inner * Math.sin(toRad(a - 90))}
            stroke={i % 3 === 0 ? palette.primary : "rgba(255,255,255,0.15)"}
            strokeWidth={i % 3 === 0 ? 1.5 : 0.8}
          />
        )
        // suppress TS unused warning
        void outer
      })}

      {/* Needle */}
      <motion.line
        x1={cx} y1={cy}
        x2={arcX(angle)} y2={arcY(angle)}
        stroke={palette.glow} strokeWidth="2" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${palette.glow})` }}
      />

      {/* Centre dot */}
      <circle cx={cx} cy={cy} r="5" fill={palette.primary}
        style={{ filter: `drop-shadow(0 0 6px ${palette.glow})` }} />
      <circle cx={cx} cy={cy} r="2.5" fill="#fff" />

      {/* Speed number */}
      <text x={cx} y={cy + 26} textAnchor="middle"
        fill="white" fontSize="18" fontWeight="800" fontFamily="monospace"
        style={{ filter: `drop-shadow(0 0 4px ${palette.glow})` }}
      >
        {speed}
      </text>
      <text x={cx} y={cy + 36} textAnchor="middle"
        fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="monospace" letterSpacing="2"
      >
        KM/H
      </text>
    </svg>
  )
}

// ── Boost bar ─────────────────────────────────────────────────────────────────

function BoostBar({ value, palette }: { value: number; palette: NeonPalette }) {
  const segments = 8
  const filled = Math.round(value * segments)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.25em] text-white/35">Boost</span>
        <span className="text-[9px] font-bold" style={{ color: palette.accent }}>{Math.round(value * 100)}%</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: segments }, (_, i) => (
          <motion.div
            key={i}
            className="h-3 flex-1 rounded-sm"
            animate={i < filled ? {
              opacity: [0.7, 1, 0.7],
              boxShadow: [`0 0 4px ${palette.glow}50`, `0 0 10px ${palette.glow}90`, `0 0 4px ${palette.glow}50`],
            } : {}}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.08 }}
            style={{
              background: i < filled
                ? `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`
                : "rgba(255,255,255,0.07)",
              border: `1px solid ${i < filled ? palette.primary + "60" : "rgba(255,255,255,0.08)"}`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Combo meter ───────────────────────────────────────────────────────────────

function ComboMeter({ combo, palette }: { combo: number; palette: NeonPalette }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-0.5"
      animate={combo > 0 ? { scale: [1, 1.04, 1] } : {}}
      transition={{ duration: 0.6, repeat: combo > 0 ? Infinity : 0 }}
    >
      <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">Combo</div>
      <motion.div
        className="text-2xl font-extrabold tracking-tight"
        style={{
          background: `linear-gradient(135deg, ${palette.secondary}, ${palette.accent})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: `drop-shadow(0 0 8px ${palette.glow})`,
        }}
        key={combo}
        initial={{ scale: 1.3, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        ×{combo}
      </motion.div>
    </motion.div>
  )
}

// ── Score display ──────────────────────────────────────────────────────────────

function ScoreDisplay({ score, palette }: { score: number; palette: NeonPalette }) {
  const formatted = score.toLocaleString("en-US", { minimumIntegerDigits: 6, useGrouping: true })
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-[0.25em] text-white/35 mb-0.5">Score</div>
      <div
        className="text-xl font-extrabold tracking-wider font-mono"
        style={{
          color: "#fff",
          textShadow: `0 0 12px ${palette.glow}80, 0 0 4px ${palette.glow}50`,
        }}
      >
        {formatted}
      </div>
    </div>
  )
}

// ── Lap indicator ─────────────────────────────────────────────────────────────

function LapIndicator({ lap, totalLaps, palette }: {
  lap: number; totalLaps: number; palette: NeonPalette
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">Lap</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-extrabold" style={{ color: palette.primary }}>{lap}</span>
        <span className="text-sm font-bold text-white/30">/{totalLaps}</span>
      </div>
    </div>
  )
}

// ── Mini map ──────────────────────────────────────────────────────────────────

function MiniMap({ carPos, palette }: { carPos: { x: number; y: number }; palette: NeonPalette }) {
  const trackPoints = [
    [50, 15], [85, 15], [90, 35], [85, 55], [65, 65], [60, 80],
    [70, 90], [85, 90], [90, 75], [90, 55], [95, 40], [95, 15],
    [95, 15], [50, 15],
  ]
  const d = trackPoints.map((p, i) =>
    `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") + " Z"

  return (
    <div
      className="relative w-20 h-20 rounded-xl overflow-hidden"
      style={{
        background: "rgba(0,0,0,0.55)",
        border: `1px solid ${palette.hudBorder}30`,
        backdropFilter: "blur(8px)",
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
        <path d={d} stroke={palette.grid} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Player dot */}
      <motion.div
        className="absolute w-2 h-2 rounded-full"
        style={{
          background: palette.glow,
          boxShadow: `0 0 8px ${palette.glow}`,
          left: `${carPos.x}%`,
          top:  `${carPos.y}%`,
          transform: "translate(-50%, -50%)",
        }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 0.9, repeat: Infinity }}
      />
    </div>
  )
}

// ── Pause menu ────────────────────────────────────────────────────────────────

function PauseMenu({ palette, onClose }: { palette: NeonPalette; onClose: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ backdropFilter: "blur(12px)", background: "rgba(0,0,0,0.65)" }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="flex flex-col items-center gap-4 w-52 p-6 rounded-2xl"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))`,
          border: `1px solid ${palette.hudBorder}35`,
          backdropFilter: "blur(24px)",
          boxShadow: `0 0 40px ${palette.glow}20`,
        }}
      >
        <div className="text-xs uppercase tracking-[0.3em] text-white/40">Paused</div>
        <div className="text-2xl font-extrabold uppercase tracking-widest" style={{
          background: `linear-gradient(135deg, #fff, ${palette.secondary})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          II
        </div>
        {["Resume", "Restart", "Settings", "Quit"].map((item, i) => (
          <button
            key={item}
            onClick={item === "Resume" ? onClose : undefined}
            className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-150 cursor-pointer"
            style={i === 0 ? {
              background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
              color: "#fff",
              boxShadow: `0 4px 16px ${palette.glow}40`,
            } : {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {item}
          </button>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ── Main HUD ──────────────────────────────────────────────────────────────────

const hudGlass = (palette: NeonPalette) => ({
  background: "rgba(0,0,0,0.45)",
  border: `1px solid ${palette.hudBorder}25`,
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
})

interface Props {
  palette: NeonPalette
}

export function NeonHUD({ palette }: Props) {
  const [speed,  setSpeed]  = useState(187)
  const [combo,  setCombo]  = useState(5)
  const [score,  setScore]  = useState(52840)
  const [boost,  setBoost]  = useState(0.62)
  const [paused, setPaused] = useState(false)
  const [carPos, setCarPos] = useState({ x: 55, y: 48 })

  // Animate values continuously to simulate gameplay
  useEffect(() => {
    const iv = setInterval(() => {
      setSpeed(s => {
        const next = s + (Math.random() - 0.48) * 14
        return Math.max(60, Math.min(320, next))
      })
      setScore(s => s + Math.floor(Math.random() * 120 + 20))
      setBoost(b => {
        const next = b + (Math.random() - 0.55) * 0.06
        return Math.max(0, Math.min(1, next))
      })
      setCombo(c => Math.random() > 0.85 ? Math.max(1, c + 1) : c)
      setCarPos(p => ({
        x: Math.max(10, Math.min(88, p.x + (Math.random() - 0.5) * 4)),
        y: Math.max(10, Math.min(88, p.y + (Math.random() - 0.5) * 4)),
      }))
    }, 250)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden select-none">

      {/* ── Scanlines ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.025]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
        }}
      />

      {/* ── HUD corner panels ── */}

      {/* Top-left: Lap + Time */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="absolute top-4 left-4 flex items-center gap-3 px-4 py-2.5 rounded-xl z-20"
        style={hudGlass(palette)}
      >
        <LapIndicator lap={2} totalLaps={3} palette={palette} />
        <div className="w-px h-8 bg-white/10" />
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">Time</div>
          <div className="text-sm font-extrabold font-mono tracking-wider text-white/80">
            01:23.4
          </div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">Pos</div>
          <div className="text-lg font-extrabold" style={{ color: palette.accent }}>1st</div>
        </div>
      </motion.div>

      {/* Top-right: Score */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 }}
        className="absolute top-4 right-4 px-4 py-2.5 rounded-xl z-20"
        style={hudGlass(palette)}
      >
        <ScoreDisplay score={score} palette={palette} />
      </motion.div>

      {/* Bottom-left: Speed gauge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute bottom-4 left-4 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl z-20"
        style={hudGlass(palette)}
      >
        <SpeedGauge speed={Math.round(speed)} palette={palette} />
        <BoostBar value={boost} palette={palette} />
      </motion.div>

      {/* Bottom-centre: Combo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl z-20"
        style={hudGlass(palette)}
      >
        <ComboMeter combo={combo} palette={palette} />
      </motion.div>

      {/* Bottom-right: Mini map */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-4 right-4 p-2.5 rounded-xl z-20"
        style={hudGlass(palette)}
      >
        <MiniMap carPos={carPos} palette={palette} />
        <div className="text-center mt-1.5 text-[8px] uppercase tracking-[0.2em] text-white/25">
          Track Map
        </div>
      </motion.div>

      {/* ── Pause button ── */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setPaused(p => !p)}
        className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest z-20 cursor-pointer"
        style={{
          ...hudGlass(palette),
          color: "rgba(255,255,255,0.5)",
        }}
      >
        ❙❙ Pause
      </motion.button>

      {/* ── Centre HUD (drift indicator) ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
        <motion.div
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
          className="text-center"
        >
          <div
            className="text-4xl font-extrabold uppercase tracking-[0.3em]"
            style={{
              background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: `drop-shadow(0 0 20px ${palette.glow})`,
            }}
          >
            DRIFT!
          </div>
          <div className="text-xs uppercase tracking-[0.4em] text-white/40 mt-1">+2,400 pts</div>
        </motion.div>
      </div>

      {/* ── Speed lines (motion effect) ── */}
      <div className="absolute inset-0 pointer-events-none z-5">
        {Array.from({ length: 8 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 h-px rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${palette.glow}30, transparent)`,
              width: `${20 + i * 5}%`,
              left: i % 2 === 0 ? 0 : "auto",
              right: i % 2 !== 0 ? 0 : "auto",
              top: `${20 + i * 8}%`,
            }}
            animate={{ scaleX: [0.3, 1, 0.3], opacity: [0, 0.5, 0] }}
            transition={{
              duration: 0.5 + i * 0.1,
              repeat: Infinity,
              repeatDelay: Math.random() * 2 + 0.5,
              delay: i * 0.18,
            }}
          />
        ))}
      </div>

      {/* ── Pause overlay ── */}
      {paused && <PauseMenu palette={palette} onClose={() => setPaused(false)} />}

      {/* ── Label ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-0 mt-16">
        {/* spacer */}
      </div>
    </div>
  )
}
