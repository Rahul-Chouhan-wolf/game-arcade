"use client"

import { useEffect, useRef } from "react"
import { NeonPalette } from "./types"

// ── Precomputed scene elements ────────────────────────────────────────────────

interface Star   { nx: number; ny: number; r: number; phase: number; speed: number }
interface Building { nx: number; nw: number; nh: number; winCols: number; winRows: number }
interface Streak { nx: number; ny: number; speed: number; length: number; side: -1 | 1; alpha: number; color: string }

// ── Drawing helpers ───────────────────────────────────────────────────────────

function hex2rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  W: number,
  VPY: number,
  palette: NeonPalette
) {
  const g = ctx.createLinearGradient(0, 0, 0, VPY)
  g.addColorStop(0, palette.bg)
  g.addColorStop(0.55, palette.bgMid)
  g.addColorStop(1, hex2rgba(palette.primary, 0.18))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, VPY)
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  W: number,
  VPY: number,
  t: number
) {
  for (const s of stars) {
    const twinkle = 0.45 + 0.55 * Math.sin(t * s.speed + s.phase)
    ctx.globalAlpha = twinkle
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(s.nx * W, s.ny * VPY * 0.88, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  VPX: number,
  VPY: number,
  W: number,
  palette: NeonPalette,
  t: number
) {
  const R = Math.min(W * 0.13, 100)
  const cx = VPX
  const cy = VPY - R * 0.1

  // Outer corona
  const corona = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 3.2)
  corona.addColorStop(0, hex2rgba(palette.sunColors[1], 0.28))
  corona.addColorStop(0.4, hex2rgba(palette.sunColors[2], 0.08))
  corona.addColorStop(1, "transparent")
  ctx.fillStyle = corona
  ctx.fillRect(cx - R * 3.5, cy - R * 3.5, R * 7, R * 7)

  // Sun body — clip to circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()

  const body = ctx.createLinearGradient(cx, cy - R, cx, cy + R)
  body.addColorStop(0, palette.sunColors[0])
  body.addColorStop(0.45, palette.sunColors[1])
  body.addColorStop(1, palette.sunColors[2])
  ctx.fillStyle = body
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

  // Horizontal scan lines (classic synthwave cut)
  const lineGap = R * 0.072
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.6)  // slow breathe
  ctx.fillStyle = `rgba(0,0,0,${0.55 + pulse * 0.1})`
  let lineY = cy          // start from exact centre
  while (lineY < cy + R) {
    ctx.fillRect(cx - R, lineY, R * 2, lineGap * 0.55)
    lineY += lineGap
  }
  ctx.restore()
}

function drawCityline(
  ctx: CanvasRenderingContext2D,
  buildings: Building[],
  W: number,
  VPX: number,
  VPY: number,
  palette: NeonPalette
) {
  // Glow behind city
  const cityGlow = ctx.createLinearGradient(0, VPY - VPY * 0.18, 0, VPY)
  cityGlow.addColorStop(0, "transparent")
  cityGlow.addColorStop(1, hex2rgba(palette.primary, 0.12))
  ctx.fillStyle = cityGlow
  ctx.fillRect(0, VPY - VPY * 0.18, W, VPY * 0.18)

  for (const b of buildings) {
    const bx = b.nx * W
    const bw = b.nw * W
    const bh = b.nh * VPY
    const by = VPY - bh

    // Building silhouette
    ctx.fillStyle = hex2rgba(palette.bg, 0.9)
    ctx.fillRect(bx, by, bw, bh)

    // Windows
    const ww = bw / (b.winCols + 1) * 0.55
    const wh = bh / (b.winRows + 1) * 0.45
    for (let wr = 0; wr < b.winRows; wr++) {
      for (let wc = 0; wc < b.winCols; wc++) {
        if (Math.random() > 0.45) continue  // sparse windows
        const wx = bx + ((wc + 0.5) / b.winCols) * bw - ww / 2
        const wy = by + ((wr + 0.5) / b.winRows) * bh - wh / 2
        ctx.fillStyle = Math.random() > 0.6
          ? hex2rgba(palette.accent, 0.7)
          : hex2rgba(palette.secondary, 0.55)
        ctx.fillRect(wx, wy, ww, wh)
      }
    }

    // Building edge glow
    ctx.strokeStyle = hex2rgba(palette.primary, 0.12)
    ctx.lineWidth = 0.5
    ctx.strokeRect(bx, by, bw, bh)
  }
}

function drawHorizonGlow(
  ctx: CanvasRenderingContext2D,
  W: number,
  VPX: number,
  VPY: number,
  palette: NeonPalette
) {
  // Wide atmospheric glow along the horizon line
  const g = ctx.createRadialGradient(VPX, VPY, 0, VPX, VPY, W * 0.55)
  g.addColorStop(0, hex2rgba(palette.glow, 0.22))
  g.addColorStop(0.5, hex2rgba(palette.primary, 0.06))
  g.addColorStop(1, "transparent")
  ctx.fillStyle = g
  ctx.fillRect(0, VPY - 60, W, 120)

  // Sharp horizon line
  ctx.strokeStyle = hex2rgba(palette.primary, 0.6)
  ctx.lineWidth = 1.5
  ctx.shadowColor = palette.glow
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(0, VPY)
  ctx.lineTo(W, VPY)
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  VPY: number,
  palette: NeonPalette
) {
  const g = ctx.createLinearGradient(0, VPY, 0, H)
  g.addColorStop(0, hex2rgba(palette.bgMid, 0.7))
  g.addColorStop(0.25, hex2rgba(palette.bg, 0.95))
  g.addColorStop(1, palette.bg)
  ctx.fillStyle = g
  ctx.fillRect(0, VPY, W, H - VPY)
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  VPX: number,
  VPY: number,
  palette: NeonPalette,
  offset: number
) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, VPY, W, H - VPY)
  ctx.clip()

  ctx.shadowColor = palette.glow
  ctx.shadowBlur = 6

  // Horizontal scrolling lines
  const numH = 22
  for (let i = 0; i < numH; i++) {
    const t0 = ((i / numH) + offset) % 1
    // Quadratic perspective compression near horizon
    const t = t0 * t0
    if (t < 0.003) continue          // avoid vanishing at the very start

    const y = VPY + (H - VPY) * t
    const spread = t * 0.82
    const x1 = VPX - spread * W * 0.78
    const x2 = VPX + spread * W * 0.78

    ctx.globalAlpha = Math.min(t * 2.5, 1) * 0.65
    ctx.strokeStyle = palette.grid
    ctx.lineWidth = t * 2.2

    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
  }

  // Vertical converging lines
  const numV = 12
  ctx.globalAlpha = 0.45
  ctx.lineWidth = 1
  ctx.strokeStyle = palette.grid
  for (let i = -numV / 2; i <= numV / 2; i++) {
    const frac = i / (numV / 2)
    const xBottom = VPX + frac * W * 0.78
    ctx.beginPath()
    ctx.moveTo(VPX, VPY)
    ctx.lineTo(xBottom, H)
    ctx.stroke()
  }

  ctx.restore()
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  VPX: number,
  VPY: number,
  palette: NeonPalette,
  offset: number
) {
  ctx.save()

  // Road surface (slightly lighter centre strip)
  ctx.beginPath()
  ctx.moveTo(VPX - 4, VPY)
  ctx.lineTo(VPX + 4, VPY)
  ctx.lineTo(VPX + W * 0.22, H)
  ctx.lineTo(VPX - W * 0.22, H)
  ctx.closePath()
  const roadFill = ctx.createLinearGradient(0, VPY, 0, H)
  roadFill.addColorStop(0, "transparent")
  roadFill.addColorStop(1, hex2rgba(palette.primary, 0.04))
  ctx.fillStyle = roadFill
  ctx.fill()

  // Dashed centre line
  const numDashes = 14
  ctx.shadowColor = palette.glow
  ctx.shadowBlur = 10
  ctx.strokeStyle = hex2rgba(palette.glow, 0.85)
  ctx.lineWidth = 2
  ctx.setLineDash([16, 20])
  ctx.lineDashOffset = -offset * 320

  // Perspective-scale the line from VPY to H
  for (let i = 0; i < numDashes; i++) {
    const t0 = i / numDashes
    const t1 = (i + 0.45) / numDashes
    const y0 = VPY + (H - VPY) * (t0 * t0)
    const y1 = VPY + (H - VPY) * (t1 * t1)
    const lw = t0 * 3 + 0.5
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(VPX, y0)
    ctx.lineTo(VPX, y1)
    ctx.stroke()
  }

  // Neon lane border lines — left & right
  const sides = [-1, 1] as const
  for (const side of sides) {
    ctx.setLineDash([])
    ctx.strokeStyle = hex2rgba(palette.secondary, 0.6)
    ctx.lineWidth = 1.5
    ctx.shadowColor = palette.secondary
    ctx.shadowBlur = 8

    ctx.beginPath()
    ctx.moveTo(VPX + side * 4, VPY)
    ctx.lineTo(VPX + side * W * 0.22, H)
    ctx.stroke()
  }

  ctx.restore()
  ctx.shadowBlur = 0
}

function drawStreaks(
  ctx: CanvasRenderingContext2D,
  streaks: Streak[],
  W: number,
  H: number,
  VPX: number,
  VPY: number,
  t: number
) {
  for (const s of streaks) {
    // progress 0→1 (VPY to H)
    const prog = ((s.ny + t * s.speed) % 1)
    const tSq = prog * prog
    const y = VPY + (H - VPY) * tSq
    const spread = tSq * 0.7
    const xCenter = VPX + s.side * spread * W * 0.55 + s.nx * W * 0.12

    const yLen = (H - VPY) * s.length * (tSq + 0.1)
    const y0 = Math.max(VPY, y - yLen)

    const g = ctx.createLinearGradient(xCenter, y0, xCenter, y)
    g.addColorStop(0, `${s.color}00`)
    g.addColorStop(0.6, `${s.color}${Math.round(s.alpha * tSq * 255).toString(16).padStart(2, "0")}`)
    g.addColorStop(1, `${s.color}00`)

    ctx.strokeStyle = g
    ctx.lineWidth = tSq * 2.5 + 0.5
    ctx.shadowColor = s.color
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(xCenter, y0)
    ctx.lineTo(xCenter, y)
    ctx.stroke()
    ctx.shadowBlur = 0
  }
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number
) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85)
  g.addColorStop(0, "transparent")
  g.addColorStop(1, "rgba(0,0,0,0.62)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  palette: NeonPalette
  speedMult?: number   // 0–2, default 1
  showVehicle?: boolean
}

export function NeonHighway({ palette, speedMult = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const tRef      = useRef(0)

  // Precomputed geometry (palette-independent — reset on mount)
  const starsRef     = useRef<Star[]>([])
  const buildingsRef = useRef<Building[]>([])
  const streaksRef   = useRef<Streak[]>([])

  useEffect(() => {
    // Precompute stars
    starsRef.current = Array.from({ length: 180 }, () => ({
      nx: Math.random(),
      ny: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 1.8 + 0.6,
    }))

    // Precompute city buildings
    const rawBuildings: Building[] = []
    let bx = 0
    while (bx < 1) {
      const bw = Math.random() * 0.042 + 0.014
      rawBuildings.push({
        nx: bx,
        nw: bw * 0.82,
        nh: Math.random() * 0.14 + 0.04,
        winCols: Math.floor(Math.random() * 4) + 1,
        winRows: Math.floor(Math.random() * 5) + 2,
      })
      bx += bw + Math.random() * 0.008
    }
    buildingsRef.current = rawBuildings

    // Precompute light streaks
    streaksRef.current = Array.from({ length: 18 }, (_, i) => ({
      nx: (Math.random() - 0.5) * 0.4,
      ny: Math.random(),
      speed: Math.random() * 0.38 + 0.22,
      length: Math.random() * 0.14 + 0.06,
      side: (i % 2 === 0 ? -1 : 1) as -1 | 1,
      alpha: Math.random() * 0.6 + 0.25,
      color: ["#ffffff", "#00fff5", "#ff2dd4", "#ffe066"][Math.floor(Math.random() * 4)],
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = 0, H = 0

    const resize = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener("resize", resize)

    const frame = () => {
      if (!W || !H) { rafRef.current = requestAnimationFrame(frame); return }

      ctx.clearRect(0, 0, W, H)
      const VPX = W / 2
      const VPY = H * 0.43
      const t   = tRef.current

      drawSky(ctx, W, VPY, palette)
      drawStars(ctx, starsRef.current, W, VPY, t)
      drawSun(ctx, VPX, VPY, W, palette, t)
      drawCityline(ctx, buildingsRef.current, W, VPX, VPY, palette)
      drawHorizonGlow(ctx, W, VPX, VPY, palette)
      drawGround(ctx, W, H, VPY, palette)
      drawGrid(ctx, W, H, VPX, VPY, palette, (t * 0.55) % 1)
      drawRoad(ctx, W, H, VPX, VPY, palette, t)
      drawStreaks(ctx, streaksRef.current, W, H, VPX, VPY, t)
      drawVignette(ctx, W, H)

      tRef.current += 0.012 * speedMult
      rafRef.current = requestAnimationFrame(frame)
    }

    frame()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [palette, speedMult])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  )
}
