"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  CelestialBody, Projectile, AsteroidDef,
  makeProjectile, stepProjectile, previewTrajectory,
  asteroidPos, asteroidHit, isEscaped, launchVelocity,
  G,
} from "@/lib/orbital/physics"
import { PUZZLES, PuzzleDef, PuzzleTarget, generateLevel } from "@/lib/orbital/puzzles"
import { OrbitalAudio } from "@/lib/orbital/audio"

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase       = 'menu' | 'level-select' | 'playing' | 'sandbox' | 'won' | 'paused'
type LaunchState = 'idle' | 'aiming' | 'launched'

interface Camera { x: number; y: number; zoom: number }

// World-space particles (checkpoints, asteroid hits)
interface WorldParticle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; color: string
}

// ─── Sandbox preset ───────────────────────────────────────────────────────────

const SANDBOX_BODIES: CelestialBody[] = [
  { id: 1, x:   0, y:   0, mass: 10500, radius: 62, type: 'star',      fixed: true },
  { id: 2, x: 215, y:   0, mass: 2200,  radius: 30, type: 'planet',    fixed: true },
  { id: 3, x:-265, y:   0, mass: 1900,  radius: 26, type: 'planet',    fixed: true },
  { id: 4, x:   0, y: 305, mass: 5000,  radius: 23, type: 'blackhole', fixed: true },
]
const SANDBOX_ASTEROIDS: AsteroidDef[] = [
  { id: 1, centerX: 0, centerY: 0, orbitRadius: 140, speed:  0.55, phase: 0.0, radius: 15 },
  { id: 2, centerX: 0, centerY: 0, orbitRadius: 165, speed: -0.45, phase: 2.1, radius: 14 },
  { id: 3, centerX: 0, centerY: 0, orbitRadius: 192, speed:  0.35, phase: 4.5, radius: 13 },
]
const SANDBOX_START = { x: -100, y: -240 }

// ─── Palette ──────────────────────────────────────────────────────────────────

const BODY_COLORS: Record<CelestialBody['type'], { core: string; glow: string; atm: string }> = {
  planet:      { core: '#1d4ed8', glow: '#3b82f6', atm: '#93c5fd' },
  star:        { core: '#dc2626', glow: '#f97316', atm: '#fde68a' },
  blackhole:   { core: '#000000', glow: '#7c3aed', atm: '#c4b5fd' },
  neutronstar: { core: '#e0f2fe', glow: '#38bdf8', atm: '#bae6fd' },
}

const ACCENT     = '#818cf8'
const TARGET_COL = '#22c55e'
const AST_COL    = '#9ca3af'

// ─── Utility ──────────────────────────────────────────────────────────────────

function hex2rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function frand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// ─── Drawing: background ──────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75)
  g.addColorStop(0, '#0b0b1f')
  g.addColorStop(0.5, '#06060f')
  g.addColorStop(1, '#020207')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawStarfield(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  camX: number, camY: number,
  t: number,
) {
  const px = camX * 0.07, py = camY * 0.07
  for (let i = 0; i < 210; i++) {
    const sx  = ((frand(i * 3 + 1) * W * 1.3 + px * frand(i + 0.5)) % W + W) % W
    const sy  = ((frand(i * 3 + 2) * H * 1.3 + py * frand(i + 1.5)) % H + H) % H
    const sr  = frand(i * 3 + 3) * 1.3 + 0.18
    const twk = 0.45 + 0.4 * Math.sin(t * 1.4 + i * 0.9)
    const bri = frand(i * 3) > 0.85 ? 0.9 : 0.32
    ctx.fillStyle = `rgba(255,255,255,${twk * bri})`
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
  }
}

// ─── Drawing: nebulae (world-space) ──────────────────────────────────────────

function drawNebulae(ctx: CanvasRenderingContext2D, t: number) {
  const clouds = [
    { x:  190, y:  -95, r: 225, c: '#4f46e5', a: 0.052 },
    { x: -225, y:  130, r: 185, c: '#0e7490', a: 0.042 },
    { x:   65, y:  205, r: 155, c: '#7c3aed', a: 0.038 },
    { x: -105, y: -185, r: 135, c: '#1d4ed8', a: 0.032 },
  ]
  for (const cl of clouds) {
    const drift = Math.sin(t * 0.11 + cl.x * 0.01) * 9
    const grd   = ctx.createRadialGradient(cl.x + drift, cl.y, 0, cl.x + drift, cl.y, cl.r)
    grd.addColorStop(0, hex2rgba(cl.c, cl.a))
    grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(cl.x + drift, cl.y, cl.r, 0, Math.PI * 2); ctx.fill()
  }
}

// ─── Drawing: celestial bodies ────────────────────────────────────────────────

function drawCelestialBody(
  ctx: CanvasRenderingContext2D, body: CelestialBody, t: number,
) {
  const { x, y, radius, type } = body
  const col = BODY_COLORS[type]
  ctx.save(); ctx.translate(x, y)
  if (type === 'blackhole') drawBlackHole(ctx, radius, col.glow, t)
  else if (type === 'star') drawStar(ctx, radius, col.core, col.glow, col.atm, t)
  else drawPlanet(ctx, radius, col.core, col.glow, col.atm)
  ctx.restore()
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  r: number, core: string, glow: string, atm: string,
) {
  const halo = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2.6)
  halo.addColorStop(0, hex2rgba(glow, 0.18)); halo.addColorStop(1, 'transparent')
  ctx.fillStyle = halo
  ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2)
  ctx.strokeStyle = hex2rgba(atm, 0.26); ctx.lineWidth = 3; ctx.stroke()
  const body = ctx.createRadialGradient(-r * 0.28, -r * 0.28, 0, 0, 0, r)
  body.addColorStop(0, hex2rgba(atm, 0.85)); body.addColorStop(0.5, core); body.addColorStop(1, '#00091a')
  ctx.fillStyle = body; ctx.shadowColor = glow; ctx.shadowBlur = 18
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
  const spec = ctx.createRadialGradient(-r * 0.30, -r * 0.30, 0, 0, 0, r * 0.60)
  spec.addColorStop(0, 'rgba(255,255,255,0.18)'); spec.addColorStop(1, 'transparent')
  ctx.fillStyle = spec; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  r: number, core: string, glow: string, atm: string, t: number,
) {
  const pulse = 1 + 0.033 * Math.sin(t * 2.1)
  const corona = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 3.5 * pulse)
  corona.addColorStop(0, hex2rgba(glow, 0.32)); corona.addColorStop(0.5, hex2rgba(atm, 0.06)); corona.addColorStop(1, 'transparent')
  ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(0, 0, r * 3.5 * pulse, 0, Math.PI * 2); ctx.fill()
  const body = ctx.createRadialGradient(-r * 0.22, -r * 0.22, 0, 0, 0, r)
  body.addColorStop(0, hex2rgba(atm, 0.9)); body.addColorStop(0.5, glow); body.addColorStop(1, core)
  ctx.fillStyle = body; ctx.shadowColor = glow; ctx.shadowBlur = 28
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
}

function drawBlackHole(
  ctx: CanvasRenderingContext2D, r: number, glow: string, t: number,
) {
  const spin = t * 0.58
  const outer = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 3.2)
  outer.addColorStop(0, hex2rgba(glow, 0.28)); outer.addColorStop(0.6, hex2rgba(glow, 0.06)); outer.addColorStop(1, 'transparent')
  ctx.fillStyle = outer; ctx.beginPath(); ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2); ctx.fill()
  ctx.save(); ctx.rotate(spin); ctx.scale(1, 0.30)
  const disk = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.3)
  disk.addColorStop(0, hex2rgba('#f97316', 0.55)); disk.addColorStop(0.4, hex2rgba('#dc2626', 0.28)); disk.addColorStop(1, 'transparent')
  ctx.fillStyle = disk; ctx.beginPath(); ctx.arc(0, 0, r * 2.3, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  ctx.beginPath(); ctx.arc(0, 0, r * 1.42, 0, Math.PI * 2)
  ctx.strokeStyle = hex2rgba(glow, 0.55); ctx.lineWidth = 2.5; ctx.stroke()
  const void_ = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  void_.addColorStop(0, '#000000'); void_.addColorStop(0.7, '#060010'); void_.addColorStop(1, 'transparent')
  ctx.fillStyle = void_; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
}

// ─── Drawing: asteroids ───────────────────────────────────────────────────────

function drawAsteroid(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  id: number,
  t: number,
  danger: boolean,  // flashes when probe is nearby
) {
  const SIDES = 8
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(t * (0.4 + (id % 3) * 0.15) + id)

  ctx.beginPath()
  for (let i = 0; i < SIDES; i++) {
    const a  = (i / SIDES) * Math.PI * 2
    const ir = radius * (0.68 + 0.32 * Math.sin(i * 2.7 + id * 1.37))
    if (i === 0) ctx.moveTo(Math.cos(a) * ir, Math.sin(a) * ir)
    else         ctx.lineTo(Math.cos(a) * ir, Math.sin(a) * ir)
  }
  ctx.closePath()

  const grad = ctx.createRadialGradient(-radius * 0.22, -radius * 0.22, 0, 0, 0, radius)
  if (danger) {
    const flash = Math.abs(Math.sin(t * 12)) > 0.5
    grad.addColorStop(0, flash ? '#dc2626' : '#7f1d1d')
    grad.addColorStop(1, '#1c0808')
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12
  } else {
    grad.addColorStop(0, '#4a4a5e')
    grad.addColorStop(0.6, '#2a2a38')
    grad.addColorStop(1, '#1a1a24')
  }
  ctx.fillStyle = grad
  ctx.strokeStyle = danger ? '#ef4444' : '#5a5a6e'
  ctx.lineWidth = 1.2
  ctx.fill(); ctx.stroke()
  ctx.shadowBlur = 0

  // Crater
  ctx.beginPath()
  ctx.arc(radius * 0.24, -radius * 0.18, radius * 0.22, 0, Math.PI * 2)
  ctx.strokeStyle = danger ? 'rgba(200,80,80,0.45)' : 'rgba(80,80,100,0.45)'
  ctx.lineWidth = 0.8; ctx.stroke()

  ctx.restore()
}

function drawAsteroidOrbit(
  ctx: CanvasRenderingContext2D, def: AsteroidDef,
) {
  ctx.beginPath()
  ctx.arc(def.centerX, def.centerY, def.orbitRadius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(150,150,180,0.07)'
  ctx.lineWidth = 1; ctx.setLineDash([2, 7]); ctx.stroke(); ctx.setLineDash([])
}

// ─── Drawing: target sequence ─────────────────────────────────────────────────

function drawTargetSequence(
  ctx: CanvasRenderingContext2D,
  targets: PuzzleTarget[],
  currentIdx: number,
  t: number,
) {
  // Connector lines between pending targets (faint, dashed)
  ctx.setLineDash([4, 7])
  ctx.strokeStyle = hex2rgba(TARGET_COL, 0.13)
  ctx.lineWidth = 1.2
  for (let i = Math.max(currentIdx - 1, 0); i < targets.length - 1; i++) {
    ctx.beginPath()
    ctx.moveTo(targets[i].x, targets[i].y)
    ctx.lineTo(targets[i + 1].x, targets[i + 1].y)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Draw each target with its sequence number
  for (let i = 0; i < targets.length; i++) {
    const tgt      = targets[i]
    const isActive = i === currentIdx
    const isDone   = i < currentIdx
    const alpha    = isDone ? 0.18 : isActive ? 1.0 : 0.40
    const pulse    = isActive ? 1 + 0.10 * Math.sin(t * 3.2) : 1.0
    const r        = tgt.radius * pulse

    ctx.save()
    ctx.translate(tgt.x, tgt.y)
    ctx.globalAlpha = alpha

    // Outer glow (only active)
    if (isActive) {
      const outer = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.8)
      outer.addColorStop(0, hex2rgba(TARGET_COL, 0.24)); outer.addColorStop(1, 'transparent')
      ctx.fillStyle = outer; ctx.beginPath(); ctx.arc(0, 0, r * 2.8, 0, Math.PI * 2); ctx.fill()
    }

    // Ring
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.strokeStyle = isDone ? '#6b7280' : TARGET_COL
    ctx.lineWidth = isActive ? 2.5 : 1.5
    if (isActive) { ctx.shadowColor = TARGET_COL; ctx.shadowBlur = 16 }
    ctx.stroke(); ctx.shadowBlur = 0

    // Centre dot
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = isDone ? '#6b7280' : TARGET_COL
    if (isActive) { ctx.shadowColor = TARGET_COL; ctx.shadowBlur = 10 }
    ctx.fill(); ctx.shadowBlur = 0

    // Sequence number badge
    if (!isDone) {
      const badgeR = Math.max(9 * pulse, 8)
      ctx.beginPath(); ctx.arc(r + badgeR + 3, -r - badgeR - 3, badgeR, 0, Math.PI * 2)
      ctx.fillStyle = isActive ? TARGET_COL : hex2rgba(TARGET_COL, 0.55); ctx.fill()
      ctx.font         = `700 ${Math.round(badgeR * 1.1)}px system-ui`
      ctx.fillStyle    = '#000'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), r + badgeR + 3, -r - badgeR - 3)
    } else {
      // Checkmark for completed
      const cr = 9
      ctx.beginPath(); ctx.arc(r + cr + 3, -r - cr - 3, cr, 0, Math.PI * 2)
      ctx.fillStyle = '#16a34a'; ctx.fill()
      ctx.font         = `700 10px system-ui`
      ctx.fillStyle    = '#fff'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('✓', r + cr + 3, -r - cr - 2)
    }

    ctx.globalAlpha = 1
    ctx.restore()
  }
}

// ─── Drawing: trajectory preview ─────────────────────────────────────────────

function drawTrajectoryPreview(
  ctx: CanvasRenderingContext2D,
  path: { x: number; y: number }[],
  hasAsteroidHit: boolean,
) {
  if (path.length < 2) return

  const crossoverIdx = hasAsteroidHit ? Math.floor(path.length * 0.65) : path.length

  for (let i = 0; i < path.length; i++) {
    const frac    = i / path.length
    const safe    = i < crossoverIdx
    const a       = (1 - frac) * 0.60
    const r       = Math.max(1.5, 3.8 * (1 - frac * 0.72))
    const color   = safe ? '#c7d2fe' : '#fca5a5'
    ctx.beginPath(); ctx.arc(path[i].x, path[i].y, r, 0, Math.PI * 2)
    ctx.fillStyle = hex2rgba(color, a); ctx.fill()
  }

  // First dot brighter
  ctx.beginPath(); ctx.arc(path[0].x, path[0].y, 4.5, 0, Math.PI * 2)
  ctx.fillStyle = '#e0e7ff'
  ctx.shadowColor = ACCENT; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0
}

// ─── Drawing: launch indicator & projectile ───────────────────────────────────

function drawLaunchIndicator(
  ctx: CanvasRenderingContext2D, x: number, y: number, t: number,
) {
  const pulse = 1 + 0.16 * Math.sin(t * 4)
  ctx.beginPath(); ctx.arc(x, y, 20 * pulse, 0, Math.PI * 2)
  ctx.strokeStyle = hex2rgba(ACCENT, 0.5 + 0.3 * Math.sin(t * 4)); ctx.lineWidth = 1.5; ctx.stroke()
  ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(x, y, 33, 0, Math.PI * 2)
  ctx.strokeStyle = hex2rgba(ACCENT, 0.2); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([])
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#e0e7ff'; ctx.shadowColor = ACCENT; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0
}

function drawTrail(ctx: CanvasRenderingContext2D, proj: Projectile) {
  const trail = proj.trail
  for (let i = 1; i < trail.length; i++) {
    const frac = i / trail.length
    ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, Math.max(1.4, 4.2 * frac), 0, Math.PI * 2)
    ctx.fillStyle = hex2rgba(ACCENT, frac * frac * 0.55); ctx.fill()
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile) {
  const { x, y } = proj
  const glo = ctx.createRadialGradient(x, y, 0, x, y, 24)
  glo.addColorStop(0, hex2rgba(ACCENT, 0.58)); glo.addColorStop(1, 'transparent')
  ctx.fillStyle = glo; ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(x, y, proj.radius, 0, Math.PI * 2)
  ctx.fillStyle = '#e0e7ff'; ctx.shadowColor = ACCENT; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0
  ctx.beginPath(); ctx.arc(x - proj.radius * 0.25, y - proj.radius * 0.25, proj.radius * 0.38, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill()
}

function drawAimArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number, vx: number, vy: number,
) {
  if (vx * vx + vy * vy < 25) return
  const SCALE = 0.22
  const ex = fromX + vx * SCALE, ey = fromY + vy * SCALE
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(ex, ey)
  ctx.strokeStyle = hex2rgba('#e0e7ff', 0.65); ctx.lineWidth = 2
  ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([])
  const ang = Math.atan2(ey - fromY, ex - fromX), sz = 10
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - sz * Math.cos(ang - 0.4), ey - sz * Math.sin(ang - 0.4))
  ctx.lineTo(ex - sz * Math.cos(ang + 0.4), ey - sz * Math.sin(ang + 0.4))
  ctx.closePath()
  ctx.fillStyle = '#e0e7ff'; ctx.shadowColor = ACCENT; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0
}

// ─── Drawing: world particles ─────────────────────────────────────────────────

function updateWorldParticles(particles: WorldParticle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt; p.y += p.vy * dt
    p.vx *= 0.92; p.vy *= 0.92
    p.life -= dt / p.maxLife
    if (p.life <= 0) particles.splice(i, 1)
  }
}

function drawWorldParticles(ctx: CanvasRenderingContext2D, particles: WorldParticle[]) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(p.life, 0) ** 0.6
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1
}

function spawnCheckpointBurst(
  particles: WorldParticle[], x: number, y: number,
  color = TARGET_COL, count = 24,
) {
  for (let i = 0; i < count; i++) {
    const ang   = (i / count) * Math.PI * 2 + Math.random() * 0.3
    const speed = 55 + Math.random() * 130
    particles.push({
      x, y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      life: 1, maxLife: 0.65 + Math.random() * 0.55,
      size: 2.5 + Math.random() * 5.5,
      color,
    })
  }
}

function spawnAsteroidBurst(particles: WorldParticle[], x: number, y: number, count = 18) {
  for (let i = 0; i < count; i++) {
    const ang   = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const speed = 45 + Math.random() * 100
    particles.push({
      x, y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      life: 1, maxLife: 0.5 + Math.random() * 0.45,
      size: 2 + Math.random() * 4,
      color: '#f97316',
    })
  }
}

// ─── Camera helpers ───────────────────────────────────────────────────────────

function computePuzzleCamera(puzzle: PuzzleDef, W: number, H: number): Camera {
  const pts = [
    { x: puzzle.startX, y: puzzle.startY },
    ...puzzle.targets.map(t => ({ x: t.x, y: t.y })),
    ...puzzle.bodies.map(b => ({ x: b.x, y: b.y })),
  ]
  const minX = Math.min(...pts.map(p => p.x)) - 90
  const maxX = Math.max(...pts.map(p => p.x)) + 90
  const minY = Math.min(...pts.map(p => p.y)) - 90
  const maxY = Math.max(...pts.map(p => p.y)) + 90
  const zoom = Math.min(W / (maxX - minX), H / (maxY - minY)) * 0.86
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom: Math.max(zoom, 0.3) }
}

function computeSandboxCamera(W: number, H: number): Camera {
  return { x: 0, y: 0, zoom: Math.max(Math.min(W, H) / 720, 0.38) }
}

// ─── Puzzle resolver ──────────────────────────────────────────────────────────

function getPuzzle(idx: number): PuzzleDef {
  return idx < PUZZLES.length ? PUZZLES[idx] : generateLevel(idx + 1)
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function glass(border = ACCENT): React.CSSProperties {
  return {
    background: 'rgba(0,0,0,0.70)',
    border: `1px solid ${border}28`,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  }
}

function GlassCard({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return <div className={`rounded-2xl p-6 ${className}`} style={{ ...glass(), ...style }}>{children}</div>
}

function DifficultyStars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? '#fbbf24' : 'rgba(255,255,255,0.13)', fontSize: 10 }}>★</span>
      ))}
    </div>
  )
}

// ── Menu ─────────────────────────────────────────────────────────────────────

function MenuOverlay({ onPuzzle, onSandbox }: { onPuzzle: () => void; onSandbox: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div className="mb-8 relative"
        initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', damping: 22 }}>
        <motion.div className="w-28 h-28 rounded-full border border-indigo-400/30"
          animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="absolute inset-3 rounded-full border border-indigo-300/20"
          animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} />
        <div className="absolute inset-0 flex items-center justify-center text-3xl"
          style={{ filter: `drop-shadow(0 0 16px ${ACCENT})` }}>⊕</div>
      </motion.div>

      <motion.div className="text-center mb-10"
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] mb-2" style={{ color: ACCENT }}>
          Space Gravity Puzzles
        </div>
        <h1 className="text-6xl sm:text-7xl font-extrabold uppercase tracking-[0.18em] leading-none"
          style={{
            background: `linear-gradient(135deg,#fff 20%,${ACCENT} 60%,#6366f1)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 0 32px #6366f170)`,
          }}>
          ORBITAL
        </h1>
        <p className="text-white/30 text-xs tracking-wide mt-2">
          Multiple targets · Orbiting asteroids · Endless levels
        </p>
      </motion.div>

      <motion.div className="flex flex-col gap-3 w-full max-w-xs"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.28 }}>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onPuzzle}
          className="w-full py-4 rounded-2xl text-sm font-extrabold uppercase tracking-[0.25em] text-white cursor-pointer"
          style={{ background: `linear-gradient(135deg,${ACCENT},#6366f1)`, boxShadow: `0 6px 28px ${ACCENT}40` }}>
          🧩 Puzzle Mode
        </motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onSandbox}
          className="w-full py-4 rounded-2xl text-sm font-extrabold uppercase tracking-[0.25em] cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${ACCENT}30`, color: 'rgba(255,255,255,0.7)' }}>
          🌌 Sandbox
        </motion.button>
      </motion.div>

      <motion.p className="mt-8 text-[10px] text-white/20 uppercase tracking-[0.2em] text-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
        Drag to aim · Release to launch · Hit beacons in order
      </motion.p>
    </motion.div>
  )
}

// ── Level select ─────────────────────────────────────────────────────────────

function LevelSelectOverlay({
  onSelect, onEndless, onBack,
}: { onSelect: (idx: number) => void; onEndless: () => void; onBack: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <GlassCard className="w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>Puzzle Mode</div>
            <h2 className="text-xl font-extrabold text-white mt-0.5">Choose a Level</h2>
          </div>
          <button onClick={onBack}
            className="text-white/30 hover:text-white/70 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer">
            ← Back
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {PUZZLES.map((p, i) => (
            <motion.button key={p.id}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(i)}
              className="w-full flex items-center gap-4 rounded-xl px-4 py-3 text-left cursor-pointer transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                style={{ background: `${ACCENT}25`, color: ACCENT }}>{p.id}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white leading-tight">{p.name}</div>
                <div className="text-[11px] text-white/40 leading-tight mt-0.5 truncate">
                  {p.targets.length} target{p.targets.length > 1 ? 's' : ''}
                  {p.asteroids.length > 0 ? ` · ${p.asteroids.length} asteroid${p.asteroids.length > 1 ? 's' : ''}` : ''}
                </div>
              </div>
              <DifficultyStars n={p.difficulty} />
            </motion.button>
          ))}
        </div>

        {/* Endless mode */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onEndless}
          className="w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest cursor-pointer"
          style={{ background: `linear-gradient(135deg,#1e1b4b,#312e81)`, border: `1px solid ${ACCENT}40`, color: ACCENT }}>
          ∞ Endless Mode — Level 9+
        </motion.button>
      </GlassCard>
    </motion.div>
  )
}

// ── Win overlay ──────────────────────────────────────────────────────────────

function WinOverlay({
  puzzle, attempts, totalTargets, onNext, onRetry, onMenu,
}: {
  puzzle: PuzzleDef; attempts: number; totalTargets: number
  onNext: (() => void) | null; onRetry: () => void; onMenu: () => void
}) {
  return (
    <motion.div className="absolute inset-0 z-30 flex items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <GlassCard className="w-full max-w-sm text-center" style={{ border: `1px solid ${TARGET_COL}28` }}>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }} className="text-5xl mb-3">🎯</motion.div>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1" style={{ color: TARGET_COL }}>
          All {totalTargets} beacon{totalTargets > 1 ? 's' : ''} reached
        </div>
        <h2 className="text-2xl font-extrabold text-white mb-1">{puzzle.name}</h2>
        <p className="text-white/40 text-xs mb-5">
          Completed in <span className="text-white font-bold">{attempts}</span> {attempts === 1 ? 'attempt' : 'attempts'}
        </p>
        <div className="flex flex-col gap-2">
          {onNext && (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onNext}
              className="w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest text-white cursor-pointer"
              style={{ background: `linear-gradient(135deg,${ACCENT},#6366f1)`, boxShadow: `0 4px 20px ${ACCENT}40` }}>
              Next Level →
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onRetry}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
            ↺ Play Again
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onMenu}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            Level Select
          </motion.button>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ── Pause ─────────────────────────────────────────────────────────────────────

function PauseOverlay({ onResume, onMenu }: { onResume: () => void; onMenu: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-30 flex items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
      <GlassCard className="w-full max-w-xs text-center">
        <div className="text-3xl font-extrabold mb-1" style={{ color: ACCENT }}>II</div>
        <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] mb-5">Paused</div>
        <div className="flex flex-col gap-2">
          {([['Resume', onResume, true], ['Exit to Menu', onMenu, false]] as const).map(([lbl, fn, pri]) => (
            <button key={lbl} onClick={fn}
              className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
              style={pri
                ? { background: `linear-gradient(135deg,${ACCENT},#6366f1)`, color: '#fff' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }
              }>{lbl}</button>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ── HUD ───────────────────────────────────────────────────────────────────────

function HUD({
  puzzle, levelIndex, attempts, launchState, isSandbox, phase,
  currentTargetIdx, onPause, onReset,
}: {
  puzzle: PuzzleDef | null; levelIndex: number; attempts: number
  launchState: LaunchState; isSandbox: boolean; phase: Phase
  currentTargetIdx: number; onPause: () => void; onReset: () => void
}) {
  if (phase !== 'playing' && phase !== 'sandbox') return null
  const total = puzzle?.targets.length ?? 0

  return (
    <div className="absolute inset-0 pointer-events-none z-20 select-none">
      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
        <div className="flex flex-col gap-0.5 rounded-xl px-3 py-2" style={glass()}>
          {isSandbox ? (
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Sandbox</span>
          ) : puzzle ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
                  {levelIndex < PUZZLES.length ? `Level ${levelIndex + 1}` : `Level ${levelIndex + 1} · ∞`}
                </span>
                <DifficultyStars n={puzzle.difficulty} />
              </div>
              <span className="text-sm font-extrabold text-white leading-tight">{puzzle.name}</span>
              {/* Goal progress pills */}
              {total > 1 && launchState === 'launched' && (
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: total }, (_, i) => (
                    <div key={i}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: 22, height: 6,
                        background: i < currentTargetIdx
                          ? '#16a34a'
                          : i === currentTargetIdx
                          ? TARGET_COL
                          : 'rgba(255,255,255,0.18)',
                      }}
                    />
                  ))}
                  <span className="text-[10px] font-bold ml-1"
                    style={{ color: currentTargetIdx < total ? TARGET_COL : '#16a34a' }}>
                    {currentTargetIdx}/{total}
                  </span>
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={onReset}
            className="rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/70 transition-colors"
            style={glass()}>↺ Reset</button>
          <button onClick={onPause}
            className="rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/70 transition-colors"
            style={glass()}>II Pause</button>
        </div>
      </div>

      {/* Hint + attempts */}
      <AnimatePresence>
        {launchState === 'idle' && (
          <motion.div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1.5"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            {!isSandbox && puzzle && (
              <div className="text-xs text-white/45 text-center max-w-xs px-4 py-2 rounded-xl" style={glass()}>
                {puzzle.hint}
              </div>
            )}
            <div className="text-[10px] text-white/22 uppercase tracking-[0.22em]">
              {isSandbox ? 'Drag anywhere · aim · release' : `Attempt ${attempts + 1} — drag to aim, release to launch`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isSandbox && attempts > 0 && launchState === 'idle' && (
        <div className="absolute bottom-20 right-4 rounded-xl px-3 py-1.5" style={glass()}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
            {attempts} attempt{attempts !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Checkpoint notification ──────────────────────────────────────────────────

function CheckpointBanner({ text, key_ }: { text: string; key_: number }) {
  return (
    <motion.div key={key_}
      className="absolute left-1/2 top-1/3 -translate-x-1/2 z-30 pointer-events-none select-none"
      initial={{ opacity: 0, y: 10, scale: 0.85 }}
      animate={{ opacity: 1, y: -20, scale: 1 }}
      exit={{ opacity: 0, y: -60, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}>
      <div className="px-5 py-2.5 rounded-full text-sm font-extrabold uppercase tracking-widest"
        style={{
          background: `linear-gradient(135deg,${TARGET_COL},#16a34a)`,
          boxShadow: `0 4px 24px ${TARGET_COL}60`,
          color: '#fff',
        }}>{text}</div>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function OrbitalGame() {
  const [phase,          setPhase]          = useState<Phase>('menu')
  const [levelIndex,     setLevelIndex]     = useState(0)
  const [attempts,       setAttempts]       = useState(0)
  const [launchState,    setLaunchState]    = useState<LaunchState>('idle')
  const [isSandbox,      setIsSandbox]      = useState(false)
  const [currentTgtIdx,  setCurrentTgtIdx]  = useState(0)
  const [checkpoints,    setCheckpoints]    = useState<{ id: number; text: string }[]>([])
  const cpIdRef = useRef(0)

  // ── Refs ────────────────────────────────────────────────────────────────────
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const projectileRef    = useRef<Projectile | null>(null)
  const bodiesRef        = useRef<CelestialBody[]>([])
  const targetsRef       = useRef<PuzzleTarget[]>([])
  const asteroidsRef     = useRef<AsteroidDef[]>([])
  const startPosRef      = useRef({ x: 0, y: 0 })
  const camRef           = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const camTargetRef     = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const previewRef       = useRef<{ x: number; y: number }[]>([])
  const previewAstHit    = useRef(false)
  const worldParticles   = useRef<WorldParticle[]>([])
  const tRef             = useRef(0)
  const audioRef         = useRef<OrbitalAudio | null>(null)
  const launchStateRef   = useRef<LaunchState>('idle')
  const phaseRef         = useRef<Phase>('menu')
  const isSandboxRef     = useRef(false)
  const attemptsRef      = useRef(0)
  const currentTgtIdxRef = useRef(0)
  const totalTargetsRef  = useRef(0)
  const aimDragRef       = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)
  const levelIdxRef      = useRef(0)

  // Keep refs synced
  useEffect(() => { launchStateRef.current   = launchState  }, [launchState])
  useEffect(() => { phaseRef.current         = phase        }, [phase])
  useEffect(() => { isSandboxRef.current     = isSandbox    }, [isSandbox])
  useEffect(() => { attemptsRef.current      = attempts     }, [attempts])
  useEffect(() => { currentTgtIdxRef.current = currentTgtIdx }, [currentTgtIdx])
  useEffect(() => { levelIdxRef.current      = levelIndex   }, [levelIndex])

  // ── Level init ──────────────────────────────────────────────────────────────

  const initLevel = useCallback((idx: number, sandbox: boolean) => {
    const canvas = canvasRef.current
    const W = canvas?.offsetWidth  ?? 800
    const H = canvas?.offsetHeight ?? 600

    if (sandbox) {
      bodiesRef.current   = SANDBOX_BODIES
      asteroidsRef.current = SANDBOX_ASTEROIDS
      targetsRef.current  = []
      totalTargetsRef.current = 0
      startPosRef.current = SANDBOX_START
      const cam = computeSandboxCamera(W, H)
      camRef.current = camTargetRef.current = { ...cam }
    } else {
      const puzzle = getPuzzle(idx)
      bodiesRef.current   = puzzle.bodies.map(b => ({ ...b, fixed: true }))
      targetsRef.current  = puzzle.targets.map(t => ({ ...t }))
      asteroidsRef.current = puzzle.asteroids.map(a => ({ ...a }))
      totalTargetsRef.current = puzzle.targets.length
      startPosRef.current = { x: puzzle.startX, y: puzzle.startY }
      const cam = computePuzzleCamera(puzzle, W, H)
      camRef.current = camTargetRef.current = { ...cam }
    }

    projectileRef.current = null
    previewRef.current    = []
    previewAstHit.current = false
    worldParticles.current = []
    aimDragRef.current    = null
    setLaunchState('idle'); launchStateRef.current = 'idle'
    setCurrentTgtIdx(0);    currentTgtIdxRef.current = 0
    setAttempts(0);         attemptsRef.current = 0
    setCheckpoints([])
  }, [])

  // ── Game handlers ────────────────────────────────────────────────────────────

  const handleWin = useCallback(() => {
    audioRef.current?.playWin()
    setPhase('won')
  }, [])

  const handleCheckpoint = useCallback((idx: number, total: number) => {
    audioRef.current?.playWin()
    const id   = ++cpIdRef.current
    const text = idx + 1 >= total ? `All ${total} Beacons!` : `Beacon ${idx + 1} / ${total}!`
    setCheckpoints(p => [...p, { id, text }])
    setTimeout(() => setCheckpoints(p => p.filter(c => c.id !== id)), 1400)
    spawnCheckpointBurst(worldParticles.current, targetsRef.current[idx].x, targetsRef.current[idx].y)
  }, [])

  const handleLoss = useCallback(() => {
    audioRef.current?.playAbsorb()
    const newAtt = attemptsRef.current + 1
    setAttempts(newAtt); attemptsRef.current = newAtt
    projectileRef.current = null
    previewRef.current    = []
    previewAstHit.current = false
    aimDragRef.current    = null
    setCurrentTgtIdx(0);  currentTgtIdxRef.current = 0
    setLaunchState('idle'); launchStateRef.current = 'idle'
    // Restore puzzle camera
    const canvas = canvasRef.current
    const W = canvas?.offsetWidth ?? 800, H = canvas?.offsetHeight ?? 600
    if (!isSandboxRef.current) {
      const cam = computePuzzleCamera(getPuzzle(levelIdxRef.current), W, H)
      camTargetRef.current = cam
    }
  }, [])

  // ── Pointer input ────────────────────────────────────────────────────────────

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
      setLaunchState('aiming'); launchStateRef.current = 'aiming'
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
      if (vx * vx + vy * vy < 15 * 15) {
        aimDragRef.current = null; setLaunchState('idle'); launchStateRef.current = 'idle'; return
      }
      const { x, y } = startPosRef.current
      projectileRef.current = makeProjectile(x, y, vx, vy)
      previewRef.current = []; previewAstHit.current = false
      aimDragRef.current = null
      audioRef.current?.playLaunch()
      setLaunchState('launched'); launchStateRef.current = 'launched'
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const ph = phaseRef.current
        if (ph === 'playing' || ph === 'sandbox') setPhase('paused')
        else if (ph === 'paused') setPhase(isSandboxRef.current ? 'sandbox' : 'playing')
      }
    }

    canvas.addEventListener('pointerdown', onDown, { passive: false })
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup',   onUp,   { passive: false })
    window.addEventListener('keydown',     onKey)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      window.removeEventListener('keydown',     onKey)
    }
  }, [])

  // ── Audio ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!audioRef.current) {
      try { audioRef.current = new OrbitalAudio() } catch { /* silent */ }
    }
    if (phase === 'playing' || phase === 'sandbox') audioRef.current?.start()
    else if (phase === 'paused' || phase === 'menu') audioRef.current?.pause()
  }, [phase])

  useEffect(() => () => { audioRef.current?.dispose(); audioRef.current = null }, [])

  // ── Game loop ────────────────────────────────────────────────────────────────

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
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (launchStateRef.current === 'idle') {
        const cam = isSandboxRef.current
          ? computeSandboxCamera(W, H)
          : computePuzzleCamera(getPuzzle(levelIdxRef.current), W, H)
        camRef.current = camTargetRef.current = { ...cam }
      }
    }
    resize()
    window.addEventListener('resize', resize)

    let last = performance.now(), rafId = 0

    const loop = (now: number) => {
      const dt      = Math.min((now - last) / 1000, 0.05)
      last = now
      tRef.current += dt
      const t       = tRef.current
      const state   = launchStateRef.current
      const bodies  = bodiesRef.current
      const asteroids = asteroidsRef.current
      const sandbox = isSandboxRef.current

      // ── Physics ─────────────────────────────────────────────────────────────
      if (state === 'launched' && projectileRef.current) {
        projectileRef.current = stepProjectile(projectileRef.current, bodies, dt)
        const proj = projectileRef.current

        // Gravity hum
        let maxF = 0
        for (const b of bodies) {
          const r2 = (proj.x - b.x) ** 2 + (proj.y - b.y) ** 2
          maxF = Math.max(maxF, G * b.mass / Math.max(r2, 1))
        }
        audioRef.current?.setGravityIntensity(Math.min(maxF / 40000, 1))

        // Asteroid collision check
        if (proj.alive) {
          for (const ast of asteroids) {
            if (asteroidHit(ast, proj, t)) {
              const pos = asteroidPos(ast, t)
              spawnAsteroidBurst(worldParticles.current, pos.x, pos.y)
              spawnAsteroidBurst(worldParticles.current, proj.x, proj.y, 12)
              handleLoss(); rafId = requestAnimationFrame(loop); return
            }
          }
        }

        // Sequential target check
        if (!sandbox && proj.alive) {
          const tgtIdx = currentTgtIdxRef.current
          const tgts   = targetsRef.current
          if (tgtIdx < tgts.length) {
            const tgt  = tgts[tgtIdx]
            const dist = Math.hypot(proj.x - tgt.x, proj.y - tgt.y)
            if (dist < tgt.radius + proj.radius) {
              const nextIdx = tgtIdx + 1
              handleCheckpoint(tgtIdx, totalTargetsRef.current)
              if (nextIdx >= tgts.length) {
                // All targets hit — WIN!
                setTimeout(() => handleWin(), 350)
                rafId = requestAnimationFrame(loop); return
              }
              setCurrentTgtIdx(nextIdx); currentTgtIdxRef.current = nextIdx
            }
          }
        }

        // Loss check
        if (!proj.alive || isEscaped(proj)) { handleLoss() }
        else {
          // Camera follows probe, gently zoom in as it closes on current target
          const tgtIdx = currentTgtIdxRef.current
          const tgts   = targetsRef.current
          const hasTgt = !sandbox && tgtIdx < tgts.length
          const tgt    = hasTgt ? tgts[tgtIdx] : null
          const toDist = tgt ? Math.hypot(proj.x - tgt.x, proj.y - tgt.y) : Infinity
          const zoomBoost = hasTgt && toDist < 180 ? 1 + (180 - toDist) / 360 : 1

          camTargetRef.current = {
            x: proj.x,
            y: proj.y,
            zoom: camRef.current.zoom * zoomBoost,
          }
        }
      }

      // ── Trajectory preview ───────────────────────────────────────────────────
      if (state === 'aiming' && aimDragRef.current) {
        const { sx, sy, cx, cy } = aimDragRef.current
        const { vx, vy } = launchVelocity(cx - sx, cy - sy)
        const { x, y }   = startPosRef.current
        const result = previewTrajectory(x, y, vx, vy, bodies, asteroids, t)
        previewRef.current    = result.path
        previewAstHit.current = result.asteroidHitStep !== null
      }

      // ── World particles ──────────────────────────────────────────────────────
      updateWorldParticles(worldParticles.current, dt)

      // ── Camera lerp ──────────────────────────────────────────────────────────
      const cam    = camRef.current
      const camTgt = camTargetRef.current
      const lerp   = 1 - Math.exp(-5 * dt)
      cam.x    += (camTgt.x    - cam.x)    * lerp
      cam.y    += (camTgt.y    - cam.y)    * lerp
      cam.zoom += (camTgt.zoom - cam.zoom) * lerp
      const { x: camX, y: camY, zoom } = cam

      // ── Render ───────────────────────────────────────────────────────────────
      drawBackground(ctx, W, H)
      drawStarfield(ctx, W, H, camX, camY, t)

      ctx.save()
      ctx.setTransform(zoom, 0, 0, zoom, W / 2 - camX * zoom, H / 2 - camY * zoom)

      // Nebulae
      drawNebulae(ctx, t)

      // Asteroid orbit rings (when idle/aiming — helps planning)
      if (state !== 'launched') {
        for (const ast of asteroids) drawAsteroidOrbit(ctx, ast)
      }

      // Targets (numbered + connected)
      if (!sandbox) {
        drawTargetSequence(ctx, targetsRef.current, currentTgtIdxRef.current, t)
      }

      // Celestial bodies
      for (const body of [...bodies].sort((a, b) => b.radius - a.radius)) {
        drawCelestialBody(ctx, body, t)
      }

      // Asteroids — compute danger flash
      for (const ast of asteroids) {
        const pos  = asteroidPos(ast, t)
        let danger = false
        if (state === 'launched' && projectileRef.current?.alive) {
          const proj  = projectileRef.current
          const dist  = Math.hypot(proj.x - pos.x, proj.y - pos.y)
          danger = dist < ast.radius * 3.5
        }
        drawAsteroid(ctx, pos.x, pos.y, ast.radius, ast.id, t, danger)
      }

      // Trajectory preview
      if (state === 'aiming') {
        drawTrajectoryPreview(ctx, previewRef.current, previewAstHit.current)
        if (aimDragRef.current) {
          const { sx, sy, cx, cy } = aimDragRef.current
          const { vx, vy } = launchVelocity(cx - sx, cy - sy)
          drawAimArrow(ctx, startPosRef.current.x, startPosRef.current.y, vx, vy)
        }
      }

      // Trail + projectile (or idle indicator)
      if (state === 'launched' && projectileRef.current?.alive) {
        drawTrail(ctx, projectileRef.current)
        drawProjectile(ctx, projectileRef.current)
      } else if (state === 'idle' || state === 'aiming') {
        drawLaunchIndicator(ctx, startPosRef.current.x, startPosRef.current.y, t)
      }

      // World-space particles (checkpoints, asteroid hits)
      drawWorldParticles(ctx, worldParticles.current)

      ctx.restore()

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, levelIndex, handleWin, handleLoss, handleCheckpoint])

  // ── Derived ──────────────────────────────────────────────────────────────────

  const currentPuzzle  = !isSandbox ? getPuzzle(levelIndex) : null
  const hasNextLevel   = true  // endless — always has a next level

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#020207' }}>
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none z-[5] opacity-[0.018]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.5) 2px,rgba(255,255,255,0.5) 3px)' }} />

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block"
        style={{ cursor: launchState === 'aiming' ? 'crosshair' : 'default' }} />

      <HUD
        puzzle={currentPuzzle}
        levelIndex={levelIndex}
        attempts={attempts}
        launchState={launchState}
        isSandbox={isSandbox}
        phase={phase}
        currentTargetIdx={currentTgtIdx}
        onPause={() => setPhase('paused')}
        onReset={() => {
          initLevel(isSandbox ? 0 : levelIndex, isSandbox)
          audioRef.current?.resume()
        }}
      />

      {/* Checkpoint banners */}
      <AnimatePresence>
        {checkpoints.map(cp => (
          <CheckpointBanner key={cp.id} key_={cp.id} text={cp.text} />
        ))}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {phase === 'menu' && (
          <MenuOverlay key="menu" onPuzzle={() => setPhase('level-select')} onSandbox={() => {
            setIsSandbox(true); initLevel(0, true); setPhase('sandbox'); audioRef.current?.start()
          }} />
        )}

        {phase === 'level-select' && (
          <LevelSelectOverlay key="level-select"
            onSelect={(idx) => { setIsSandbox(false); setLevelIndex(idx); initLevel(idx, false); setPhase('playing'); audioRef.current?.start() }}
            onEndless={() => { setIsSandbox(false); const idx = PUZZLES.length; setLevelIndex(idx); initLevel(idx, false); setPhase('playing'); audioRef.current?.start() }}
            onBack={() => setPhase('menu')}
          />
        )}

        {phase === 'won' && currentPuzzle && (
          <WinOverlay key="won"
            puzzle={currentPuzzle}
            attempts={attempts + 1}
            totalTargets={currentPuzzle.targets.length}
            onNext={hasNextLevel ? () => {
              const next = levelIndex + 1
              setLevelIndex(next); initLevel(next, false); setPhase('playing')
            } : null}
            onRetry={() => { initLevel(levelIndex, false); setPhase('playing') }}
            onMenu={() => setPhase('level-select')}
          />
        )}

        {phase === 'paused' && (
          <PauseOverlay key="paused"
            onResume={() => setPhase(isSandbox ? 'sandbox' : 'playing')}
            onMenu={() => { setPhase('menu'); audioRef.current?.pause() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
