"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { GameHub } from "./game-hub"
import { ChevronDown } from "lucide-react"

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function HomeContent() {
  const [scrollY, setScrollY] = useState(0)
  const [winH, setWinH] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setWinH(window.innerHeight)
    const onScroll = () => setScrollY(window.scrollY)
    const onResize = () => setWinH(window.innerHeight)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  const h = winH || 800

  // Animation spans the hero scroll (completes as game section nears viewport)
  const rawP = Math.min(1, scrollY / (h * 0.75))
  const t = 1 - Math.pow(1 - rawP, 3) // cubic ease-out

  // ── Title interpolations ──
  const startSize = Math.min(Math.max(h * 0.17, 72), 170)
  const endSize = 36
  const fontSize = lerp(startSize, endSize, t)

  // Vertical: center of viewport → settling position (28px from top)
  const startTop = h * 0.5 - startSize * 0.48
  const endTop = 28
  const titleTop = lerp(startTop, endTop, t)

  // Subtitle fades out during first half of scroll
  const subtitleOpacity = Math.max(0, 1 - rawP * 2)
  const subtitleMargin = lerp(20, 6, t)

  // Chevron fades out very quickly
  const chevronOpacity = Math.max(0, 1 - rawP * 3)

  // Glow diminishes
  const glowSize = lerp(50, 0, t)
  const glowAlpha = lerp(0.12, 0, t)

  // Switch from fixed title → in-flow title when game section enters viewport
  // At scrollY = h, in-flow title (pt-7 = 28px) is at viewport y = 28px — matches fixed endTop
  const pastHero = scrollY >= h

  const gradientStyle = {
    background:
      "linear-gradient(168deg, #ffffff 10%, rgba(45,212,191,0.6) 55%, rgba(129,140,248,0.45) 100%)",
    WebkitBackgroundClip: "text" as const,
    WebkitTextFillColor: "transparent" as const,
  }

  // SSR / pre-mount fallback
  if (!mounted) {
    return (
      <div className="relative z-10">
        <div className="h-screen flex items-center px-4">
          <div className="max-w-2xl mx-auto w-full">
            <h1
              className="text-[72px] sm:text-[120px] md:text-[160px] font-black uppercase leading-none tracking-[-0.03em] select-none"
              style={gradientStyle}
            >
              Arcade
            </h1>
            <div className="mt-5">
              <div style={{ width: 40, height: 1, background: "rgba(255,255,255,0.2)" }} className="mb-3" />
              <p
                className="text-[13px] sm:text-[15px] tracking-[0.2em] uppercase font-medium"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Premium browser games
              </p>
            </div>
          </div>
        </div>
        <GameHub />
      </div>
    )
  }

  return (
    <div className="relative z-10">
      {/* ── Fixed title — shrinks from hero center-left to above-grid position ── */}
      <div
        className="fixed inset-x-0 z-50 pointer-events-none px-4"
        style={{
          top: titleTop,
          opacity: pastHero ? 0 : 1,
          transition: "opacity 0.12s ease",
        }}
      >
        <div className="max-w-2xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="font-black uppercase leading-none tracking-[-0.03em] select-none"
            style={{
              fontSize,
              ...gradientStyle,
              filter:
                glowSize > 1
                  ? `drop-shadow(0 0 ${glowSize}px rgba(45,212,191,${glowAlpha}))`
                  : "none",
              willChange: "font-size",
            }}
          >
            Arcade
          </motion.h1>

          {/* Subtitle — left-aligned, fades out during scroll */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            style={{ opacity: subtitleOpacity, marginTop: subtitleMargin }}
          >
            <div
              style={{ width: 40, height: 1, background: "rgba(255,255,255,0.2)" }}
              className="mb-3"
            />
            <p
              className="text-[13px] sm:text-[15px] tracking-[0.2em] uppercase font-medium"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Premium browser games
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Hero spacer — full viewport ── */}
      <div className="relative h-screen">
        {/* Scroll indicator — centered at bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div
            className="flex flex-col items-center gap-2 cursor-pointer"
            style={{ opacity: chevronOpacity }}
            onClick={() => window.scrollTo({ top: h, behavior: "smooth" })}
          >
            <span
              className="text-[9px] uppercase tracking-[0.3em] font-semibold"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Explore
            </span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            >
              <ChevronDown className="w-5 h-5" style={{ color: "rgba(255,255,255,0.3)" }} />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* ── In-flow title — settles above game grid, scrolls normally ── */}
      <div className="w-full px-4">
        <div className="max-w-2xl mx-auto pt-7">
          <h1
            className="text-[36px] font-black uppercase leading-none tracking-[-0.03em] select-none mb-8"
            style={{
              ...gradientStyle,
              opacity: pastHero ? 1 : 0,
              transition: "opacity 0.15s ease",
            }}
          >
            Arcade
          </h1>
        </div>
      </div>

      {/* ── Game Hub ── */}
      <GameHub />
    </div>
  )
}
