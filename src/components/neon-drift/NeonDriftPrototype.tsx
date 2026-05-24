"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { PALETTES, NeonPalette, PaletteId } from "./types"
import { NeonHighway } from "./NeonHighway"
import { NeonMenu } from "./NeonMenu"
import { NeonHUD } from "./NeonHUD"

// ── Tab system ─────────────────────────────────────────────────────────────────

type Tab = "menu" | "world" | "hud" | "palettes"

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: "menu",     label: "Main Menu",  icon: "◈", desc: "Cinematic menu design" },
  { id: "world",    label: "Environment",icon: "⬡", desc: "Synthwave highway world" },
  { id: "hud",      label: "HUD System", icon: "◎", desc: "In-game UI showcase" },
  { id: "palettes", label: "Palettes",   icon: "▣", desc: "Colour direction" },
]

// ── Palette switcher ──────────────────────────────────────────────────────────

function PalettePill({
  palette, active, onClick,
}: { palette: NeonPalette; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer"
      style={active ? {
        background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
        color: "#fff",
        boxShadow: `0 0 16px ${palette.glow}50`,
        border: "none",
      } : {
        background: "rgba(255,255,255,0.04)",
        border: `1px solid rgba(255,255,255,0.12)`,
        color: "rgba(255,255,255,0.45)",
      }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.glow})` }}
      />
      {palette.name}
    </motion.button>
  )
}

// ── Palette showcase card ─────────────────────────────────────────────────────

function PaletteCard({ palette, index }: { palette: NeonPalette; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${palette.primary}30`,
        boxShadow: `0 0 32px ${palette.glow}12`,
      }}
    >
      {/* Gradient preview strip */}
      <div
        className="h-16 rounded-xl w-full"
        style={{
          background: `linear-gradient(135deg, ${palette.bg} 0%, ${palette.bgMid} 30%, ${palette.primary}55 70%, ${palette.secondary}80 100%)`,
          boxShadow: `inset 0 0 20px ${palette.glow}20`,
        }}
      >
        {/* Sun preview */}
        <div className="w-full h-full flex items-center justify-center relative overflow-hidden rounded-xl">
          <div
            className="w-12 h-12 rounded-full"
            style={{
              background: `linear-gradient(180deg, ${palette.sunColors[0]}, ${palette.sunColors[1]}, ${palette.sunColors[2]})`,
              boxShadow: `0 0 28px ${palette.glow}70`,
            }}
          />
        </div>
      </div>

      {/* Name */}
      <div>
        <div
          className="text-sm font-extrabold tracking-wider uppercase mb-0.5"
          style={{ color: palette.primary }}
        >
          {palette.name}
        </div>
        <div className="text-[10px] text-white/30 uppercase tracking-[0.2em]">
          Colour Direction
        </div>
      </div>

      {/* Swatch row */}
      <div className="flex gap-2">
        {[
          { label: "Primary",   color: palette.primary },
          { label: "Secondary", color: palette.secondary },
          { label: "Accent",    color: palette.accent },
          { label: "Grid",      color: palette.grid },
          { label: "Glow",      color: palette.glow },
        ].map(sw => (
          <div key={sw.label} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full h-7 rounded-lg"
              style={{
                background: sw.color,
                boxShadow: `0 0 10px ${sw.color}60`,
              }}
            />
            <div className="text-[7px] uppercase tracking-wider text-white/30 text-center leading-tight">
              {sw.label}
            </div>
          </div>
        ))}
      </div>

      {/* Usage tokens */}
      <div className="flex flex-col gap-1.5">
        {[
          { role: "UI Borders",   color: palette.hudBorder },
          { role: "Grid Lines",   color: palette.grid },
          { role: "Bloom/Glow",   color: palette.glow },
          { role: "Bg Deep",      color: palette.bg },
        ].map(t => (
          <div key={t.role} className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">{t.role}</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-white/40">{t.color}</span>
              <div
                className="w-4 h-4 rounded-sm"
                style={{ background: t.color, boxShadow: `0 0 6px ${t.color}80` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Glassmorphism UI sample */}
      <div
        className="rounded-xl p-3 flex items-center gap-3"
        style={{
          background: "rgba(0,0,0,0.4)",
          border: `1px solid ${palette.hudBorder}25`,
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: palette.glow, boxShadow: `0 0 8px ${palette.glow}` }}
        />
        <div className="flex-1">
          <div className="text-[9px] text-white/35 uppercase tracking-[0.2em]">Sample glassmorphism panel</div>
          <div className="text-[10px] font-bold" style={{ color: palette.primary }}>
            88,420 pts · ×5 combo
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── World showcase (environment with overlaid info) ────────────────────────────

function WorldShowcase({ palette }: { palette: NeonPalette }) {
  return (
    <div className="relative w-full h-full">
      <NeonHighway palette={palette} speedMult={1} />

      {/* Overlaid labels */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-between items-start"
        >
          <div
            className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{
              background: "rgba(0,0,0,0.5)",
              border: `1px solid ${palette.primary}30`,
              color: palette.secondary,
              backdropFilter: "blur(8px)",
            }}
          >
            ⬡ Environment Preview
          </div>
          <div
            className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{
              background: "rgba(0,0,0,0.5)",
              border: `1px solid ${palette.primary}30`,
              color: "rgba(255,255,255,0.4)",
              backdropFilter: "blur(8px)",
            }}
          >
            Live Canvas · WebGL-ready
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap gap-2"
        >
          {[
            "Synthwave Grid",
            "Retro Sun + Scan Lines",
            "City Silhouette",
            "Light Streaks",
            "Twinkling Stars",
            "Road Perspective",
            "Atmospheric Fog",
          ].map(tag => (
            <div
              key={tag}
              className="px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest"
              style={{
                background: `${palette.primary}18`,
                border: `1px solid ${palette.primary}35`,
                color: palette.secondary,
                backdropFilter: "blur(6px)",
              }}
            >
              {tag}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// ── Main prototype ────────────────────────────────────────────────────────────

export function NeonDriftPrototype() {
  const [activeTab,     setActiveTab]     = useState<Tab>("menu")
  const [activePalette, setActivePalette] = useState<PaletteId>("synthwave")

  const palette = PALETTES[activePalette]

  return (
    <div
      className="relative flex flex-col w-full h-screen overflow-hidden"
      style={{ background: palette.bg }}
    >
      {/* ── Background highway (always present, dimmed behind non-world tabs) ── */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: activeTab === "world" ? 1 : 0.22 }}
      >
        <NeonHighway palette={palette} speedMult={activeTab === "world" ? 1 : 0.5} />
      </div>

      {/* ── Scanlines (always) ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.028]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
        }}
      />

      {/* ── Top bar ── */}
      <div
        className="relative z-30 flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{
          background: "rgba(0,0,0,0.55)",
          borderBottom: `1px solid ${palette.primary}20`,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Left: title */}
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[10px] font-extrabold uppercase tracking-[0.3em]"
            style={{ color: palette.primary }}
          >
            ◈
          </motion.div>
          <div>
            <div
              className="text-xs font-extrabold uppercase tracking-[0.2em]"
              style={{
                background: `linear-gradient(135deg, #fff, ${palette.secondary})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Neon Drift
            </div>
            <div className="text-[8px] uppercase tracking-[0.25em] text-white/25">
              Design Prototype · Visual Preview
            </div>
          </div>
        </div>

        {/* Right: palette pills */}
        <div className="flex gap-1.5 flex-wrap justify-end">
          {Object.values(PALETTES).map(p => (
            <PalettePill
              key={p.id}
              palette={p}
              active={activePalette === p.id}
              onClick={() => setActivePalette(p.id as PaletteId)}
            />
          ))}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="relative z-20 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "menu" && (
            <motion.div
              key="menu"
              className="absolute inset-0 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <NeonMenu palette={palette} />
            </motion.div>
          )}

          {activeTab === "world" && (
            <motion.div
              key="world"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <WorldShowcase palette={palette} />
            </motion.div>
          )}

          {activeTab === "hud" && (
            <motion.div
              key="hud"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <NeonHUD palette={palette} />
            </motion.div>
          )}

          {activeTab === "palettes" && (
            <motion.div
              key="palettes"
              className="absolute inset-0 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-5 pb-24">
                <div className="mb-5">
                  <div
                    className="text-xs font-extrabold uppercase tracking-[0.25em] mb-1"
                    style={{ color: palette.primary }}
                  >
                    Colour Directions
                  </div>
                  <div className="text-[10px] text-white/30 uppercase tracking-[0.2em]">
                    Four distinct visual identities — pick your vibe
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
                  {Object.values(PALETTES).map((p, i) => (
                    <PaletteCard key={p.id} palette={p} index={i} />
                  ))}
                </div>

                {/* Audio recommendations */}
                <div className="mt-8 max-w-3xl mx-auto">
                  <div
                    className="text-xs font-extrabold uppercase tracking-[0.25em] mb-3"
                    style={{ color: palette.primary }}
                  >
                    ♪ Music / Audio Direction
                  </div>
                  <div
                    className="rounded-2xl p-5 flex flex-col gap-3"
                    style={{
                      background: "rgba(0,0,0,0.45)",
                      border: `1px solid ${palette.primary}25`,
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <div className="text-[10px] text-white/40 leading-relaxed">
                      Target mood: <span style={{ color: palette.secondary }}>midnight neon highway · futuristic arcade energy · retro-future drive</span>
                    </div>
                    {[
                      { src: "Pixabay Music",         url: "pixabay.com/music",        note: "Royalty-free synthwave tracks, direct download" },
                      { src: "StreamBeats (Harris H)", url: "streambeats.com",           note: "Lo-fi / synthwave, 100% stream-safe" },
                      { src: "Mixkit",                url: "mixkit.co/free-music",      note: "Curated free-license electronic / synthwave" },
                      { src: "Free Music Archive",    url: "freemusicarchive.org",      note: "CC-licensed artists — search 'synthwave', 'outrun'" },
                    ].map(r => (
                      <div
                        key={r.src}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        <motion.div
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.8, repeat: Infinity, delay: Math.random() }}
                          className="text-sm flex-shrink-0 mt-0.5"
                        >♪</motion.div>
                        <div>
                          <div className="text-[10px] font-bold text-white/70">{r.src}</div>
                          <div className="text-[9px]" style={{ color: palette.accent }}>
                            {r.url}
                          </div>
                          <div className="text-[9px] text-white/30 mt-0.5">{r.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tech stack note */}
                <div className="mt-6 max-w-3xl mx-auto">
                  <div
                    className="rounded-2xl p-5"
                    style={{
                      background: "rgba(0,0,0,0.45)",
                      border: `1px solid ${palette.primary}25`,
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <div
                      className="text-xs font-extrabold uppercase tracking-[0.25em] mb-3"
                      style={{ color: palette.primary }}
                    >
                      ◎ Next Phase: Full Build
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "React + TypeScript",
                        "Three.js highway",
                        "Framer Motion UI",
                        "Cannon.js physics",
                        "Drift mechanic",
                        "Leaderboards",
                        "Sound engine",
                        "Mobile controls",
                        "Bloom post-FX",
                      ].map(tag => (
                        <div
                          key={tag}
                          className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                          style={{
                            background: `${palette.primary}15`,
                            border: `1px solid ${palette.primary}30`,
                            color: palette.primary,
                          }}
                        >
                          {tag}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom tab bar ── */}
      <div
        className="relative z-30 flex items-center justify-center gap-1 px-4 py-3 flex-shrink-0"
        style={{
          background: "rgba(0,0,0,0.7)",
          borderTop: `1px solid ${palette.primary}18`,
          backdropFilter: "blur(24px)",
        }}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer flex-1 max-w-[100px]"
              style={isActive ? {
                background: `${palette.primary}20`,
                border: `1px solid ${palette.primary}45`,
                boxShadow: `0 0 12px ${palette.glow}25`,
              } : {
                background: "transparent",
                border: "1px solid transparent",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="tabIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: palette.primary }}
                />
              )}
              <span
                className="text-base leading-none"
                style={{ color: isActive ? palette.primary : "rgba(255,255,255,0.3)" }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wider leading-none"
                style={{ color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)" }}
              >
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
