import { useEffect, useRef, useState } from 'react'
import { Renderer, type HoleRender } from '../render/renderer'
import { usePointer, type PointerHandlers } from './usePointer'
import {
  spawnBlackHole, stepBlackHoles, pruneDead, horizonOf,
} from '../simulation/blackhole'
import { PARTICLE_SIDES, BH_FEED_PER_PARTICLE } from '../utils/constants'
import { hsv } from '../utils/math'
import type { BlackHole, Settings, NebulaBurst } from '../types'

// A merge/collapse paints a colourful expanding nebula. Three vivid, spread-out
// hues keep it luminous and never muddy.
function makeBurst(x: number, y: number, mass: number): NebulaBurst {
  const base = Math.random()
  const m = Math.min(mass, 3.2)
  return {
    x, y, age: 0,
    life: 3.4 + m * 0.7,
    radius: 0.22 + m * 0.16,
    seed: Math.random() * 10,
    colors: [hsv(base, 0.85, 1), hsv(base + 0.16, 0.8, 1), hsv(base + 0.42, 0.9, 1)],
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

    const holes: BlackHole[] = []
    const bursts: NebulaBurst[] = []
    let chaos = 0
    const drift: [number, number] = [0, 0]

    // Pointer → black-hole control
    handlersRef.current = {
      spawn(x, y) { const b = spawnBlackHole(x, y); holes.push(b); return b.id },
      drag(id, x, y, speed) {
        const b = holes.find(h => h.id === id)
        if (!b) return
        b.x = x; b.y = y
        chaos = Math.min(1.5, chaos + speed * 0.04)
        // feeding scales with how fast you drag through matter
        b.mass += BH_FEED_PER_PARTICLE * speed * 60
      },
      release(id) { const b = holes.find(h => h.id === id); if (b) b.growing = false },
    }

    actionsRef.current = {
      reset(s) { holes.length = 0; seed = s ?? ((Math.random() * 1e9) | 0); renderer.seed(seed) },
      randomSeed() { holes.length = 0; seed = (Math.random() * 1e9) | 0; renderer.seed(seed) },
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
      // gentle camera drift for a living, cinematic feel
      drift[0] = Math.sin(time * 0.03) * 0.02
      drift[1] = Math.cos(time * 0.021) * 0.02

      // age + prune nebula bursts (they keep evolving even when paused-idle)
      for (let i = bursts.length - 1; i >= 0; i--) {
        bursts[i].age += dt
        if (bursts[i].age >= bursts[i].life) bursts.splice(i, 1)
      }

      if (!s.paused && !prefersReduced) {
        const { merged, exploded } = stepBlackHoles(holes, dt)
        for (const m of merged) if (bursts.length < 12) bursts.push(makeBurst(m.x, m.y, m.mass))
        for (const e of exploded) if (bursts.length < 12) bursts.push(makeBurst(e.x, e.y, e.mass * 1.4))
        const live = pruneDead(holes)
        holes.length = 0; holes.push(...live)
        renderer.particles.step({
          bhData: pack(holes).data,
          bhCount: pack(holes).count,
          dt, time, aspect: renderer.aspect, chaos,
        })
      }

      const render: HoleRender[] = holes.map(b => ({ ...b, w_horizon: horizonOf(b) }))
      renderer.render(render, bursts, time, drift)
    }

    // local packer (avoids importing for the hot path twice)
    function pack(hs: BlackHole[]) {
      const data = new Float32Array(24)
      const count = Math.min(hs.length, 6)
      for (let i = 0; i < count; i++) {
        data[i * 4] = hs[i].x * renderer.aspect
        data[i * 4 + 1] = hs[i].y
        data[i * 4 + 2] = hs[i].mass
        data[i * 4 + 3] = horizonOf(hs[i])
      }
      return { data, count }
    }

    raf = requestAnimationFrame(frame)
    setReady(true)

    const onResize = () => { resizePending = true }
    const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) last = performance.now() }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      renderer.dispose()
    }
  }, [canvasRef, settingsRef, density])

  usePointer(canvasRef, handlersRef)

  return { ready, error, actionsRef }
}
