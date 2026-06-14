import { useEffect, useRef, useState } from 'react'
import { FluidSimulation } from '../simulation/FluidSimulation'
import { pickColor, scaleColor } from '../utils/color'
import {
  DYE_RESOLUTION, DYE_RESOLUTION_MOBILE, FLUID_STRENGTH, COLOR_RANDOMIZATION,
  SPLAT_RADIUS,
} from '../constants/config'
import type { ElementFlowSettings } from '../types'

interface Pointer {
  id: number
  x: number; y: number; px: number; py: number
  color: [number, number, number]
  active: boolean
}

export interface ElementFlowActions {
  reset(): void
  exportPNG(): void
}

export function useElementFlow(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  settingsRef: React.RefObject<ElementFlowSettings>,
) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const simRef = useRef<FluidSimulation | null>(null)
  const actionsRef = useRef<ElementFlowActions | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    const dyeRes = isMobile ? DYE_RESOLUTION_MOBILE : DYE_RESOLUTION
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Cap DPR so high-refresh / retina displays stay at 60 FPS.
    const maxDpr = isMobile ? 2 : 1.75
    function sizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      const w = Math.floor(window.innerWidth * dpr)
      const h = Math.floor(window.innerHeight * dpr)
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w; canvas!.height = h
        return true
      }
      return false
    }
    sizeCanvas()

    let sim: FluidSimulation
    try {
      sim = new FluidSimulation(canvas, dyeRes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL2 unavailable')
      return
    }
    simRef.current = sim
    actionsRef.current = {
      reset: () => sim.reset(),
      exportPNG: () => {
        const url = sim.exportPNG()
        const a = document.createElement('a')
        a.href = url; a.download = `element-flow-${Date.now()}.png`; a.click()
      },
    }

    // ── Pointers (mouse + multi-touch) ────────────────────────────────────────
    const pointers = new Map<number, Pointer>()
    const colorTimer = { hueT: 0 }

    function toTexcoord(clientX: number, clientY: number) {
      return { x: clientX / window.innerWidth, y: 1 - clientY / window.innerHeight }
    }
    function freshColor() {
      const s = settingsRef.current!
      const c = pickColor(COLOR_RANDOMIZATION[s.colorRandomization])
      return scaleColor(c, 0.18)   // dye injected bright; bloom amplifies
    }
    function addPointer(id: number, clientX: number, clientY: number) {
      const { x, y } = toTexcoord(clientX, clientY)
      pointers.set(id, { id, x, y, px: x, py: y, color: freshColor(), active: true })
    }
    function movePointer(id: number, clientX: number, clientY: number) {
      const p = pointers.get(id); if (!p) return
      const { x, y } = toTexcoord(clientX, clientY)
      p.px = p.x; p.py = p.y; p.x = x; p.y = y
    }

    function onMouseDown(e: MouseEvent) { addPointer(-1, e.clientX, e.clientY) }
    function onMouseMove(e: MouseEvent) {
      if (!pointers.has(-1)) {
        // hover paints lightly with a transient pointer
        addPointer(-1, e.clientX, e.clientY)
        const p = pointers.get(-1)!; p.active = false
      }
      movePointer(-1, e.clientX, e.clientY)
    }
    function onMouseUp() { pointers.delete(-1) }
    function onTouchStart(e: TouchEvent) {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) addPointer(t.identifier, t.clientX, t.clientY)
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) movePointer(t.identifier, t.clientX, t.clientY)
    }
    function onTouchEnd(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) pointers.delete(t.identifier)
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)

    function applyPointers() {
      const s = settingsRef.current!
      const strength = FLUID_STRENGTH[s.fluidStrength]
      for (const p of pointers.values()) {
        const dx = (p.x - p.px)
        const dy = (p.y - p.py)
        const speed = Math.hypot(dx, dy)
        if (speed < 1e-5 && p.active === false) continue
        // Quick movement → stronger splash & more dye; slow → elegant swirl.
        const sizeBoost = 1 + Math.min(speed * 18, 3) * strength.splat
        sim.splat({
          x: p.x, y: p.y,
          dx: dx * strength.force,
          dy: dy * strength.force,
          color: p.color.map(c => c * (0.5 + sizeBoost * 0.6)) as [number, number, number],
          radius: SPLAT_RADIUS * sizeBoost,
        })
        p.px = p.x; p.py = p.y
      }
    }

    // ── Settings sync ─────────────────────────────────────────────────────────
    function syncSettings() {
      const s = settingsRef.current!
      sim.bloomEnabled = s.bloom
      sim.background = s.background === 'light' ? 1 : 0
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    let raf = 0
    let last = performance.now()
    let visible = true
    let resizePending = false

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      const s = settingsRef.current!
      if (!visible) return
      let dt = (now - last) / 1000
      last = now
      dt = Math.min(dt, 1 / 30)

      if (resizePending) { sizeCanvas(); sim.resize(); resizePending = false }

      syncSettings()
      colorTimer.hueT += dt

      if (!s.paused && !prefersReduced) {
        applyPointers()
        sim.step(dt)
      } else {
        // Respect reduced-motion / pause: still inject from active drags, no auto-advection
        applyPointers()
      }
      sim.render(colorTimer.hueT)
    }
    raf = requestAnimationFrame(frame)
    setReady(true)

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    function onResize() { resizePending = true }
    function onVisibility() {
      visible = document.visibilityState === 'visible'
      if (visible) last = performance.now()
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      sim.dispose()
      simRef.current = null
    }
  }, [canvasRef, settingsRef])

  return { ready, error, actionsRef }
}
