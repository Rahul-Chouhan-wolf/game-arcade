"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { PALETTES, NeonPalette, PaletteId } from "./types"
import { CarState, InputState, createCar, stepCar, normalizeAngle } from "@/lib/neon-drift/physics"
import {
  Highway, RoadSegment, EnvObject,
  ROAD_HALF_W, LOOK_AHEAD_PX,
  HIGHWAY_START_X, HIGHWAY_START_Y, HIGHWAY_START_ANGLE,
} from "@/lib/neon-drift/highway"
import { SynthwaveMusic } from "@/lib/neon-drift/synth-music"
import { AudioEngine } from "@/lib/neon-drift/audio"

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "menu" | "countdown" | "playing" | "paused" | "gameover"

interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; color: string; isSpark: boolean
}

interface TrafficCar {
  id: number; x: number; y: number; heading: number; speed: number; passed: boolean
}

interface Camera { x: number; y: number; heading: number; bank: number }

interface FloatNotif {
  id: number; text: string; pts: number; x: number; y: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hex2rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r)
}

function rng(x: number, y: number, seed = 137): number {
  return ((Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453) % 1 + 1) % 1
}

// ─── World-space rendering ────────────────────────────────────────────────────

function drawWorldBackground(ctx: CanvasRenderingContext2D, camX: number, camY: number, W: number, H: number, palette: NeonPalette) {
  const R = Math.hypot(W, H) * 0.75

  // Base fill
  ctx.fillStyle = palette.bg
  ctx.fillRect(camX - R, camY - R, R * 2, R * 2)

  // Synthwave ground grid (world-aligned)
  const GRID = 220
  const sx = Math.floor((camX - R) / GRID) * GRID
  const sy = Math.floor((camY - R) / GRID) * GRID

  ctx.strokeStyle = hex2rgba(palette.grid, 0.09)
  ctx.lineWidth = 0.8

  for (let x = sx; x <= camX + R; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, camY - R); ctx.lineTo(x, camY + R); ctx.stroke()
  }
  for (let y = sy; y <= camY + R; y += GRID) {
    ctx.beginPath(); ctx.moveTo(camX - R, y); ctx.lineTo(camX + R, y); ctx.stroke()
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, palette: NeonPalette) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const seed = rng(x, y) * 100
  const w = 60 + (seed % 5) * 22
  const h = 38 + (seed % 7) * 14
  ctx.fillStyle = `rgba(8,8,20,0.92)`
  roundRect(ctx, -w / 2, -h / 2, w, h, 3)
  ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.grid, 0.22)
  ctx.lineWidth = 1
  ctx.stroke()
  // windows
  const rows = Math.floor(h / 12), cols = Math.floor(w / 16)
  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      if (rng(x + ci, y + ri) < 0.45) {
        ctx.fillStyle = rng(x + ci * 2, y + ri * 3) > 0.5
          ? hex2rgba(palette.accent, 0.45) : hex2rgba(palette.secondary, 0.30)
        ctx.fillRect(-w / 2 + 5 + ci * 14, -h / 2 + 5 + ri * 11, 7, 5)
      }
    }
  }
  ctx.restore()
}

function drawPole(ctx: CanvasRenderingContext2D, x: number, y: number, palette: NeonPalette) {
  ctx.beginPath()
  ctx.arc(x, y, 4, 0, 2 * Math.PI)
  ctx.fillStyle = palette.glow
  ctx.shadowColor = palette.glow
  ctx.shadowBlur = 18
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, 2 * Math.PI)
  ctx.strokeStyle = hex2rgba(palette.glow, 0.28)
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawBillboard(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, palette: NeonPalette, label?: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle + Math.PI / 2)
  const bw = 72, bh = 22
  ctx.fillStyle = "rgba(0,0,0,0.85)"
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 4)
  ctx.fill()
  ctx.strokeStyle = palette.primary
  ctx.lineWidth = 1.5
  ctx.shadowColor = palette.glow
  ctx.shadowBlur = 12
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 4)
  ctx.stroke()
  ctx.shadowBlur = 0
  if (label) {
    ctx.font = "700 6px monospace"
    ctx.fillStyle = palette.secondary
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(label.slice(0, 13), 0, 0)
  }
  ctx.restore()
}

function drawEnvObjects(ctx: CanvasRenderingContext2D, highway: Highway, palette: NeonPalette) {
  const segMap = new Map<number, RoadSegment>()
  for (const s of highway.segments) segMap.set(s.id, s)

  for (const obj of highway.envObjects) {
    const seg = segMap.get(obj.segId)
    if (!seg) continue

    const perpX = -Math.sin(seg.angle) * obj.side
    const perpY =  Math.cos(seg.angle) * obj.side

    switch (obj.kind as EnvObject["kind"]) {
      case "pole": {
        const px = seg.x + perpX * (ROAD_HALF_W + 28)
        const py = seg.y + perpY * (ROAD_HALF_W + 28)
        drawPole(ctx, px, py, palette)
        break
      }
      case "billboard": {
        const bx = seg.x + perpX * (ROAD_HALF_W + 50)
        const by = seg.y + perpY * (ROAD_HALF_W + 50)
        drawBillboard(ctx, bx, by, seg.angle, palette, (obj as EnvObject & { label?: string }).label)
        break
      }
      case "building": {
        const distance = ROAD_HALF_W + 165 + rng(seg.x, seg.y) * 80
        const bx = seg.x + perpX * distance
        const by = seg.y + perpY * distance
        drawBuilding(ctx, bx, by, seg.angle, palette)
        break
      }
    }
  }
}

function drawHighwayRoad(ctx: CanvasRenderingContext2D, segments: RoadSegment[], palette: NeonPalette, t: number) {
  if (segments.length < 2) return
  ctx.save()

  const leftPts:  { x: number; y: number }[] = []
  const rightPts: { x: number; y: number }[] = []

  for (const s of segments) {
    const px = -Math.sin(s.angle)
    const py =  Math.cos(s.angle)
    leftPts.push({ x: s.x + px * ROAD_HALF_W, y: s.y + py * ROAD_HALF_W })
    rightPts.push({ x: s.x - px * ROAD_HALF_W, y: s.y - py * ROAD_HALF_W })
  }

  // Road surface fill
  ctx.beginPath()
  ctx.moveTo(leftPts[0].x, leftPts[0].y)
  for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y)
  for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y)
  ctx.closePath()
  ctx.fillStyle = "#0d0d1f"
  ctx.fill()

  // Drift zone + sweeper tint
  const driftSegs = segments.filter(s => s.type === "drift-zone" || s.type === "sweeper")
  if (driftSegs.length > 1) {
    for (let i = 0; i < driftSegs.length - 1; i++) {
      const a = driftSegs[i], b = driftSegs[i + 1]
      const ax = -Math.sin(a.angle), ay = Math.cos(a.angle)
      const bx = -Math.sin(b.angle), by = Math.cos(b.angle)
      ctx.beginPath()
      ctx.moveTo(a.x + ax * ROAD_HALF_W, a.y + ay * ROAD_HALF_W)
      ctx.lineTo(b.x + bx * ROAD_HALF_W, b.y + by * ROAD_HALF_W)
      ctx.lineTo(b.x - bx * ROAD_HALF_W, b.y - by * ROAD_HALF_W)
      ctx.lineTo(a.x - ax * ROAD_HALF_W, a.y - ay * ROAD_HALF_W)
      ctx.closePath()
      ctx.fillStyle = hex2rgba(palette.glow, 0.04)
      ctx.fill()
    }
  }

  // Left edge
  ctx.beginPath()
  ctx.moveTo(leftPts[0].x, leftPts[0].y)
  for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y)
  ctx.strokeStyle = palette.primary
  ctx.lineWidth = 3.5
  ctx.shadowColor = palette.glow
  ctx.shadowBlur = 18
  ctx.lineJoin = "round"
  ctx.stroke()

  // Right edge
  ctx.beginPath()
  ctx.moveTo(rightPts[0].x, rightPts[0].y)
  for (let i = 1; i < rightPts.length; i++) ctx.lineTo(rightPts[i].x, rightPts[i].y)
  ctx.strokeStyle = palette.secondary
  ctx.lineWidth = 3.5
  ctx.shadowColor = palette.glow
  ctx.shadowBlur = 18
  ctx.stroke()
  ctx.shadowBlur = 0

  // Centre dashes (animated)
  ctx.setLineDash([28, 42])
  ctx.lineDashOffset = -(t * 180) % 70
  ctx.strokeStyle = hex2rgba(palette.grid, 0.55)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(segments[0].x, segments[0].y)
  for (let i = 1; i < segments.length; i++) ctx.lineTo(segments[i].x, segments[i].y)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.restore()
}

// ─── Car rendering ────────────────────────────────────────────────────────────

function drawCar(ctx: CanvasRenderingContext2D, car: CarState, palette: NeonPalette) {
  ctx.save()
  ctx.translate(car.x, car.y)
  ctx.rotate(car.heading)

  // Underglow
  const ug = ctx.createRadialGradient(0, 5, 0, 0, 5, 42)
  ug.addColorStop(0, hex2rgba(palette.glow, 0.7))
  ug.addColorStop(1, "transparent")
  ctx.fillStyle = ug
  ctx.beginPath(); ctx.ellipse(0, 6, 44, 17, 0, 0, 2 * Math.PI); ctx.fill()

  // Drift glow at wheels
  if (car.drifting) {
    const t = Math.min(Math.abs(car.driftAngle) / 0.8, 1)
    ctx.fillStyle = hex2rgba(palette.glow, 0.22 * t)
    ctx.beginPath(); ctx.ellipse(-28, -11, 6, 4, 0, 0, 2 * Math.PI); ctx.fill()
    ctx.beginPath(); ctx.ellipse(-28,  11, 6, 4, 0, 0, 2 * Math.PI); ctx.fill()
  }

  // Body shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(ctx, -30, -12, 62, 26, 7); ctx.fill()

  // Body
  const bg = ctx.createLinearGradient(0, -14, 0, 14)
  bg.addColorStop(0, "#1e1e3a"); bg.addColorStop(0.5, "#14142a"); bg.addColorStop(1, "#0e0e1e")
  ctx.shadowColor = palette.primary; ctx.shadowBlur = 14
  roundRect(ctx, -31, -13, 62, 26, 6)
  ctx.fillStyle = bg; ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.primary, 0.85); ctx.lineWidth = 1.8; ctx.stroke()
  ctx.shadowBlur = 0

  // Neon stripe
  for (const sy of [-13, 13]) {
    ctx.beginPath(); ctx.moveTo(-22, sy); ctx.lineTo(22, sy)
    ctx.strokeStyle = hex2rgba(palette.glow, 0.9); ctx.lineWidth = 1.4
    ctx.shadowColor = palette.glow; ctx.shadowBlur = 8; ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Cabin
  roundRect(ctx, -6, -10, 24, 20, 4)
  ctx.fillStyle = hex2rgba(palette.accent, 0.28); ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.accent, 0.6); ctx.lineWidth = 0.9; ctx.stroke()

  // Headlights
  for (const sy of [-9, 9]) {
    ctx.beginPath(); ctx.ellipse(31, sy, 5, 3, 0, 0, 2 * Math.PI)
    ctx.fillStyle = "#fff"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0
  }

  // Engine exhaust
  ctx.beginPath(); ctx.ellipse(-34, 0, 4, 9, 0, 0, 2 * Math.PI)
  ctx.fillStyle = hex2rgba(palette.secondary, 0.95)
  ctx.shadowColor = palette.secondary; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0

  // Wheels
  for (const [wx, wy] of [[-18, -14], [14, -14], [-18, 14], [14, 14]]) {
    roundRect(ctx, wx - 8, wy - 4, 14, 7, 2)
    ctx.fillStyle = "#0a0a14"; ctx.fill()
    ctx.strokeStyle = hex2rgba(palette.grid, 0.55); ctx.lineWidth = 0.9; ctx.stroke()
  }

  ctx.restore()
}

// ─── Traffic ──────────────────────────────────────────────────────────────────

function drawTrafficCar(ctx: CanvasRenderingContext2D, tc: TrafficCar, palette: NeonPalette) {
  ctx.save()
  ctx.translate(tc.x, tc.y); ctx.rotate(tc.heading)

  // Body
  roundRect(ctx, -18, -9, 36, 18, 4)
  ctx.fillStyle = "#161622"; ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.stroke()

  // Taillights
  for (const sy of [-7, 7]) {
    ctx.beginPath(); ctx.ellipse(-17, sy, 3.5, 2.5, 0, 0, 2 * Math.PI)
    ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0
  }

  // Faint headlights
  for (const sy of [-7, 7]) {
    ctx.beginPath(); ctx.ellipse(17, sy, 3, 2, 0, 0, 2 * Math.PI)
    ctx.fillStyle = "rgba(255,255,220,0.25)"; ctx.fill()
  }

  // Neon roof strip
  ctx.strokeStyle = hex2rgba(palette.accent, 0.5); ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(-10, -9); ctx.lineTo(10, -9); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-10,  9); ctx.lineTo(10,  9); ctx.stroke()

  ctx.restore()
}

// ─── Particles ────────────────────────────────────────────────────────────────

const MAX_PARTICLES = 160

function spawnDriftParticles(car: CarState, palette: NeonPalette, particles: Particle[], count = 2) {
  const rx = car.x - Math.cos(car.heading) * 26
  const ry = car.y - Math.sin(car.heading) * 26
  const px = -Math.sin(car.heading), py = Math.cos(car.heading)

  for (const side of [-1, 1] as const) {
    for (let ci = 0; ci < count; ci++) {
      if (particles.length >= MAX_PARTICLES) break
      const da = Math.abs(car.driftAngle)
      const isSpark = da > 0.5 && Math.random() < 0.28
      particles.push({
        x: rx + px * side * 11 + (Math.random() - 0.5) * 8,
        y: ry + py * side * 11 + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 55 - car.vx * 0.11,
        vy: (Math.random() - 0.5) * 55 - car.vy * 0.11,
        life: 1, maxLife: isSpark ? 0.25 + Math.random() * 0.18 : 0.7 + Math.random() * 0.5,
        size: isSpark ? Math.random() * 3 + 1 : Math.random() * 15 + 6,
        color: isSpark ? palette.accent : palette.glow, isSpark,
      })
    }
  }
}

function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt; p.y += p.vy * dt
    p.vx *= 0.94; p.vy *= 0.94
    p.life -= dt / p.maxLife
    if (p.life <= 0) particles.splice(i, 1)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.globalAlpha = Math.pow(p.life, 0.5)
    if (p.isSpark) {
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI); ctx.fill(); ctx.shadowBlur = 0
    } else {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
      g.addColorStop(0, hex2rgba(p.color, 0.55)); g.addColorStop(1, "transparent")
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI); ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

// ─── Screen-space FX ─────────────────────────────────────────────────────────

function drawSpeedLines(ctx: CanvasRenderingContext2D, W: number, H: number, speed: number, palette: NeonPalette, t: number) {
  const intensity = Math.max(0, (speed - 130) / 330)
  if (intensity < 0.01) return
  ctx.save()

  // Vanishing point in upper portion of screen (where road horizon is with the new camera)
  const vpx = W / 2, vpy = H * 0.22

  for (let i = 0; i < 22; i++) {
    // Spread streaks radially from vanishing point, biased toward lower screen (where car is)
    const baseAngle = (i / 22) * Math.PI * 2
    // Offset streaks so they're denser in the lower/peripheral area
    const radius0 = H * 0.28 + ((i * 67 + Math.floor(t * 90 + i * 7)) % (H * 0.62))
    const radius1 = radius0 + 28 + intensity * 150

    const x0 = vpx + Math.cos(baseAngle) * radius0
    const y0 = vpy + Math.sin(baseAngle) * radius0
    const x1 = vpx + Math.cos(baseAngle) * radius1
    const y1 = vpy + Math.sin(baseAngle) * radius1

    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, "transparent")
    g.addColorStop(0.45, hex2rgba(palette.glow, 0.16 * intensity))
    g.addColorStop(1, "transparent")
    ctx.strokeStyle = g
    ctx.lineWidth = 0.9 + intensity * 0.6
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  ctx.restore()
}

function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number, speed = 0) {
  const speedN = Math.min(speed / 480, 1)
  // Vignette grows darker + tighter at speed → tunnel-vision effect
  const inner = H * (0.30 - speedN * 0.10)
  const outer = H * (0.88 - speedN * 0.08)
  const alpha  = 0.52 + speedN * 0.22
  const g = ctx.createRadialGradient(W / 2, H * 0.60, inner, W / 2, H * 0.55, outer)
  g.addColorStop(0, "transparent")
  g.addColorStop(1, `rgba(0,0,0,${alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// Cinematic sky + horizon — fills the "road ahead" upper portion of screen
function drawHorizonAtmosphere(ctx: CanvasRenderingContext2D, W: number, H: number, palette: NeonPalette, speed: number) {
  const speedN = Math.min(speed / 320, 1)

  // Deep sky gradient — covers upper ~38% of screen (road ahead area)
  const skyH = H * 0.38
  const sky = ctx.createLinearGradient(0, 0, 0, skyH)
  sky.addColorStop(0,   palette.bgMid)
  sky.addColorStop(0.55, hex2rgba(palette.primary, 0.05 + speedN * 0.07))
  sky.addColorStop(1,   "transparent")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, skyH)

  // Subtle star field (static but pretty)
  ctx.fillStyle = "rgba(255,255,255,0.55)"
  for (let i = 0; i < 38; i++) {
    // Deterministic positions seeded by index
    const sx = ((i * 173 + 47) % 97) / 97 * W
    const sy = ((i * 251 + 13) % 61) / 61 * skyH * 0.72
    const sr = 0.5 + ((i * 97) % 5) * 0.2
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
  }

  // Horizon glow band — sits right where road meets "sky"
  const horizonY = H * 0.33
  const glow = ctx.createLinearGradient(0, horizonY - 18, 0, horizonY + 28)
  glow.addColorStop(0,   "transparent")
  glow.addColorStop(0.5, hex2rgba(palette.glow, 0.12 + speedN * 0.22))
  glow.addColorStop(1,   "transparent")
  ctx.fillStyle = glow
  ctx.fillRect(0, horizonY - 18, W, 46)

  // City-glow blobs on horizon (pillars of light)
  for (let i = 0; i < 5; i++) {
    const bx = (0.1 + i * 0.2) * W
    const bw = 30 + ((i * 53) % 40)
    const bg = ctx.createRadialGradient(bx, horizonY, 0, bx, horizonY, bw)
    bg.addColorStop(0, hex2rgba(i % 2 === 0 ? palette.primary : palette.secondary, 0.10 + speedN * 0.08))
    bg.addColorStop(1, "transparent")
    ctx.fillStyle = bg
    ctx.fillRect(bx - bw, horizonY - bw / 2, bw * 2, bw)
  }
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function drawHUD(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  car: CarState,
  palette: NeonPalette,
  distance: number,
  countdown: number,
) {
  ctx.save()
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0)

  const speedKmh = Math.round(car.speed * 0.45)
  const distKm   = (distance / 4600).toFixed(2)

  // ── Speed panel (bottom-left) ─────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.48)"
  ctx.beginPath(); ctx.roundRect(14, H - 82, 108, 68, 12); ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.38); ctx.lineWidth = 1; ctx.stroke()

  ctx.font = `900 38px 'SF Mono','Fira Mono',monospace`
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"
  ctx.shadowColor = palette.glow; ctx.shadowBlur = 14
  ctx.fillText(`${speedKmh}`, 68, H - 46); ctx.shadowBlur = 0
  ctx.font = `700 9px system-ui`; ctx.fillStyle = hex2rgba(palette.primary, 0.7)
  ctx.fillText("KM/H", 68, H - 29)

  // ── Score + combo (top-right) ─────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.48)"
  ctx.beginPath(); ctx.roundRect(W - 155, 14, 141, 54, 12); ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.35); ctx.lineWidth = 1; ctx.stroke()

  ctx.font = `700 9px system-ui`; ctx.fillStyle = hex2rgba(palette.primary, 0.55); ctx.textAlign = "right"
  ctx.fillText("SCORE", W - 18, 32)
  ctx.font = `900 22px 'SF Mono','Fira Mono',monospace`; ctx.fillStyle = "#fff"
  ctx.shadowColor = palette.glow; ctx.shadowBlur = 10
  ctx.fillText(car.score.toLocaleString(), W - 18, 58); ctx.shadowBlur = 0
  if (car.combo > 1) {
    ctx.font = `900 14px 'SF Mono','Fira Mono',monospace`; ctx.fillStyle = palette.secondary
    ctx.shadowColor = palette.secondary; ctx.shadowBlur = 8
    ctx.fillText(`×${car.combo}`, W - 18 - 80, 58); ctx.shadowBlur = 0
  }

  // ── Distance (top-left) ───────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.48)"
  ctx.beginPath(); ctx.roundRect(14, 14, 118, 54, 12); ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.35); ctx.lineWidth = 1; ctx.stroke()

  ctx.font = `700 9px system-ui`; ctx.textAlign = "left"; ctx.fillStyle = hex2rgba(palette.primary, 0.55)
  ctx.fillText("DISTANCE", 26, 32)
  ctx.font = `900 18px 'SF Mono','Fira Mono',monospace`; ctx.fillStyle = palette.accent
  ctx.shadowColor = palette.accent; ctx.shadowBlur = 8
  ctx.fillText(`${distKm} km`, 26, 56); ctx.shadowBlur = 0

  // ── Drift angle bar (bottom-centre) ──────────────────────────────────────
  const barW = Math.min(210, W * 0.46)
  const barX = (W - barW) / 2, barY = H - 40

  ctx.fillStyle = "rgba(0,0,0,0.5)"
  ctx.beginPath(); ctx.roundRect(barX - 12, barY - 9, barW + 24, 30, 8); ctx.fill()

  ctx.fillStyle = "rgba(255,255,255,0.07)"
  ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill()

  const driftFrac = Math.min(Math.abs(car.driftAngle) / 1.1, 1)
  if (driftFrac > 0) {
    const fw = barW * driftFrac, fx = barX + (barW - fw) / 2
    const bg2 = ctx.createLinearGradient(fx, 0, fx + fw, 0)
    bg2.addColorStop(0, hex2rgba(palette.primary, 0.6))
    bg2.addColorStop(0.5, palette.glow)
    bg2.addColorStop(1, hex2rgba(palette.primary, 0.6))
    ctx.fillStyle = car.drifting ? bg2 : hex2rgba(palette.primary, 0.3)
    ctx.shadowColor = palette.glow; ctx.shadowBlur = car.drifting ? 14 : 0
    ctx.beginPath(); ctx.roundRect(fx, barY, fw, 7, 3); ctx.fill(); ctx.shadowBlur = 0
  }

  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(barX + barW / 2 - 1, barY - 3, 2, 13)

  if (car.drifting) {
    ctx.font = "900 8px system-ui"; ctx.fillStyle = palette.glow; ctx.textAlign = "center"
    ctx.shadowColor = palette.glow; ctx.shadowBlur = 10
    ctx.fillText("DRIFT", W / 2, barY + 20); ctx.shadowBlur = 0
  }

  // ── Countdown ────────────────────────────────────────────────────────────
  if (countdown > 0) {
    ctx.font = "900 80px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"
    ctx.shadowColor = palette.glow; ctx.shadowBlur = 42
    ctx.fillText(Math.ceil(countdown) <= 0 ? "GO!" : String(Math.ceil(countdown)), W / 2, H / 2 + 30)
    ctx.shadowBlur = 0
  }

  ctx.restore()
}

// ─── Touch controls ───────────────────────────────────────────────────────────

function TouchControls({ onInput }: { onInput: (k: keyof InputState, v: boolean) => void }) {
  const B = (label: string, k: keyof InputState, extra = "") => (
    <button
      className={`select-none flex items-center justify-center rounded-2xl text-white/75 font-extrabold active:scale-95 transition-all ${extra}`}
      style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.14)" }}
      onPointerDown={() => onInput(k, true)}
      onPointerUp={() => onInput(k, false)}
      onPointerLeave={() => onInput(k, false)}
    >{label}</button>
  )
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-5 px-4">
      <div className="pointer-events-auto flex justify-between items-end gap-2">
        {B("◀", "left", "w-20 h-20 text-xl")}
        <div className="flex flex-col gap-2">
          {B("GAS", "throttle", "w-24 h-14 text-sm tracking-widest")}
          {B("DRIFT", "handbrake", "w-24 h-14 text-sm tracking-widest")}
        </div>
        {B("▶", "right", "w-20 h-20 text-xl")}
      </div>
    </div>
  )
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function glass(borderColor: string): React.CSSProperties {
  return { background: "rgba(0,0,0,0.62)", border: `1px solid ${borderColor}30`, backdropFilter: "blur(22px)" }
}

function MenuOverlay({ palette, activePalette, onStart, onPalette, musicMuted, onMuteToggle }: {
  palette: NeonPalette; activePalette: PaletteId
  onStart: () => void; onPalette: (id: PaletteId) => void
  musicMuted: boolean; onMuteToggle: () => void
}) {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center z-30 select-none"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="text-center mb-8"
        initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", damping: 22 }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.4em] mb-2" style={{ color: palette.secondary }}>
          Endless Neon Highway
        </div>
        <div className="font-extrabold uppercase tracking-[0.14em] leading-none"
          style={{
            fontSize: "clamp(3rem,12vw,5.5rem)",
            background: `linear-gradient(135deg,#fff 20%,${palette.secondary} 60%,${palette.primary})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 28px ${palette.glow}80)`,
          }}>NEON<br />DRIFT</div>
        <div className="text-white/30 text-xs tracking-[0.25em] uppercase mt-2">Race the neon night — forever</div>
      </motion.div>

      <motion.button
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35, type: "spring", damping: 18 }}
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}
        onClick={onStart}
        className="px-10 py-4 rounded-2xl text-sm font-extrabold uppercase tracking-[0.28em] text-white mb-5 cursor-pointer"
        style={{ background: `linear-gradient(135deg,${palette.primary},${palette.secondary})`, boxShadow: `0 0 28px ${palette.glow}40` }}
      >⚡ Start Drifting</motion.button>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="flex gap-2 flex-wrap justify-center mb-3">
        {Object.values(PALETTES).map(p => (
          <button key={p.id} onClick={() => onPalette(p.id as PaletteId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all"
            style={activePalette === p.id ? {
              background: `linear-gradient(135deg,${p.primary},${p.secondary})`, color: "#fff",
              boxShadow: `0 0 12px ${p.glow}50`,
            } : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }}>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.primary }} />
            {p.name}
          </button>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        className="flex items-center gap-3 mb-3">
        <button onClick={onMuteToggle}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest cursor-pointer"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.5)" }}>
          {musicMuted ? "🔇 Music Off" : "🎵 Music On"}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72 }}
        className="text-[10px] text-white/20 uppercase tracking-[0.2em] text-center">
        ← → Steer · ↑ Gas · Space Drift · Esc Pause
      </motion.div>
    </motion.div>
  )
}

function PauseOverlay({ palette, onResume, onQuit, musicMuted, onMuteToggle }: {
  palette: NeonPalette; onResume: () => void; onQuit: () => void
  musicMuted: boolean; onMuteToggle: () => void
}) {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center z-40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: "blur(14px)", background: "rgba(0,0,0,0.55)" }}>
      <motion.div initial={{ scale: 0.85, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 24 }}
        transition={{ type: "spring", damping: 22 }}
        className="flex flex-col items-center gap-4 w-58 p-7 rounded-2xl" style={glass(palette.primary)}>
        <div className="text-[10px] text-white/35 uppercase tracking-[0.3em]">Paused</div>
        <div className="text-3xl font-extrabold" style={{ color: palette.primary }}>II</div>
        {([["Resume", onResume, true], ["End Session", onQuit, false]] as const).map(([lbl, fn, pri]) => (
          <button key={lbl} onClick={fn}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
            style={pri ? {
              background: `linear-gradient(135deg,${palette.primary},${palette.secondary})`, color: "#fff",
            } : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)" }}>
            {lbl}
          </button>
        ))}
        <button onClick={onMuteToggle}
          className="text-[10px] text-white/35 uppercase tracking-widest cursor-pointer hover:text-white/60 transition-colors">
          {musicMuted ? "🔇 Unmute Music" : "🎵 Mute Music"}
        </button>
      </motion.div>
    </motion.div>
  )
}

function SessionEndOverlay({ palette, car, distance, onRestart, onQuit }: {
  palette: NeonPalette; car: CarState; distance: number; onRestart: () => void; onQuit: () => void
}) {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center z-40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.62)" }}>
      <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="flex flex-col items-center gap-4 w-66 p-8 rounded-2xl" style={glass(palette.primary)}>
        <div className="text-[10px] text-white/35 uppercase tracking-[0.3em]">Session Complete</div>
        <div className="text-2xl font-extrabold uppercase tracking-widest"
          style={{ background: `linear-gradient(135deg,#fff,${palette.secondary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Neon Drift
        </div>
        <div className="w-full space-y-2">
          {([
            ["Score",    car.score.toLocaleString()],
            ["Distance", `${(distance / 4600).toFixed(2)} km`],
            ["Max Combo", `×${car.combo}`],
          ] as const).map(([lbl, val]) => (
            <div key={lbl} className="flex justify-between text-xs">
              <span className="text-white/40 uppercase tracking-widest">{lbl}</span>
              <span className="font-bold text-white">{val}</span>
            </div>
          ))}
        </div>
        {([["Drive Again", onRestart, true], ["Main Menu", onQuit, false]] as const).map(([lbl, fn, pri]) => (
          <button key={lbl} onClick={fn}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
            style={pri ? {
              background: `linear-gradient(135deg,${palette.primary},${palette.secondary})`,
              color: "#fff", boxShadow: `0 0 18px ${palette.glow}35`,
            } : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)" }}>
            {lbl}
          </button>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ─── Main Game Component ──────────────────────────────────────────────────────

export function NeonDriftGame() {
  const [phase, setPhase]           = useState<Phase>("menu")
  const [activePalette, setPalette] = useState<PaletteId>("synthwave")
  const [musicMuted, setMusicMuted] = useState(false)
  const [floatNotifs, setFloatNotifs] = useState<FloatNotif[]>([])
  const notifId = useRef(0)

  const palette = PALETTES[activePalette]

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const inputRef     = useRef<InputState>({ left: false, right: false, throttle: false, brake: false, handbrake: false })
  const carRef       = useRef<CarState>(createCar(HIGHWAY_START_X, HIGHWAY_START_Y, HIGHWAY_START_ANGLE))
  const camRef       = useRef<Camera>({ x: HIGHWAY_START_X, y: HIGHWAY_START_Y, heading: HIGHWAY_START_ANGLE, bank: 0 })
  const highwayRef   = useRef<Highway | null>(null)
  const trafficRef   = useRef<TrafficCar[]>([])
  const particlesRef = useRef<Particle[]>([])
  const musicRef     = useRef<SynthwaveMusic | null>(null)
  const audioRef     = useRef<AudioEngine | null>(null)
  const tRef         = useRef(0)
  const distRef      = useRef(0)
  const countdownRef = useRef(3.2)
  const prevComboRef = useRef(1)
  const prevScoreRef = useRef(0)
  const trafficIdRef = useRef(0)
  const trafficSpawnTimer = useRef(4)
  const musicMutedRef     = useRef(false)
  const cameraShakeRef    = useRef(0)   // 0–1, decays each frame

  // Keep muted ref in sync
  useEffect(() => { musicMutedRef.current = musicMuted }, [musicMuted])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "playing") setPhase("paused")
        else if (phase === "paused") setPhase("playing")
      }
      const map: Record<string, keyof InputState> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "throttle",
        ArrowDown: "brake", " ": "handbrake", a: "left", d: "right", w: "throttle", s: "brake",
      }
      const k = map[e.key]
      if (k) { e.preventDefault(); inputRef.current[k] = true }
    }
    const up = (e: KeyboardEvent) => {
      const map: Record<string, keyof InputState> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "throttle",
        ArrowDown: "brake", " ": "handbrake", a: "left", d: "right", w: "throttle", s: "brake",
      }
      const k = map[e.key]
      if (k) inputRef.current[k] = false
    }
    window.addEventListener("keydown", dn)
    window.addEventListener("keyup", up)
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up) }
  }, [phase])

  const handleTouchInput = useCallback((k: keyof InputState, v: boolean) => {
    inputRef.current[k] = v
  }, [])

  // ── Start / reset ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    carRef.current      = createCar(HIGHWAY_START_X, HIGHWAY_START_Y, HIGHWAY_START_ANGLE)
    camRef.current      = { x: HIGHWAY_START_X, y: HIGHWAY_START_Y, heading: HIGHWAY_START_ANGLE, bank: 0 }
    cameraShakeRef.current = 0
    highwayRef.current  = new Highway(HIGHWAY_START_X, HIGHWAY_START_Y, HIGHWAY_START_ANGLE)
    trafficRef.current  = []
    particlesRef.current = []
    distRef.current     = 0
    countdownRef.current = 3.2
    prevComboRef.current = 1
    prevScoreRef.current = 0
    trafficSpawnTimer.current = 4
    inputRef.current    = { left: false, right: false, throttle: false, brake: false, handbrake: false }
    setFloatNotifs([])
    setPhase("countdown")
  }, [])

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const handleMuteToggle = useCallback(() => {
    setMusicMuted(prev => {
      const next = !prev
      if (next) musicRef.current?.pause()
      else musicRef.current?.resume()
      return next
    })
  }, [])

  // ── Music lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "playing" || phase === "countdown") {
      if (!musicRef.current) {
        try { musicRef.current = new SynthwaveMusic() } catch { /* no audio */ }
      }
      if (!musicMutedRef.current) musicRef.current?.resume()
      musicRef.current?.start()

      if (!audioRef.current) {
        try { audioRef.current = new AudioEngine() } catch { /* no audio */ }
      }
      audioRef.current?.resume()
    } else {
      musicRef.current?.pause()
      audioRef.current?.suspend()
    }
  }, [phase])

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" && phase !== "countdown") return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = 0, H = 0
    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    let last = performance.now(), rafId = 0

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      // Countdown phase
      if (phase === "countdown") {
        countdownRef.current -= dt
        if (countdownRef.current <= 0) { setPhase("playing"); return }
      }

      const playing = phase === "playing" || countdownRef.current <= 0
      const hw      = highwayRef.current
      if (!hw) { rafId = requestAnimationFrame(loop); return }

      // ── Physics + highway ─────────────────────────────────────────────────
      if (playing) {
        hw.update(carRef.current.x, carRef.current.y, carRef.current.heading)
        const onRoad = hw.isOnRoad(carRef.current.x, carRef.current.y)
        let newCar   = stepCar(carRef.current, inputRef.current, dt, onRoad)

        // Wall constraint — bounce using the road segment's perpendicular normal
        const { x: cx, y: cy, hit } = hw.constrainToRoad(newCar.x, newCar.y)
        if (hit) {
          const r = hw.nearestSegment(cx, cy)
          if (r) {
            // Perpendicular to road direction (one of the two wall normals)
            const perpX = -Math.sin(r.seg.angle)
            const perpY =  Math.cos(r.seg.angle)
            // Which side of the centreline? sign gives the outward-pointing normal.
            const side  = ((cx - r.seg.x) * perpX + (cy - r.seg.y) * perpY) >= 0 ? 1 : -1
            const bnx   = perpX * side, bny = perpY * side
            const vDotN = newCar.vx * bnx + newCar.vy * bny
            if (vDotN < 0) {
              // Moving into wall → reflect + energy loss
              newCar = { ...newCar, x: cx, y: cy,
                vx: newCar.vx - 1.45 * vDotN * bnx,
                vy: newCar.vy - 1.45 * vDotN * bny,
              }
              // Cap speed (wall absorbs energy)
              const postSpd = Math.hypot(newCar.vx, newCar.vy)
              const cappedSpd = Math.min(postSpd, newCar.speed * 0.62)
              if (postSpd > 0) newCar = { ...newCar,
                vx: newCar.vx * cappedSpd / postSpd,
                vy: newCar.vy * cappedSpd / postSpd,
              }
              cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.18)
            } else {
              newCar = { ...newCar, x: cx, y: cy }
            }
          } else {
            newCar = { ...newCar, x: cx, y: cy }
          }
        }

        // Drift notif
        if (newCar.combo > prevComboRef.current && newCar.score > prevScoreRef.current) {
          const pts = newCar.score - prevScoreRef.current
          const id  = ++notifId.current
          setFloatNotifs(prev => [...prev.slice(-4), { id, text: "DRIFT!", pts, x: W / 2, y: H / 2 - 70 }])
          setTimeout(() => setFloatNotifs(p => p.filter(n => n.id !== id)), 2000)
        }
        prevComboRef.current = newCar.combo
        prevScoreRef.current = newCar.score
        carRef.current = newCar

        // Distance
        distRef.current += newCar.speed * dt

        // Particles
        if (newCar.drifting && newCar.speed > 80) {
          spawnDriftParticles(newCar, palette, particlesRef.current, newCar.speed > 250 ? 3 : 2)
        }
        updateParticles(particlesRef.current, dt)

        // ── Traffic ───────────────────────────────────────────────────────
        trafficSpawnTimer.current -= dt
        if (trafficSpawnTimer.current <= 0 && trafficRef.current.length < 6) {
          const segs  = hw.segments
          const car   = carRef.current
          const ahead = segs.filter(s => {
            const fwd = (s.x - car.x) * Math.cos(car.heading) + (s.y - car.y) * Math.sin(car.heading)
            return fwd > 1600 && fwd < 2400
          })
          if (ahead.length > 0) {
            const seg = ahead[Math.floor(Math.random() * ahead.length)]
            const perpX = -Math.sin(seg.angle), perpY = Math.cos(seg.angle)
            const lat   = (Math.random() - 0.5) * (ROAD_HALF_W * 1.3)
            trafficRef.current.push({
              id:      ++trafficIdRef.current,
              x:       seg.x + perpX * lat,
              y:       seg.y + perpY * lat,
              heading: seg.angle,
              speed:   190 + Math.random() * 110,
              passed:  false,
            })
          }
          trafficSpawnTimer.current = 3.5 + Math.random() * 3.5
        }

        // Update traffic — OBB collision + near-miss
        // Player half-extents: 31 fwd, 13 lat  |  Traffic half-extents: 18 fwd, 9 lat
        const COLL_FWD = 49, COLL_LAT = 22   // combined (sum of both half-extents)
        const NEAR_FWD = 80, NEAR_LAT = 50   // near-miss zone (wider)

        trafficRef.current = trafficRef.current.filter(tc => {
          const dx = tc.x - carRef.current.x
          const dy = tc.y - carRef.current.y
          const fwd = dx * Math.cos(carRef.current.heading) + dy * Math.sin(carRef.current.heading)
          if (fwd < -900) return false

          // Project offset into player car's local axes (OBB check)
          const cosH   = Math.cos(carRef.current.heading)
          const sinH   = Math.sin(carRef.current.heading)
          const localX = dx * cosH + dy * sinH    // forward component (+= ahead)
          const localY = -dx * sinH + dy * cosH   // lateral component

          // ── Collision ──────────────────────────────────────────────────────
          if (Math.abs(localX) < COLL_FWD && Math.abs(localY) < COLL_LAT) {
            const dist  = Math.hypot(dx, dy) || 1
            // Repulsion direction: from tc centre toward player
            const awayX = -dx / dist, awayY = -dy / dist
            const curSpd = carRef.current.speed

            // Arcade impulse: slow player hard, kick sideways slightly
            carRef.current = {
              ...carRef.current,
              vx: carRef.current.vx * 0.35 + awayX * curSpd * 0.30,
              vy: carRef.current.vy * 0.35 + awayY * curSpd * 0.30,
              combo: 1, comboTimer: 0,
            }

            // Camera shake
            cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.42)

            // Impact sparks at collision point
            const impX = (carRef.current.x + tc.x) / 2
            const impY = (carRef.current.y + tc.y) / 2
            for (let si = 0; si < 22; si++) {
              if (particlesRef.current.length < MAX_PARTICLES) {
                const spd = 200 + Math.random() * 300
                const ang = Math.random() * Math.PI * 2
                particlesRef.current.push({
                  x: impX + (Math.random() - 0.5) * 22,
                  y: impY + (Math.random() - 0.5) * 22,
                  vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                  life: 1, maxLife: 0.18 + Math.random() * 0.28,
                  size: 1.5 + Math.random() * 3.5, color: palette.accent, isSpark: true,
                })
              }
            }

            // Notification
            const cid = ++notifId.current
            setFloatNotifs(p => [...p.slice(-4), { id: cid, text: "CRASH!", pts: 0, x: W / 2, y: H / 2 - 80 }])
            setTimeout(() => setFloatNotifs(pp => pp.filter(n => n.id !== cid)), 1100)
            return false  // traffic car removed on impact
          }

          // ── Near-miss bonus ────────────────────────────────────────────────
          if (!tc.passed && Math.abs(localX) < NEAR_FWD && Math.abs(localY) < NEAR_LAT) {
            tc.passed = true
            const nmId = ++notifId.current
            carRef.current = { ...carRef.current, score: carRef.current.score + 500 }
            setFloatNotifs(p => [...p.slice(-4), { id: nmId, text: "NEAR MISS!", pts: 500, x: W / 2, y: H / 2 - 120 }])
            setTimeout(() => setFloatNotifs(pp => pp.filter(n => n.id !== nmId)), 1800)
          }
          if (fwd < -20) tc.passed = true

          // Move traffic along road
          const roadAngle = hw.roadAngleAt(tc.x, tc.y)
          tc.x += Math.cos(roadAngle) * tc.speed * dt
          tc.y += Math.sin(roadAngle) * tc.speed * dt
          tc.heading = roadAngle
          return true
        })

        // ── Music intensity ───────────────────────────────────────────────
        const speedN  = Math.min(newCar.speed / 460, 1)
        const driftN  = Math.min(Math.abs(newCar.driftAngle) / 0.8, 1)
        const intensity = Math.max(speedN * 0.4, driftN * 0.85)
        musicRef.current?.setIntensity(intensity)
        audioRef.current?.update(newCar.speed, Math.abs(newCar.driftAngle), inputRef.current.throttle)
      }

      // ── Third-person camera ───────────────────────────────────────────────
      const car = carRef.current
      const cam = camRef.current

      // Camera trails ~110 px behind car in world space
      const CAM_BEHIND = 110
      const targetCamX = car.x - Math.cos(car.heading) * CAM_BEHIND
      const targetCamY = car.y - Math.sin(car.heading) * CAM_BEHIND

      const posLag  = 1 - Math.exp(-7 * dt)   // snappy position follow
      const headLag = 1 - Math.exp(-2.8 * dt) // slightly floaty heading

      cam.x += (targetCamX - cam.x) * posLag
      cam.y += (targetCamY - cam.y) * posLag
      cam.heading += normalizeAngle(car.heading - cam.heading) * headLag

      // Cinematic banking during drift (gentle tilt into the corner)
      const targetBank = car.drifting ? normalizeAngle(car.driftAngle) * -0.09 : 0
      cam.bank += (targetBank - cam.bank) * (1 - Math.exp(-5 * dt))

      // Camera shake decays exponentially
      cameraShakeRef.current *= Math.exp(-9 * dt)

      tRef.current += dt

      // ── Render ────────────────────────────────────────────────────────────

      // 1. Clear
      ctx.fillStyle = palette.bg
      ctx.fillRect(0, 0, W, H)

      // 2. Screen-space sky + horizon (road stretches toward top of screen)
      drawHorizonAtmosphere(ctx, W, H, palette, car.speed)

      // 3. Third-person camera transform
      //    Anchor at H*0.70 → car appears ~55-60% down, road fills top 55%
      const shake = cameraShakeRef.current
      const shakeX = shake > 0.01 ? (Math.random() - 0.5) * shake * W * 0.022 : 0
      const shakeY = shake > 0.01 ? (Math.random() - 0.5) * shake * H * 0.014 : 0
      ctx.save()
      ctx.translate(W / 2 + shakeX, H * 0.70 + shakeY)
      ctx.rotate(-(cam.heading + Math.PI / 2) + cam.bank)
      ctx.translate(-cam.x, -cam.y)

      // 4. World background + grid
      drawWorldBackground(ctx, cam.x, cam.y, W, H, palette)

      // 5. Env objects (buildings behind road)
      if (highwayRef.current) drawEnvObjects(ctx, highwayRef.current, palette)

      // 6. Road
      if (highwayRef.current) drawHighwayRoad(ctx, highwayRef.current.segments, palette, tRef.current)

      // 7. Particles
      drawParticles(ctx, particlesRef.current)

      // 8. Traffic
      for (const tc of trafficRef.current) drawTrafficCar(ctx, tc, palette)

      // 9. Player car
      if (playing) drawCar(ctx, car, palette)

      ctx.restore()

      // 10. Screen-space FX
      drawSpeedLines(ctx, W, H, car.speed, palette, tRef.current)
      drawVignette(ctx, W, H, car.speed)

      // 11. HUD
      drawHUD(ctx, W, H, car, palette, distRef.current,
        phase === "countdown" ? Math.max(0, countdownRef.current) : 0)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener("resize", resize) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, palette])

  // Cleanup
  useEffect(() => () => {
    musicRef.current?.dispose(); musicRef.current = null
    audioRef.current?.dispose(); audioRef.current = null
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden select-none" style={{ background: palette.bg }}>
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none z-[5] opacity-[0.022]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.6) 2px,rgba(255,255,255,0.6) 3px)" }} />

      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />

      {/* Float notifs */}
      <AnimatePresence>
        {floatNotifs.map(n => (
          <motion.div key={n.id}
            className="absolute pointer-events-none z-30 text-center"
            style={{ left: "50%", top: "35%", transform: "translateX(-50%)" }}
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: 1, y: -45, scale: 1 }}
            exit={{ opacity: 0, y: -90, scale: 0.8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}>
            <div className="text-3xl font-extrabold leading-none"
              style={{
                background: `linear-gradient(135deg,${palette.secondary},${palette.accent})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                filter: `drop-shadow(0 0 14px ${palette.glow})`,
              }}>{n.text}</div>
            <div className="text-sm font-bold text-white/80 mt-1">
              +{n.pts.toLocaleString()}
              {n.text === "DRIFT!" && <span style={{ color: palette.secondary }}> ×{carRef.current.combo}</span>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Mobile touch controls */}
      {(phase === "playing" || phase === "countdown") && (
        <div className="absolute inset-0 z-20 sm:hidden">
          <TouchControls onInput={handleTouchInput} />
        </div>
      )}

      {/* Phase overlays */}
      <AnimatePresence>
        {phase === "menu" && (
          <MenuOverlay key="menu" palette={palette} activePalette={activePalette}
            onStart={startGame} onPalette={setPalette}
            musicMuted={musicMuted} onMuteToggle={handleMuteToggle} />
        )}
        {phase === "paused" && (
          <PauseOverlay key="pause" palette={palette}
            onResume={() => setPhase("playing")} onQuit={() => setPhase("gameover")}
            musicMuted={musicMuted} onMuteToggle={handleMuteToggle} />
        )}
        {phase === "gameover" && (
          <SessionEndOverlay key="gameover" palette={palette}
            car={carRef.current} distance={distRef.current}
            onRestart={startGame} onQuit={() => setPhase("menu")} />
        )}
      </AnimatePresence>

      {/* Pause button */}
      {phase === "playing" && (
        <button onClick={() => setPhase("paused")}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer"
          style={{ background: "rgba(0,0,0,0.45)", border: `1px solid ${palette.primary}22`, color: "rgba(255,255,255,0.42)", backdropFilter: "blur(12px)" }}>
          ❙❙ Pause
        </button>
      )}
    </div>
  )
}
