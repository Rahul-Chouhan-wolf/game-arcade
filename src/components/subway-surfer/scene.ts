// ─── Rail Runner · scene renderer ─────────────────────────────────────────────
// True perspective projection (scale ∝ 1/depth) with a vanishing point,
// daytime Subway-Surfers-style palette: rails, sleepers, graffiti walls,
// catenary posts, trains, barricades, signal gantries, coins, animated runner.

import type { ObstacleType } from '@/lib/subway-surfer/collision'

// ─── View / projection ────────────────────────────────────────────────────────

export interface View {
  W: number
  H: number
  ppu: number       // pixels per world-unit at the player plane (z = 0)
  horizonY: number
  feetY: number     // screen Y of the player's feet on the ground
}

export const CAM = 10           // camera distance behind the player (world units)
export const LANE_W = 2.2       // world X between lane centres
const FAR = 90                  // render distance

export function makeView(W: number, H: number): View {
  return {
    W, H,
    ppu: Math.min(H * 0.115, W * 0.165),
    horizonY: H * 0.34,
    feetY: H * 0.87,
  }
}

export function pscale(z: number): number {
  return CAM / (CAM + Math.max(z, -CAM * 0.55))
}

export function groundY(z: number, v: View): number {
  return v.horizonY + (v.feetY - v.horizonY) * pscale(z)
}

export function xToScreen(xWorld: number, z: number, v: View): number {
  return v.W / 2 + xWorld * v.ppu * pscale(z)
}

/** Fog factor: 1 near player → 0 at the horizon */
function vis(z: number): number {
  return Math.max(0, Math.min(1, 1 - z / (FAR * 1.15)))
}

function quad(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
) {
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4)
  ctx.closePath()
}

// Deterministic per-index pseudo-random
function rnd(k: number, salt = 0): number {
  const x = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Sky ──────────────────────────────────────────────────────────────────────

export function drawSky(ctx: CanvasRenderingContext2D, v: View, t: number) {
  const { W, H, horizonY } = v

  const sky = ctx.createLinearGradient(0, 0, 0, horizonY)
  sky.addColorStop(0,    '#2f8fe0')
  sky.addColorStop(0.55, '#7cc4ef')
  sky.addColorStop(0.88, '#cfe9f4')
  sky.addColorStop(1,    '#ffe9c4')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, horizonY + 2)

  // Sun glow
  const sunX = W * 0.78, sunY = horizonY * 0.42
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.16)
  sun.addColorStop(0, 'rgba(255,250,220,0.95)')
  sun.addColorStop(0.25, 'rgba(255,240,190,0.55)')
  sun.addColorStop(1, 'rgba(255,240,190,0)')
  ctx.fillStyle = sun
  ctx.fillRect(sunX - W * 0.16, sunY - W * 0.16, W * 0.32, W * 0.32)

  // Clouds (slow parallax drift)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 0.23 + 0.08 + t * 0.004 * (1 + i * 0.2)) % 1.15 - 0.075) * W
    const cy = horizonY * (0.18 + rnd(i, 3) * 0.42)
    const s  = W * (0.035 + rnd(i, 7) * 0.03)
    ctx.beginPath()
    ctx.ellipse(cx, cy, s * 1.6, s * 0.55, 0, 0, Math.PI * 2)
    ctx.ellipse(cx - s, cy + s * 0.18, s * 0.9, s * 0.42, 0, 0, Math.PI * 2)
    ctx.ellipse(cx + s * 1.1, cy + s * 0.15, s, s * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Distant skyline
  ctx.fillStyle = 'rgba(110,140,175,0.55)'
  for (let i = 0; i < 22; i++) {
    const bw = W * (0.025 + rnd(i, 11) * 0.03)
    const bh = horizonY * (0.06 + rnd(i, 13) * 0.16)
    const bx = (i / 22) * W
    ctx.fillRect(bx, horizonY - bh, bw, bh + 2)
  }
  ctx.fillStyle = 'rgba(130,158,190,0.45)'
  for (let i = 0; i < 14; i++) {
    const bw = W * (0.04 + rnd(i, 17) * 0.045)
    const bh = horizonY * (0.03 + rnd(i, 19) * 0.09)
    const bx = (i / 14) * W + W * 0.02
    ctx.fillRect(bx, horizonY - bh, bw, bh + 2)
  }
}

// ─── Ground, rails, sleepers, walls, posts ────────────────────────────────────

export function drawWorld(ctx: CanvasRenderingContext2D, v: View, scroll: number) {
  const { W, H, horizonY } = v

  // Gravel ballast bed
  const gnd = ctx.createLinearGradient(0, horizonY, 0, H)
  gnd.addColorStop(0, '#8d8579')
  gnd.addColorStop(0.35, '#7a7165')
  gnd.addColorStop(1, '#5c544a')
  ctx.fillStyle = gnd
  ctx.fillRect(0, horizonY, W, H - horizonY)

  // Gravel speckles (world-locked so they scroll)
  ctx.fillStyle = 'rgba(40,35,28,0.35)'
  const k0 = Math.ceil(scroll / 1.1)
  for (let k = k0; k < k0 + 70; k++) {
    const z = k * 1.1 - scroll
    if (z < -4 || z > 55) continue
    for (let j = 0; j < 4; j++) {
      const xw = (rnd(k, j * 5) - 0.5) * 10
      const sx = xToScreen(xw, z, v)
      const sy = groundY(z, v) + rnd(k, j * 9) * 3
      const r  = (0.5 + rnd(k, j * 13)) * 1.6 * pscale(z)
      ctx.fillRect(sx, sy, r, r * 0.7)
    }
  }

  // ── Side walls (graffiti slabs every 6 world units) ─────────────────────────
  const WALL_X = 6.4, WALL_H = 3.4, SLAB = 6
  const kw0 = Math.ceil((scroll - SLAB) / SLAB)
  for (let k = kw0 + 15; k >= kw0; k--) {       // far → near
    const z1 = k * SLAB - scroll
    const z2 = z1 + SLAB
    if (z2 < -4 || z1 > FAR) continue
    const a = vis(Math.max(z1, 0))

    for (const side of [-1, 1] as const) {
      const xw = WALL_X * side
      const xn = xToScreen(xw, Math.max(z1, -4), v)
      const xf = xToScreen(xw, Math.min(z2, FAR), v)
      const ynB = groundY(Math.max(z1, -4), v)
      const yfB = groundY(Math.min(z2, FAR), v)
      const ynT = ynB - WALL_H * v.ppu * pscale(Math.max(z1, -4))
      const yfT = yfB - WALL_H * v.ppu * pscale(Math.min(z2, FAR))

      // Wall face — solid, fog blended toward the horizon haze colour
      const base = 152 + Math.floor(rnd(k, side) * 26)
      const wr = Math.round(base + (255 - base) * (1 - a))
      const wg = Math.round(base - 16 + (233 - base + 16) * (1 - a))
      const wb = Math.round(base - 34 + (196 - base + 34) * (1 - a))
      ctx.fillStyle = `rgb(${wr},${wg},${wb})`
      quad(ctx, xn, ynT, xf, yfT, xf, yfB, xn, ynB)
      ctx.fill()

      // Panel seam + top coping
      ctx.strokeStyle = `rgba(95,85,70,${0.45 * a})`
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(xn, ynT); ctx.lineTo(xn, ynB); ctx.stroke()
      ctx.fillStyle = `rgba(118,106,90,${0.4 + a * 0.6})`
      quad(ctx, xn, ynT, xf, yfT, xf, yfT + 3 * pscale(z1), xn, ynT + 4 * pscale(z1))
      ctx.fill()

      // Weathering: vertical drip stains
      if (a > 0.3) {
        ctx.fillStyle = `rgba(80,70,58,${0.14 * a})`
        for (let d = 0; d < 3; d++) {
          const dtp = 0.15 + d * 0.3 + rnd(k, d + side * 13) * 0.15
          const dx1 = xn + (xf - xn) * dtp
          const dyT = ynT + (yfT - ynT) * dtp
          const dyB = ynB + (yfB - ynB) * dtp
          const dw = Math.abs(dyB - dyT) * (0.02 + rnd(k, d * 7) * 0.02)
          ctx.fillRect(dx1, dyT + (dyB - dyT) * 0.05, dw, (dyB - dyT) * (0.25 + rnd(k, d * 17) * 0.3))
        }
      }

      // Graffiti — drawn in wall space via transform so tags are skewed
      // with the wall plane (painted on, not floating). ~Half the slabs clean.
      if (z1 < 30 && a > 0.4 && rnd(k, side * 3) > 0.45) {
        const gt = 0.18 + rnd(k, side + 5) * 0.4       // position along the slab
        const gw = 0.3 + rnd(k, side + 9) * 0.2        // patch width (slab fraction)
        const anchorX = xn + (xf - xn) * gt
        const anchorB = ynB + (yfB - ynB) * gt
        const anchorT = ynT + (yfT - ynT) * gt
        const wallH = anchorB - anchorT
        // Wall-space basis: u along the wall, v up the wall
        const ux = (xf - xn) * gw
        const uy = (yfB - ynB) * gw
        const vy = -wallH * (0.3 + rnd(k, side + 11) * 0.16)
        const baseY = anchorB - wallH * 0.1

        const hues = [205, 345, 40, 135, 285]
        const hue = hues[Math.floor(rnd(k, side * 5 + 1) * hues.length)]

        ctx.save()
        ctx.transform(ux, uy, 0, vy, anchorX, baseY)
        ctx.globalAlpha = 0.75 * a
        // Bubble-letter band (unit square in wall space)
        ctx.fillStyle = `hsl(${hue},80%,50%)`
        ctx.beginPath()
        for (let b = 0; b < 4; b++) {
          const bx = 0.14 + b * 0.24
          ctx.ellipse(bx, 0.5 + (rnd(k, b + side) - 0.5) * 0.16, 0.155, 0.32 + rnd(k, b * 3) * 0.12, 0, 0, Math.PI * 2)
        }
        ctx.fill()
        // Highlight pass
        ctx.fillStyle = `hsl(${(hue + 40) % 360},85%,66%)`
        ctx.beginPath()
        for (let b = 0; b < 4; b++) {
          const bx = 0.14 + b * 0.24
          ctx.ellipse(bx - 0.03, 0.42 + (rnd(k, b + side) - 0.5) * 0.16, 0.07, 0.16, 0, 0, Math.PI * 2)
        }
        ctx.fill()
        // Underline swash
        ctx.strokeStyle = `hsl(${hue},65%,28%)`
        ctx.lineWidth = 0.05
        ctx.beginPath()
        ctx.moveTo(-0.02, 0.85)
        ctx.quadraticCurveTo(0.5, 1.04, 1.02, 0.8)
        ctx.stroke()
        ctx.restore()
        ctx.globalAlpha = 1
      }
    }
  }

  // ── Sleepers (per lane) ─────────────────────────────────────────────────────
  const SLEEP = 1.5
  const ks0 = Math.ceil((scroll - 4) / SLEEP)
  for (let k = ks0 + 46; k >= ks0; k--) {
    const z = k * SLEEP - scroll
    if (z < -4 || z > 65) continue
    const a = vis(z)
    ctx.fillStyle = `rgba(74,56,40,${0.45 + a * 0.55})`
    for (const lane of [-1, 0, 1]) {
      const xw = lane * LANE_W
      const x1 = xToScreen(xw - 1.0, z, v)
      const x2 = xToScreen(xw + 1.0, z, v)
      const y1 = groundY(z, v)
      const x3 = xToScreen(xw + 1.0, z + 0.42, v)
      const x4 = xToScreen(xw - 1.0, z + 0.42, v)
      const y2 = groundY(z + 0.42, v)
      quad(ctx, x1, y1, x2, y1, x3, y2, x4, y2)
      ctx.fill()
    }
  }

  // ── Rails (straight lines → vanishing point) ────────────────────────────────
  for (const lane of [-1, 0, 1]) {
    for (const off of [-0.72, 0.72]) {
      const xw = lane * LANE_W + off
      const xNear = xToScreen(xw, -4, v)
      const yNear = groundY(-4, v)
      const xFar  = xToScreen(xw, FAR, v)
      const yFar  = groundY(FAR, v)

      ctx.strokeStyle = 'rgba(60,58,55,0.9)'
      ctx.lineWidth = 4.5 * pscale(0)
      ctx.beginPath(); ctx.moveTo(xNear, yNear); ctx.lineTo(xFar, yFar); ctx.stroke()

      ctx.strokeStyle = 'rgba(228,232,238,0.95)'
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(xNear, yNear - 1); ctx.lineTo(xFar, yFar); ctx.stroke()
    }
  }

  // ── Catenary posts + overhead wires ─────────────────────────────────────────
  const POST = 14
  const kp0 = Math.ceil(scroll / POST)
  for (let k = kp0 + 6; k >= kp0; k--) {
    const z = k * POST - scroll
    if (z < 0 || z > FAR) continue
    const sc = pscale(z)
    const a = vis(z)
    const yB = groundY(z, v)
    const ph = 5.6 * v.ppu * sc

    ctx.strokeStyle = `rgba(70,76,84,${0.4 + a * 0.6})`
    ctx.lineWidth = Math.max(1, 5 * sc)
    for (const side of [-1, 1]) {
      const px = xToScreen(5.4 * side, z, v)
      ctx.beginPath(); ctx.moveTo(px, yB); ctx.lineTo(px, yB - ph); ctx.stroke()
    }
    // Crossbeam
    ctx.lineWidth = Math.max(1, 3.2 * sc)
    ctx.beginPath()
    ctx.moveTo(xToScreen(-5.4, z, v), yB - ph)
    ctx.lineTo(xToScreen(5.4, z, v), yB - ph)
    ctx.stroke()
  }
  // Contact wires
  ctx.strokeStyle = 'rgba(50,55,62,0.45)'
  ctx.lineWidth = 1
  for (const lane of [-1, 0, 1]) {
    const xw = lane * LANE_W
    ctx.beginPath()
    ctx.moveTo(xToScreen(xw, 0, v), groundY(0, v) - 5.2 * v.ppu)
    ctx.lineTo(xToScreen(xw, FAR, v), groundY(FAR, v) - 5.2 * v.ppu * pscale(FAR))
    ctx.stroke()
  }

  // Horizon haze over the track bed
  const haze = ctx.createLinearGradient(0, horizonY, 0, horizonY + (H - horizonY) * 0.22)
  haze.addColorStop(0, 'rgba(255,233,196,0.75)')
  haze.addColorStop(1, 'rgba(255,233,196,0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, horizonY, W, (H - horizonY) * 0.22)
}

// ─── Trains ───────────────────────────────────────────────────────────────────

const TRAIN_COLORS = [
  { body: '#e8a020', dark: '#b87a10', stripe: '#d23c28', roof: '#c8cdd4' },  // yellow metro
  { body: '#3a7bc8', dark: '#2a5b98', stripe: '#e8e8e8', roof: '#bfc6cf' },  // blue metro
  { body: '#d23c28', dark: '#a02818', stripe: '#f0d040', roof: '#c8cdd4' },  // red metro
  { body: '#3aa860', dark: '#287a44', stripe: '#e8e8e8', roof: '#bfc6cf' },  // green metro
]

export function drawTrain(
  ctx: CanvasRenderingContext2D, v: View,
  laneOff: number, zFront: number, len: number, colorId: number,
) {
  if (zFront > FAR) return
  const c = TRAIN_COLORS[colorId % TRAIN_COLORS.length]
  const zN = Math.max(zFront, -CAM * 0.4)
  const zF = Math.min(zFront + len, FAR)
  if (zF <= zN) return

  const xw = laneOff * LANE_W
  const HW = 1.04          // train half-width (world)
  const TH = 3.5           // train height (world)
  const scN = pscale(zN), scF = pscale(zF)
  const a = vis(Math.max(zN, 0))

  const xL = xToScreen(xw - HW, zN, v), xR = xToScreen(xw + HW, zN, v)
  const yB = groundY(zN, v)
  const yT = yB - TH * v.ppu * scN
  const fxL = xToScreen(xw - HW * 0.92, zF, v), fxR = xToScreen(xw + HW * 0.92, zF, v)
  const fyB = groundY(zF, v)
  const fyT = fyB - TH * v.ppu * scF * 0.96

  ctx.save()
  ctx.globalAlpha = 0.35 + a * 0.65

  // Ground shadow
  ctx.fillStyle = 'rgba(20,15,10,0.3)'
  quad(ctx, xL - 4 * scN, yB + 2, xR + 4 * scN, yB + 2, fxR, fyB + 1, fxL, fyB + 1)
  ctx.fill()

  // Side faces (visible side depends on which lane the train is in)
  if (laneOff >= 0) {  // we see its LEFT side
    ctx.fillStyle = c.dark
    quad(ctx, xL, yT, fxL, fyT, fxL, fyB, xL, yB)
    ctx.fill()
    // Window band
    ctx.fillStyle = 'rgba(18,26,36,0.85)'
    quad(ctx,
      xL + 1, yT + (yB - yT) * 0.18, fxL, fyT + (fyB - fyT) * 0.18,
      fxL, fyT + (fyB - fyT) * 0.42, xL + 1, yT + (yB - yT) * 0.42)
    ctx.fill()
    // Undercarriage
    ctx.fillStyle = 'rgba(30,30,34,0.9)'
    quad(ctx, xL, yB - (yB - yT) * 0.1, fxL, fyB - (fyB - fyT) * 0.1, fxL, fyB, xL, yB)
    ctx.fill()
  }
  if (laneOff <= 0) {  // we see its RIGHT side
    ctx.fillStyle = c.dark
    quad(ctx, xR, yT, fxR, fyT, fxR, fyB, xR, yB)
    ctx.fill()
    ctx.fillStyle = 'rgba(18,26,36,0.85)'
    quad(ctx,
      xR - 1, yT + (yB - yT) * 0.18, fxR, fyT + (fyB - fyT) * 0.18,
      fxR, fyT + (fyB - fyT) * 0.42, xR - 1, yT + (yB - yT) * 0.42)
    ctx.fill()
    ctx.fillStyle = 'rgba(30,30,34,0.9)'
    quad(ctx, xR, yB - (yB - yT) * 0.1, fxR, fyB - (fyB - fyT) * 0.1, fxR, fyB, xR, yB)
    ctx.fill()
  }

  // Roof
  ctx.fillStyle = c.roof
  quad(ctx, xL, yT, xR, yT, fxR, fyT, fxL, fyT)
  ctx.fill()
  // Roof AC unit
  const acw = (xR - xL) * 0.34
  ctx.fillStyle = 'rgba(105,112,120,0.95)'
  ctx.fillRect((xL + xR) / 2 - acw / 2, yT - 6 * scN, acw, 6 * scN)

  // ── Rear face (facing the player) ───────────────────────────────────────────
  const w = xR - xL, h = yB - yT
  const r = Math.min(10 * scN, w * 0.12)

  ctx.fillStyle = c.body
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(xL, yT, w, h, [r, r, 2, 2])
  else ctx.rect(xL, yT, w, h)
  ctx.fill()

  // Big rear window
  ctx.fillStyle = '#141e2a'
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function')
    ctx.roundRect(xL + w * 0.14, yT + h * 0.1, w * 0.72, h * 0.3, r * 0.7)
  else ctx.rect(xL + w * 0.14, yT + h * 0.1, w * 0.72, h * 0.3)
  ctx.fill()
  // Window reflection
  ctx.strokeStyle = 'rgba(180,210,235,0.4)'
  ctx.lineWidth = Math.max(1, w * 0.03)
  ctx.beginPath()
  ctx.moveTo(xL + w * 0.2, yT + h * 0.36)
  ctx.lineTo(xL + w * 0.38, yT + h * 0.12)
  ctx.stroke()

  // Stripe
  ctx.fillStyle = c.stripe
  ctx.fillRect(xL, yT + h * 0.48, w, h * 0.09)

  // Door seam
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = Math.max(1, w * 0.012)
  ctx.beginPath()
  ctx.moveTo(xL + w / 2, yT + h * 0.44); ctx.lineTo(xL + w / 2, yB - h * 0.12)
  ctx.stroke()

  // Tail lights (glowing)
  for (const sx of [xL + w * 0.12, xR - w * 0.12]) {
    ctx.shadowBlur = 8 * scN; ctx.shadowColor = '#ff3020'
    ctx.fillStyle = '#ff4030'
    ctx.beginPath(); ctx.arc(sx, yT + h * 0.72, Math.max(1.5, w * 0.035), 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
  }

  // Bumper + coupling
  ctx.fillStyle = 'rgba(40,42,46,0.95)'
  ctx.fillRect(xL + w * 0.06, yB - h * 0.1, w * 0.88, h * 0.07)
  ctx.fillRect(xL + w * 0.42, yB - h * 0.04, w * 0.16, h * 0.05)

  ctx.restore()
}

// ─── Barricade (jump over) ────────────────────────────────────────────────────

export function drawBarrier(ctx: CanvasRenderingContext2D, v: View, laneOff: number, z: number) {
  if (z > FAR || z < -2) return
  const sc = pscale(z)
  const a = vis(Math.max(z, 0))
  const xw = laneOff * LANE_W
  const xL = xToScreen(xw - 0.95, z, v), xR = xToScreen(xw + 0.95, z, v)
  const yB = groundY(z, v)
  const w = xR - xL
  const h = 2.3 * v.ppu * sc
  const yT = yB - h

  ctx.save()
  ctx.globalAlpha = 0.3 + a * 0.7

  // Shadow
  ctx.fillStyle = 'rgba(20,15,10,0.25)'
  ctx.beginPath(); ctx.ellipse((xL + xR) / 2, yB + 2 * sc, w * 0.55, 4 * sc, 0, 0, Math.PI * 2); ctx.fill()

  // Posts
  ctx.fillStyle = '#5a6068'
  ctx.fillRect(xL, yT, w * 0.07, h)
  ctx.fillRect(xR - w * 0.07, yT, w * 0.07, h)

  // Two striped planks
  for (const py of [yT + h * 0.08, yT + h * 0.5]) {
    const ph = h * 0.3
    ctx.fillStyle = '#e8e4dc'
    ctx.fillRect(xL, py, w, ph)
    ctx.save()
    ctx.beginPath(); ctx.rect(xL, py, w, ph); ctx.clip()
    ctx.fillStyle = '#d23c28'
    const sw = w * 0.16
    for (let x = xL - ph; x < xR + ph; x += sw * 2) {
      quad(ctx, x, py + ph, x + sw, py + ph, x + sw + ph, py, x + ph, py)
      ctx.fill()
    }
    ctx.restore()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(xL, py, w, ph)
  }

  ctx.restore()
}

// ─── Signal gantry (roll under) ───────────────────────────────────────────────

export function drawLowbar(
  ctx: CanvasRenderingContext2D, v: View, laneOff: number, z: number, t: number,
) {
  if (z > FAR || z < -2) return
  const sc = pscale(z)
  const a = vis(Math.max(z, 0))
  const xw = laneOff * LANE_W
  const xL = xToScreen(xw - 1.05, z, v), xR = xToScreen(xw + 1.05, z, v)
  const yB = groundY(z, v)
  const w = xR - xL
  // Gap below 1.0 world units; bar spans 1.0 → 2.0
  const yGap = yB - 1.0 * v.ppu * sc
  const yTop = yB - 2.05 * v.ppu * sc

  ctx.save()
  ctx.globalAlpha = 0.3 + a * 0.7

  // Posts (full height)
  ctx.fillStyle = '#6a7078'
  ctx.fillRect(xL, yTop, w * 0.06, yB - yTop)
  ctx.fillRect(xR - w * 0.06, yTop, w * 0.06, yB - yTop)

  // Hanging bar with hazard stripes
  ctx.fillStyle = '#f0c020'
  ctx.fillRect(xL, yTop, w, yGap - yTop)
  ctx.save()
  ctx.beginPath(); ctx.rect(xL, yTop, w, yGap - yTop); ctx.clip()
  ctx.fillStyle = '#2a2c30'
  const bh = yGap - yTop
  for (let x = xL - bh; x < xR + bh; x += w * 0.22) {
    quad(ctx, x, yGap, x + w * 0.11, yGap, x + w * 0.11 + bh, yTop, x + bh, yTop)
    ctx.fill()
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(xL, yTop, w, yGap - yTop)

  // Blinking warning light
  const blink = (Math.sin(t * 7 + z) + 1) / 2
  ctx.shadowBlur = 9 * sc * blink; ctx.shadowColor = '#ffb020'
  ctx.fillStyle = `rgba(255,${150 + blink * 90},20,${0.5 + blink * 0.5})`
  ctx.beginPath()
  ctx.arc((xL + xR) / 2, yTop - 4 * sc, Math.max(1.5, 3.4 * sc), 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.restore()
}

// ─── Coin ─────────────────────────────────────────────────────────────────────

export function drawCoin(
  ctx: CanvasRenderingContext2D, v: View, laneOff: number, z: number, t: number,
) {
  if (z > FAR * 0.8 || z < -2) return
  const sc = pscale(z)
  const a = vis(Math.max(z, 0))
  const cx = xToScreen(laneOff * LANE_W, z, v)
  const bobY = Math.sin(t * 3.2 + z * 0.7) * 2.5 * sc
  const cy = groundY(z, v) - 1.25 * v.ppu * sc + bobY
  const r = 0.34 * v.ppu * sc
  const spin = Math.abs(Math.cos(t * 4 + z * 0.5))   // 1 = face on, 0 = edge on

  ctx.save()
  ctx.globalAlpha = 0.4 + a * 0.6

  ctx.shadowBlur = 10 * sc; ctx.shadowColor = '#ffce30'
  ctx.fillStyle = '#e9a813'
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(r * spin, r * 0.14), r, 0, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0

  if (spin > 0.3) {
    ctx.fillStyle = '#ffd84d'
    ctx.beginPath(); ctx.ellipse(cx, cy, r * spin * 0.72, r * 0.72, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#e9a813'
    ctx.font = `900 ${r * 1.05}px monospace`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.save()
    ctx.translate(cx, cy); ctx.scale(spin, 1)
    ctx.fillText('$', 0, r * 0.06)
    ctx.restore()
  }

  // Glint
  ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 6 + z)})`
  ctx.beginPath(); ctx.arc(cx - r * 0.3 * spin, cy - r * 0.45, r * 0.14, 0, Math.PI * 2); ctx.fill()

  ctx.restore()
}

// ─── Runner (viewed from behind) ──────────────────────────────────────────────

export interface RunnerState {
  laneX: number       // current lane offset (-1..1, lerped)
  playerY: number     // jump height (world units)
  isRolling: boolean
  isJumping: boolean
  runPhase: number    // run-cycle phase (radians)
  lean: number        // -1..1 lateral lean while switching lanes
}

const SKIN = '#e8b48a'
const HOODIE = '#2563eb'
const HOODIE_D = '#1a4cb8'
const JEANS = '#27384f'
const CAP_RED = '#d92b20'

export function drawRunner(ctx: CanvasRenderingContext2D, v: View, r: RunnerState) {
  const ppu = v.ppu
  const px = xToScreen(r.laneX * LANE_W, 0, v)
  const groundFeet = v.feetY
  const fy = groundFeet - r.playerY * ppu * 0.92

  // Ground shadow (stays on the ground)
  const airT = Math.min(1, r.playerY / 3)
  ctx.save()
  ctx.globalAlpha = 0.3 - airT * 0.18
  ctx.fillStyle = '#1a140c'
  ctx.beginPath()
  ctx.ellipse(px, groundFeet + ppu * 0.04, ppu * (0.42 - airT * 0.12), ppu * 0.085, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(px, fy)
  ctx.rotate(r.lean * 0.16)

  if (r.isRolling) {
    // ── Tumbling ball ──
    const R = 0.46 * ppu
    ctx.fillStyle = HOODIE
    ctx.beginPath(); ctx.arc(0, -R, R, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = HOODIE_D
    ctx.beginPath(); ctx.arc(0, -R, R, Math.PI * 0.15, Math.PI * 0.85); ctx.fill()
    // Cap arc spinning
    const sp = r.runPhase * 2.2
    ctx.strokeStyle = CAP_RED
    ctx.lineWidth = R * 0.34
    ctx.beginPath(); ctx.arc(0, -R, R * 0.74, sp, sp + 1.6); ctx.stroke()
    ctx.strokeStyle = JEANS
    ctx.beginPath(); ctx.arc(0, -R, R * 0.74, sp + Math.PI, sp + Math.PI + 1.3); ctx.stroke()
    // Motion lines
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(0, -R, R * (1.18 + i * 0.14), Math.PI * 0.6, Math.PI * 0.95)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  const φ = r.runPhase
  const bob = r.isJumping ? 0 : Math.abs(Math.cos(φ)) * 0.045 * ppu
  const hipY = -0.78 * ppu - bob
  const shoulderY = -1.24 * ppu - bob
  const legW = 0.135 * ppu
  const armW = 0.105 * ppu

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // ── Legs ──
  for (const side of [-1, 1] as const) {
    const hipX = side * 0.135 * ppu
    let footY: number, footX: number, kneeX: number, kneeY: number
    if (r.isJumping) {
      // Tucked: knees up, feet under butt
      footY = hipY + 0.34 * ppu
      footX = hipX + side * 0.05 * ppu
      kneeX = hipX + side * 0.16 * ppu
      kneeY = hipY + 0.13 * ppu
    } else {
      const lift = Math.max(0, Math.sin(φ + (side === -1 ? 0 : Math.PI)))
      footY = -lift * 0.42 * ppu
      footX = hipX + side * 0.03 * ppu
      kneeX = hipX + side * (0.045 + lift * 0.075) * ppu
      kneeY = (hipY + footY) / 2 - lift * 0.06 * ppu
    }
    ctx.strokeStyle = JEANS
    ctx.lineWidth = legW
    ctx.beginPath()
    ctx.moveTo(hipX, hipY)
    ctx.quadraticCurveTo(kneeX, kneeY, footX, footY)
    ctx.stroke()
    // Shoe (sole flashes when lifted)
    const lifted = footY < -0.1 * ppu
    ctx.fillStyle = lifted ? '#f2f2f0' : '#e2e2de'
    ctx.beginPath()
    ctx.ellipse(footX, footY, 0.115 * ppu, (lifted ? 0.085 : 0.06) * ppu, 0, 0, Math.PI * 2)
    ctx.fill()
    if (lifted) {
      ctx.fillStyle = '#c8c2b6'
      ctx.beginPath()
      ctx.ellipse(footX, footY + 0.02 * ppu, 0.095 * ppu, 0.05 * ppu, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ── Torso (hoodie) ──
  const tw = 0.55 * ppu
  ctx.fillStyle = HOODIE
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function')
    ctx.roundRect(-tw / 2, shoulderY - 0.06 * ppu, tw, (hipY - shoulderY) + 0.16 * ppu, 0.12 * ppu)
  else ctx.rect(-tw / 2, shoulderY - 0.06 * ppu, tw, (hipY - shoulderY) + 0.16 * ppu)
  ctx.fill()
  // Hood bunched at the neck
  ctx.fillStyle = HOODIE_D
  ctx.beginPath()
  ctx.ellipse(0, shoulderY + 0.015 * ppu, 0.21 * ppu, 0.085 * ppu, 0, 0, Math.PI * 2)
  ctx.fill()

  // ── Backpack ──
  ctx.fillStyle = '#cf7a1e'
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function')
    ctx.roundRect(-0.19 * ppu, shoulderY + 0.07 * ppu, 0.38 * ppu, 0.34 * ppu, 0.07 * ppu)
  else ctx.rect(-0.19 * ppu, shoulderY + 0.07 * ppu, 0.38 * ppu, 0.34 * ppu)
  ctx.fill()
  ctx.fillStyle = '#a85e10'
  ctx.fillRect(-0.19 * ppu, shoulderY + 0.19 * ppu, 0.38 * ppu, 0.045 * ppu)

  // ── Arms ──
  for (const side of [-1, 1] as const) {
    const shX = side * 0.295 * ppu
    let handX: number, handY: number, elbX: number, elbY: number
    if (r.isJumping) {
      // Arms thrown up and out
      elbX = shX + side * 0.13 * ppu
      elbY = shoulderY - 0.16 * ppu
      handX = shX + side * 0.2 * ppu
      handY = shoulderY - 0.38 * ppu
    } else {
      const swing = Math.sin(φ + (side === -1 ? Math.PI : 0))   // opposite to same-side leg
      elbX = shX + side * 0.085 * ppu
      elbY = shoulderY + 0.22 * ppu
      handX = shX + side * 0.045 * ppu
      handY = shoulderY + (0.3 - swing * 0.17) * ppu
    }
    ctx.strokeStyle = HOODIE
    ctx.lineWidth = armW
    ctx.beginPath()
    ctx.moveTo(shX, shoulderY + 0.05 * ppu)
    ctx.quadraticCurveTo(elbX, elbY, handX, handY)
    ctx.stroke()
    // Fist
    ctx.fillStyle = SKIN
    ctx.beginPath(); ctx.arc(handX, handY, 0.062 * ppu, 0, Math.PI * 2); ctx.fill()
  }

  // ── Head + cap (from behind) ──
  const headY = shoulderY - 0.19 * ppu
  const headR = 0.165 * ppu
  // Neck
  ctx.fillStyle = SKIN
  ctx.fillRect(-0.05 * ppu, headY + headR * 0.5, 0.1 * ppu, 0.1 * ppu)
  // Head base
  ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fill()
  // Hair fringe under cap
  ctx.fillStyle = '#3b2a18'
  ctx.beginPath(); ctx.arc(0, headY + headR * 0.3, headR * 0.92, 0.15, Math.PI - 0.15); ctx.fill()
  // Cap (back view: dome + strap)
  ctx.fillStyle = CAP_RED
  ctx.beginPath(); ctx.arc(0, headY - headR * 0.12, headR * 1.02, Math.PI, Math.PI * 2); ctx.fill()
  ctx.fillRect(-headR * 1.02, headY - headR * 0.16, headR * 2.04, headR * 0.42)
  // Strap band
  ctx.fillStyle = '#a81e14'
  ctx.fillRect(-headR * 0.85, headY + headR * 0.13, headR * 1.7, headR * 0.2)
  // Cap button
  ctx.fillStyle = '#891510'
  ctx.beginPath(); ctx.arc(0, headY - headR * 0.62, headR * 0.14, 0, Math.PI * 2); ctx.fill()

  ctx.restore()
}

// ─── Particles ────────────────────────────────────────────────────────────────

export interface Particle {
  xw: number; yw: number; z: number       // world position (yw = height)
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  kind: 'dust' | 'spark'
}

export function stepParticles(ps: Particle[], dt: number, dz: number) {
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    p.life -= dt
    if (p.life <= 0) { ps.splice(i, 1); continue }
    p.xw += p.vx * dt
    p.yw += p.vy * dt
    p.vy -= (p.kind === 'spark' ? 6 : -2) * dt   // dust floats up, sparks fall
    p.z -= dz * 0.4
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, v: View, ps: Particle[]) {
  for (const p of ps) {
    const sc = pscale(p.z)
    const t = p.life / p.maxLife
    const sx = xToScreen(p.xw, p.z, v)
    const sy = groundY(p.z, v) - p.yw * v.ppu * sc
    ctx.globalAlpha = t * (p.kind === 'dust' ? 0.4 : 0.9)
    ctx.fillStyle = p.kind === 'dust' ? '#b8a98f' : '#ffd84d'
    ctx.beginPath()
    ctx.arc(sx, sy, p.size * sc * (p.kind === 'dust' ? (2 - t) : t), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ─── Post FX ──────────────────────────────────────────────────────────────────

export function drawSpeedStreaks(ctx: CanvasRenderingContext2D, v: View, speed: number, t: number) {
  const k = Math.min(1, Math.max(0, (speed - 26) / 18))
  if (k <= 0) return
  ctx.save()
  ctx.globalAlpha = k * 0.25
  ctx.strokeStyle = '#ffffff'
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + Math.sin(t + i) * 0.1
    const cx = v.W / 2, cy = v.H * 0.45
    const r1 = Math.max(v.W, v.H) * 0.42
    const r2 = r1 + 40 + (i % 4) * 30 * k
    ctx.lineWidth = 1 + (i % 3)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
    ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawVignette(ctx: CanvasRenderingContext2D, v: View) {
  const g = ctx.createRadialGradient(
    v.W / 2, v.H * 0.48, Math.min(v.W, v.H) * 0.42,
    v.W / 2, v.H * 0.48, Math.max(v.W, v.H) * 0.78,
  )
  g.addColorStop(0, 'rgba(20,12,40,0)')
  g.addColorStop(1, 'rgba(20,12,40,0.28)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, v.W, v.H)
}
