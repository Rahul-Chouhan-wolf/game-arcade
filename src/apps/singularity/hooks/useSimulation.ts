import { useEffect, useRef, useState } from 'react'
import { Renderer, type HoleRender } from '../render/renderer'
import { usePointer, type PointerHandlers } from './usePointer'
import {
  spawnBody, stepBodies, pruneDead, eventHorizon, packGravity, type BurstReq,
} from '../simulation/blackhole'
import { PARTICLE_SIDES, BH_FEED_PER_PARTICLE } from '../utils/constants'
import { hsv } from '../utils/math'
import type { Body, BodyKind, Settings, NebulaBurst } from '../types'

const MAX_SOURCES = 12

// Merges/collapses/tidal-disruptions paint a colourful expanding nebula.
// Three vivid, spread-out hues keep it luminous and never muddy.
function makeBurst(req: BurstReq): NebulaBurst {
  const base = Math.random()
  const m = Math.min(req.mass, 3.2)
  const big = req.kind === 'annihilation' || req.kind === 'collapse'
  let colors: NebulaBurst['colors']
  if (req.kind === 'tidal' && req.color) {
    colors = [req.color, hsv(base, 0.85, 1), hsv(base + 0.3, 0.9, 1)]
  } else if (big) {
    colors = [[1, 1, 1], hsv(base, 0.7, 1), hsv(base + 0.5, 0.85, 1)]
  } else {
    colors = [hsv(base, 0.85, 1), hsv(base + 0.16, 0.8, 1), hsv(base + 0.42, 0.9, 1)]
  }
  return {
    x: req.x, y: req.y, age: 0,
    life: (big ? 4.6 : 3.4) + m * 0.7,
    radius: (big ? 0.42 : 0.22) + m * 0.16,
    seed: Math.random() * 10,
    colors,
  }
}

export interface SimActions {
  reset(seed?: number): void
  randomSeed(): void
  screenshot(): void
}

export function useSimulation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  settingsRef: React.RefObject<Settings>,
  spawnKindRef: React.RefObject<BodyKind>,
) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const actionsRef = useRef<SimActions | null>(null)
  const handlersRef = useRef<PointerHandlers>(null as unknown as PointerHandlers)

  const density = settingsRef.current?.density ?? 'medium'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: Renderer
    try {
      renderer = new Renderer(canvas, PARTICLE_SIDES[settingsRef.current!.density])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL2 unavailable')
      return
    }

    let seed = (Math.random() * 1e9) | 0
    renderer.seed(seed)

    const bodies: Body[] = []
    const bursts: NebulaBurst[] = []
    let chaos = 0
    const drift: [number, number] = [0, 0]

    // Pointer → spawn the currently selected body kind and control it
    handlersRef.current = {
      spawn(x, y) { const b = spawnBody(spawnKindRef.current, x, y); bodies.push(b); return b.id },
      drag(id, x, y, speed) {
        const b = bodies.find(h => h.id === id)
        if (!b) return
        b.x = x; b.y = y
        if (b.kind === 'blackhole') {
          chaos = Math.min(1.5, chaos + speed * 0.04)
          b.mass += BH_FEED_PER_PARTICLE * speed * 60     // feed while dragging
        }
      },
      release(id) { const b = bodies.find(h => h.id === id); if (b) b.growing = false },
    }

    actionsRef.current = {
      reset(s) { bodies.length = 0; bursts.length = 0; seed = s ?? ((Math.random() * 1e9) | 0); renderer.seed(seed) },
      randomSeed() { bodies.length = 0; bursts.length = 0; seed = (Math.random() * 1e9) | 0; renderer.seed(seed) },
      screenshot() {
        const url = renderer.screenshot()
        const a = document.createElement('a')
        a.href = url; a.download = `singularity-${seed}.png`; a.click()
      },
    }

    let raf = 0
    let last = performance.now()
    let visible = true
    let resizePending = false
    let time = 0

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      const s = settingsRef.current!
      let dt = (now - last) / 1000
      last = now
      dt = Math.min(dt, 1 / 30)
      time += dt

      renderer.bloom = s.bloom
      renderer.lensing = s.lensing
      if (resizePending) { renderer.resize(); resizePending = false }

      chaos *= 0.94
      drift[0] = Math.sin(time * 0.03) * 0.02      // gentle cinematic camera drift
      drift[1] = Math.cos(time * 0.021) * 0.02

      // age + prune nebula bursts (keep evolving even while idle)
      for (let i = bursts.length - 1; i >= 0; i--) {
        bursts[i].age += dt
        if (bursts[i].age >= bursts[i].life) bursts.splice(i, 1)
      }

      if (!s.paused && !prefersReduced) {
        const { bursts: events } = stepBodies(bodies, dt)
        for (const ev of events) if (bursts.length < 14) bursts.push(makeBurst(ev))
        const live = pruneDead(bodies)
        bodies.length = 0; bodies.push(...live)
        const grav = packGravity(bodies, renderer.aspect, MAX_SOURCES)
        renderer.particles.step({
          bhData: grav.data, bhCount: grav.count,
          dt, time, aspect: renderer.aspect, chaos,
        })
      }

      const render: HoleRender[] = bodies.map(b => ({ ...b, w_horizon: eventHorizon(b) }))
      renderer.render(render, bursts, time, drift)
    }

    raf = requestAnimationFrame(frame)
    setReady(true)

    const onResize = () => { resizePending = true }
    const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) last = performance.now() }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    // ResizeObserver catches the initial layout + any container change reliably
    // (canvas.clientWidth can be stale on the first frame).
    const ro = new ResizeObserver(() => { resizePending = true })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      ro.disconnect()
      renderer.dispose()
    }
  }, [canvasRef, settingsRef, spawnKindRef, density])

  usePointer(canvasRef, handlersRef)

  return { ready, error, actionsRef }
}
