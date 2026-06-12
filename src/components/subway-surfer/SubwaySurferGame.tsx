"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { SubwayHUD, type HudPowerup } from './SubwayHUD'
import { SubwayMenu } from './SubwayMenu'
import {
  LANE_OFFSETS, SPAWN_Z, RECYCLE_Z,
  speedAtDistance, spawnIntervalAt,
  type LaneIndex,
} from '@/lib/subway-surfer/track'
import {
  integrateJump, lerpLane, ROLL_DURATION, PLAYER_STAND_H,
} from '@/lib/subway-surfer/physics'
import {
  isHit, isCoinCollected, OBSTACLE_LEN, COIN_Y,
  type ObstacleType,
} from '@/lib/subway-surfer/collision'
import { spawnRow as spawnRowLib } from '@/lib/subway-surfer/spawn'
import { coinPattern, skyLine } from '@/lib/subway-surfer/patterns'
import { calcScore, loadHigh, saveHigh, COIN_VALUE } from '@/lib/subway-surfer/score'
import {
  makePowerupState, tickPowerups, activate, isOn, multiplierOf,
  jumpVelocityFor, pickupTypeFor, POWERUP_DURATION,
  JETPACK_ALT, MAGNET_RANGE_Z,
  type PowerupState, type PowerupType,
} from '@/lib/subway-surfer/powerups'
import { type GamePhase } from './types'
import { ThreeScene, type ObSlot, type CoinSlot, type PickSlot } from './three-scene'

// ─── Pool sizes ───────────────────────────────────────────────────────────────
const POOL_OBST = 18
const POOL_COIN = 60
const POOL_PICK = 4

// Moving (oncoming) trains appear after this distance
const MOVING_TRAIN_FROM = 400

interface GS {
  phase:        GamePhase
  lane:         LaneIndex
  laneX:        number
  playerY:      number
  playerVY:     number
  isJumping:    boolean
  isRolling:    boolean
  jetFalling:   boolean      // descending after jetpack — collision grace
  rollTimer:    number
  runPhase:     number
  distance:     number
  speed:        number
  coins:        number
  score:        number
  bonus:        number       // extra points earned via the ×2 multiplier
  power:        PowerupState
  nextSpawnAt:  number
  nextPickupAt: number
  spawnSeed:    number
  scrollOffset: number
  crashT:       number
  dustT:        number
  lean:         number
  obstacles:    ObSlot[]
  coinObjs:     CoinSlot[]
  pickups:      PickSlot[]
}

function makeGS(): GS {
  return {
    phase: 'menu', lane: 1, laneX: 0, playerY: 0, playerVY: 0,
    isJumping: false, isRolling: false, jetFalling: false,
    rollTimer: 0, runPhase: 0,
    distance: 0, speed: 18, coins: 0, score: 0, bonus: 0,
    power: makePowerupState(),
    // Random seed base so every run gets a different obstacle/coin layout
    // (the generators themselves stay deterministic per seed for the tests)
    nextSpawnAt: 26, nextPickupAt: 60,
    spawnSeed: Math.floor(Math.random() * 100000), scrollOffset: 0,
    crashT: 0, dustT: 0, lean: 0,
    obstacles: Array.from({ length: POOL_OBST }, () =>
      ({ active: false, z: 0, lane: 1 as LaneIndex, type: 'barrier' as ObstacleType, colorId: 0, vz: 0 })),
    coinObjs: Array.from({ length: POOL_COIN }, () =>
      ({ active: false, z: 0, lane: 1 as LaneIndex, yw: 0 })),
    pickups: Array.from({ length: POOL_PICK }, () =>
      ({ active: false, z: 0, lane: 1 as LaneIndex, kind: 'magnet' as PowerupType })),
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SubwaySurferGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flashRef  = useRef<HTMLDivElement>(null)
  const gsRef     = useRef<GS>(makeGS())
  const sceneRef  = useRef<ThreeScene | null>(null)
  const rafRef    = useRef<number>(0)
  const lastTRef  = useRef<number>(0)
  const frameRef  = useRef<number>(0)
  const timeRef   = useRef<number>(0)

  const [phase,      setPhase]      = useState<GamePhase>('menu')
  const [hudScore,   setHudScore]   = useState(0)
  const [hudCoins,   setHudCoins]   = useState(0)
  const [hudDist,    setHudDist]    = useState(0)
  const [hudPowers,  setHudPowers]  = useState<HudPowerup[]>([])
  const [hudMult,    setHudMult]    = useState(1)
  const [finalScore, setFinalScore] = useState(0)
  const [finalCoins, setFinalCoins] = useState(0)
  const [highScore,  setHighScore]  = useState(0)

  useEffect(() => { setHighScore(loadHigh()) }, [])

  const startGame = useCallback(() => {
    const s = makeGS()
    s.phase = 'playing'
    gsRef.current = s
    setPhase('playing'); setHudScore(0); setHudCoins(0); setHudDist(0)
    setHudPowers([]); setHudMult(1)
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

    const scene = new ThreeScene(canvas)
    sceneRef.current = scene

    function resize() { scene.resize() }
    window.addEventListener('resize', resize)

    // ── Coin helpers ──────────────────────────────────────────────────────────
    function placeCoins(s: GS, specs: { lane: LaneIndex; dz: number; y: number }[], anchorZ: number) {
      for (const spec of specs) {
        const slot = s.coinObjs.find(c => !c.active)
        if (!slot) return
        slot.active = true
        slot.z      = anchorZ - spec.dz
        slot.lane   = spec.lane
        slot.yw     = spec.y
      }
    }

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
          // Some trains come at you with headlights on
          slot.vz = ob.type === 'train'
            && s.distance > MOVING_TRAIN_FROM
            && ((s.spawnSeed * 13 + ob.lane) % 10 < 3)
            ? 8 + ((s.spawnSeed * 5) % 8)
            : 0
          if (ob.type === 'train') hasTrain = true
        }
      }

      // Coins: sky lines while flying, rich ground patterns otherwise
      if (isOn(s.power, 'jetpack')) {
        const alt = JETPACK_ALT + PLAYER_STAND_H / 2 - COIN_Y
        placeCoins(s, skyLine(s.lane, alt), SPAWN_Z)
      } else {
        placeCoins(s, coinPattern(s.spawnSeed, row), SPAWN_Z)
      }

      // Occasional powerup pickup in a clear lane
      if (s.distance >= s.nextPickupAt) {
        const slot = s.pickups.find(p => !p.active)
        if (slot) {
          const cl = row.clearLanes[(s.spawnSeed * 3) % row.clearLanes.length]
          slot.active = true
          slot.z      = SPAWN_Z - 6
          slot.lane   = cl
          slot.kind   = pickupTypeFor(s.spawnSeed)
          s.nextPickupAt = s.distance + 180 + ((s.spawnSeed * 31) % 140)
        }
      }

      s.spawnSeed++
      s.nextSpawnAt += spawnIntervalAt(s.distance) + (hasTrain ? OBSTACLE_LEN.train * 0.75 : 0)
    }

    // ── Game loop ─────────────────────────────────────────────────────────────
    function loop(ts: number) {
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
        const hadJetpack = isOn(s.power, 'jetpack')
        tickPowerups(s.power, dt)
        const mult = multiplierOf(s.power)

        const prevLaneX = s.laneX
        s.laneX = lerpLane(s.laneX, LANE_OFFSETS[s.lane], dt)
        s.lean = Math.max(-1, Math.min(1, (s.laneX - prevLaneX) / Math.max(dt, 1e-4) / 9))

        // ── Vertical motion: jetpack flight > jump arc ──
        if (isOn(s.power, 'jetpack')) {
          s.playerY = Math.min(JETPACK_ALT, s.playerY + (JETPACK_ALT - s.playerY) * 4 * dt + 2 * dt)
          s.isJumping = false; s.isRolling = false; s.jetFalling = false
        } else if (hadJetpack) {
          // Jetpack just ran out — fall with collision grace until landing
          s.isJumping = true; s.playerVY = 0; s.jetFalling = true
        }
        if (s.isJumping) {
          const j = integrateJump(s.playerY, s.playerVY, dt)
          const wasAirborne = s.playerY > 0.3
          s.playerY = j.y; s.playerVY = j.vy
          if (j.landed) {
            s.isJumping = false
            s.jetFalling = false
            if (wasAirborne) scene.emitDust(s.laneX, 6)
          }
        }
        if (s.isRolling) {
          s.rollTimer -= dt
          if (s.rollTimer <= 0) { s.isRolling = false; s.rollTimer = 0 }
        }

        s.dustT -= dt
        if (s.dustT <= 0 && !s.isJumping && s.playerY < 0.2) {
          scene.emitDust(s.laneX)
          s.dustT = 0.09
        }

        // ── Advance world ──
        const dz = s.speed * dt
        s.distance     += dz
        s.scrollOffset += dz
        s.bonus        += (mult - 1) * (dz / 4)   // multiplier doubles distance points
        if (s.distance >= s.nextSpawnAt) doSpawn(s)

        for (const o of s.obstacles) if (o.active) o.z -= dz + o.vz * dt
        for (const c of s.coinObjs)  if (c.active) c.z -= dz
        for (const p of s.pickups)   if (p.active) p.z -= dz

        // ── Collision (skipped while flying or falling from flight) ──
        let dead = false
        if (!isOn(s.power, 'jetpack') && !s.jetFalling) {
          for (const o of s.obstacles) {
            if (!o.active) continue
            if (isHit(s.lane, s.playerY, s.isRolling, o.lane, o.z, o.type)) { dead = true; break }
          }
        }

        if (dead) {
          s.crashT = 0.65
          s.score = calcScore(s.distance, s.coins) + Math.floor(s.bonus)
        } else {
          // Coins — magnet pulls them in from any lane within range
          const magnet = isOn(s.power, 'magnet')
          for (const c of s.coinObjs) {
            if (!c.active) continue
            const grabbed = magnet
              ? (c.z < MAGNET_RANGE_Z && c.z > -1)
              : isCoinCollected(s.lane, s.playerY, c.lane, c.z, COIN_Y + c.yw)
            if (grabbed) {
              c.active = false              // free the slot immediately (pool never starves)
              s.coins++
              s.bonus += (mult - 1) * COIN_VALUE
              scene.emitSparks(c.lane, c.z, COIN_Y + c.yw)
            }
          }
          // Pickups
          for (const p of s.pickups) {
            if (!p.active) continue
            if (p.lane === s.lane && Math.abs(p.z) < 1.3 && s.playerY < 2.5) {
              p.active = false
              activate(s.power, p.kind)
              scene.emitSparks(p.lane, 0.4, 1.4, 12)
            }
          }
          // Recycle
          for (const o of s.obstacles)
            if (o.active && o.z + OBSTACLE_LEN[o.type] < RECYCLE_Z) o.active = false
          for (const c of s.coinObjs)
            if (c.active && c.z < RECYCLE_Z) c.active = false
          for (const p of s.pickups)
            if (p.active && p.z < RECYCLE_Z) p.active = false

          s.score = calcScore(s.distance, s.coins) + Math.floor(s.bonus)
          if (frameRef.current % 3 === 0) {
            setHudScore(s.score); setHudCoins(s.coins); setHudDist(Math.floor(s.distance))
            setHudMult(mult)
            const chips: HudPowerup[] = []
            for (const t of ['magnet', 'jetpack', 'multiplier', 'sneakers'] as PowerupType[]) {
              if (s.power[t] > 0) chips.push({ type: t, frac: s.power[t] / POWERUP_DURATION[t] })
            }
            setHudPowers(chips)
          }
        }
      } else if (s.phase === 'playing' && dying) {
        s.crashT -= dt
        if (s.crashT <= 0) {
          s.crashT = 0
          s.phase = 'gameover'
          saveHigh(s.score)
          setPhase('gameover'); setFinalScore(s.score); setFinalCoins(s.coins)
          setHighScore(loadHigh())
        }
      }

      // Crash flash overlay
      if (flashRef.current) {
        flashRef.current.style.opacity = dying ? String((s.crashT / 0.65) * 0.4) : '0'
      }

      scene.render({
        phase: s.phase,
        laneX: s.laneX,
        playerY: s.playerY,
        isJumping: s.isJumping || s.jetFalling,
        isRolling: s.isRolling,
        runPhase: s.runPhase,
        lean: s.lean,
        jetpack: isOn(s.power, 'jetpack'),
        magnet: isOn(s.power, 'magnet'),
        sneakers: isOn(s.power, 'sneakers'),
        speed: s.speed,
        scrollOffset: s.scrollOffset,
        crashT: s.crashT,
        obstacles: s.obstacles,
        coinObjs: s.coinObjs,
        pickups: s.pickups,
      }, dt, timeRef.current)

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    // ── Actions ───────────────────────────────────────────────────────────────
    function tryJump(s: GS) {
      if (s.isJumping || isOn(s.power, 'jetpack')) return
      s.isJumping = true
      s.playerVY = jumpVelocityFor(s.power)
      s.isRolling = false; s.rollTimer = 0
    }
    function tryRoll(s: GS) {
      if (s.isJumping || isOn(s.power, 'jetpack')) return
      s.isRolling = true; s.rollTimer = ROLL_DURATION
    }

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
          e.preventDefault(); tryJump(s); break
        case 'ArrowDown': case 's': case 'S': tryRoll(s); break
        case 'Escape': case 'p': case 'P': pauseGame(); break
      }
    }

    // ── Input — touch ─────────────────────────────────────────────────────────
    let tx = 0, ty = 0
    function onTouchStart(e: TouchEvent) { tx = e.touches[0].clientX; ty = e.touches[0].clientY }
    function onTouchEnd(e: TouchEvent) {
      const s = gsRef.current
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
        if (dy < 0) tryJump(s)
        else tryRoll(s)
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
      scene.dispose()
      sceneRef.current = null
    }
  }, [startGame, pauseGame, resumeGame])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#2f8fe0]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(20,12,40,0.3) 100%)' }}
      />
      {/* Crash flash */}
      <div
        ref={flashRef}
        className="absolute inset-0 pointer-events-none"
        style={{ background: '#ff2814', opacity: 0, transition: 'opacity 0.05s linear' }}
      />
      <SubwayHUD
        score={hudScore} coins={hudCoins} distance={hudDist}
        powerups={hudPowers} multiplier={hudMult}
        phase={phase} onPause={pauseGame}
      />
      <SubwayMenu
        phase={phase} score={finalScore} coins={finalCoins} highScore={highScore}
        onStart={startGame}
      />
    </div>
  )
}
