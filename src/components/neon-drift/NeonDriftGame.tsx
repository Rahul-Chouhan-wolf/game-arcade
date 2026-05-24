"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { PALETTES, NeonPalette, PaletteId } from "./types"
import { CarState, InputState, createCar, stepCar, normalizeAngle } from "@/lib/neon-drift/physics"
import {
  Highway, RoadSegment, EnvObject,
  ROAD_HALF_W, SEGMENT_LEN,
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

// Camera only tracks smoothed heading + cinematic bank (position is derived from car)
interface Camera { heading: number; bank: number }

interface FloatNotif {
  id: number; text: string; pts: number; x: number; y: number
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

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
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r)
}

function rng(x: number, y: number, seed = 137): number {
  return ((Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453) % 1 + 1) % 1
}

// ─── Perspective constants ────────────────────────────────────────────────────

const HORIZON_F  = 0.36   // horizon as Y fraction of screen height
const FOCAL_LEN  = 360    // perspective focal length (world units)
const CAM_HEIGHT = 115    // camera height above road (world units)
const CAM_BEHIND = 80     // camera offset behind car (world units)
const MAX_DEPTH  = 3200   // clip beyond this world-unit depth

// ─── Core projection ─────────────────────────────────────────────────────────

// Projects a world-space point to screen space given camera position + heading.
// Returns null if the point is behind the camera.
function worldToProj(
  wx: number, wy: number,
  camX: number, camY: number, camH: number,
  W: number, H: number,
): { sx: number; sy: number; scale: number; fwd: number } | null {
  const dx  = wx - camX
  const dy  = wy - camY
  const fwd = dx * Math.cos(camH) + dy * Math.sin(camH)   // depth along camera axis
  const lat = -dx * Math.sin(camH) + dy * Math.cos(camH)  // lateral offset
  if (fwd < 1) return null
  const scale    = FOCAL_LEN / fwd
  const horizonY = HORIZON_F * H
  return {
    sx:    W / 2 + lat * scale,
    sy:    horizonY + CAM_HEIGHT * scale,
    scale, fwd,
  }
}

// ─── Sky + ground ─────────────────────────────────────────────────────────────

function drawSky(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  palette: NeonPalette,
  speed: number,
  t: number,
) {
  const horizonY = HORIZON_F * H
  const speedN   = Math.min(speed / 320, 1)

  // ── Sky gradient ───────────────────────────────────────────────────────────
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY)
  sky.addColorStop(0,   palette.bgMid)
  sky.addColorStop(0.5, hex2rgba(palette.primary, 0.03 + speedN * 0.05))
  sky.addColorStop(1,   hex2rgba(palette.primary, 0.07 + speedN * 0.08))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, horizonY)

  // ── Static stars ───────────────────────────────────────────────────────────
  for (let i = 0; i < 48; i++) {
    const sx = ((i * 173 + 47) % 97) / 97 * W
    const sy = ((i * 251 + 13) % 61) / 61 * horizonY * 0.80
    const sr = 0.35 + ((i * 97) % 5) * 0.18
    const twinkle = 0.4 + 0.35 * Math.sin(t * 1.8 + i * 0.7)
    ctx.fillStyle = `rgba(255,255,255,${twinkle})`
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
  }

  // ── City skyline silhouette ────────────────────────────────────────────────
  ctx.fillStyle = hex2rgba(palette.bgMid, 0.92)
  for (let i = 0; i < 18; i++) {
    const bx  = (i / 18) * W + ((i * 37) % 22) - 10
    const bh  = 8 + ((i * 71) % 32)
    const bw  = 6 + ((i * 29) % 18)
    ctx.fillRect(bx, horizonY - bh, bw, bh)
    // Antenna light
    if ((i * 53) % 3 === 0) {
      const flash = Math.sin(t * 1.2 + i) > 0.6
      ctx.fillStyle = flash ? hex2rgba(palette.accent, 0.7) : hex2rgba(palette.accent, 0.15)
      ctx.beginPath(); ctx.arc(bx + bw / 2, horizonY - bh - 2, 1.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = hex2rgba(palette.bgMid, 0.92)
    }
  }

  // ── Horizon glow band ──────────────────────────────────────────────────────
  const hg = ctx.createLinearGradient(0, horizonY - 28, 0, horizonY + 22)
  hg.addColorStop(0,   "transparent")
  hg.addColorStop(0.5, hex2rgba(palette.glow, 0.11 + speedN * 0.20))
  hg.addColorStop(1,   "transparent")
  ctx.fillStyle = hg
  ctx.fillRect(0, horizonY - 28, W, 50)

  // ── Ground fill (below horizon) ────────────────────────────────────────────
  const ground = ctx.createLinearGradient(0, horizonY, 0, H)
  ground.addColorStop(0, "#06060f")
  ground.addColorStop(1, "#020207")
  ctx.fillStyle = ground
  ctx.fillRect(0, horizonY, W, H - horizonY)
}

// ─── Perspective road ─────────────────────────────────────────────────────────

function drawPerspectiveRoad(
  ctx: CanvasRenderingContext2D,
  highway: Highway,
  palette: NeonPalette,
  camX: number, camY: number, camH: number,
  W: number, H: number,
  t: number,
  carSpeed: number,
) {
  const horizonY = HORIZON_F * H

  // ── Project every segment ─────────────────────────────────────────────────
  type ProjSeg = {
    sx: number; sy: number; lx: number; rx: number
    scale: number; fwd: number; type: RoadSegment["type"]
    segIdx: number
  }
  const segs: ProjSeg[] = []
  let segIdx = 0
  for (const seg of highway.segments) {
    const p = worldToProj(seg.x, seg.y, camX, camY, camH, W, H)
    segIdx++
    if (!p || p.fwd > MAX_DEPTH) continue
    const roadW = ROAD_HALF_W * p.scale
    if (p.sy < horizonY - 2) continue  // above horizon, skip
    segs.push({
      sx: p.sx, sy: p.sy,
      lx: p.sx - roadW, rx: p.sx + roadW,
      scale: p.scale, fwd: p.fwd,
      type: seg.type, segIdx,
    })
  }

  // Sort far → near (painter's algorithm)
  segs.sort((a, b) => b.fwd - a.fwd)

  if (segs.length < 2) return

  // Pre-compute how far the nearest segment is from the screen bottom, and
  // extrapolate road edges so the road always fills to H (no dark gap).
  const extNear    = segs[segs.length - 1]
  const extPrev    = segs[segs.length - 2]
  const extNearSY  = Math.max(extNear.sy, horizonY)
  const extPrevSY  = Math.max(extPrev.sy, horizonY)
  const extDY      = extNearSY - extPrevSY
  const needsExt   = extNearSY < H && extDY > 0.5
  const extT       = needsExt ? (H + 4 - extNearSY) / extDY : 0
  const extLx      = extNear.lx + (extNear.lx - extPrev.lx) * extT
  const extRx      = extNear.rx + (extNear.rx - extPrev.rx) * extT

  // ── Road surface (trapezoids) ──────────────────────────────────────────────
  for (let i = 0; i < segs.length - 1; i++) {
    const far  = segs[i]
    const near = segs[i + 1]
    const isDrift   = far.type === "drift-zone" || far.type === "sweeper"
    const isCurve   = far.type === "curve-left" || far.type === "curve-right"

    // Clip sy to horizon
    const farSY  = Math.max(far.sy,  horizonY)
    const nearSY = Math.max(near.sy, horizonY)

    ctx.beginPath()
    ctx.moveTo(far.lx,  farSY)
    ctx.lineTo(far.rx,  farSY)
    ctx.lineTo(near.rx, nearSY)
    ctx.lineTo(near.lx, nearSY)
    ctx.closePath()

    if (isDrift) {
      ctx.fillStyle = "#1a0e2e"   // purple tint — drift zones pop
    } else if (isCurve) {
      ctx.fillStyle = "#181828"   // slightly brighter for curves
    } else {
      ctx.fillStyle = "#1c1c30"   // clearly visible vs ground "#06060f"
    }
    ctx.fill()

    // Drift zone tint overlay
    if (isDrift) {
      ctx.fillStyle = hex2rgba(palette.glow, 0.032)
      ctx.fill()
    }

    // Rumble strips at road edges (alternating blocks)
    const stripOn = (Math.floor(far.fwd / (SEGMENT_LEN * 2.5)) % 2 === 0)
    if (stripOn && near.fwd < 600) {
      const sw = Math.max(4 * near.scale, 1)
      ctx.fillStyle = hex2rgba(palette.secondary, 0.35)
      ctx.fillRect(near.lx, nearSY, sw, Math.abs(nearSY - farSY) + 1)
      ctx.fillRect(near.rx - sw, nearSY, sw, Math.abs(nearSY - farSY) + 1)
    }
  }

  // Fill the gap between the nearest projected segment and the bottom of screen
  if (needsExt) {
    const roadColor = extNear.type === "drift-zone" || extNear.type === "sweeper"
      ? "#1a0e2e"
      : extNear.type === "curve-left" || extNear.type === "curve-right"
      ? "#181828" : "#1c1c30"
    ctx.beginPath()
    ctx.moveTo(extNear.lx, extNearSY)
    ctx.lineTo(extNear.rx, extNearSY)
    ctx.lineTo(extRx, H + 4)
    ctx.lineTo(extLx, H + 4)
    ctx.closePath()
    ctx.fillStyle = roadColor
    ctx.fill()
  }

  // ── Centre lane dashes (speed-animated) ───────────────────────────────────
  const dashPhase = (t * carSpeed * 0.004) % 1
  for (let i = 0; i < segs.length - 1; i++) {
    const far  = segs[i]
    const near = segs[i + 1]
    // Alternate dash pattern, shift with time for speed sensation
    if (((i + Math.floor(dashPhase * 8)) % 3) !== 0) continue
    const farSY  = Math.max(far.sy,  horizonY)
    const nearSY = Math.max(near.sy, horizonY)
    ctx.beginPath()
    ctx.moveTo(far.sx,  farSY)
    ctx.lineTo(near.sx, nearSY)
    ctx.strokeStyle = hex2rgba(palette.grid, 0.55)
    ctx.lineWidth   = Math.max(near.scale * 5, 0.8)
    ctx.stroke()
  }

  // ── Left neon edge ─────────────────────────────────────────────────────────
  ctx.beginPath()
  let first = true
  for (const s of segs) {
    const sy = Math.max(s.sy, horizonY)
    if (first) { ctx.moveTo(s.lx, sy); first = false }
    else ctx.lineTo(s.lx, sy)
  }
  if (needsExt) ctx.lineTo(extLx, H + 4)
  ctx.strokeStyle  = palette.primary
  ctx.lineWidth    = 2.5
  ctx.shadowColor  = palette.glow
  ctx.shadowBlur   = 20
  ctx.lineJoin     = "round"
  ctx.stroke()
  ctx.shadowBlur   = 0

  // ── Right neon edge ────────────────────────────────────────────────────────
  ctx.beginPath()
  first = true
  for (const s of segs) {
    const sy = Math.max(s.sy, horizonY)
    if (first) { ctx.moveTo(s.rx, sy); first = false }
    else ctx.lineTo(s.rx, sy)
  }
  if (needsExt) ctx.lineTo(extRx, H + 4)
  ctx.strokeStyle = palette.secondary
  ctx.lineWidth   = 2.5
  ctx.shadowColor = palette.glow
  ctx.shadowBlur  = 20
  ctx.stroke()
  ctx.shadowBlur  = 0
}

// ─── Perspective environment objects ─────────────────────────────────────────

function drawPerspectiveEnvObjects(
  ctx: CanvasRenderingContext2D,
  highway: Highway,
  palette: NeonPalette,
  camX: number, camY: number, camH: number,
  W: number, H: number,
) {
  const horizonY  = HORIZON_F * H
  const segMap   = new Map<number, RoadSegment>()
  for (const s of highway.segments) segMap.set(s.id, s)

  type ProjObj = {
    ox: number; oy: number; scale: number; fwd: number
    obj: EnvObject; seg: RoadSegment
  }
  const objs: ProjObj[] = []

  for (const obj of highway.envObjects) {
    const seg = segMap.get(obj.segId)
    if (!seg) continue

    const perpX = -Math.sin(seg.angle) * obj.side
    const perpY =  Math.cos(seg.angle) * obj.side
    const dist  = obj.kind === "pole"      ? ROAD_HALF_W + 30
                : obj.kind === "billboard" ? ROAD_HALF_W + 55
                : ROAD_HALF_W + 155 + rng(seg.x, seg.y) * 90

    const wx = seg.x + perpX * dist
    const wy = seg.y + perpY * dist
    const p  = worldToProj(wx, wy, camX, camY, camH, W, H)
    if (!p || p.fwd > MAX_DEPTH) continue
    if (p.sy < horizonY - 8) continue

    objs.push({ ox: p.sx, oy: p.sy, scale: p.scale, fwd: p.fwd, obj, seg })
  }

  // Far → near
  objs.sort((a, b) => b.fwd - a.fwd)

  for (const { ox, oy, scale, obj, seg } of objs) {
    if (scale < 0.005) continue  // invisible at this distance
    switch (obj.kind) {
      case "pole":      drawProjPole(ctx, ox, oy, scale, palette); break
      case "billboard": drawProjBillboard(ctx, ox, oy, scale, palette, horizonY, (obj as EnvObject & { label?: string }).label); break
      case "building":  drawProjBuilding(ctx, ox, oy, scale, palette, seg.x, seg.y); break
    }
  }
}

function drawProjPole(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number, scale: number,
  palette: NeonPalette,
) {
  const h = Math.min(70 * scale, 500)
  const w = Math.max(2.5 * scale, 0.8)
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(ox, oy - h)
  ctx.strokeStyle = hex2rgba(palette.glow, 0.65)
  ctx.lineWidth   = w
  ctx.stroke()
  const gr = Math.max(5 * scale, 1.2)
  ctx.beginPath()
  ctx.arc(ox, oy - h, gr, 0, Math.PI * 2)
  ctx.fillStyle  = palette.glow
  ctx.shadowColor = palette.glow
  ctx.shadowBlur = 14
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawProjBillboard(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number, scale: number,
  palette: NeonPalette, horizonY: number, label?: string,
) {
  const poleH = Math.min(90 * scale, 500)
  const bw    = Math.max(80 * scale, 3)
  const bh    = Math.max(28 * scale, 2)
  const pw    = Math.max(2.5 * scale, 0.5)
  // Clamp pole top to horizon so it never draws into sky
  const poleTop = Math.max(oy - poleH, horizonY)
  // Pole
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(ox, poleTop)
  ctx.strokeStyle = hex2rgba(palette.grid, 0.45)
  ctx.lineWidth   = pw
  ctx.stroke()
  // Board — only draw if it fits below the horizon
  const by = oy - poleH - bh
  if (by < horizonY) return   // board would be in the sky — skip
  ctx.fillStyle   = "rgba(0,0,0,0.88)"
  ctx.beginPath(); ctx.roundRect(ox - bw / 2, by, bw, bh, Math.max(3 * scale, 1)); ctx.fill()
  ctx.strokeStyle = palette.primary
  ctx.lineWidth   = Math.max(1.5 * scale, 0.4)
  ctx.shadowColor = palette.glow
  ctx.shadowBlur  = 10
  ctx.stroke()
  ctx.shadowBlur  = 0
  if (label && scale > 0.025) {
    const fs = Math.max(Math.round(7 * scale), 4)
    ctx.font         = `700 ${fs}px monospace`
    ctx.fillStyle    = palette.secondary
    ctx.textAlign    = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(label.slice(0, 16), ox, by + bh / 2)
  }
}

function drawProjBuilding(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number, scale: number,
  palette: NeonPalette, seedX: number, seedY: number,
) {
  const seed = rng(seedX, seedY) * 100
  const bw   = Math.max((58 + (seed % 5) * 22) * scale, 2)
  const bh   = Math.max((90 + (seed % 7) * 35) * scale, 3)

  ctx.fillStyle = "rgba(6,6,18,0.95)"
  ctx.beginPath(); ctx.roundRect(ox - bw / 2, oy - bh, bw, bh, Math.max(2 * scale, 1)); ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.grid, 0.28)
  ctx.lineWidth   = Math.max(scale * 0.8, 0.3)
  ctx.stroke()

  if (scale > 0.045) {
    const rows = Math.min(Math.floor(bh / (13 * scale)), 7)
    const cols = Math.min(Math.floor(bw / (11 * scale)), 6)
    const ch   = bh / (rows + 1), cw = bw / (cols + 1)
    for (let ri = 0; ri < rows; ri++) {
      for (let ci = 0; ci < cols; ci++) {
        if (rng(seedX + ci, seedY + ri) < 0.45) {
          const ww = Math.max(4 * scale, 0.8), wh = Math.max(3 * scale, 0.6)
          ctx.fillStyle = rng(seedX + ci * 2, seedY + ri * 3) > 0.5
            ? hex2rgba(palette.accent, 0.52) : hex2rgba(palette.secondary, 0.38)
          ctx.fillRect(ox - bw / 2 + (ci + 1) * cw - ww / 2, oy - bh + (ri + 1) * ch - wh / 2, ww, wh)
        }
      }
    }
  }
}

// ─── Perspective traffic car ──────────────────────────────────────────────────

function drawPerspectiveTrafficCar(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number, scale: number,
  palette: NeonPalette,
) {
  if (scale < 0.006 || scale > 12) return
  const CW = 52 * scale, CH = 22 * scale, CA = 18 * scale

  ctx.save()
  ctx.translate(ox, oy)

  // Shadow / reflection on road
  const sg = ctx.createRadialGradient(0, 3, 0, 0, 3, CW * 0.65)
  sg.addColorStop(0, hex2rgba(palette.primary, 0.18 * Math.min(scale, 1)))
  sg.addColorStop(1, "transparent")
  ctx.fillStyle = sg
  ctx.fillRect(-CW * 0.65, 3, CW * 1.3, CH * 0.5)

  // Cabin
  ctx.fillStyle   = hex2rgba(palette.accent, 0.14)
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth   = Math.max(scale * 0.5, 0.3)
  ctx.beginPath(); ctx.roundRect(-CW * 0.32, -CH - CA, CW * 0.64, CA, Math.max(2 * scale, 1)); ctx.fill(); ctx.stroke()

  // Body
  ctx.fillStyle   = "#151524"
  ctx.strokeStyle = "rgba(255,255,255,0.14)"
  ctx.lineWidth   = Math.max(scale * 0.8, 0.3)
  ctx.beginPath(); ctx.roundRect(-CW / 2, -CH, CW, CH, Math.max(3 * scale, 1)); ctx.fill(); ctx.stroke()

  // Taillights
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * (CW / 2 - 4 * scale), -CH * 0.55, 4 * scale, 3 * scale, 0, 0, Math.PI * 2)
    ctx.fillStyle   = "#ef4444"
    ctx.shadowColor = "#ef4444"
    ctx.shadowBlur  = 8 * Math.min(scale, 1.5)
    ctx.fill()
    ctx.shadowBlur  = 0
  }

  // Neon roof strip
  if (scale > 0.04) {
    ctx.beginPath()
    ctx.moveTo(-CW * 0.28, -CH - CA + 1)
    ctx.lineTo( CW * 0.28, -CH - CA + 1)
    ctx.strokeStyle = hex2rgba(palette.accent, 0.55)
    ctx.lineWidth   = Math.max(1.2 * scale, 0.4)
    ctx.shadowColor = palette.accent
    ctx.shadowBlur  = 6 * Math.min(scale, 1)
    ctx.stroke()
    ctx.shadowBlur  = 0
  }

  ctx.restore()
}

// ─── Player car (fixed screen-space) ─────────────────────────────────────────

function drawPlayerCar(
  ctx: CanvasRenderingContext2D,
  car: CarState,
  W: number, H: number,
  palette: NeonPalette,
  bank = 0,
) {
  // Car sways slightly with drift angle
  const drift  = normalizeAngle(car.driftAngle)
  const carX   = W / 2 - drift * 42
  const carY   = H * 0.815
  const tilt   = drift * 0.10 + bank  // visual lean + camera bank
  const CW     = 72                 // half-width reference (full = 144)
  const CH     = 30                 // body height

  ctx.save()
  ctx.translate(carX, carY)
  ctx.rotate(tilt)

  // ── Neon ground-glow (below car) ──────────────────────────────────────────
  const ug = ctx.createRadialGradient(0, 8, 0, 0, 8, CW * 0.9)
  ug.addColorStop(0, hex2rgba(palette.glow, 0.55))
  ug.addColorStop(1, "transparent")
  ctx.fillStyle = ug
  ctx.fillRect(-CW * 0.9, 5, CW * 1.8, 22)

  // ── Rear spoiler / wing ────────────────────────────────────────────────────
  ctx.fillStyle   = "#111128"
  ctx.strokeStyle = hex2rgba(palette.secondary, 0.65)
  ctx.lineWidth   = 1.5
  roundRect(ctx, -CW / 2 - 5, -CH - 10, CW + 10, 8, 3)
  ctx.fill(); ctx.stroke()
  // Spoiler mounts
  for (const mx of [-CW * 0.3, CW * 0.3]) {
    ctx.fillStyle = "#1a1a30"
    ctx.fillRect(mx - 3, -CH - 8, 6, 10)
  }

  // ── Main body (trapezoid — wider at bottom for 3-D feel) ─────────────────
  ctx.beginPath()
  ctx.moveTo(-CW / 2 - 5, 0)          // bottom-left
  ctx.lineTo( CW / 2 + 5, 0)          // bottom-right
  ctx.lineTo( CW / 2 - 5, -CH)        // top-right
  ctx.lineTo(-CW / 2 + 5, -CH)        // top-left
  ctx.closePath()
  const bodyG = ctx.createLinearGradient(0, -CH, 0, 0)
  bodyG.addColorStop(0, "#1e1e3a")
  bodyG.addColorStop(1, "#0c0c1e")
  ctx.fillStyle   = bodyG
  ctx.shadowColor = palette.primary
  ctx.shadowBlur  = 18
  ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.primary, 0.78)
  ctx.lineWidth   = 1.8
  ctx.stroke()
  ctx.shadowBlur  = 0

  // ── Rear glass ────────────────────────────────────────────────────────────
  ctx.beginPath()
  ctx.moveTo(-CW / 2 + 12, -CH)
  ctx.lineTo( CW / 2 - 12, -CH)
  ctx.lineTo( CW / 2 - 18, -CH - 14)
  ctx.lineTo(-CW / 2 + 18, -CH - 14)
  ctx.closePath()
  ctx.fillStyle   = hex2rgba(palette.accent, 0.20)
  ctx.strokeStyle = hex2rgba(palette.accent, 0.45)
  ctx.lineWidth   = 1
  ctx.fill(); ctx.stroke()

  // ── Taillights ────────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const lx = side * (CW / 2 - 3)
    ctx.beginPath()
    ctx.ellipse(lx, -CH * 0.48, 11, 6.5, 0, 0, Math.PI * 2)
    ctx.fillStyle   = car.speed > 10 ? "#ef4444" : "#7f1d1d"
    ctx.shadowColor = "#ef4444"
    ctx.shadowBlur  = 18
    ctx.fill()
    ctx.shadowBlur  = 0
    // Taillight glow cone
    const tg = ctx.createRadialGradient(lx, -CH * 0.48, 0, lx, -CH * 0.48, 36)
    tg.addColorStop(0, hex2rgba("#ef4444", 0.28))
    tg.addColorStop(1, "transparent")
    ctx.fillStyle = tg
    ctx.fillRect(lx - 36, -CH - 16, 72, 26)
  }

  // ── Neon side strips ──────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const lx = side * (CW / 2 + 2)
    ctx.beginPath()
    ctx.moveTo(lx,                  0)
    ctx.lineTo(lx - side * 4, -CH)
    ctx.strokeStyle = palette.glow
    ctx.lineWidth   = 2.2
    ctx.shadowColor = palette.glow
    ctx.shadowBlur  = 12
    ctx.stroke()
    ctx.shadowBlur  = 0
  }

  // ── Wheels ────────────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const wx = side * (CW / 2 + 4)
    roundRect(ctx, side === -1 ? wx - 12 : wx, 2, 13, 9, 3)
    ctx.fillStyle   = "#080818"
    ctx.strokeStyle = hex2rgba(palette.grid, 0.6)
    ctx.lineWidth   = 1
    ctx.fill(); ctx.stroke()
  }

  // ── Drift wheel glow ──────────────────────────────────────────────────────
  if (car.drifting) {
    const da = Math.min(Math.abs(drift) / 0.7, 1)
    for (const side of [-1, 1]) {
      const wx  = side * (CW / 2 + 10)
      const dg  = ctx.createRadialGradient(wx, 6, 0, wx, 6, 22 + da * 20)
      dg.addColorStop(0, hex2rgba(palette.glow, 0.60 * da))
      dg.addColorStop(1, "transparent")
      ctx.fillStyle = dg
      ctx.beginPath(); ctx.arc(wx, 6, 38 + da * 22, 0, Math.PI * 2); ctx.fill()
    }
  }

  ctx.restore()
}

// ─── Particles ────────────────────────────────────────────────────────────────

const MAX_PARTICLES = 180

// Screen-space drift smoke/sparks spawned at car's screen position
function spawnDriftParticles(
  car: CarState, palette: NeonPalette, particles: Particle[],
  W: number, H: number, count = 2,
) {
  const drift = normalizeAngle(car.driftAngle)
  const carX  = W / 2 - drift * 42
  const carY  = H * 0.815

  for (let ci = 0; ci < count * 2; ci++) {
    if (particles.length >= MAX_PARTICLES) break
    const da     = Math.abs(drift)
    const isSpark = da > 0.42 && Math.random() < 0.28
    const side   = ci % 2 === 0 ? -1 : 1

    particles.push({
      x: carX + side * (34 + Math.random() * 16) + (Math.random() - 0.5) * 14,
      y: carY + 8 + Math.random() * 7,
      vx: side * (22 + Math.random() * 52) + (Math.random() - 0.5) * 28,
      vy: 38 + Math.random() * 70,    // falls downward (off screen)
      life: 1,
      maxLife: isSpark
        ? 0.16 + Math.random() * 0.14
        : 0.50 + Math.random() * 0.42,
      size:  isSpark ? 1.5 + Math.random() * 2.5 : 9 + Math.random() * 16,
      color: isSpark ? palette.accent : palette.glow,
      isSpark,
    })
  }
}

function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt; p.y += p.vy * dt
    p.vx *= 0.93; p.vy *= 0.93
    p.life -= dt / p.maxLife
    if (p.life <= 0) particles.splice(i, 1)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.globalAlpha = Math.pow(Math.max(p.life, 0), 0.5)
    if (p.isSpark) {
      ctx.fillStyle   = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur  = 6
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur  = 0
    } else {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
      g.addColorStop(0, hex2rgba(p.color, 0.52))
      g.addColorStop(1, "transparent")
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
}

// ─── Screen-space FX ─────────────────────────────────────────────────────────

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  speed: number, palette: NeonPalette, t: number,
) {
  const intensity = Math.max(0, (speed - 130) / 330)
  if (intensity < 0.01) return
  ctx.save()

  // Vanishing point = horizon centre
  const vpx = W / 2, vpy = HORIZON_F * H

  for (let i = 0; i < 24; i++) {
    const angle   = (i / 24) * Math.PI * 2
    const radius0 = H * 0.20 + ((i * 71 + Math.floor(t * 95 + i * 9)) % (H * 0.68))
    const radius1 = radius0 + 26 + intensity * 140
    const x0 = vpx + Math.cos(angle) * radius0
    const y0 = vpy + Math.sin(angle) * radius0
    const x1 = vpx + Math.cos(angle) * radius1
    const y1 = vpy + Math.sin(angle) * radius1
    const g  = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0,   "transparent")
    g.addColorStop(0.4, hex2rgba(palette.glow, 0.18 * intensity))
    g.addColorStop(1,   "transparent")
    ctx.strokeStyle = g
    ctx.lineWidth   = 0.8 + intensity * 0.7
    ctx.beginPath()
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  ctx.restore()
}

function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number, speed = 0) {
  const speedN = Math.min(speed / 480, 1)
  const inner  = H * (0.32 - speedN * 0.12)
  const outer  = H * (0.90 - speedN * 0.10)
  const alpha  = 0.48 + speedN * 0.24
  const g = ctx.createRadialGradient(W / 2, H * 0.56, inner, W / 2, H * 0.50, outer)
  g.addColorStop(0, "transparent")
  g.addColorStop(1, `rgba(0,0,0,${alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
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

  // ── Speed (bottom-left) ────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.48)"
  ctx.beginPath(); ctx.roundRect(14, H - 82, 108, 68, 12); ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.38); ctx.lineWidth = 1; ctx.stroke()

  ctx.font      = `900 38px 'SF Mono','Fira Mono',monospace`
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"
  ctx.shadowColor = palette.glow; ctx.shadowBlur = 14
  ctx.fillText(`${speedKmh}`, 68, H - 46); ctx.shadowBlur = 0
  ctx.font      = `700 9px system-ui`; ctx.fillStyle = hex2rgba(palette.primary, 0.7)
  ctx.fillText("KM/H", 68, H - 29)

  // ── Score + combo (top-right) ─────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.48)"
  ctx.beginPath(); ctx.roundRect(W - 155, 14, 141, 54, 12); ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.35); ctx.lineWidth = 1; ctx.stroke()

  ctx.font      = `700 9px system-ui`; ctx.fillStyle = hex2rgba(palette.primary, 0.55); ctx.textAlign = "right"
  ctx.fillText("SCORE", W - 18, 32)
  ctx.font      = `900 22px 'SF Mono','Fira Mono',monospace`; ctx.fillStyle = "#fff"
  ctx.shadowColor = palette.glow; ctx.shadowBlur = 10
  ctx.fillText(car.score.toLocaleString(), W - 18, 58); ctx.shadowBlur = 0
  if (car.combo > 1) {
    ctx.font      = `900 14px 'SF Mono','Fira Mono',monospace`; ctx.fillStyle = palette.secondary
    ctx.shadowColor = palette.secondary; ctx.shadowBlur = 8
    ctx.fillText(`×${car.combo}`, W - 18 - 80, 58); ctx.shadowBlur = 0
  }

  // ── Distance (top-left) ───────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.48)"
  ctx.beginPath(); ctx.roundRect(14, 14, 118, 54, 12); ctx.fill()
  ctx.strokeStyle = hex2rgba(palette.hudBorder, 0.35); ctx.lineWidth = 1; ctx.stroke()

  ctx.font = `700 9px system-ui`; ctx.textAlign = "left"; ctx.fillStyle = hex2rgba(palette.primary, 0.55)
  ctx.fillText("DISTANCE", 26, 32)
  ctx.font      = `900 18px 'SF Mono','Fira Mono',monospace`; ctx.fillStyle = palette.accent
  ctx.shadowColor = palette.accent; ctx.shadowBlur = 8
  ctx.fillText(`${distKm} km`, 26, 56); ctx.shadowBlur = 0

  // ── Drift bar (bottom-centre) ─────────────────────────────────────────────
  const barW = Math.min(210, W * 0.46)
  const barX = (W - barW) / 2, barY = H - 40

  ctx.fillStyle = "rgba(0,0,0,0.50)"
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
    ctx.fillStyle   = car.drifting ? bg2 : hex2rgba(palette.primary, 0.3)
    ctx.shadowColor = palette.glow; ctx.shadowBlur = car.drifting ? 14 : 0
    ctx.beginPath(); ctx.roundRect(fx, barY, fw, 7, 3); ctx.fill(); ctx.shadowBlur = 0
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(barX + barW / 2 - 1, barY - 3, 2, 13)

  if (car.drifting) {
    ctx.font      = "900 8px system-ui"; ctx.fillStyle = palette.glow; ctx.textAlign = "center"
    ctx.shadowColor = palette.glow; ctx.shadowBlur = 10
    ctx.fillText("DRIFT", W / 2, barY + 20); ctx.shadowBlur = 0
  }

  // ── Countdown ────────────────────────────────────────────────────────────
  if (countdown > 0) {
    ctx.font      = "900 80px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"
    ctx.shadowColor = palette.glow; ctx.shadowBlur = 42
    ctx.fillText(
      Math.ceil(countdown) <= 0 ? "GO!" : String(Math.ceil(countdown)),
      W / 2, H / 2 + 30,
    )
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
            ["Score",     car.score.toLocaleString()],
            ["Distance",  `${(distance / 4600).toFixed(2)} km`],
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
  const [phase, setPhase]             = useState<Phase>("menu")
  const [activePalette, setPalette]   = useState<PaletteId>("synthwave")
  const [musicMuted, setMusicMuted]   = useState(false)
  const [floatNotifs, setFloatNotifs] = useState<FloatNotif[]>([])
  const notifId = useRef(0)

  const palette = PALETTES[activePalette]

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const inputRef     = useRef<InputState>({
    left: false, right: false, throttle: false, brake: false, handbrake: false,
  })
  const carRef        = useRef<CarState>(createCar(HIGHWAY_START_X, HIGHWAY_START_Y, HIGHWAY_START_ANGLE))
  const camRef        = useRef<Camera>({ heading: HIGHWAY_START_ANGLE, bank: 0 })
  const highwayRef    = useRef<Highway | null>(null)
  const trafficRef    = useRef<TrafficCar[]>([])
  const particlesRef  = useRef<Particle[]>([])
  const musicRef      = useRef<SynthwaveMusic | null>(null)
  const audioRef      = useRef<AudioEngine | null>(null)
  const tRef          = useRef(0)
  const distRef       = useRef(0)
  const countdownRef  = useRef(3.2)
  const prevComboRef  = useRef(1)
  const prevScoreRef  = useRef(0)
  const trafficIdRef  = useRef(0)
  const trafficSpawnTimer = useRef(4)
  const musicMutedRef = useRef(false)
  const cameraShakeRef = useRef(0)

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
    window.addEventListener("keydown", dn)
    window.addEventListener("keyup",   up)
    return () => {
      window.removeEventListener("keydown", dn)
      window.removeEventListener("keyup",   up)
    }
  }, [phase])

  const handleTouchInput = useCallback((k: keyof InputState, v: boolean) => {
    inputRef.current[k] = v
  }, [])

  // ── Start / reset ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    carRef.current         = createCar(HIGHWAY_START_X, HIGHWAY_START_Y, HIGHWAY_START_ANGLE)
    camRef.current         = { heading: HIGHWAY_START_ANGLE, bank: 0 }
    highwayRef.current     = new Highway(HIGHWAY_START_X, HIGHWAY_START_Y, HIGHWAY_START_ANGLE)
    trafficRef.current     = []
    particlesRef.current   = []
    distRef.current        = 0
    countdownRef.current   = 3.2
    prevComboRef.current   = 1
    prevScoreRef.current   = 0
    trafficSpawnTimer.current = 4
    cameraShakeRef.current    = 0
    inputRef.current = { left: false, right: false, throttle: false, brake: false, handbrake: false }
    setFloatNotifs([])
    setPhase("countdown")
  }, [])

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const handleMuteToggle = useCallback(() => {
    setMusicMuted(prev => {
      const next = !prev
      if (next) musicRef.current?.pause()
      else      musicRef.current?.resume()
      return next
    })
  }, [])

  // ── Music lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "playing" || phase === "countdown") {
      if (!musicRef.current) {
        try { musicRef.current = new SynthwaveMusic() } catch { /* no audio ctx */ }
      }
      if (!musicMutedRef.current) musicRef.current?.resume()
      musicRef.current?.start()
      if (!audioRef.current) {
        try { audioRef.current = new AudioEngine() } catch { /* no audio ctx */ }
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
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    let last = performance.now(), rafId = 0

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      // Countdown
      if (phase === "countdown") {
        countdownRef.current -= dt
        if (countdownRef.current <= 0) { setPhase("playing"); return }
      }

      const playing = phase === "playing" || countdownRef.current <= 0
      const hw      = highwayRef.current
      if (!hw) { rafId = requestAnimationFrame(loop); return }

      // ── Physics + highway ────────────────────────────────────────────────
      if (playing) {
        hw.update(carRef.current.x, carRef.current.y, carRef.current.heading)
        const onRoad = hw.isOnRoad(carRef.current.x, carRef.current.y)
        let newCar   = stepCar(carRef.current, inputRef.current, dt, onRoad)

        // ── Wall bounce (road-segment-normal based) ───────────────────────
        const { x: cx, y: cy, hit } = hw.constrainToRoad(newCar.x, newCar.y)
        if (hit) {
          const r = hw.nearestSegment(cx, cy)
          if (r) {
            const perpX = -Math.sin(r.seg.angle)
            const perpY =  Math.cos(r.seg.angle)
            const side  = ((cx - r.seg.x) * perpX + (cy - r.seg.y) * perpY) >= 0 ? 1 : -1
            const bnx   = perpX * side, bny = perpY * side
            const vDotN = newCar.vx * bnx + newCar.vy * bny
            if (vDotN < 0) {
              newCar = { ...newCar, x: cx, y: cy,
                vx: newCar.vx - 1.45 * vDotN * bnx,
                vy: newCar.vy - 1.45 * vDotN * bny,
              }
              const postSpd    = Math.hypot(newCar.vx, newCar.vy)
              const cappedSpd  = Math.min(postSpd, newCar.speed * 0.62)
              if (postSpd > 0) newCar = { ...newCar,
                vx: newCar.vx * cappedSpd / postSpd,
                vy: newCar.vy * cappedSpd / postSpd,
              }
              cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.20)
              // Wall sparks (screen-space at car position)
              for (let si = 0; si < 10; si++) {
                if (particlesRef.current.length < MAX_PARTICLES) {
                  const ang = Math.random() * Math.PI * 2
                  particlesRef.current.push({
                    x: W / 2 + (Math.random() - 0.5) * 80,
                    y: H * 0.79 + (Math.random() - 0.5) * 30,
                    vx: Math.cos(ang) * (80 + Math.random() * 160),
                    vy: Math.sin(ang) * (80 + Math.random() * 160),
                    life: 1, maxLife: 0.15 + Math.random() * 0.20,
                    size: 1.2 + Math.random() * 2.5, color: palette.secondary, isSpark: true,
                  })
                }
              }
            } else {
              newCar = { ...newCar, x: cx, y: cy }
            }
          } else {
            newCar = { ...newCar, x: cx, y: cy }
          }
        }

        // ── Drift notif ───────────────────────────────────────────────────
        if (newCar.combo > prevComboRef.current && newCar.score > prevScoreRef.current) {
          const pts = newCar.score - prevScoreRef.current
          const id  = ++notifId.current
          setFloatNotifs(prev => [...prev.slice(-4), {
            id, text: "DRIFT!", pts, x: W / 2, y: H / 2 - 70,
          }])
          setTimeout(() => setFloatNotifs(p => p.filter(n => n.id !== id)), 2000)
        }
        prevComboRef.current = newCar.combo
        prevScoreRef.current = newCar.score
        carRef.current = newCar

        // ── Distance ─────────────────────────────────────────────────────
        distRef.current += newCar.speed * dt

        // ── Drift particles ───────────────────────────────────────────────
        if (newCar.drifting && newCar.speed > 70) {
          spawnDriftParticles(
            newCar, palette, particlesRef.current, W, H,
            newCar.speed > 250 ? 3 : 2,
          )
        }
        updateParticles(particlesRef.current, dt)

        // ── Traffic ───────────────────────────────────────────────────────
        trafficSpawnTimer.current -= dt
        if (trafficSpawnTimer.current <= 0 && trafficRef.current.length < 6) {
          const segs  = hw.segments
          const car   = carRef.current
          const ahead = segs.filter(s => {
            const fwd = (s.x - car.x) * Math.cos(car.heading) +
                        (s.y - car.y) * Math.sin(car.heading)
            return fwd > 1600 && fwd < 2400
          })
          if (ahead.length > 0) {
            const seg   = ahead[Math.floor(Math.random() * ahead.length)]
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

        // OBB collision + near-miss
        const COLL_FWD = 49, COLL_LAT = 22
        const NEAR_FWD = 80, NEAR_LAT = 50

        trafficRef.current = trafficRef.current.filter(tc => {
          const dx  = tc.x - carRef.current.x
          const dy  = tc.y - carRef.current.y
          const fwd = dx * Math.cos(carRef.current.heading) +
                      dy * Math.sin(carRef.current.heading)
          if (fwd < -900) return false

          const cosH   = Math.cos(carRef.current.heading)
          const sinH   = Math.sin(carRef.current.heading)
          const localX = dx * cosH + dy * sinH
          const localY = -dx * sinH + dy * cosH

          // ── Collision ────────────────────────────────────────────────────
          if (Math.abs(localX) < COLL_FWD && Math.abs(localY) < COLL_LAT) {
            const dist  = Math.hypot(dx, dy) || 1
            const awayX = -dx / dist, awayY = -dy / dist
            const curSpd = carRef.current.speed
            carRef.current = {
              ...carRef.current,
              vx: carRef.current.vx * 0.35 + awayX * curSpd * 0.30,
              vy: carRef.current.vy * 0.35 + awayY * curSpd * 0.30,
              combo: 1, comboTimer: 0,
            }
            cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.42)
            // Impact sparks (screen-space)
            for (let si = 0; si < 22; si++) {
              if (particlesRef.current.length < MAX_PARTICLES) {
                const ang = Math.random() * Math.PI * 2
                const spd = 180 + Math.random() * 280
                particlesRef.current.push({
                  x: W / 2 + (Math.random() - 0.5) * 60,
                  y: H * 0.79 + (Math.random() - 0.5) * 28,
                  vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                  life: 1, maxLife: 0.18 + Math.random() * 0.28,
                  size: 1.5 + Math.random() * 3.5, color: palette.accent, isSpark: true,
                })
              }
            }
            const cid = ++notifId.current
            setFloatNotifs(p => [...p.slice(-4), { id: cid, text: "CRASH!", pts: 0, x: W / 2, y: H / 2 - 80 }])
            setTimeout(() => setFloatNotifs(pp => pp.filter(n => n.id !== cid)), 1100)
            return false
          }

          // ── Near-miss ────────────────────────────────────────────────────
          if (!tc.passed && Math.abs(localX) < NEAR_FWD && Math.abs(localY) < NEAR_LAT) {
            tc.passed = true
            const nmId = ++notifId.current
            carRef.current = { ...carRef.current, score: carRef.current.score + 500 }
            setFloatNotifs(p => [...p.slice(-4), {
              id: nmId, text: "NEAR MISS!", pts: 500, x: W / 2, y: H / 2 - 120,
            }])
            setTimeout(() => setFloatNotifs(pp => pp.filter(n => n.id !== nmId)), 1800)
          }
          if (fwd < -20) tc.passed = true

          const roadAngle = hw.roadAngleAt(tc.x, tc.y)
          tc.x += Math.cos(roadAngle) * tc.speed * dt
          tc.y += Math.sin(roadAngle) * tc.speed * dt
          tc.heading = roadAngle
          return true
        })

        // ── Music intensity ────────────────────────────────────────────────
        const speedN    = Math.min(newCar.speed / 560, 1)
        const driftN    = Math.min(Math.abs(newCar.driftAngle) / 0.8, 1)
        const intensity = Math.max(speedN * 0.4, driftN * 0.85)
        musicRef.current?.setIntensity(intensity)
        audioRef.current?.update(newCar.speed, Math.abs(newCar.driftAngle), inputRef.current.throttle)
      }

      // ── Camera: heading + bank only (position derived from car) ──────────
      const car = carRef.current
      const cam = camRef.current

      const headLag = 1 - Math.exp(-2.6 * dt)
      cam.heading  += normalizeAngle(car.heading - cam.heading) * headLag

      const targetBank = car.drifting ? normalizeAngle(car.driftAngle) * -0.08 : 0
      cam.bank += (targetBank - cam.bank) * (1 - Math.exp(-5 * dt))

      cameraShakeRef.current *= Math.exp(-9 * dt)

      // Camera world position (behind + above car, derived each frame)
      const camX = car.x - Math.cos(cam.heading) * CAM_BEHIND
      const camY = car.y - Math.sin(cam.heading) * CAM_BEHIND

      tRef.current += dt

      // ── Render ────────────────────────────────────────────────────────────
      const t     = tRef.current
      const shake = cameraShakeRef.current
      const shakeX = shake > 0.01 ? (Math.random() - 0.5) * shake * W * 0.020 : 0
      const shakeY = shake > 0.01 ? (Math.random() - 0.5) * shake * H * 0.012 : 0

      // Apply shake only — bank is applied to player car, not the whole scene
      ctx.save()
      ctx.translate(W / 2 + shakeX, H / 2 + shakeY)
      ctx.translate(-W / 2, -H / 2)

      // 1. Sky (gradient + stars + city + horizon glow + ground fill)
      drawSky(ctx, W, H, palette, car.speed, t)

      // 2. Road surface (perspective trapezoids + neon edges + dashes)
      if (hw) drawPerspectiveRoad(ctx, hw, palette, camX, camY, cam.heading, W, H, t, car.speed)

      // 3. Environment (buildings, poles, billboards — far → near)
      if (hw) drawPerspectiveEnvObjects(ctx, hw, palette, camX, camY, cam.heading, W, H)

      // 4. Traffic cars (perspective projected, far → near)
      {
        type PT = { sx: number; sy: number; scale: number; fwd: number; tc: TrafficCar }
        const projTraffic: PT[] = []
        for (const tc of trafficRef.current) {
          const p = worldToProj(tc.x, tc.y, camX, camY, cam.heading, W, H)
          if (p && p.fwd < MAX_DEPTH) projTraffic.push({ ...p, tc })
        }
        projTraffic.sort((a, b) => b.fwd - a.fwd)
        for (const { sx, sy, scale } of projTraffic) {
          drawPerspectiveTrafficCar(ctx, sx, sy, scale, palette)
        }
      }

      // 5. Screen-space particles (drift smoke / sparks)
      drawParticles(ctx, particlesRef.current)

      // 6. Player car (fixed screen position, sways with drift + camera bank)
      if (playing) drawPlayerCar(ctx, car, W, H, palette, cam.bank)

      // 7. Speed lines (converging to horizon VP)
      drawSpeedLines(ctx, W, H, car.speed, palette, t)

      // 8. Vignette (tightens at speed)
      drawVignette(ctx, W, H, car.speed)

      ctx.restore()

      // 9. HUD (outside tilt transform so it stays readable)
      drawHUD(ctx, W, H, car, palette, distRef.current,
        phase === "countdown" ? Math.max(0, countdownRef.current) : 0)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, palette])

  // Cleanup audio on unmount
  useEffect(() => () => {
    musicRef.current?.dispose(); musicRef.current = null
    audioRef.current?.dispose(); audioRef.current = null
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden select-none" style={{ background: palette.bg }}>
      {/* Scanlines overlay */}
      <div className="absolute inset-0 pointer-events-none z-[5] opacity-[0.022]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.6) 2px,rgba(255,255,255,0.6) 3px)",
        }} />

      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />

      {/* Floating score notifications */}
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
                background: n.text === "CRASH!"
                  ? `linear-gradient(135deg,#ef4444,#f97316)`
                  : `linear-gradient(135deg,${palette.secondary},${palette.accent})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                filter: `drop-shadow(0 0 14px ${n.text === "CRASH!" ? "#ef4444" : palette.glow})`,
              }}>{n.text}</div>
            {n.pts > 0 && (
              <div className="text-sm font-bold text-white/80 mt-1">
                +{n.pts.toLocaleString()}
                {n.text === "DRIFT!" && (
                  <span style={{ color: palette.secondary }}> ×{carRef.current.combo}</span>
                )}
              </div>
            )}
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
          style={{
            background: "rgba(0,0,0,0.45)",
            border: `1px solid ${palette.primary}22`,
            color: "rgba(255,255,255,0.42)",
            backdropFilter: "blur(12px)",
          }}>
          ❙❙ Pause
        </button>
      )}
    </div>
  )
}
