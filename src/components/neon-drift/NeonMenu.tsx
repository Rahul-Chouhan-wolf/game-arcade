"use client"

import { motion, AnimatePresence } from "motion/react"
import { useState } from "react"
import { NeonPalette } from "./types"

// ── Neon hover car (SVG) ──────────────────────────────────────────────────────

function NeonCar({ palette }: { palette: NeonPalette }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
      className="relative flex justify-center"
    >
      {/* Ground glow */}
      <motion.div
        animate={{ opacity: [0.4, 0.8, 0.4], scaleX: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-6 rounded-full blur-xl"
        style={{ background: `radial-gradient(ellipse, ${palette.glow}80 0%, transparent 70%)` }}
      />

      <svg viewBox="0 0 520 180" className="w-full max-w-sm" role="img" aria-label="Neon drift car">
        <defs>
          <radialGradient id="underGlow" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2a2a3e" />
            <stop offset="60%" stopColor="#14141f" />
            <stop offset="100%" stopColor="#0a0a12" />
          </linearGradient>
          <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={palette.primary} stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="trailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0" />
            <stop offset="50%" stopColor={palette.glow} stopOpacity="0.3" />
            <stop offset="100%" stopColor={palette.secondary} stopOpacity="0.05" />
          </linearGradient>
          <filter id="neonBloom">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="softBloom">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Motion trail */}
        <motion.g
          animate={{ opacity: [0.6, 0.9, 0.6], x: [0, -4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M340 118 L490 106 L510 126 L492 138 L340 132 Z"
            fill="url(#trailGrad)" />
          <path d="M340 112 L480 102 L498 112 L480 118 L340 116 Z"
            fill="url(#trailGrad)" opacity="0.4" />
        </motion.g>

        {/* Underglow ellipse */}
        <motion.ellipse
          cx="205" cy="155" rx="165" ry="16"
          fill="url(#underGlow)"
          animate={{ ry: [14, 20, 14], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Body main */}
        <path
          d="M62 132 L88 100 C100 86 128 76 165 74 L285 72 C318 72 346 80 362 95 L388 125 L395 136 L60 140 Z"
          fill="url(#bodyGrad)"
          stroke={palette.primary}
          strokeWidth="0.8"
          strokeOpacity="0.5"
        />

        {/* Cabin / windshield */}
        <path
          d="M162 74 L185 52 C193 44 220 40 255 40 L285 40 C308 40 326 47 335 56 L355 74 L290 72 L172 72 Z"
          fill="url(#glassGrad)"
          stroke={palette.accent}
          strokeWidth="1"
          strokeOpacity="0.6"
          filter="url(#neonBloom)"
        />

        {/* Windshield highlight */}
        <path
          d="M195 62 L210 48 L270 46 L310 58 L295 68 L215 68 Z"
          fill="white"
          opacity="0.06"
        />

        {/* Front splitter */}
        <path
          d="M62 136 L55 140 L50 145 L60 148 L395 148 L405 144 L388 140 L62 136 Z"
          fill={palette.primary}
          opacity="0.7"
          filter="url(#neonBloom)"
        />

        {/* Neon trim stripe */}
        <motion.path
          d="M90 108 L355 108"
          stroke={palette.glow}
          strokeWidth="1.5"
          fill="none"
          filter="url(#neonBloom)"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Door panel lines */}
        <path d="M150 74 L140 136" stroke={palette.primary} strokeWidth="0.6" opacity="0.4" />
        <path d="M270 72 L280 136" stroke={palette.primary} strokeWidth="0.6" opacity="0.4" />

        {/* Front hover pod */}
        <ellipse cx="108" cy="146" rx="40" ry="9" fill="#0e0e1e" />
        <motion.ellipse
          cx="108" cy="148" rx="36" ry="5"
          fill={palette.glow}
          opacity="0.85"
          filter="url(#softBloom)"
          animate={{ opacity: [0.6, 1, 0.6], ry: [4, 7, 4] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        />
        <ellipse cx="108" cy="146" rx="36" ry="4" fill={palette.glow} opacity="0.5" />

        {/* Rear hover pod */}
        <ellipse cx="342" cy="146" rx="40" ry="9" fill="#0e0e1e" />
        <motion.ellipse
          cx="342" cy="148" rx="36" ry="5"
          fill={palette.glow}
          opacity="0.85"
          filter="url(#softBloom)"
          animate={{ opacity: [0.7, 1, 0.7], ry: [4, 7, 4] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
        <ellipse cx="342" cy="146" rx="36" ry="4" fill={palette.glow} opacity="0.5" />

        {/* Engine exhaust glows */}
        <motion.ellipse
          cx="390" cy="120" rx="8" ry="5"
          fill={palette.secondary}
          filter="url(#softBloom)"
          animate={{ opacity: [0.4, 0.9, 0.4], rx: [6, 12, 6] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.ellipse
          cx="390" cy="126" rx="8" ry="5"
          fill={palette.accent}
          filter="url(#softBloom)"
          animate={{ opacity: [0.3, 0.8, 0.3], rx: [5, 10, 5] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
        />
      </svg>
    </motion.div>
  )
}

// ── Menu button ────────────────────────────────────────────────────────────────

interface MenuBtnProps {
  label: string
  icon: string
  primary?: boolean
  palette: NeonPalette
  delay?: number
}

function MenuBtn({ label, icon, primary, palette, delay = 0 }: MenuBtnProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.button
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.03, x: 4 }}
      whileTap={{ scale: 0.97 }}
      className="relative w-full flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm tracking-widest uppercase overflow-hidden transition-all duration-200 cursor-pointer"
      style={primary ? {
        background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
        boxShadow: hovered
          ? `0 0 32px ${palette.glow}70, 0 0 8px ${palette.glow}50`
          : `0 0 18px ${palette.glow}40`,
        color: "#fff",
        border: "none",
      } : {
        background: hovered ? `${palette.primary}12` : `rgba(255,255,255,0.04)`,
        border: `1px solid ${hovered ? palette.primary + "60" : "rgba(255,255,255,0.1)"}`,
        color: hovered ? "#fff" : "rgba(255,255,255,0.55)",
        boxShadow: hovered ? `0 0 16px ${palette.glow}20` : "none",
      }}
    >
      {/* Animated shimmer on primary */}
      {primary && (
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }}
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
            width: "40%",
          }}
        />
      )}
      <span className="text-base w-5 flex-shrink-0">{icon}</span>
      <span className="relative">{label}</span>
      {primary && (
        <motion.span
          className="ml-auto text-[10px] tracking-[0.3em] opacity-60"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          ▶ GO
        </motion.span>
      )}
    </motion.button>
  )
}

// ── Main menu ─────────────────────────────────────────────────────────────────

interface Props {
  palette: NeonPalette
}

export function NeonMenu({ palette }: Props) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">

      {/* ── Scanlines overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 3px)",
        }}
      />

      {/* ── Radial spotlight vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none z-[9]"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(0,0,0,0.55) 100%)`,
        }}
      />

      {/* ── Centre panel ── */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-sm px-5 gap-0">

        {/* ── Badge ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-5 flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.3em]"
          style={{
            borderColor: `${palette.primary}40`,
            background: `${palette.primary}12`,
            color: palette.secondary,
          }}
        >
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >◈</motion.span>
          Design Preview · Visual Prototype
        </motion.div>

        {/* ── Title ── */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-extrabold tracking-[0.18em] uppercase text-center leading-none mb-1"
          style={{
            fontSize: "clamp(2.8rem, 10vw, 5rem)",
            background: `linear-gradient(135deg, #fff 20%, ${palette.secondary} 55%, ${palette.primary} 90%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none",
            filter: `drop-shadow(0 0 24px ${palette.glow}90)`,
          }}
        >
          NEON
        </motion.h1>
        <motion.h1
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.28, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-extrabold tracking-[0.22em] uppercase text-center leading-none mb-6"
          style={{
            fontSize: "clamp(2.8rem, 10vw, 5rem)",
            background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 50%, #fff 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 32px ${palette.glow}99)`,
          }}
        >
          DRIFT
        </motion.h1>

        {/* ── Tagline ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-white/40 text-xs tracking-[0.25em] uppercase mb-3 text-center"
        >
          Race the neon night
        </motion.p>

        {/* ── Car ── */}
        <div className="w-full mb-4">
          <NeonCar palette={palette} />
        </div>

        {/* ── Buttons ── */}
        <div className="w-full flex flex-col gap-2.5">
          <MenuBtn label="Start Drift" icon="⚡" primary palette={palette} delay={0.55} />
          <MenuBtn label="Garage"      icon="🚗" palette={palette} delay={0.65} />
          <MenuBtn label="Music"       icon="🎵" palette={palette} delay={0.72} />
          <MenuBtn label="Settings"    icon="⚙" palette={palette} delay={0.79} />
        </div>

        {/* ── Bottom stats ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className="w-full mt-5 flex justify-between items-center px-2"
          style={{ borderTop: `1px solid ${palette.primary}22`, paddingTop: 12 }}
        >
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-[0.25em] text-white/25 mb-0.5">Best Time</div>
            <div className="text-xs font-bold tracking-wider" style={{ color: palette.accent }}>1:23.456</div>
          </div>
          <div
            className="text-[9px] uppercase tracking-[0.25em] font-bold"
            style={{ color: `${palette.primary}60` }}
          >
            ◈ NEON DRIFT ◈
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-[0.25em] text-white/25 mb-0.5">High Score</div>
            <div className="text-xs font-bold tracking-wider" style={{ color: palette.accent }}>88,420</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
