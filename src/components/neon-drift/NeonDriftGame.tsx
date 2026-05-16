"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { PALETTES, NeonPalette, PaletteId } from "./types"
import {
  CarState, InputState,
  createCar, stepCar, normalizeAngle,
} from "@/lib/neon-drift/physics"
import {
  TRACK_RADIUS, TRACK_HALF_WIDTH,
  TRACK_START_X, TRACK_START_Y, TRACK_START_HEADING,
  isOnTrack, constrainToTrack,
} from "@/lib/neon-drift/track"
import { AudioEngine } from "@/lib/neon-drift/audio"

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "menu" | "countdown" | "playing" | "paused" | "gameover"

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number         // 1 → 0
  maxLife: number
  size: number
  color: string
  isSpark: boolean
}

interface Camera {
  x: number; y: number
  heading: number
}

interface DriftNotif {
  id: number
  points: number
  combo: number
  x: number; y: number  // screen position (for floating label)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTER_R       = TRACK_RADIUS + TRACK_HALF_WIDTH
const INNER_R       = TRACK_RADIUS - TRACK_HALF_WIDTH
const MAX_PARTICLES = 160
const TOTAL_LAPS    = 3

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function hex2rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

// ─── Track rendering ──────────────────────────────────────────────────────────

function drawTrack(ctx: CanvasRenderingContext2D, palette: NeonPalette, t: number) {
  // Surface fill
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, OUTER_R, 0, 2 * Math.PI)
  ctx.arc(0, 0, INNER_R, 0, 2 * Math.PI, true)
  ctx.fillStyle = "#0c0c1e"
  ctx.fill()

  // Outer kerb — alternating neon / dark arc sections
  const KERB_W = 14
  const KERB_SEGS = 24
  for (let i = 0; i < KERB_SEGS; i++) {
    const a1 = (i / KERB_SEGS) * 2 * Math.PI
    const a2 = ((i + 0.5) / KERB_SEGS) * 2 * Math.PI
    ctx.beginPath()
    ctx.arc(0, 0, OUTER_R, a1, a2)
    ctx.arc(0, 0, OUTER_R - KERB_W, a2, a1, true)
    ctx.closePath()
    ctx.fillStyle = i % 2 === 0 ? hex2rgba(palette.primary, 0.9) : "rgba(255,255,255,0.12)"
    ctx.fill()
  }

  // Inner kerb
  for (let i = 0; i < KERB_SEGS; i++) {
    const a1 = (i / KERB_SEGS) * 2 * Math.PI
    const a2 = ((i + 0.5) / KERB_SEGS) * 2 * Math.PI
    ctx.beginPath()
    ctx.arc(0, 0, INNER_R, a1, a2)
    ctx.arc(0, 0, INNER_R + KERB_W, a2, a1, true)
    ctx.closePath()
    ctx.fillStyle = i % 2 === 0 ? hex2rgba(palette.secondary, 0.85) : "rgba(255,255,255,0.10)"
    ctx.fill()
  }

  // Centre dashes (rotate with time for movement feel)
  const DASH_COUNT = 30
  ctx.strokeStyle = hex2rgba(palette.grid, 0.5)
  ctx.lineWidth = 2
  ctx.setLineDash([18, 22])
  ctx.lineDashOffset = -t * 40
  ctx.shadowColor = palette.glow
  ctx.shadowBlur  = 6
  ctx.beginPath()
  ctx.arc(0, 0, TRACK_RADIUS, 0, 2 * Math.PI)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.shadowBlur = 0
  void DASH_COUNT

  // Outer glow ring
  ctx.beginPath()
  ctx.arc(0, 0, OUTER_R, 0, 2 * Math.PI)
  ctx.strokeStyle = hex2rgba(palette.glow, 0.35)
  ctx.lineWidth = 3
  ctx.shadowColor = palette.glow
  ctx.shadowBlur  = 18
  ctx.stroke()

  // Inner glow ring
  ctx.beginPath()
  ctx.arc(0, 0, INNER_R, 0, 2 * Math.PI)
  ctx.strokeStyle = hex2rgba(palette.secondary, 0.30)
  ctx.lineWidth = 2.5
  ctx.shadowColor = palette.secondary
  ctx.shadowBlur  = 14
  ctx.stroke()
  ctx.shadowBlur = 0

  // Start / finish line (at angle –π/2, top of track)
  const SFX = 0
  const SFY_OUTER = -OUTER_R
  const SFY_INNER = -INNER_R
  ctx.save()
  ctx.translate(SFX, (SFY_OUTER + SFY_INNER) / 2)
  ctx.rotate(0)
  const sfLen = TRACK_HALF_WIDTH * 2
  const sfW   = 22
  // Checkered pattern
  for (let ci = 0; ci < 4; ci++) {
    for (let ri = 0; ri < 2; ri++) {
      ctx.fillStyle = (ci + ri) % 2 === 0 ? "#ffffff" : "#000000"
      ctx.fillRect(
        -sfW / 2 + ri * (sfW / 2),
        -sfLen / 2 + ci * (sfLen / 4),
        sfW / 2, sfLen / 4,
      )
    }
  }
  ctx.restore()

  ctx.restore()
}

// ─── Background ───────────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, palette: NeonPalette) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7)
  g.addColorStop(0, palette.bgMid)
  g.addColorStop(1, palette.bg)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// ─── Car rendering ────────────────────────────────────────────────────────────

function drawCar(ctx: CanvasRenderingContext2D, car: CarState, palette: NeonPalette) {
  ctx.save()
  ctx.translate(car.x, car.y)
  ctx.rotate(car.heading)  // car body faces right (angle = 0)

  // --- Underglow (tinted, slightly below) ---
  const ugGrad = ctx.createRadialGradient(0, 4, 0, 0, 4, 40)
  ugGrad.addColorStop(0, hex2rgba(palette.glow, 0.7))
  ugGrad.addColorStop(1, "transparent")
  ctx.fillStyle = ugGrad
  ctx.beginPath()
  ctx.ellipse(0, 6, 42, 16, 0, 0, 2 * Math.PI)
  ctx.fill()

  // Drift smoke tyre marks
  if (car.drifting) {
    const driftGlow = Math.min(Math.abs(car.driftAngle) / 0.8, 1)
    ctx.fillStyle = hex2rgba(palette.glow, 0.25 * driftGlow)
    ctx.beginPath()
    ctx.ellipse(-28, -11, 5, 4, 0, 0, 2 * Math.PI)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-28, 11, 5, 4, 0, 0, 2 * Math.PI)
    ctx.fill()
  }

  // Main body shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  roundRect(ctx, -30, -12, 62, 26, 7)
  ctx.fill()

  // Main body
  const bodyGrad = ctx.createLinearGradient(0, -14, 0, 14)
  bodyGrad.addColorStop(0, "#1e1e3a")
  bodyGrad.addColorStop(0.5, "#14142a")
  bodyGrad.addColorStop(1, "#0e0e1e")
  ctx.shadowColor = palette.primary
  ctx.shadowBlur  = 12
  roundRect(ctx, -31, -13, 62, 26, 6)
  ctx.fillStyle = bodyGrad
  ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.primary, 0.85)
  ctx.lineWidth = 1.8
  ctx.stroke()
  ctx.shadowBlur = 0

  // Neon side stripe
  ctx.strokeStyle = hex2rgba(palette.glow, 0.9)
  ctx.lineWidth = 1.5
  ctx.shadowColor = palette.glow
  ctx.shadowBlur  = 8
  ctx.beginPath()
  ctx.moveTo(-22, -13)
  ctx.lineTo( 22, -13)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-22, 13)
  ctx.lineTo( 22, 13)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Windshield / cabin
  ctx.fillStyle = hex2rgba(palette.accent, 0.28)
  ctx.strokeStyle = hex2rgba(palette.accent, 0.65)
  ctx.lineWidth = 1
  roundRect(ctx, -6, -10, 24, 20, 4)
  ctx.fill()
  ctx.stroke()

  // Front headlights
  for (const sy of [-9, 9]) {
    ctx.beginPath()
    ctx.ellipse(31, sy, 5, 3, 0, 0, 2 * Math.PI)
    ctx.fillStyle = "#ffffff"
    ctx.shadowColor = "#ffffff"
    ctx.shadowBlur  = 14
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Rear engine glow
  ctx.beginPath()
  ctx.ellipse(-34, 0, 4, 9, 0, 0, 2 * Math.PI)
  ctx.fillStyle = hex2rgba(palette.secondary, 0.95)
  ctx.shadowColor = palette.secondary
  ctx.shadowBlur  = 18
  ctx.fill()
  ctx.shadowBlur = 0

  // Wheel pods (visual only)
  for (const [wx, wy] of [[-18, -14], [14, -14], [-18, 14], [14, 14]]) {
    roundRect(ctx, wx - 8, wy - 4, 14, 7, 2)
    ctx.fillStyle = "#0a0a14"
    ctx.fill()
    ctx.strokeStyle = hex2rgba(palette.grid, 0.6)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.restore()
}

// ─── Particles ────────────────────────────────────────────────────────────────

function spawnDriftParticles(
  car: CarState,
  palette: NeonPalette,
  particles: Particle[],
  count = 2,
) {
  const rearX = car.x - Math.cos(car.heading) * 26
  const rearY = car.y - Math.sin(car.heading) * 26
  const perpX = -Math.sin(car.heading)
  const perpY =  Math.cos(car.heading)

  for (let side = -1; side <= 1; side += 2) {
    for (let ci = 0; ci < count; ci++) {
      if (particles.length >= MAX_PARTICLES) break
      const wx = rearX + perpX * side * 11
      const wy = rearY + perpY * side * 11

      const driftAmt = Math.abs(car.driftAngle)
      const isSpark  = driftAmt > 0.55 && Math.random() < 0.3

      particles.push({
        x: wx + (Math.random() - 0.5) * 8,
        y: wy + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 55 - car.vx * 0.12,
        vy: (Math.random() - 0.5) * 55 - car.vy * 0.12,
        life: 1,
        maxLife: isSpark ? 0.28 + Math.random() * 0.18 : 0.7 + Math.random() * 0.5,
        size: isSpark ? Math.random() * 3 + 1 : Math.random() * 16 + 6,
        color: isSpark ? palette.accent : palette.glow,
        isSpark,
      })
    }
  }
}

function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.94
    p.vy *= 0.94
    p.life -= dt / p.maxLife
    if (p.life <= 0) particles.splice(i, 1)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const a = Math.pow(p.life, 0.5)
    ctx.globalAlpha = a
    if (p.isSpark) {
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur  = 6
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI)
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
      g.addColorStop(0, hex2rgba(p.color, 0.55))
      g.addColorStop(1, "transparent")
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

// ─── HUD (canvas) ─────────────────────────────────────────────────────────────

function drawHUD(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  car: CarState,
  palette: NeonPalette,
  countdown: number,
) {
  ctx.save()
  // Use identity transform for HUD (screen-space)
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0)

  const DPR = 1  // we already scaled the transform above

  // ── Speed (bottom-left) ───────────────────────────────────────────────────
  const speedKmh = Math.round(car.speed * 0.5)
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.beginPath()
  ctx.roundRect(14, H - 80, 100, 66, 12)
  ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.4)
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.font = `900 38px 'SF Mono', 'Fira Mono', monospace`
  ctx.fillStyle = "#fff"
  ctx.shadowColor = palette.glow
  ctx.shadowBlur  = 14
  ctx.textAlign   = "center"
  ctx.fillText(`${speedKmh}`, 64, H - 44)
  ctx.shadowBlur = 0
  ctx.font = `700 9px system-ui`
  ctx.fillStyle = hex2rgba(palette.primary, 0.7)
  ctx.fillText("KM/H", 64, H - 28)

  // ── Score (top-right) ──────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.beginPath()
  ctx.roundRect(W - 150, 14, 136, 50, 12)
  ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.35)
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.font = `700 9px system-ui`
  ctx.fillStyle = hex2rgba(palette.primary, 0.55)
  ctx.textAlign = "right"
  ctx.fillText("SCORE", W - 18, 32)

  ctx.font = `900 22px 'SF Mono', 'Fira Mono', monospace`
  ctx.fillStyle = "#fff"
  ctx.shadowColor = palette.glow
  ctx.shadowBlur  = 10
  ctx.fillText(car.score.toLocaleString(), W - 18, 56)
  ctx.shadowBlur = 0

  // ── Lap + Combo (top-left) ─────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.beginPath()
  ctx.roundRect(14, 14, 112, 50, 12)
  ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.35)
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.font = `700 9px system-ui`
  ctx.fillStyle = hex2rgba(palette.primary, 0.55)
  ctx.textAlign = "left"
  ctx.fillText("LAP", 26, 32)

  ctx.font = `900 22px 'SF Mono', 'Fira Mono', monospace`
  ctx.fillStyle = palette.accent
  ctx.shadowColor = palette.accent
  ctx.shadowBlur  = 8
  ctx.fillText(`${car.lap + 1}/${TOTAL_LAPS}`, 26, 56)
  ctx.shadowBlur = 0

  if (car.combo > 1) {
    ctx.font = `900 16px 'SF Mono', 'Fira Mono', monospace`
    ctx.fillStyle = palette.secondary
    ctx.shadowColor = palette.secondary
    ctx.shadowBlur  = 10
    ctx.fillText(`×${car.combo}`, 78, 56)
    ctx.shadowBlur = 0
  }

  // ── Drift angle bar (bottom-centre) ──────────────────────────────────────
  const barW = Math.min(200, W * 0.45)
  const barH_px = 7
  const barX = (W - barW) / 2
  const barY = H - 36

  // BG
  ctx.fillStyle = "rgba(0,0,0,0.5)"
  ctx.beginPath()
  ctx.roundRect(barX - 12, barY - 8, barW + 24, barH_px + 20, 8)
  ctx.fill()

  ctx.fillStyle = "rgba(255,255,255,0.08)"
  ctx.beginPath()
  ctx.roundRect(barX, barY, barW, barH_px, 3)
  ctx.fill()

  const driftFrac = Math.min(Math.abs(car.driftAngle) / 1.1, 1)
  if (driftFrac > 0) {
    const fillW = barW * driftFrac
    const fillX = barX + (barW - fillW) / 2
    const barGrad = ctx.createLinearGradient(fillX, 0, fillX + fillW, 0)
    barGrad.addColorStop(0, hex2rgba(palette.primary, 0.6))
    barGrad.addColorStop(0.5, palette.glow)
    barGrad.addColorStop(1, hex2rgba(palette.primary, 0.6))
    ctx.fillStyle = car.drifting ? barGrad : hex2rgba(palette.primary, 0.3)
    ctx.shadowColor = palette.glow
    ctx.shadowBlur  = car.drifting ? 12 : 0
    ctx.beginPath()
    ctx.roundRect(fillX, barY, fillW, barH_px, 3)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Centre pip
  ctx.fillStyle = "rgba(255,255,255,0.6)"
  ctx.fillRect(barX + barW / 2 - 1, barY - 2, 2, barH_px + 4)

  // DRIFT label
  if (car.drifting) {
    ctx.font = `900 8px system-ui`
    ctx.fillStyle = palette.glow
    ctx.shadowColor = palette.glow
    ctx.shadowBlur  = 8
    ctx.textAlign   = "center"
    ctx.fillText("DRIFT", W / 2, barY + barH_px + 16)
    ctx.shadowBlur = 0
  }

  // ── Countdown ──────────────────────────────────────────────────────────────
  if (countdown > 0) {
    ctx.font      = `900 80px system-ui`
    ctx.textAlign = "center"
    ctx.fillStyle = "#fff"
    ctx.shadowColor = palette.glow
    ctx.shadowBlur  = 40
    ctx.fillText(countdown > 0.5 ? String(Math.ceil(countdown)) : "GO!", W / 2, H / 2 + 28)
    ctx.shadowBlur = 0
  }

  ctx.restore()
  void DPR
}

// ─── Speed lines (screen-space) ───────────────────────────────────────────────

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  speed: number,
  palette: NeonPalette,
  t: number,
) {
  const intensity = Math.max(0, (speed - 180) / 280)  // 0–1 above 180 km/h
  if (intensity < 0.01) return

  ctx.save()
  const cx = W / 2, cy = H / 2
  const LINE_COUNT = 14

  for (let i = 0; i < LINE_COUNT; i++) {
    const angle  = (i / LINE_COUNT) * Math.PI * 2 + t * 0.15
    const dist   = 80 + ((i * 37 + t * 120) % (Math.max(W, H) * 0.6))
    const lineLen = 40 + intensity * 140

    const x1 = cx + Math.cos(angle) * dist
    const y1 = cy + Math.sin(angle) * dist
    const x2 = cx + Math.cos(angle) * (dist + lineLen)
    const y2 = cy + Math.sin(angle) * (dist + lineLen)

    const grad = ctx.createLinearGradient(x1, y1, x2, y2)
    grad.addColorStop(0, "transparent")
    grad.addColorStop(0.5, hex2rgba(palette.glow, 0.12 * intensity))
    grad.addColorStop(1, "transparent")

    ctx.strokeStyle = grad
    ctx.lineWidth   = 1.2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.restore()
}

// ─── Vignette ────────────────────────────────────────────────────────────────

function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85)
  g.addColorStop(0, "transparent")
  g.addColorStop(1, "rgba(0,0,0,0.55)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// ─── Touch controls ───────────────────────────────────────────────────────────

interface TouchControlsProps {
  onInput: (key: keyof InputState, val: boolean) => void
}

function TouchControls({ onInput }: TouchControlsProps) {
  const btnCls = "select-none flex items-center justify-center rounded-2xl text-white/70 font-extrabold text-xl active:scale-95 transition-all"
  const btnStyle = "background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.14);"

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-6 px-4 gap-3">
      <div className="pointer-events-auto flex justify-between items-end gap-3">
        {/* Left: steer left */}
        <button
          className={`${btnCls} w-20 h-20`}
          style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.14)" }}
          onPointerDown={() => onInput("left", true)}
          onPointerUp={() => onInput("left", false)}
          onPointerLeave={() => onInput("left", false)}
        >◀</button>

        {/* Centre: throttle + handbrake */}
        <div className="flex flex-col gap-2 items-center">
          <button
            className={`${btnCls} w-24 h-14 text-sm tracking-widest`}
            style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.14)" }}
            onPointerDown={() => onInput("throttle", true)}
            onPointerUp={() => onInput("throttle", false)}
            onPointerLeave={() => onInput("throttle", false)}
          >GAS</button>
          <button
            className={`${btnCls} w-24 h-14 text-sm tracking-widest`}
            style={{ background: "rgba(255,255,255,0.10)", border: "1.5px solid rgba(255,255,255,0.22)" }}
            onPointerDown={() => onInput("handbrake", true)}
            onPointerUp={() => onInput("handbrake", false)}
            onPointerLeave={() => onInput("handbrake", false)}
          >DRIFT</button>
        </div>

        {/* Right: steer right */}
        <button
          className={`${btnCls} w-20 h-20`}
          style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.14)" }}
          onPointerDown={() => onInput("right", true)}
          onPointerUp={() => onInput("right", false)}
          onPointerLeave={() => onInput("right", false)}
        >▶</button>
      </div>
      <div className="pointer-events-auto flex justify-center">
        <div className="text-[10px] text-white/20 uppercase tracking-widest">KB: ← → ↑ Space</div>
      </div>
    </div>
  )
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function glassBox(borderColor: string) {
  return {
    background: "rgba(0,0,0,0.60)",
    border: `1px solid ${borderColor}30`,
    backdropFilter: "blur(20px)",
  } as React.CSSProperties
}

interface MenuOverlayProps {
  palette: NeonPalette
  onStart: () => void
  onPaletteChange: (id: PaletteId) => void
  activePalette: PaletteId
}

function MenuOverlay({ palette, onStart, onPaletteChange, activePalette }: MenuOverlayProps) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-30 select-none"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Title */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", damping: 22 }}
        className="text-center mb-8"
      >
        <div className="text-[11px] font-bold uppercase tracking-[0.4em] mb-2"
          style={{ color: palette.secondary }}>
          Phase 1 · Core Feel
        </div>
        <div
          className="font-extrabold uppercase tracking-[0.14em] leading-none"
          style={{
            fontSize: "clamp(3rem,12vw,5.5rem)",
            background: `linear-gradient(135deg, #fff 20%, ${palette.secondary} 60%, ${palette.primary})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 28px ${palette.glow}80)`,
          }}
        >NEON<br />DRIFT</div>
        <div className="text-white/30 text-xs tracking-[0.25em] uppercase mt-2">Race the neon night</div>
      </motion.div>

      {/* Start button */}
      <motion.button
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35, type: "spring", damping: 18 }}
        whileHover={{ scale: 1.06, boxShadow: `0 0 40px ${palette.glow}60` }}
        whileTap={{ scale: 0.96 }}
        onClick={onStart}
        className="px-10 py-4 rounded-2xl text-sm font-extrabold uppercase tracking-[0.28em] text-white mb-6 cursor-pointer"
        style={{
          background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
          boxShadow: `0 0 24px ${palette.glow}40`,
        }}
      >⚡ Start Drift</motion.button>

      {/* Palette selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex gap-2 flex-wrap justify-center mb-4"
      >
        {Object.values(PALETTES).map(p => (
          <button
            key={p.id}
            onClick={() => onPaletteChange(p.id as PaletteId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all"
            style={activePalette === p.id ? {
              background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})`,
              color: "#fff",
              boxShadow: `0 0 12px ${p.glow}50`,
            } : {
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            <span className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: p.primary }} />
            {p.name}
          </button>
        ))}
      </motion.div>

      {/* Controls hint */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
        className="text-[10px] text-white/20 uppercase tracking-[0.2em] text-center"
      >
        ← → Steer · ↑ Gas · Space Drift
      </motion.div>
    </motion.div>
  )
}

function PauseOverlay({ palette, onResume, onQuit }: {
  palette: NeonPalette; onResume: () => void; onQuit: () => void
}) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: "blur(14px)", background: "rgba(0,0,0,0.55)" }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 24 }}
        transition={{ type: "spring", damping: 22 }}
        className="flex flex-col items-center gap-4 w-56 p-7 rounded-2xl"
        style={glassBox(palette.primary)}
      >
        <div className="text-[10px] text-white/35 uppercase tracking-[0.3em]">Paused</div>
        <div className="text-3xl font-extrabold" style={{ color: palette.primary }}>II</div>
        {([
          ["Resume", onResume, true],
          ["Quit", onQuit, false],
        ] as const).map(([label, fn, primary]) => (
          <button key={label} onClick={fn}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer transition-all"
            style={primary ? {
              background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
              color: "#fff",
            } : {
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.5)",
            }}>{label}</button>
        ))}
      </motion.div>
    </motion.div>
  )
}

function GameOverOverlay({ palette, car, onRestart, onQuit }: {
  palette: NeonPalette; car: CarState; onRestart: () => void; onQuit: () => void
}) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: "blur(14px)", background: "rgba(0,0,0,0.60)" }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 28 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="flex flex-col items-center gap-4 w-64 p-8 rounded-2xl"
        style={glassBox(palette.primary)}
      >
        <div className="text-[10px] text-white/35 uppercase tracking-[0.3em]">Race Complete</div>
        <div className="text-2xl font-extrabold uppercase tracking-widest"
          style={{
            background: `linear-gradient(135deg, #fff, ${palette.secondary})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Neon Drift</div>

        <div className="w-full space-y-2">
          {[
            ["Score", car.score.toLocaleString()],
            ["Max Combo", `×${car.combo}`],
            ["Laps", `${TOTAL_LAPS}/${TOTAL_LAPS}`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-white/40 uppercase tracking-widest">{label}</span>
              <span className="font-bold text-white">{val}</span>
            </div>
          ))}
        </div>

        {[
          ["Play Again", onRestart, true],
          ["Main Menu", onQuit, false],
        ].map(([label, fn, primary]) => (
          <button key={label as string} onClick={fn as () => void}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
            style={primary ? {
              background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
              color: "#fff",
              boxShadow: `0 0 18px ${palette.glow}35`,
            } : {
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.5)",
            }}>{label as string}</button>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ─── Main Game Component ──────────────────────────────────────────────────────

export function NeonDriftGame() {
  const [phase, setPhase]           = useState<Phase>("menu")
  const [activePalette, setActivePalette] = useState<PaletteId>("synthwave")
  const [driftNotifs, setDriftNotifs] = useState<DriftNotif[]>([])
  const notifIdRef = useRef(0)

  const palette = PALETTES[activePalette]

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const inputRef    = useRef<InputState>({ left: false, right: false, throttle: false, brake: false, handbrake: false })
  const carRef      = useRef<CarState>(createCar(TRACK_START_X, TRACK_START_Y, TRACK_START_HEADING))
  const camRef      = useRef<Camera>({ x: TRACK_START_X, y: TRACK_START_Y, heading: TRACK_START_HEADING })
  const particlesRef = useRef<Particle[]>([])
  const audioRef    = useRef<AudioEngine | null>(null)
  const tRef        = useRef(0)
  const countdownRef = useRef(3)
  const prevComboRef = useRef(1)

  // ── Keyboard handling ─────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "playing") setPhase("paused")
      if (e.key === "Escape" && phase === "paused")  setPhase("playing")
      const map: Record<string, keyof InputState> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "throttle",
        ArrowDown: "brake", " ": "handbrake",
        a: "left", d: "right", w: "throttle", s: "brake",
      }
      const k = map[e.key]
      if (k) { e.preventDefault(); inputRef.current[k] = true }
    }
    const up = (e: KeyboardEvent) => {
      const map: Record<string, keyof InputState> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "throttle",
        ArrowDown: "brake", " ": "handbrake",
        a: "left", d: "right", w: "throttle", s: "brake",
      }
      const k = map[e.key]
      if (k) inputRef.current[k] = false
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup",   up)
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up) }
  }, [phase])

  // ── Touch input handler ────────────────────────────────────────────────────
  const handleTouchInput = useCallback((key: keyof InputState, val: boolean) => {
    inputRef.current[key] = val
  }, [])

  // ── Game start / reset ────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    carRef.current      = createCar(TRACK_START_X, TRACK_START_Y, TRACK_START_HEADING)
    camRef.current      = { x: TRACK_START_X, y: TRACK_START_Y, heading: TRACK_START_HEADING }
    particlesRef.current = []
    countdownRef.current = 3.2
    prevComboRef.current = 1
    inputRef.current = { left: false, right: false, throttle: false, brake: false, handbrake: false }
    setDriftNotifs([])
    setPhase("countdown")
  }, [])

  // ── Audio init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "playing" || phase === "countdown") {
      if (!audioRef.current) {
        try { audioRef.current = new AudioEngine() } catch { /* no audio ctx */ }
      }
      audioRef.current?.resume()
    } else {
      audioRef.current?.suspend()
    }
  }, [phase])

  // ── Main game loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" && phase !== "countdown") return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = 0, H = 0
    const setSize = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    setSize()
    window.addEventListener("resize", setSize)

    let lastTime = performance.now()
    let rafId    = 0

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      // ── Countdown phase ──────────────────────────────────────────────────
      if (phase === "countdown") {
        countdownRef.current -= dt
        if (countdownRef.current <= 0) {
          setPhase("playing")
        }
      }

      const isPlaying = phase === "playing" || countdownRef.current <= 0

      // ── Physics ──────────────────────────────────────────────────────────
      if (isPlaying) {
        const onTrack = isOnTrack(carRef.current.x, carRef.current.y)
        let newCar = stepCar(carRef.current, inputRef.current, dt, onTrack)

        // Track constraint (push back in bounds)
        const constrained = constrainToTrack(newCar.x, newCar.y)
        if (constrained.x !== newCar.x || constrained.y !== newCar.y) {
          // Dampen velocity when hitting wall
          const nx = newCar.x / Math.hypot(newCar.x, newCar.y)
          const ny = newCar.y / Math.hypot(newCar.x, newCar.y)
          const dot = newCar.vx * nx + newCar.vy * ny
          newCar = {
            ...newCar,
            x: constrained.x, y: constrained.y,
            vx: newCar.vx - dot * nx * 1.3,
            vy: newCar.vy - dot * ny * 1.3,
          }
        }

        // Drift notif when combo increments
        if (newCar.combo > prevComboRef.current && newCar.score > carRef.current.score) {
          const gained = newCar.score - carRef.current.score
          const id = ++notifIdRef.current
          setDriftNotifs(prev => [...prev.slice(-3), { id, points: gained, combo: newCar.combo, x: W / 2, y: H / 2 - 60 }])
          setTimeout(() => setDriftNotifs(prev => prev.filter(n => n.id !== id)), 2200)
        }
        prevComboRef.current = newCar.combo

        // Lap complete check
        if (newCar.lap >= TOTAL_LAPS) {
          carRef.current = newCar
          setPhase("gameover")
          return
        }

        carRef.current = newCar

        // ── Particles ──────────────────────────────────────────────────────
        if (newCar.drifting && newCar.speed > 80) {
          const count = Math.min(2, newCar.speed > 250 ? 3 : 2)
          spawnDriftParticles(newCar, palette, particlesRef.current, count)
        }
        updateParticles(particlesRef.current, dt)
      }

      // ── Camera update ─────────────────────────────────────────────────────
      const car = carRef.current
      const camLag   = 1 - Math.exp(-6 * dt)
      const headLag  = 1 - Math.exp(-4 * dt)
      camRef.current.x += (car.x - camRef.current.x) * camLag
      camRef.current.y += (car.y - camRef.current.y) * camLag
      const headDiff = normalizeAngle(car.heading - camRef.current.heading)
      camRef.current.heading += headDiff * headLag

      // ── Audio ─────────────────────────────────────────────────────────────
      if (isPlaying) {
        audioRef.current?.update(car.speed, Math.abs(car.driftAngle), inputRef.current.throttle)
      }

      // ── Render ───────────────────────────────────────────────────────────
      tRef.current += dt

      // Background
      drawBackground(ctx, W, H, palette)

      // World transform (camera)
      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.rotate(-(camRef.current.heading + Math.PI / 2))
      ctx.translate(-camRef.current.x, -camRef.current.y)

      drawTrack(ctx, palette, tRef.current)
      drawParticles(ctx, particlesRef.current)
      if (isPlaying || phase === "countdown") {
        drawCar(ctx, car, palette)
      }

      ctx.restore()

      // Screen-space FX
      drawSpeedLines(ctx, W, H, car.speed, palette, tRef.current)
      drawVignette(ctx, W, H)

      // HUD (screen-space)
      drawHUD(
        ctx, W, H, car, palette,
        phase === "countdown" ? Math.max(0, countdownRef.current) : 0,
      )

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", setSize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, palette])

  // ── Cleanup audio on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => { audioRef.current?.dispose(); audioRef.current = null }
  }, [])

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none"
      style={{ background: palette.bg }}
    >
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none z-[5] opacity-[0.025]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)" }}
      />

      {/* Game canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />

      {/* Drift score popups */}
      <AnimatePresence>
        {driftNotifs.map(n => (
          <motion.div
            key={n.id}
            className="absolute pointer-events-none z-30 text-center"
            style={{ left: "50%", top: "38%", transform: "translateX(-50%)" }}
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: 1, y: -40, scale: 1 }}
            exit={{ opacity: 0, y: -80, scale: 0.8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div
              className="text-3xl font-extrabold leading-none"
              style={{
                background: `linear-gradient(135deg, ${palette.secondary}, ${palette.accent})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                filter: `drop-shadow(0 0 14px ${palette.glow})`,
              }}
            >
              DRIFT!
            </div>
            <div className="text-sm font-bold text-white/80 mt-1">
              +{n.points.toLocaleString()} <span style={{ color: palette.secondary }}>×{n.combo}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Touch controls (shown while playing on touch devices) */}
      {(phase === "playing" || phase === "countdown") && (
        <div className="absolute inset-0 z-20 sm:hidden">
          <TouchControls onInput={handleTouchInput} />
        </div>
      )}

      {/* Phase overlays */}
      <AnimatePresence>
        {phase === "menu" && (
          <MenuOverlay
            key="menu"
            palette={palette}
            onStart={startGame}
            onPaletteChange={setActivePalette}
            activePalette={activePalette}
          />
        )}
        {phase === "paused" && (
          <PauseOverlay
            key="pause"
            palette={palette}
            onResume={() => setPhase("playing")}
            onQuit={() => setPhase("menu")}
          />
        )}
        {phase === "gameover" && (
          <GameOverOverlay
            key="gameover"
            palette={palette}
            car={carRef.current}
            onRestart={startGame}
            onQuit={() => setPhase("menu")}
          />
        )}
      </AnimatePresence>

      {/* Pause button (in-game) */}
      {phase === "playing" && (
        <button
          onClick={() => setPhase("paused")}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer"
          style={{ background: "rgba(0,0,0,0.45)", border: `1px solid ${palette.primary}25`, color: "rgba(255,255,255,0.45)", backdropFilter: "blur(12px)" }}
        >
          ❙❙ Pause
        </button>
      )}
    </div>
  )
}
