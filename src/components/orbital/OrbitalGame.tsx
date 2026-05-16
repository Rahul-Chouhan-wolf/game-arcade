"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  CelestialBody, Projectile,
  makeProjectile, stepProjectile, previewTrajectory,
  isEscaped, launchVelocity,
  G, MAX_LAUNCH_V,
} from "@/lib/orbital/physics"
import { PUZZLES, PuzzleDef, PuzzleTarget } from "@/lib/orbital/puzzles"
import { OrbitalAudio } from "@/lib/orbital/audio"

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase       = 'menu' | 'level-select' | 'playing' | 'sandbox' | 'won' | 'paused'
type LaunchState = 'idle' | 'aiming' | 'launched'

interface Camera { x: number; y: number; zoom: number }

// ─── Sandbox preset ───────────────────────────────────────────────────────────

const SANDBOX_BODIES: CelestialBody[] = [
  { id: 1, x:   0, y:   0, mass: 10000, radius: 62, type: 'star',     fixed: true },
  { id: 2, x: 215, y:   0, mass: 2200,  radius: 30, type: 'planet',   fixed: true },
  { id: 3, x:-260, y:   0, mass: 1800,  radius: 26, type: 'planet',   fixed: true },
  { id: 4, x:   0, y: 310, mass: 4500,  radius: 22, type: 'blackhole', fixed: true },
]
const SANDBOX_START = { x: -100, y: -240 }

// ─── Colour palette ────────────────────────────────────────────────────────────

const BODY_COLORS: Record<CelestialBody['type'], { core: string; glow: string; atm?: string }> = {
  planet:      { core: '#1d4ed8', glow: '#3b82f6', atm: '#93c5fd' },
  star:        { core: '#dc2626', glow: '#f97316', atm: '#fde68a' },
  blackhole:   { core: '#000000', glow: '#7c3aed', atm: '#c4b5fd' },
  neutronstar: { core: '#e0f2fe', glow: '#38bdf8', atm: '#bae6fd' },
}

const ACCENT     = '#818cf8'
const ACCENT_GLO = '#6366f1'
const TARGET_COL = '#22c55e'

// ─── Pure drawing helpers ─────────────────────────────────────────────────────

function hex2rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// Seeded deterministic random for starfield
function frand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// ─── Rendering: background ────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Deep space gradient
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75)
  g.addColorStop(0,   '#0b0b1f')
  g.addColorStop(0.5, '#06060f')
  g.addColorStop(1,   '#020207')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawStarfield(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  camX: number, camY: number, zoom: number,
  t: number,
) {
  // Stars parallax — they move slightly with camera at 0.08x rate
  const px = camX * 0.08
  const py = camY * 0.08
  for (let i = 0; i < 200; i++) {
    const sx  = ((frand(i * 3 + 1) * W + px * frand(i + 0.5)) % W + W) % W
    const sy  = ((frand(i * 3 + 2) * H + py * frand(i + 1.5)) % H + H) % H
    const sr  = frand(i * 3 + 3) * 1.2 + 0.2
    const twk = 0.5 + 0.4 * Math.sin(t * 1.4 + i * 0.9)
    const bri = frand(i * 3) > 0.85 ? 0.9 : 0.35
    ctx.fillStyle = `rgba(255,255,255,${twk * bri})`
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
  }
}

// Subtle nebula wisps (world-space, inside camera transform)
function drawNebulae(ctx: CanvasRenderingContext2D, t: number) {
  const clouds = [
    { x:  180, y: -90,  r: 220, c: '#4f46e5', a: 0.055 },
    { x: -220, y:  130, r: 180, c: '#0e7490', a: 0.045 },
    { x:   60, y:  200, r: 150, c: '#7c3aed', a: 0.040 },
    { x: -100, y: -180, r: 130, c: '#1d4ed8', a: 0.035 },
  ]
  for (const cl of clouds) {
    const drift = Math.sin(t * 0.12 + cl.x * 0.01) * 8
    const grd   = ctx.createRadialGradient(cl.x + drift, cl.y, 0, cl.x + drift, cl.y, cl.r)
    grd.addColorStop(0, hex2rgba(cl.c, cl.a))
    grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(cl.x + drift, cl.y, cl.r, 0, Math.PI * 2); ctx.fill()
  }
}

// ─── Rendering: celestial bodies ──────────────────────────────────────────────

function drawCelestialBody(
  ctx: CanvasRenderingContext2D,
  body: CelestialBody,
  t: number,
) {
  const { x, y, radius, type } = body
  const col = BODY_COLORS[type]

  ctx.save()
  ctx.translate(x, y)

  if (type === 'blackhole') {
    drawBlackHole(ctx, radius, col.glow, t)
  } else if (type === 'star') {
    drawStar(ctx, radius, col.core, col.glow, col.atm!, t)
  } else {
    drawPlanet(ctx, radius, col.core, col.glow, col.atm!)
  }

  ctx.restore()
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  r: number, core: string, glow: string, atm: string,
) {
  // Outer halo (large transparent glow)
  const halo = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2.6)
  halo.addColorStop(0, hex2rgba(glow, 0.18))
  halo.addColorStop(1, 'transparent')
  ctx.fillStyle = halo
  ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2); ctx.fill()

  // Atmosphere ring
  ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2)
  ctx.strokeStyle = hex2rgba(atm, 0.28)
  ctx.lineWidth   = 3; ctx.stroke()

  // Body gradient (light from top-left)
  const body = ctx.createRadialGradient(-r * 0.28, -r * 0.28, 0, 0, 0, r)
  body.addColorStop(0, hex2rgba(atm,  0.85))
  body.addColorStop(0.5, core)
  body.addColorStop(1, '#00091a')
  ctx.fillStyle = body
  ctx.shadowColor = glow; ctx.shadowBlur = 18
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0

  // Specular highlight
  const spec = ctx.createRadialGradient(-r * 0.30, -r * 0.30, 0, 0, 0, r * 0.60)
  spec.addColorStop(0, 'rgba(255,255,255,0.18)')
  spec.addColorStop(1, 'transparent')
  ctx.fillStyle = spec
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  r: number, core: string, glow: string, atm: string, t: number,
) {
  const pulse = 1 + 0.03 * Math.sin(t * 2.2)

  // Corona (animated outer glow)
  const corona = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 3.5 * pulse)
  corona.addColorStop(0, hex2rgba(glow, 0.32))
  corona.addColorStop(0.5, hex2rgba(atm, 0.06))
  corona.addColorStop(1, 'transparent')
  ctx.fillStyle = corona
  ctx.beginPath(); ctx.arc(0, 0, r * 3.5 * pulse, 0, Math.PI * 2); ctx.fill()

  // Body
  const body = ctx.createRadialGradient(-r * 0.22, -r * 0.22, 0, 0, 0, r)
  body.addColorStop(0, hex2rgba(atm, 0.9))
  body.addColorStop(0.5, glow)
  body.addColorStop(1, core)
  ctx.fillStyle = body
  ctx.shadowColor = glow; ctx.shadowBlur = 28
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
}

function drawBlackHole(
  ctx: CanvasRenderingContext2D,
  r: number, glow: string, t: number,
) {
  const spin = t * 0.6

  // Outer warping glow
  const outer = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 3.0)
  outer.addColorStop(0, hex2rgba(glow, 0.26))
  outer.addColorStop(0.6, hex2rgba(glow, 0.06))
  outer.addColorStop(1, 'transparent')
  ctx.fillStyle = outer
  ctx.beginPath(); ctx.arc(0, 0, r * 3.0, 0, Math.PI * 2); ctx.fill()

  // Accretion disk (rotating ellipse)
  ctx.save()
  ctx.rotate(spin)
  ctx.scale(1, 0.32)
  const disk = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.2)
  disk.addColorStop(0, hex2rgba('#f97316', 0.5))
  disk.addColorStop(0.4, hex2rgba('#dc2626', 0.28))
  disk.addColorStop(1, 'transparent')
  ctx.fillStyle = disk
  ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Photon sphere (bright ring at 1.5× radius)
  ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2)
  ctx.strokeStyle = hex2rgba(glow, 0.55)
  ctx.lineWidth   = 2.5; ctx.stroke()

  // Singularity (dark void)
  const void_ = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  void_.addColorStop(0, '#000000')
  void_.addColorStop(0.7, '#060010')
  void_.addColorStop(1, 'transparent')
  ctx.fillStyle = void_
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
}

// ─── Rendering: target zone ───────────────────────────────────────────────────

function drawTarget(
  ctx: CanvasRenderingContext2D,
  target: PuzzleTarget,
  t: number,
) {
  const { x, y, radius } = target
  const pulse = 1 + 0.08 * Math.sin(t * 3.0)

  ctx.save()
  ctx.translate(x, y)

  // Outer glow
  const outer = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 2.4)
  outer.addColorStop(0, hex2rgba(TARGET_COL, 0.22))
  outer.addColorStop(1, 'transparent')
  ctx.fillStyle = outer
  ctx.beginPath(); ctx.arc(0, 0, radius * 2.4 * pulse, 0, Math.PI * 2); ctx.fill()

  // Ring
  ctx.beginPath(); ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2)
  ctx.strokeStyle = TARGET_COL
  ctx.lineWidth   = 2.5
  ctx.shadowColor = TARGET_COL; ctx.shadowBlur = 16
  ctx.stroke(); ctx.shadowBlur = 0

  // Inner dot
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2)
  ctx.fillStyle   = TARGET_COL
  ctx.shadowColor = TARGET_COL; ctx.shadowBlur = 12
  ctx.fill(); ctx.shadowBlur = 0

  // Cross-hairs
  ctx.strokeStyle = hex2rgba(TARGET_COL, 0.35)
  ctx.lineWidth   = 1
  for (const angle of [0, Math.PI / 2]) {
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * radius * 0.45, Math.sin(angle) * radius * 0.45)
    ctx.lineTo(Math.cos(angle) * radius * 1.55 * pulse, Math.sin(angle) * radius * 1.55 * pulse)
    ctx.moveTo(-Math.cos(angle) * radius * 0.45, -Math.sin(angle) * radius * 0.45)
    ctx.lineTo(-Math.cos(angle) * radius * 1.55 * pulse, -Math.sin(angle) * radius * 1.55 * pulse)
    ctx.stroke()
  }

  ctx.restore()
}

// ─── Rendering: projectile + trail ────────────────────────────────────────────

function drawTrail(ctx: CanvasRenderingContext2D, proj: Projectile) {
  const trail = proj.trail
  if (trail.length < 2) return

  for (let i = 1; i < trail.length; i++) {
    const frac = i / trail.length
    const a    = frac * frac * 0.55
    const r    = Math.max(1.5, 4 * frac)
    ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, r, 0, Math.PI * 2)
    ctx.fillStyle = hex2rgba(ACCENT, a)
    ctx.fill()
  }
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  proj: Projectile,
  t: number,
) {
  const { x, y } = proj

  // Glow halo
  const glo = ctx.createRadialGradient(x, y, 0, x, y, 22)
  glo.addColorStop(0, hex2rgba(ACCENT, 0.55))
  glo.addColorStop(1, 'transparent')
  ctx.fillStyle = glo
  ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill()

  // Core
  ctx.beginPath(); ctx.arc(x, y, proj.radius, 0, Math.PI * 2)
  ctx.fillStyle   = '#e0e7ff'
  ctx.shadowColor = ACCENT; ctx.shadowBlur = 18
  ctx.fill(); ctx.shadowBlur = 0

  // Specular
  ctx.beginPath(); ctx.arc(x - proj.radius * 0.25, y - proj.radius * 0.25, proj.radius * 0.38, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill()

  void t
}

// ─── Rendering: launch indicator (idle state) ─────────────────────────────────

function drawLaunchIndicator(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  t: number,
) {
  const pulse = 1 + 0.15 * Math.sin(t * 4)

  // Outer pulsing ring
  ctx.beginPath(); ctx.arc(x, y, 20 * pulse, 0, Math.PI * 2)
  ctx.strokeStyle = hex2rgba(ACCENT, 0.5 + 0.3 * Math.sin(t * 4))
  ctx.lineWidth = 1.5; ctx.stroke()

  // Dashed orbit ring
  ctx.setLineDash([4, 5])
  ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2)
  ctx.strokeStyle = hex2rgba(ACCENT, 0.22)
  ctx.lineWidth = 1; ctx.stroke()
  ctx.setLineDash([])

  // Small probe circle
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fillStyle   = '#e0e7ff'
  ctx.shadowColor = ACCENT; ctx.shadowBlur = 14
  ctx.fill(); ctx.shadowBlur = 0
}

// ─── Rendering: trajectory preview ───────────────────────────────────────────

function drawTrajectoryPreview(
  ctx: CanvasRenderingContext2D,
  path: { x: number; y: number }[],
) {
  if (path.length < 2) return

  for (let i = 0; i < path.length; i++) {
    const frac = i / path.length
    const a    = (1 - frac) * 0.60
    const r    = Math.max(1.5, 3.5 * (1 - frac * 0.7))
    ctx.beginPath(); ctx.arc(path[i].x, path[i].y, r, 0, Math.PI * 2)
    ctx.fillStyle = hex2rgba('#c7d2fe', a)
    ctx.fill()
  }

  // First dot brighter
  ctx.beginPath(); ctx.arc(path[0].x, path[0].y, 4, 0, Math.PI * 2)
  ctx.fillStyle   = '#e0e7ff'
  ctx.shadowColor = ACCENT; ctx.shadowBlur = 8
  ctx.fill(); ctx.shadowBlur = 0
}

// ─── Rendering: aim arrow ─────────────────────────────────────────────────────

function drawAimArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  vx: number, vy: number,
) {
  if (Math.hypot(vx, vy) < 5) return
  const VISUAL_SCALE = 0.22
  const ex = fromX + vx * VISUAL_SCALE
  const ey = fromY + vy * VISUAL_SCALE

  // Shaft
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(ex, ey)
  ctx.strokeStyle = hex2rgba('#e0e7ff', 0.65)
  ctx.lineWidth   = 2; ctx.setLineDash([6, 5])
  ctx.stroke(); ctx.setLineDash([])

  // Arrow head
  const ang  = Math.atan2(ey - fromY, ex - fromX)
  const size = 10
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - size * Math.cos(ang - 0.4), ey - size * Math.sin(ang - 0.4))
  ctx.lineTo(ex - size * Math.cos(ang + 0.4), ey - size * Math.sin(ang + 0.4))
  ctx.closePath()
  ctx.fillStyle   = '#e0e7ff'
  ctx.shadowColor = ACCENT; ctx.shadowBlur = 8
  ctx.fill(); ctx.shadowBlur = 0
}

// ─── Gravity influence visualisation ─────────────────────────────────────────
// Subtle force-field grid lines bent by gravity (drawn faint, for aesthetics)

function drawGravityField(
  ctx: CanvasRenderingContext2D,
  bodies: CelestialBody[],
  W: number, H: number,
  camX: number, camY: number, zoom: number,
) {
  // Transform world coords to screen for this overlay
  const toSX = (wx: number) => (wx - camX) * zoom + W / 2
  const toSY = (wy: number) => (wy - camY) * zoom + H / 2

  ctx.globalAlpha = 0.06
  ctx.strokeStyle = ACCENT
  ctx.lineWidth   = 0.7

  // Draw concentric influence circles per body
  for (const body of bodies) {
    if (body.type === 'blackhole') continue  // handled separately
    const sx = toSX(body.x)
    const sy = toSY(body.y)
    const radii = [1.8, 2.8, 4.0]
    for (const rMult of radii) {
      const sr = body.radius * rMult * zoom
      if (sr < 5 || sr > W) continue
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

// ─── Camera helpers ───────────────────────────────────────────────────────────

function computePuzzleCamera(puzzle: PuzzleDef, W: number, H: number): Camera {
  // Collect all important points
  const pts = [
    { x: puzzle.startX,  y: puzzle.startY  },
    { x: puzzle.target.x, y: puzzle.target.y },
    ...puzzle.bodies.map(b => ({ x: b.x, y: b.y })),
  ]
  const minX = Math.min(...pts.map(p => p.x)) - 80
  const maxX = Math.max(...pts.map(p => p.x)) + 80
  const minY = Math.min(...pts.map(p => p.y)) - 80
  const maxY = Math.max(...pts.map(p => p.y)) + 80
  const cx   = (minX + maxX) / 2
  const cy   = (minY + maxY) / 2
  const zoom = Math.min(W / (maxX - minX), H / (maxY - minY)) * 0.88
  return { x: cx, y: cy, zoom: Math.max(zoom, 0.3) }
}

function computeSandboxCamera(W: number, H: number): Camera {
  const size = Math.min(W, H) / 720
  return { x: 0, y: 0, zoom: Math.max(size, 0.38) }
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function glass(borderCol: string = ACCENT): React.CSSProperties {
  return {
    background: 'rgba(0,0,0,0.68)',
    border: `1px solid ${borderCol}30`,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  }
}

function GlassCard({
  children, className = '',
  style = {},
}: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{ ...glass(), ...style }}
    >
      {children}
    </div>
  )
}

// ── Star rating ──────────────────────────────────────────────────────────────

function DifficultyStars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? '#fbbf24' : 'rgba(255,255,255,0.14)', fontSize: 11 }}>
          ★
        </span>
      ))}
    </div>
  )
}

// ── Menu overlay ─────────────────────────────────────────────────────────────

function MenuOverlay({
  onPuzzle, onSandbox,
}: { onPuzzle: () => void; onSandbox: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Animated ring ornament */}
      <motion.div
        className="mb-8 relative"
        initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', damping: 22 }}
      >
        <motion.div
          className="w-28 h-28 rounded-full border border-indigo-400/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-3 rounded-full border border-indigo-300/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center text-3xl"
          style={{ filter: `drop-shadow(0 0 16px ${ACCENT})` }}
        >⊕</div>
      </motion.div>

      {/* Title */}
      <motion.div
        className="text-center mb-10"
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div
          className="text-[10px] font-bold uppercase tracking-[0.4em] mb-2"
          style={{ color: ACCENT }}
        >
          Space Gravity Puzzles
        </div>
        <h1
          className="text-6xl sm:text-7xl font-extrabold uppercase tracking-[0.18em] leading-none"
          style={{
            background: `linear-gradient(135deg, #fff 20%, ${ACCENT} 60%, #6366f1)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 0 32px ${ACCENT_GLO}70)`,
          }}
        >
          ORBITAL
        </h1>
        <p className="text-white/30 text-xs tracking-wide mt-2">
          Master gravity · Slingshot across the cosmos
        </p>
      </motion.div>

      {/* Mode buttons */}
      <motion.div
        className="flex flex-col gap-3 w-full max-w-xs"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.28 }}
      >
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onPuzzle}
          className="w-full py-4 rounded-2xl text-sm font-extrabold uppercase tracking-[0.25em] text-white cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #6366f1)`, boxShadow: `0 6px 28px ${ACCENT}40` }}
        >
          🧩 Puzzle Mode
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onSandbox}
          className="w-full py-4 rounded-2xl text-sm font-extrabold uppercase tracking-[0.25em] cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${ACCENT}30`, color: 'rgba(255,255,255,0.7)' }}
        >
          🌌 Sandbox
        </motion.button>
      </motion.div>

      {/* Hint */}
      <motion.p
        className="mt-8 text-[10px] text-white/20 uppercase tracking-[0.2em] text-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
      >
        Drag anywhere to aim · Release to launch
      </motion.p>
    </motion.div>
  )
}

// ── Level select overlay ─────────────────────────────────────────────────────

function LevelSelectOverlay({
  onSelect, onBack,
}: { onSelect: (idx: number) => void; onBack: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <GlassCard className="w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
              Puzzle Mode
            </div>
            <h2 className="text-xl font-extrabold text-white mt-0.5">Choose a Level</h2>
          </div>
          <button
            onClick={onBack}
            className="text-white/30 hover:text-white/70 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            ← Back
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {PUZZLES.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(i)}
              className="w-full flex items-center gap-4 rounded-xl px-4 py-3 text-left cursor-pointer transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                style={{ background: `${ACCENT}25`, color: ACCENT }}
              >
                {p.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white leading-tight">{p.name}</div>
                <div className="text-[11px] text-white/40 leading-tight mt-0.5 truncate">{p.description}</div>
              </div>
              <DifficultyStars n={p.difficulty} />
            </motion.button>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ── Win overlay ──────────────────────────────────────────────────────────────

function WinOverlay({
  puzzle, attempts, onNext, onRetry, onMenu,
}: {
  puzzle: PuzzleDef; attempts: number
  onNext: (() => void) | null; onRetry: () => void; onMenu: () => void
}) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <GlassCard className="w-full max-w-sm text-center" style={{ border: `1px solid ${TARGET_COL}30` }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          className="text-5xl mb-3"
        >
          🎯
        </motion.div>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1" style={{ color: TARGET_COL }}>
          Orbit achieved
        </div>
        <h2 className="text-2xl font-extrabold text-white mb-1">{puzzle.name}</h2>
        <p className="text-white/40 text-xs mb-5">
          Completed in <span className="text-white font-bold">{attempts}</span> {attempts === 1 ? 'attempt' : 'attempts'}
        </p>

        <div className="flex flex-col gap-2">
          {onNext && (
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={onNext}
              className="w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest text-white cursor-pointer"
              style={{ background: `linear-gradient(135deg,${ACCENT},#6366f1)`, boxShadow: `0 4px 20px ${ACCENT}40` }}
            >
              Next Level →
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onRetry}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          >
            ↺ Play Again
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onMenu}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            Level Select
          </motion.button>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ── Pause overlay ────────────────────────────────────────────────────────────

function PauseOverlay({
  onResume, onMenu,
}: { onResume: () => void; onMenu: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      <GlassCard className="w-full max-w-xs text-center">
        <div className="text-3xl font-extrabold mb-1" style={{ color: ACCENT }}>II</div>
        <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] mb-5">Paused</div>
        <div className="flex flex-col gap-2">
          {([['Resume', onResume, true], ['Exit to Menu', onMenu, false]] as const).map(([lbl, fn, pri]) => (
            <button
              key={lbl}
              onClick={fn}
              className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
              style={pri
                ? { background: `linear-gradient(135deg,${ACCENT},#6366f1)`, color: '#fff' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }
              }
            >
              {lbl}
            </button>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ── In-game HUD ──────────────────────────────────────────────────────────────

function HUD({
  puzzle, levelIndex, attempts, launchState, isSandbox, phase,
  onPause, onReset,
}: {
  puzzle:       PuzzleDef | null
  levelIndex:   number
  attempts:     number
  launchState:  LaunchState
  isSandbox:    boolean
  phase:        Phase
  onPause:      () => void
  onReset:      () => void
}) {
  if (phase !== 'playing' && phase !== 'sandbox') return null

  return (
    <div className="absolute inset-0 pointer-events-none z-20 select-none">
      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
        {/* Level info */}
        <div
          className="flex flex-col gap-0.5 rounded-xl px-3 py-2"
          style={glass()}
        >
          {isSandbox ? (
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Sandbox</span>
          ) : puzzle ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
                Level {levelIndex + 1} / {PUZZLES.length}
              </span>
              <span className="text-sm font-extrabold text-white">{puzzle.name}</span>
              <DifficultyStars n={puzzle.difficulty} />
            </>
          ) : null}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onReset}
            className="rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/70 transition-colors"
            style={glass()}
          >↺ Reset</button>
          <button
            onClick={onPause}
            className="rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/70 transition-colors"
            style={glass()}
          >II Pause</button>
        </div>
      </div>

      {/* Bottom hint */}
      <AnimatePresence>
        {launchState === 'idle' && (
          <motion.div
            className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          >
            {!isSandbox && puzzle && (
              <div
                className="text-xs text-white/45 text-center max-w-xs px-4 py-2 rounded-xl"
                style={glass()}
              >
                {puzzle.hint}
              </div>
            )}
            <div className="text-[10px] text-white/25 uppercase tracking-[0.25em] mt-1">
              {isSandbox ? 'Drag anywhere to aim & launch' : `Attempt ${attempts + 1} — drag to aim, release to launch`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attempts counter */}
      {!isSandbox && attempts > 0 && launchState === 'idle' && (
        <div
          className="absolute bottom-20 right-4 rounded-xl px-3 py-1.5"
          style={glass()}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
            {attempts} attempt{attempts !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function OrbitalGame() {
  const [phase,        setPhase]        = useState<Phase>('menu')
  const [levelIndex,   setLevelIndex]   = useState(0)
  const [attempts,     setAttempts]     = useState(0)
  const [launchState,  setLaunchState]  = useState<LaunchState>('idle')
  const [isSandbox,    setIsSandbox]    = useState(false)

  // ── Refs ────────────────────────────────────────────────────────────────────
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const projectileRef   = useRef<Projectile | null>(null)
  const bodiesRef       = useRef<CelestialBody[]>([])
  const targetRef       = useRef<PuzzleTarget | null>(null)
  const startPosRef     = useRef({ x: 0, y: 0 })
  const camRef          = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const camTargetRef    = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const previewRef      = useRef<{ x: number; y: number }[]>([])
  const tRef            = useRef(0)
  const audioRef        = useRef<OrbitalAudio | null>(null)
  const launchStateRef  = useRef<LaunchState>('idle')
  const phaseRef        = useRef<Phase>('menu')
  const isSandboxRef    = useRef(false)
  const attemptsRef     = useRef(0)

  // Aim drag (screen coords)
  const aimDragRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)

  // Keep refs in sync with state
  useEffect(() => { launchStateRef.current = launchState }, [launchState])
  useEffect(() => { phaseRef.current       = phase }, [phase])
  useEffect(() => { isSandboxRef.current   = isSandbox }, [isSandbox])
  useEffect(() => { attemptsRef.current    = attempts }, [attempts])

  // ── Level initialiser ───────────────────────────────────────────────────────

  const initLevel = useCallback((idx: number, sandbox: boolean) => {
    const canvas = canvasRef.current
    const W = canvas?.offsetWidth  ?? 800
    const H = canvas?.offsetHeight ?? 600

    if (sandbox) {
      bodiesRef.current  = SANDBOX_BODIES
      targetRef.current  = null
      startPosRef.current = SANDBOX_START
      const cam = computeSandboxCamera(W, H)
      camRef.current       = { ...cam }
      camTargetRef.current = { ...cam }
    } else {
      const puzzle        = PUZZLES[idx]
      bodiesRef.current   = puzzle.bodies.map(b => ({ ...b, fixed: true }))
      targetRef.current   = { ...puzzle.target }
      startPosRef.current = { x: puzzle.startX, y: puzzle.startY }
      const cam = computePuzzleCamera(puzzle, W, H)
      camRef.current       = { ...cam }
      camTargetRef.current = { ...cam }
    }

    projectileRef.current = null
    previewRef.current    = []
    aimDragRef.current    = null
    setLaunchState('idle')
    setAttempts(0)
  }, [])

  // ── Start handlers ──────────────────────────────────────────────────────────

  const startPuzzleMode = useCallback(() => {
    setIsSandbox(false); setLevelIndex(0)
    setPhase('level-select')
  }, [])

  const startSandbox = useCallback(() => {
    setIsSandbox(true)
    initLevel(0, true)
    setPhase('sandbox')
    audioRef.current?.start()
  }, [initLevel])

  const selectLevel = useCallback((idx: number) => {
    setLevelIndex(idx)
    initLevel(idx, false)
    setPhase('playing')
    audioRef.current?.start()
  }, [initLevel])

  const resetLevel = useCallback(() => {
    const sandbox = isSandboxRef.current
    initLevel(sandbox ? 0 : levelIndex, sandbox)
    audioRef.current?.resume()
  }, [initLevel, levelIndex])

  // ── Win / loss handlers ─────────────────────────────────────────────────────

  const handleWin = useCallback(() => {
    audioRef.current?.playWin()
    setPhase('won')
  }, [])

  const handleLoss = useCallback(() => {
    audioRef.current?.playAbsorb()
    // Increment attempts, reset level after short delay
    const newAtt = attemptsRef.current + 1
    setAttempts(newAtt)
    attemptsRef.current = newAtt
    projectileRef.current = null
    previewRef.current    = []
    aimDragRef.current    = null
    setLaunchState('idle')
    launchStateRef.current = 'idle'
    // Restore camera to puzzle frame
    const canvas = canvasRef.current
    const W = canvas?.offsetWidth ?? 800
    const H = canvas?.offsetHeight ?? 600
    const puzzle = PUZZLES[levelIndex]
    if (puzzle) {
      const cam = computePuzzleCamera(puzzle, W, H)
      camTargetRef.current = cam
    }
  }, [levelIndex])

  // ── Pointer input ───────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onDown = (e: PointerEvent) => {
      const ph = phaseRef.current
      if (ph !== 'playing' && ph !== 'sandbox') return
      if (launchStateRef.current !== 'idle') return
      e.preventDefault()
      audioRef.current?.playAimStart()
      aimDragRef.current = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY }
      setLaunchState('aiming')
      launchStateRef.current = 'aiming'
    }

    const onMove = (e: PointerEvent) => {
      if (launchStateRef.current !== 'aiming' || !aimDragRef.current) return
      e.preventDefault()
      aimDragRef.current = { ...aimDragRef.current, cx: e.clientX, cy: e.clientY }
    }

    const onUp = (e: PointerEvent) => {
      if (launchStateRef.current !== 'aiming' || !aimDragRef.current) return
      e.preventDefault()

      const { sx, sy, cx, cy } = aimDragRef.current
      const { vx, vy } = launchVelocity(cx - sx, cy - sy)

      if (Math.hypot(vx, vy) < 15) {
        // Too small — cancel aim
        aimDragRef.current    = null
        setLaunchState('idle')
        launchStateRef.current = 'idle'
        return
      }

      const { x, y } = startPosRef.current
      projectileRef.current  = makeProjectile(x, y, vx, vy)
      previewRef.current     = []
      aimDragRef.current     = null
      audioRef.current?.playLaunch()
      setLaunchState('launched')
      launchStateRef.current = 'launched'
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'sandbox') {
          setPhase('paused')
        } else if (phaseRef.current === 'paused') {
          setPhase(isSandboxRef.current ? 'sandbox' : 'playing')
        }
      }
    }

    canvas.addEventListener('pointerdown', onDown, { passive: false })
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup',   onUp,   { passive: false })
    window.addEventListener('keydown',     onKeyDown)

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      window.removeEventListener('keydown',     onKeyDown)
    }
  }, [])

  // ── Audio lifecycle ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!audioRef.current) {
      try { audioRef.current = new OrbitalAudio() } catch { /* silent */ }
    }
    if (phase === 'playing' || phase === 'sandbox') {
      audioRef.current?.start()
    } else if (phase === 'paused' || phase === 'menu') {
      audioRef.current?.pause()
    }
  }, [phase])

  useEffect(() => () => {
    audioRef.current?.dispose(); audioRef.current = null
  }, [])

  // ── Game loop ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const ph = phase
    if (ph !== 'playing' && ph !== 'sandbox') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0, H = 0

    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Recompute target camera after resize
      const sandbox = isSandboxRef.current
      const cam = sandbox
        ? computeSandboxCamera(W, H)
        : computePuzzleCamera(PUZZLES[levelIndex], W, H)
      if (launchStateRef.current === 'idle') {
        camRef.current       = { ...cam }
        camTargetRef.current = { ...cam }
      }
    }
    resize()
    window.addEventListener('resize', resize)

    let last  = performance.now()
    let rafId = 0

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      tRef.current += dt

      const t       = tRef.current
      const state   = launchStateRef.current
      const bodies  = bodiesRef.current
      const target  = targetRef.current
      const sandbox = isSandboxRef.current

      // ── Physics update ─────────────────────────────────────────────────────
      if (state === 'launched' && projectileRef.current) {
        projectileRef.current = stepProjectile(projectileRef.current, bodies, dt)

        const proj = projectileRef.current

        // Gravity audio hum
        let maxForce = 0
        for (const body of bodies) {
          const r2 = (proj.x - body.x) ** 2 + (proj.y - body.y) ** 2
          maxForce = Math.max(maxForce, G * body.mass / Math.max(r2, 1))
        }
        audioRef.current?.setGravityIntensity(Math.min(maxForce / 40000, 1))

        // Win check
        if (!sandbox && target) {
          const dist = Math.hypot(proj.x - target.x, proj.y - target.y)
          if (dist < target.radius + proj.radius) {
            handleWin(); rafId = requestAnimationFrame(loop); return
          }
        }

        // Loss check
        if (!proj.alive || isEscaped(proj)) {
          handleLoss()
        }

        // Camera follows projectile
        if (proj.alive) {
          camTargetRef.current = {
            x:    proj.x,
            y:    proj.y,
            zoom: camRef.current.zoom,
          }
        }
      }

      // ── Trajectory preview ─────────────────────────────────────────────────
      if (state === 'aiming' && aimDragRef.current) {
        const { sx, sy, cx, cy } = aimDragRef.current
        const { vx, vy } = launchVelocity(cx - sx, cy - sy)
        const { x, y }   = startPosRef.current
        previewRef.current = previewTrajectory(x, y, vx, vy, bodies)
      }

      // ── Smooth camera ──────────────────────────────────────────────────────
      const cam     = camRef.current
      const camTgt  = camTargetRef.current
      const lerp    = 1 - Math.exp(-5 * dt)
      cam.x    += (camTgt.x    - cam.x)    * lerp
      cam.y    += (camTgt.y    - cam.y)    * lerp
      cam.zoom += (camTgt.zoom - cam.zoom) * lerp

      const { x: camX, y: camY, zoom } = cam

      // ── Render ─────────────────────────────────────────────────────────────

      // 1. Background (screen space)
      drawBackground(ctx, W, H)
      drawStarfield(ctx, W, H, camX, camY, zoom, t)

      // 2. Subtle gravity field indicator (screen space overlay)
      drawGravityField(ctx, bodies, W, H, camX, camY, zoom)

      // 3. World-space drawing
      ctx.save()
      ctx.setTransform(zoom, 0, 0, zoom, W / 2 - camX * zoom, H / 2 - camY * zoom)

      // 3a. Nebulae (atmospheric depth)
      drawNebulae(ctx, t)

      // 3b. Target zone
      if (target) drawTarget(ctx, target, t)

      // 3c. Celestial bodies (far-to-near sort by visual radius, biggest first = background)
      const sortedBodies = [...bodies].sort((a, b) => b.radius - a.radius)
      for (const body of sortedBodies) {
        drawCelestialBody(ctx, body, t)
      }

      // 3d. Trajectory preview (when aiming)
      if (state === 'aiming') {
        drawTrajectoryPreview(ctx, previewRef.current)
        // Aim arrow from start position
        if (aimDragRef.current) {
          const { sx, sy, cx, cy } = aimDragRef.current
          const { vx, vy } = launchVelocity(cx - sx, cy - sy)
          drawAimArrow(ctx, startPosRef.current.x, startPosRef.current.y, vx, vy)
        }
      }

      // 3e. Trail + projectile (or idle indicator)
      if (state === 'launched' && projectileRef.current?.alive) {
        drawTrail(ctx, projectileRef.current)
        drawProjectile(ctx, projectileRef.current, t)
      } else if (state === 'idle' || state === 'aiming') {
        drawLaunchIndicator(ctx, startPosRef.current.x, startPosRef.current.y, t)
      }

      ctx.restore()

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, levelIndex, handleWin, handleLoss])

  // ── Render ──────────────────────────────────────────────────────────────────

  const currentPhase   = phase
  const currentPuzzle  = !isSandbox && levelIndex < PUZZLES.length ? PUZZLES[levelIndex] : null
  const hasNextLevel   = !isSandbox && levelIndex < PUZZLES.length - 1

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#020207' }}>
      {/* Scanlines — ultra-subtle */}
      <div
        className="absolute inset-0 pointer-events-none z-[5] opacity-[0.018]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.5) 2px,rgba(255,255,255,0.5) 3px)',
        }}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ cursor: launchState === 'aiming' ? 'crosshair' : 'default' }}
      />

      {/* HUD (visible during play/sandbox) */}
      <HUD
        puzzle={currentPuzzle}
        levelIndex={levelIndex}
        attempts={attempts}
        launchState={launchState}
        isSandbox={isSandbox}
        phase={phase}
        onPause={() => setPhase('paused')}
        onReset={resetLevel}
      />

      {/* Overlays */}
      <AnimatePresence mode="wait">
        {currentPhase === 'menu' && (
          <MenuOverlay
            key="menu"
            onPuzzle={startPuzzleMode}
            onSandbox={startSandbox}
          />
        )}

        {currentPhase === 'level-select' && (
          <LevelSelectOverlay
            key="level-select"
            onSelect={selectLevel}
            onBack={() => setPhase('menu')}
          />
        )}

        {currentPhase === 'won' && currentPuzzle && (
          <WinOverlay
            key="won"
            puzzle={currentPuzzle}
            attempts={attempts + 1}
            onNext={hasNextLevel ? () => {
              const next = levelIndex + 1
              setLevelIndex(next)
              initLevel(next, false)
              setPhase('playing')
            } : null}
            onRetry={() => {
              initLevel(levelIndex, false)
              setPhase('playing')
            }}
            onMenu={() => setPhase('level-select')}
          />
        )}

        {currentPhase === 'paused' && (
          <PauseOverlay
            key="paused"
            onResume={() => setPhase(isSandbox ? 'sandbox' : 'playing')}
            onMenu={() => { setPhase('menu'); audioRef.current?.pause() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
