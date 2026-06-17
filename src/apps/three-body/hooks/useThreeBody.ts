import { useEffect, useRef, useState } from 'react'
import { Renderer, type View } from '../render/renderer'
import { integrate, ensureAccel } from '../simulation/integrator'
import {
  totalEnergy, kineticEnergy, potentialEnergy, momentum,
  centerOfMass, maxComDistance, type Body,
} from '../simulation/physics'
import { PRESETS, randomPreset, type Preset } from '../simulation/presets'
import type { Settings, Stats } from '../types'

export interface ThreeBodyActions {
  loadPreset(p: Preset): void
  reset(): void
  randomize(): void
  step(): void
  screenshot(): void
}

const cloneBodies = (bs: Body[]): Body[] => bs.map(b => ({ ...b, trail: [] }))

export function useThreeBody(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  settingsRef: React.RefObject<Settings>,
  onStats: (s: Stats) => void,
  onPreset: (p: Preset) => void,
) {
  const [ready, setReady] = useState(false)
  const actionsRef = useRef<ThreeBodyActions | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new Renderer(canvas)
    renderer.resize()

    let current: Preset = PRESETS[0]
    let bodies: Body[] = current.bodies()
    let ghost: Body[] | null = null
    let G = current.G
    let time = 0
    let energy0 = 0
    const energyHistory: number[] = []
    let ejected = false
    const view: View = { cx: 0, cy: 0, scale: 120 }
    let viewInit = false

    function load(p: Preset) {
      current = p; onPreset(p)
      bodies = p.bodies(); G = p.G; time = 0; ejected = false
      ghost = null; energyHistory.length = 0; viewInit = false
      ensureAccel(bodies, G)
      energy0 = totalEnergy(bodies, G)
    }
    load(current)

    actionsRef.current = {
      loadPreset: load,
      reset: () => load(current),
      randomize: () => load(randomPreset((Math.random() * 1e9) | 0)),
      step: () => doSteps(1 / 60, true),
      screenshot: () => {
        const url = renderer.screenshot()
        const a = document.createElement('a'); a.href = url; a.download = `three-body-${current.id}.png`; a.click()
      },
    }

    function ensureGhost(on: boolean) {
      if (on && !ghost) {
        ghost = cloneBodies(bodies)
        ghost[0].x += 1e-3            // 0.001-unit perturbation reveals chaos
        ensureAccel(ghost, G)
      } else if (!on && ghost) ghost = null
    }

    function doSteps(dt: number, force: boolean) {
      const s = settingsRef.current!
      if (s.paused && !force) return
      integrate(bodies, dt, G)
      if (ghost) integrate(ghost, dt, G)
      time += dt
      if (!ejected && maxComDistance(bodies) > current.scale * 6) ejected = true
    }

    // ── Auto-framing: keep the system centred + fit to view ──
    function updateView(dt: number) {
      const c = centerOfMass(bodies)
      let ext = 0
      for (const b of bodies) ext = Math.max(ext, Math.hypot(b.x - c.x, b.y - c.y))
      ext = Math.max(ext, current.scale * 0.4)
      const target = (0.42 * Math.min(renderer.W, renderer.H)) / (ext + 0.3)
      if (!viewInit) { view.cx = c.x; view.cy = c.y; view.scale = target; viewInit = true }
      else {
        const k = Math.min(1, dt * 2.2)
        view.cx += (c.x - view.cx) * k
        view.cy += (c.y - view.cy) * k
        view.scale += (target - view.scale) * Math.min(1, dt * 1.4)
      }
    }

    // ── Pointer: drag a body to perturb the system ──
    let dragIdx = -1
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2)
    function pick(cx: number, cy: number): number {
      const rect = canvas!.getBoundingClientRect()
      const sx = (cx - rect.left) * dpr(), sy = (cy - rect.top) * dpr()
      let best = -1, bestD = 26 * dpr()
      bodies.forEach((b, i) => {
        const px = renderer.W / 2 + (b.x - view.cx) * view.scale
        const py = renderer.H / 2 - (b.y - view.cy) * view.scale
        const d = Math.hypot(px - sx, py - sy)
        if (d < bestD) { bestD = d; best = i }
      })
      return best
    }
    function toWorld(cx: number, cy: number): [number, number] {
      const rect = canvas!.getBoundingClientRect()
      const sx = (cx - rect.left) * dpr(), sy = (cy - rect.top) * dpr()
      return [(sx - renderer.W / 2) / view.scale + view.cx, view.cy - (sy - renderer.H / 2) / view.scale]
    }
    const onDown = (e: PointerEvent) => { dragIdx = pick(e.clientX, e.clientY); if (dragIdx >= 0) canvas!.setPointerCapture(e.pointerId) }
    const onMove = (e: PointerEvent) => {
      if (dragIdx < 0) return
      const [wx, wy] = toWorld(e.clientX, e.clientY)
      const b = bodies[dragIdx]
      b.x = wx; b.y = wy; b.trail.length = 0
      ensureAccel(bodies, G)
    }
    const onUp = () => { dragIdx = -1 }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    // ── Loop ──
    let raf = 0, last = performance.now(), visible = true, statT = 0
    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      const s = settingsRef.current!
      let dt = (now - last) / 1000; last = now
      dt = Math.min(dt, 1 / 30)
      ensureGhost(s.chaosGhost)

      doSteps(dt * s.speed, false)
      updateView(dt)
      renderer.render(bodies, view, {
        showTrails: s.showTrails, showVectors: s.showVectors,
        showCom: s.showCom, showLabels: s.showLabels,
      }, ghost)

      statT += dt
      if (statT > 0.1) {
        statT = 0
        const E = totalEnergy(bodies, G)
        energyHistory.push(E)
        if (energyHistory.length > 120) energyHistory.shift()
        const div = ghost ? Math.hypot(bodies[0].x - ghost[0].x, bodies[0].y - ghost[0].y) : null
        onStats({
          time, energy: E, energy0,
          drift: energy0 !== 0 ? Math.abs((E - energy0) / energy0) * 100 : 0,
          ke: kineticEnergy(bodies), pe: potentialEnergy(bodies, G),
          momentum: momentum(bodies).mag, divergence: div, ejected,
          energyHistory: [...energyHistory],
        })
      }
    }
    raf = requestAnimationFrame(frame)
    setReady(true)

    const onResize = () => renderer.resize()
    const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) last = performance.now() }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(() => renderer.resize()); ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [canvasRef, settingsRef, onStats, onPreset])

  return { ready, actionsRef }
}
