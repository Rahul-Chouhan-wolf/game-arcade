// ─── Three-Body · Canvas2D renderer ──────────────────────────────────────────
// Crisp, educational rendering: starfield, fading trails, glowing bodies,
// velocity vectors, centre-of-mass marker and labels. Canvas2D (not WebGL) so
// the physics overlays stay pin-sharp and easy to read.

import type { Body } from '../simulation/physics'
import { centerOfMass } from '../simulation/physics'

export interface View { cx: number; cy: number; scale: number }   // world centre + px/unit
export interface RenderOptions {
  showTrails: boolean
  showVectors: boolean
  showCom: boolean
  showLabels: boolean
}

interface Star { x: number; y: number; r: number; a: number }

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private stars: Star[] = []
  W = 0; H = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    let s = 987654321 >>> 0
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
    for (let i = 0; i < 260; i++) this.stars.push({ x: rnd(), y: rnd(), r: 0.3 + rnd() * 1.3, a: 0.2 + rnd() * 0.6 })
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.W = Math.max(2, Math.floor(this.canvas.clientWidth * dpr))
    this.H = Math.max(2, Math.floor(this.canvas.clientHeight * dpr))
    this.canvas.width = this.W; this.canvas.height = this.H
  }

  private toScreen(x: number, y: number, v: View): [number, number] {
    return [this.W / 2 + (x - v.cx) * v.scale, this.H / 2 - (y - v.cy) * v.scale]
  }

  render(bodies: Body[], view: View, opts: RenderOptions, ghost: Body[] | null) {
    const ctx = this.ctx, W = this.W, H = this.H

    // space background + vignette
    const bg = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.hypot(W, H) * 0.6)
    bg.addColorStop(0, '#0a0c18'); bg.addColorStop(1, '#03040a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff'
    for (const st of this.stars) {
      ctx.globalAlpha = st.a
      ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r * (W / 1400), 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1

    // chaos ghost (faint, behind)
    if (ghost) {
      ctx.globalAlpha = 0.32
      this.drawTrails(ghost, view, true)
      for (const b of ghost) this.drawBody(b, view, true)
      ctx.globalAlpha = 1
    }

    if (opts.showTrails) this.drawTrails(bodies, view, false)

    if (opts.showCom) {
      const c = centerOfMass(bodies)
      const [sx, sy] = this.toScreen(c.x, c.y, view)
      ctx.strokeStyle = 'rgba(170,190,255,0.5)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(sx - 7, sy); ctx.lineTo(sx + 7, sy); ctx.moveTo(sx, sy - 7); ctx.lineTo(sx, sy + 7); ctx.stroke()
      ctx.fillStyle = 'rgba(170,190,255,0.6)'; ctx.font = `${11 * (W / 1400)}px ui-sans-serif, system-ui`
      ctx.fillText('center of mass', sx + 10, sy - 6)
    }

    for (const b of bodies) {
      if (opts.showVectors) this.drawVector(b, view)
      this.drawBody(b, view, false)
      if (opts.showLabels) this.drawLabel(b, view)
    }
  }

  private drawTrails(bodies: Body[], v: View, ghost: boolean) {
    const ctx = this.ctx
    for (const b of bodies) {
      const t = b.trail, n = t.length / 2
      if (n < 2) continue
      ctx.lineWidth = ghost ? 1 : 1.6
      ctx.strokeStyle = b.color
      // fade older segments
      for (let i = 1; i < n; i++) {
        const [x0, y0] = this.toScreen(t[(i - 1) * 2], t[(i - 1) * 2 + 1], v)
        const [x1, y1] = this.toScreen(t[i * 2], t[i * 2 + 1], v)
        ctx.globalAlpha = (ghost ? 0.25 : 0.55) * (i / n)
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }

  private bodyRadius(b: Body, v: View): number {
    return Math.max(3, Math.cbrt(b.mass) * 7 * (this.W / 1400)) * Math.min(1.6, Math.max(0.5, v.scale / 120))
  }

  private drawBody(b: Body, v: View, ghost: boolean) {
    const ctx = this.ctx
    const [sx, sy] = this.toScreen(b.x, b.y, v)
    const r = this.bodyRadius(b, v)
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.2)
    glow.addColorStop(0, b.color)
    glow.addColorStop(0.4, this.alpha(b.color, ghost ? 0.25 : 0.5))
    glow.addColorStop(1, this.alpha(b.color, 0))
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2); ctx.fill()
    if (!ghost) {
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.55, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = b.color
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1
    }
  }

  private drawVector(b: Body, v: View) {
    const ctx = this.ctx
    const [sx, sy] = this.toScreen(b.x, b.y, v)
    const k = 26   // velocity → pixels
    const ex = sx + b.vx * k, ey = sy - b.vy * k
    ctx.strokeStyle = this.alpha(b.color, 0.85); ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke()
    const ang = Math.atan2(ey - sy, ex - sx)
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - 6 * Math.cos(ang - 0.4), ey - 6 * Math.sin(ang - 0.4))
    ctx.lineTo(ex - 6 * Math.cos(ang + 0.4), ey - 6 * Math.sin(ang + 0.4))
    ctx.closePath(); ctx.fillStyle = this.alpha(b.color, 0.85); ctx.fill()
  }

  private drawLabel(b: Body, v: View) {
    const ctx = this.ctx
    const [sx, sy] = this.toScreen(b.x, b.y, v)
    const r = this.bodyRadius(b, v)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `600 ${12 * (this.W / 1400)}px ui-sans-serif, system-ui`
    ctx.fillText(b.label, sx + r + 4, sy - r - 2)
  }

  private alpha(hex: string, a: number): string {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${a})`
  }

  screenshot(): string { return this.canvas.toDataURL('image/png') }
}
