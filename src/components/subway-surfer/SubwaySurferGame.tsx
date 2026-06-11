"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { SubwayHUD } from './SubwayHUD'
import { SubwayMenu } from './SubwayMenu'
import {
  LANE_OFFSETS, SPAWN_Z, RECYCLE_Z,
  speedAtDistance, spawnIntervalAt,
  type LaneIndex,
} from '@/lib/subway-surfer/track'
import {
  integrateJump, lerpLane,
  JUMP_VELOCITY, ROLL_DURATION,
} from '@/lib/subway-surfer/physics'
import {
  isHit, isCoinCollected, OBSTACLE_LEN,
  type ObstacleType,
} from '@/lib/subway-surfer/collision'
import { spawnRow as spawnRowLib, coinLane } from '@/lib/subway-surfer/spawn'
import { calcScore, loadHigh, saveHigh } from '@/lib/subway-surfer/score'
import { COINS_PER_ROW, COIN_SPACING, type GamePhase } from './types'
import {
  makeView, drawSky, drawWorld, drawTrain, drawBarrier, drawLowbar,
  drawCoin, drawRunner, drawParticles, stepParticles,
  drawSpeedStreaks, drawVignette,
  LANE_W, type Particle,
} from './scene'

// ─── Pool sizes ───────────────────────────────────────────────────────────────
const POOL_OBST = 18
const POOL_COIN = 35

// ─── Internal types ───────────────────────────────────────────────────────────
interface AOb { active: boolean; z: number; lane: LaneIndex; type: ObstacleType; colorId: number }
interface ACo { active: boolean; collected: boolean; z: number; lane: LaneIndex }

interface GS {
  phase:        GamePhase
  lane:         LaneIndex
  laneX:        number
  playerY:      number
  playerVY:     number
  isJumping:    boolean
  isRolling:    boolean
  rollTimer:    number
  runPhase:     number
  distance:     number
  speed:        number
  coins:        number
  score:        number
  nextSpawnAt:  number
  spawnSeed:    number
  scrollOffset: number
  crashT:       number       // crash animation countdown; >0 = dying
  dustT:        number       // running-dust emit timer
  obstacles:    AOb[]
  coinObjs:     ACo[]
  particles:    Particle[]
}

function makeGS(): GS {
  return {
    phase: 'menu', lane: 1, laneX: 0, playerY: 0, playerVY: 0,
    isJumping: false, isRolling: false, rollTimer: 0, runPhase: 0,
    distance: 0, speed: 18, coins: 0, score: 0,
    nextSpawnAt: 26, spawnSeed: 0, scrollOffset: 0,
    crashT: 0, dustT: 0,
    obstacles: Array.from({ length: POOL_OBST }, () =>
      ({ active: false, z: 0, lane: 1 as LaneIndex, type: 'barrier' as ObstacleType, colorId: 0 })),
    coinObjs: Array.from({ length: POOL_COIN }, () =>
      ({ active: false, collected: false, z: 0, lane: 1 as LaneIndex })),
    particles: [],
  }
}

function emitDust(s: GS, count: number, spread = 0.3) {
  for (let i = 0; i < count; i++) {
    if (s.particles.length > 90) return
    s.particles.push({
      xw: s.laneX * LANE_W + (Math.random() - 0.5) * spread * 2,
      yw: 0.05, z: 0.4 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 1.2, vy: 0.6 + Math.random() * 1.4,
      life: 0.35 + Math.random() * 0.3, maxLife: 0.6,
      size: 2.5 + Math.random() * 2.5, kind: 'dust',
    })
  }
}

function emitSparks(s: GS, lane: LaneIndex, z: number) {
  for (let i = 0; i < 7; i++) {
    if (s.particles.length > 110) return
    s.particles.push({
      xw: lane === 1 ? 0 : (lane === 0 ? -LANE_W : LANE_W),
      yw: 1.2, z,
      vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3,
      life: 0.3 + Math.random() * 0.25, maxLife: 0.5,
      size: 2 + Math.random() * 2, kind: 'spark',
    })
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SubwaySurferGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef     = useRef<GS>(makeGS())
  const rafRef    = useRef<number>(0)
  const lastTRef  = useRef<number>(0)
  const frameRef  = useRef<number>(0)
  const timeRef   = useRef<number>(0)

  const [phase,      setPhase]      = useState<GamePhase>('menu')
  const [hudScore,   setHudScore]   = useState(0)
  const [hudCoins,   setHudCoins]   = useState(0)
  const [hudDist,    setHudDist]    = useState(0)
  const [finalScore, setFinalScore] = useState(0)
  const [finalCoins, setFinalCoins] = useState(0)
  const [highScore,  setHighScore]  = useState(0)

  useEffect(() => { setHighScore(loadHigh()) }, [])

  const startGame = useCallback(() => {
    const s = makeGS()
    s.phase = 'playing'
    gsRef.current = s
    setPhase('playing'); setHudScore(0); setHudCoins(0); setHudDist(0)
    lastTRef.current = 0
  }, [])

  const pauseGame = useCallback(() => {
    if (gsRef.current.phase !== 'playing' || gsRef.current.crashT > 0) return
    gsRef.current.phase = 'paused'; setPhase('paused')
  }, [])

  const resumeGame = useCallback(() => {
    if (gsRef.current.phase !== 'paused') return
    gsRef.current.phase = 'playing'; setPhase('playing'); lastTRef.current = 0
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      if (!canvas) return
      canvas.width  = canvas.clientWidth  || window.innerWidth
      canvas.height = canvas.clientHeight || window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Spawning ──────────────────────────────────────────────────────────────
    function doSpawn(s: GS) {
      const row = spawnRowLib(s.spawnSeed)
      let hasTrain = false
      for (const ob of row.obstacles) {
        const slot = s.obstacles.find(o => !o.active)
        if (slot) {
          slot.active  = true
          slot.z       = SPAWN_Z
          slot.lane    = ob.lane
          slot.type    = ob.type
          slot.colorId = (s.spawnSeed * 7 + ob.lane * 3) % 4
          if (ob.type === 'train') hasTrain = true
        }
      }
      // Coin trail in the clear lane, running up to the row (never overlapping
      // the previous row, which is at least one spawn interval closer)
      const cl = coinLane(s.spawnSeed)
      for (let i = 0; i < COINS_PER_ROW; i++) {
        const slot = s.coinObjs.find(c => !c.active)
        if (slot) {
          slot.active    = true
          slot.collected = false
          slot.z         = SPAWN_Z - 2 - i * COIN_SPACING
          slot.lane      = cl
        }
      }
      s.spawnSeed++
      // Trains are long — leave extra room before the next row
      s.nextSpawnAt += spawnIntervalAt(s.distance) + (hasTrain ? OBSTACLE_LEN.train * 0.75 : 0)
    }

    // ── Game loop ─────────────────────────────────────────────────────────────
    function loop(ts: number) {
      if (!canvas) return
      const dt = lastTRef.current === 0 ? 0.016
        : Math.min((ts - lastTRef.current) / 1000, 0.05)
      lastTRef.current = ts
      timeRef.current += dt
      frameRef.current++

      const s = gsRef.current
      const dying = s.crashT > 0

      if (s.phase === 'playing' && !dying) {
        s.speed = speedAtDistance(s.distance)
        s.runPhase += dt * (7 + s.speed * 0.38)

        const prevLaneX = s.laneX
        s.laneX = lerpLane(s.laneX, LANE_OFFSETS[s.lane], dt)
        const lean = (s.laneX - prevLaneX) / Math.max(dt, 1e-4) / 9   // -1..1

        if (s.isJumping) {
          const j = integrateJump(s.playerY, s.playerVY, dt)
          const wasAirborne = s.playerY > 0.3
          s.playerY = j.y; s.playerVY = j.vy
          if (j.landed) {
            s.isJumping = false
            if (wasAirborne) emitDust(s, 6, 0.5)   // landing puff
          }
        }
        if (s.isRolling) {
          s.rollTimer -= dt
          if (s.rollTimer <= 0) { s.isRolling = false; s.rollTimer = 0 }
        }

        // Running dust
        s.dustT -= dt
        if (s.dustT <= 0 && !s.isJumping) {
          emitDust(s, 1)
          s.dustT = 0.09
        }

        // Advance world
        const dz = s.speed * dt
        s.distance     += dz
        s.scrollOffset += dz
        if (s.distance >= s.nextSpawnAt) doSpawn(s)

        for (const o of s.obstacles) if (o.active) o.z -= dz
        for (const c of s.coinObjs)  if (c.active && !c.collected) c.z -= dz
        stepParticles(s.particles, dt, dz)

        // Collision
        let dead = false
        for (const o of s.obstacles) {
          if (!o.active) continue
          if (isHit(s.lane, s.playerY, s.isRolling, o.lane, o.z, o.type)) { dead = true; break }
        }

        if (dead) {
          s.crashT = 0.65
          s.score = calcScore(s.distance, s.coins)
        } else {
          for (const c of s.coinObjs) {
            if (!c.active || c.collected) continue
            if (isCoinCollected(s.lane, s.playerY, c.lane, c.z)) {
              c.collected = true
              s.coins++
              emitSparks(s, c.lane, c.z)
            }
          }
          for (const o of s.obstacles)
            if (o.active && o.z + OBSTACLE_LEN[o.type] < RECYCLE_Z) o.active = false
          for (const c of s.coinObjs)
            if (c.active && c.z < RECYCLE_Z) c.active = false

          s.score = calcScore(s.distance, s.coins)
          if (frameRef.current % 3 === 0) {
            setHudScore(s.score); setHudCoins(s.coins); setHudDist(Math.floor(s.distance))
          }
        }

        // Stash lean for the renderer
        ;(s as GS & { _lean?: number })._lean = Math.max(-1, Math.min(1, lean))
      } else if (s.phase === 'playing' && dying) {
        s.crashT -= dt
        stepParticles(s.particles, dt, 0)
        if (s.crashT <= 0) {
          s.crashT = 0
          s.phase = 'gameover'
          saveHigh(s.score)
          const hi = loadHigh()
          setPhase('gameover'); setFinalScore(s.score); setFinalCoins(s.coins); setHighScore(hi)
        }
      }

      // ── Draw ────────────────────────────────────────────────────────────────
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const v = makeView(canvas.width, canvas.height)
        const t = timeRef.current

        ctx.save()
        // Crash shake
        if (dying) {
          const k = s.crashT / 0.65
          ctx.translate((Math.random() - 0.5) * 16 * k, (Math.random() - 0.5) * 12 * k)
        }

        drawSky(ctx, v, t)
        drawWorld(ctx, v, s.scrollOffset)

        // Depth-sorted scene objects (far → near)
        type Drawable = { z: number; draw: () => void }
        const items: Drawable[] = []
        for (const o of s.obstacles) {
          if (!o.active) continue
          const oo = o
          if (oo.type === 'train')
            items.push({ z: oo.z + OBSTACLE_LEN.train, draw: () => drawTrain(ctx, v, LANE_OFFSETS[oo.lane], oo.z, OBSTACLE_LEN.train, oo.colorId) })
          else if (oo.type === 'barrier')
            items.push({ z: oo.z, draw: () => drawBarrier(ctx, v, LANE_OFFSETS[oo.lane], oo.z) })
          else
            items.push({ z: oo.z, draw: () => drawLowbar(ctx, v, LANE_OFFSETS[oo.lane], oo.z, t) })
        }
        for (const c of s.coinObjs) {
          if (!c.active || c.collected) continue
          const cc = c
          items.push({ z: cc.z, draw: () => drawCoin(ctx, v, LANE_OFFSETS[cc.lane], cc.z, t) })
        }
        items.sort((a, b) => b.z - a.z)
        for (const it of items) it.draw()

        if (s.phase !== 'menu') {
          drawRunner(ctx, v, {
            laneX: s.laneX,
            playerY: s.playerY,
            isRolling: s.isRolling,
            isJumping: s.isJumping,
            runPhase: s.runPhase,
            lean: (s as GS & { _lean?: number })._lean ?? 0,
          })
        }

        drawParticles(ctx, v, s.particles)
        if (s.phase === 'playing' && !dying) drawSpeedStreaks(ctx, v, s.speed, t)
        drawVignette(ctx, v)

        // Crash flash
        if (dying) {
          ctx.fillStyle = `rgba(255,40,20,${(s.crashT / 0.65) * 0.28})`
          ctx.fillRect(-20, -20, v.W + 40, v.H + 40)
        }

        ctx.restore()

        if (s.phase === 'paused') {
          ctx.fillStyle = 'rgba(8,12,24,0.55)'
          ctx.fillRect(0, 0, v.W, v.H)
          ctx.save()
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = '#fff'
          ctx.font = `900 ${Math.floor(v.W * 0.05)}px system-ui, sans-serif`
          ctx.fillText('PAUSED', v.W / 2, v.H / 2)
          ctx.fillStyle = 'rgba(255,255,255,0.55)'
          ctx.font = `600 ${Math.floor(v.W * 0.016)}px system-ui, sans-serif`
          ctx.fillText('Press P · ESC · or tap to resume', v.W / 2, v.H / 2 + v.W * 0.05)
          ctx.restore()
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    // ── Input — keyboard ──────────────────────────────────────────────────────
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return
      const s = gsRef.current
      if (s.crashT > 0) return
      if (s.phase === 'menu' || s.phase === 'gameover') {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); startGame() }
        return
      }
      if (s.phase === 'paused') {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') resumeGame()
        return
      }
      switch (e.key) {
        case 'ArrowLeft':  case 'a': case 'A': if (s.lane > 0) s.lane = (s.lane - 1) as LaneIndex; break
        case 'ArrowRight': case 'd': case 'D': if (s.lane < 2) s.lane = (s.lane + 1) as LaneIndex; break
        case 'ArrowUp': case 'w': case 'W': case ' ':
          e.preventDefault()
          if (!s.isJumping) { s.isJumping = true; s.playerVY = JUMP_VELOCITY; s.isRolling = false; s.rollTimer = 0 }
          break
        case 'ArrowDown': case 's': case 'S':
          if (!s.isJumping) { s.isRolling = true; s.rollTimer = ROLL_DURATION }
          break
        case 'Escape': case 'p': case 'P': pauseGame(); break
      }
    }

    // ── Input — touch ─────────────────────────────────────────────────────────
    let tx = 0, ty = 0
    function onTouchStart(e: TouchEvent) { tx = e.touches[0].clientX; ty = e.touches[0].clientY }
    function onTouchEnd(e: TouchEvent) {
      const s   = gsRef.current
      if (s.crashT > 0) return
      const dx  = e.changedTouches[0].clientX - tx
      const dy  = e.changedTouches[0].clientY - ty
      const adx = Math.abs(dx), ady = Math.abs(dy)

      if (adx < 14 && ady < 14) {
        if (s.phase === 'menu' || s.phase === 'gameover') startGame()
        else if (s.phase === 'playing') pauseGame()
        else if (s.phase === 'paused') resumeGame()
        return
      }
      if (s.phase !== 'playing') return
      if (adx > ady && adx > 35) {
        if (dx > 0) { if (s.lane < 2) s.lane = (s.lane + 1) as LaneIndex }
        else        { if (s.lane > 0) s.lane = (s.lane - 1) as LaneIndex }
      } else if (ady > adx && ady > 35) {
        if (dy < 0) {
          if (!s.isJumping) { s.isJumping = true; s.playerVY = JUMP_VELOCITY; s.isRolling = false; s.rollTimer = 0 }
        } else {
          if (!s.isJumping) { s.isRolling = true; s.rollTimer = ROLL_DURATION }
        }
      }
    }

    window.addEventListener('keydown', onKey)
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    canvas.addEventListener('contextmenu', e => e.preventDefault())

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [startGame, pauseGame, resumeGame])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#2f8fe0]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />
      <SubwayHUD
        score={hudScore} coins={hudCoins} distance={hudDist}
        phase={phase} onPause={pauseGame}
      />
      <SubwayMenu
        phase={phase} score={finalScore} coins={finalCoins} highScore={highScore}
        onStart={startGame}
      />
    </div>
  )
}
