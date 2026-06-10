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
  isHit, isCoinCollected,
  type ObstacleType,
} from '@/lib/subway-surfer/collision'
import { spawnRow as spawnRowLib, coinLane } from '@/lib/subway-surfer/spawn'
import { calcScore, loadHigh, saveHigh } from '@/lib/subway-surfer/score'
import { COINS_PER_ROW, COIN_SPACING, type GamePhase } from './types'

// ─── Pool sizes ───────────────────────────────────────────────────────────────
const POOL_OBST = 18
const POOL_COIN = 35

// ─── Scene constants ──────────────────────────────────────────────────────────
const HY_F  = 0.40   // horizon Y fraction
const BY_F  = 0.93   // road bottom Y fraction
const HHW_F = 0.022  // road half-width at horizon (fraction of W)
const BHW_F = 0.40   // road half-width at bottom  (fraction of W)

// ─── Internal types ───────────────────────────────────────────────────────────
interface AOb { active: boolean; z: number; lane: LaneIndex; type: ObstacleType }
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
  distance:     number
  speed:        number
  coins:        number
  score:        number
  nextSpawnAt:  number
  spawnSeed:    number
  scrollOffset: number
  obstacles:    AOb[]
  coinObjs:     ACo[]
}

function makeGS(): GS {
  return {
    phase: 'menu', lane: 1, laneX: 0, playerY: 0, playerVY: 0,
    isJumping: false, isRolling: false, rollTimer: 0,
    distance: 0, speed: 18, coins: 0, score: 0,
    nextSpawnAt: 22, spawnSeed: 0, scrollOffset: 0,
    obstacles: Array.from({ length: POOL_OBST }, () =>
      ({ active: false, z: 0, lane: 1 as LaneIndex, type: 'barrier' as ObstacleType })),
    coinObjs: Array.from({ length: POOL_COIN }, () =>
      ({ active: false, collected: false, z: 0, lane: 1 as LaneIndex })),
  }
}

// ─── Projection ───────────────────────────────────────────────────────────────
function proj(z: number, laneOff: number, W: number, H: number) {
  const HY  = H * HY_F,  BY  = H * BY_F
  const HHW = W * HHW_F, BHW = W * BHW_F
  const t = Math.min(1, Math.max(0, z / SPAWN_Z))
  const screenY = BY + (HY - BY) * t
  const roadHW  = BHW + (HHW - BHW) * t
  const screenX = W / 2 + laneOff * roadHW * (2 / 3)
  const scale   = Math.max(0, 1 - t * 0.97)
  return { screenX, screenY, scale, roadHW }
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const HY = H * HY_F
  ctx.fillStyle = '#08081a'
  ctx.fillRect(0, 0, W, H)

  const sky = ctx.createLinearGradient(0, 0, 0, HY)
  sky.addColorStop(0, '#050510')
  sky.addColorStop(1, '#160a2c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, HY)

  for (let i = 0; i < 55; i++) {
    const sx = ((i * 173 + 47) % 97) / 97 * W
    const sy = ((i * 251 + 13) % 61) / 61 * HY * 0.82
    ctx.fillStyle = `rgba(255,255,255,${0.22 + (i % 5) * 0.12})`
    ctx.beginPath()
    ctx.arc(sx, sy, 0.3 + (i % 4) * 0.22, 0, Math.PI * 2)
    ctx.fill()
  }

  const hg = ctx.createLinearGradient(0, HY - 22, 0, HY + 18)
  hg.addColorStop(0, 'transparent')
  hg.addColorStop(0.5, 'rgba(120,50,220,0.16)')
  hg.addColorStop(1, 'transparent')
  ctx.fillStyle = hg
  ctx.fillRect(0, HY - 22, W, 40)

  ctx.fillStyle = '#07070f'
  ctx.fillRect(0, HY, W, H - HY)
}

function drawRoad(ctx: CanvasRenderingContext2D, W: number, H: number, scrollOff: number) {
  const HY  = H * HY_F,  BY  = H * BY_F
  const HHW = W * HHW_F, BHW = W * BHW_F

  // Road bottom extension to screen edge
  ctx.fillStyle = '#141428'
  ctx.fillRect(W / 2 - BHW, BY, BHW * 2, H - BY)

  // Road surface
  const rg = ctx.createLinearGradient(W / 2, HY, W / 2, BY)
  rg.addColorStop(0, '#0c0c20')
  rg.addColorStop(1, '#18183a')
  ctx.fillStyle = rg
  ctx.beginPath()
  ctx.moveTo(W / 2 - HHW, HY)
  ctx.lineTo(W / 2 + HHW, HY)
  ctx.lineTo(W / 2 + BHW, BY)
  ctx.lineTo(W / 2 - BHW, BY)
  ctx.closePath()
  ctx.fill()

  // Edge glow lines
  ctx.shadowBlur = 14
  ctx.shadowColor = '#00e5ff'
  ctx.strokeStyle = '#00e5ff'
  ctx.lineWidth = 2.5
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(W / 2 + side * HHW, HY)
    ctx.lineTo(W / 2 + side * BHW, BY)
    ctx.stroke()
  }
  ctx.shadowBlur = 0

  // Lane dividers (animated dashes)
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.setLineDash([22, 26])
    ctx.lineDashOffset = -(scrollOff * 0.85) % 48
    ctx.strokeStyle = 'rgba(0,229,255,0.28)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(W / 2 + side * HHW / 3, HY)
    ctx.lineTo(W / 2 + side * BHW / 3, BY)
    ctx.stroke()
    ctx.restore()
  }

  // Subtle sheen strips
  for (let i = 1; i <= 5; i++) {
    const t = i / 6
    const sy = HY + (BY - HY) * t
    const hw = HHW + (BHW - HHW) * (1 - t)
    const a  = 0.04 - t * 0.03
    if (a > 0) {
      ctx.fillStyle = `rgba(0,229,255,${a})`
      ctx.fillRect(W / 2 - hw, sy, hw * 2, 1.5)
    }
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: AOb, W: number, H: number) {
  const { screenX, screenY, scale } = proj(o.z, LANE_OFFSETS[o.lane], W, H)
  if (scale <= 0.01) return

  const laneW    = W * BHW_F * 2 / 3
  const ow       = laneW * 0.88 * scale
  const barrierH = H * BY_F * 0.27
  const oh       = (o.type === 'barrier' ? barrierH : barrierH * 0.42) * scale
  const left     = screenX - ow / 2
  const top      = screenY - oh

  ctx.shadowBlur  = Math.max(0, 18 * scale)
  ctx.shadowColor = o.type === 'barrier' ? '#ff3300' : '#ff8800'

  const bg = ctx.createLinearGradient(left, top, left + ow, top)
  if (o.type === 'barrier') {
    bg.addColorStop(0, '#8b1000'); bg.addColorStop(0.5, '#cc2200'); bg.addColorStop(1, '#8b1000')
  } else {
    bg.addColorStop(0, '#7a4800'); bg.addColorStop(0.5, '#bb7700'); bg.addColorStop(1, '#7a4800')
  }
  ctx.fillStyle = bg
  ctx.fillRect(left, top, ow, oh)

  ctx.shadowBlur = 0

  // Top accent stripe
  ctx.fillStyle = o.type === 'barrier' ? '#ff5533' : '#ffaa44'
  ctx.fillRect(left, top, ow, Math.max(2, 4 * scale))

  // Warning stripes
  ctx.save()
  ctx.beginPath()
  ctx.rect(left, top, ow, oh)
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,255,0.11)'
  ctx.lineWidth = Math.max(1, 6 * scale)
  const sg = Math.max(4, 18 * scale)
  for (let x = left - oh; x < left + ow + oh; x += sg) {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + oh, top + oh); ctx.stroke()
  }
  ctx.restore()
}

function drawCoin(ctx: CanvasRenderingContext2D, c: ACo, W: number, H: number, t: number) {
  const { screenX, screenY, scale } = proj(c.z, LANE_OFFSETS[c.lane], W, H)
  if (scale <= 0.01) return

  const r    = W * 0.017 * scale
  const floY = Math.sin(t * 3 + c.z * 0.4) * 3 * scale
  const cx   = screenX
  const cy   = screenY - H * 0.072 * scale + floY

  ctx.shadowBlur = Math.max(0, 14 * scale); ctx.shadowColor = '#ffd700'
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd700'; ctx.fill()

  ctx.shadowBlur = 0
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2)
  ctx.fillStyle = '#ffaa00'; ctx.fill()

  ctx.beginPath(); ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill()
}

function drawPlayer(ctx: CanvasRenderingContext2D, gs: GS, W: number, H: number) {
  const BY   = H * BY_F
  const BHW  = W * BHW_F
  const JSCL = (BY - H * HY_F) * 0.115

  const screenX = W / 2 + gs.laneX * BHW * (2 / 3)
  const feetY   = BY - gs.playerY * JSCL

  const standH = H * 0.145, rollH = standH * 0.47
  const standW = W * 0.068, rollW = standW * 1.5
  const ph  = gs.isRolling ? rollH : standH
  const pw  = gs.isRolling ? rollW : standW
  const left = screenX - pw / 2
  const top  = feetY - ph

  // Ground shadow
  const sa = Math.max(0, 0.32 - gs.playerY * 0.045)
  ctx.save(); ctx.globalAlpha = sa
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.ellipse(screenX, BY + 2, pw * 0.62, 4.5, 0, 0, Math.PI * 2)
  ctx.fill(); ctx.restore()

  // Body
  ctx.shadowBlur = 22; ctx.shadowColor = '#00e5ff'
  const bg = ctx.createLinearGradient(left, top, left + pw, feetY)
  bg.addColorStop(0, '#33eeff'); bg.addColorStop(1, '#0077aa')
  ctx.fillStyle = bg
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(left, top, pw, ph, 5)
  else ctx.rect(left, top, pw, ph)
  ctx.fill()
  ctx.shadowBlur = 0

  // Left edge stripe
  ctx.fillStyle = '#00ffff'; ctx.fillRect(left, top, 3, ph)

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.26)'; ctx.fillRect(left + 5, top + 4, pw * 0.32, ph * 0.36)

  // Eyes (standing only)
  if (!gs.isRolling) {
    const ex = pw * 0.14, ey = pw * 0.14
    ctx.fillStyle = '#fff'
    ctx.fillRect(screenX - pw * 0.22, top + ph * 0.14, ex, ey)
    ctx.fillRect(screenX + pw * 0.07, top + ph * 0.14, ex, ey)
    ctx.fillStyle = '#003366'
    ctx.fillRect(screenX - pw * 0.18, top + ph * 0.16, ex * 0.5, ey * 0.5)
    ctx.fillRect(screenX + pw * 0.11, top + ph * 0.16, ex * 0.5, ey * 0.5)
  }
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, W: number, H: number, speed: number) {
  const t = Math.min(1, (speed - 28) / 16)
  ctx.save(); ctx.globalAlpha = t * 0.17; ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1
  const HY = H * HY_F
  for (let i = 0; i < 14; i++) {
    const x   = (i / 14) * W + W / 28
    const len = (14 + (i * 7) % 24) * t
    const y   = HY + (i * 19) % ((H - HY) * 0.55)
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y); ctx.stroke()
  }
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SubwaySurferGame() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const gsRef      = useRef<GS>(makeGS())
  const rafRef     = useRef<number>(0)
  const lastTRef   = useRef<number>(0)
  const frameRef   = useRef<number>(0)
  const timeRef    = useRef<number>(0)

  const [phase,      setPhase]      = useState<GamePhase>('menu')
  const [hudScore,   setHudScore]   = useState(0)
  const [hudCoins,   setHudCoins]   = useState(0)
  const [hudDist,    setHudDist]    = useState(0)
  const [finalScore, setFinalScore] = useState(0)
  const [highScore,  setHighScore]  = useState(0)

  const startGame = useCallback(() => {
    const s    = makeGS()
    s.phase    = 'playing'
    gsRef.current = s
    setPhase('playing'); setHudScore(0); setHudCoins(0); setHudDist(0)
    lastTRef.current = 0
  }, [])

  const pauseGame = useCallback(() => {
    if (gsRef.current.phase !== 'playing') return
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

    // ── Spawn helper ──────────────────────────────────────────────────────────
    function doSpawn(s: GS) {
      const row = spawnRowLib(s.spawnSeed)
      for (const ob of row.obstacles) {
        const slot = s.obstacles.find(o => !o.active)
        if (slot) { slot.active = true; slot.z = SPAWN_Z; slot.lane = ob.lane; slot.type = ob.type }
      }
      const cl = coinLane(s.spawnSeed)
      for (let i = 0; i < COINS_PER_ROW; i++) {
        const slot = s.coinObjs.find(c => !c.active)
        if (slot) {
          slot.active    = true
          slot.collected = false
          slot.z         = SPAWN_Z - 22 - i * COIN_SPACING
          slot.lane      = cl
        }
      }
      s.spawnSeed++
      s.nextSpawnAt += spawnIntervalAt(s.distance)
    }

    // ── Ramp-up pre-spawn ─────────────────────────────────────────────────────
    // Ensure obstacles are already in the pipeline when game starts
    function preSpawn(s: GS) {
      const row = spawnRowLib(s.spawnSeed)
      for (const ob of row.obstacles) {
        const slot = s.obstacles.find(o => !o.active)
        if (slot) { slot.active = true; slot.z = SPAWN_Z * 0.7; slot.lane = ob.lane; slot.type = ob.type }
      }
      s.spawnSeed++
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

      if (s.phase === 'playing') {
        s.speed = speedAtDistance(s.distance)

        // Lane lerp
        s.laneX = lerpLane(s.laneX, LANE_OFFSETS[s.lane], dt)

        // Jump
        if (s.isJumping) {
          const j = integrateJump(s.playerY, s.playerVY, dt)
          s.playerY = j.y; s.playerVY = j.vy
          if (j.landed) s.isJumping = false
        }

        // Roll
        if (s.isRolling) {
          s.rollTimer -= dt
          if (s.rollTimer <= 0) { s.isRolling = false; s.rollTimer = 0 }
        }

        // Advance world
        const dz = s.speed * dt
        s.distance     += dz
        s.scrollOffset += dz

        // Spawn
        if (s.distance >= s.nextSpawnAt) doSpawn(s)

        // Move objects
        for (const o of s.obstacles) if (o.active) o.z -= dz
        for (const c of s.coinObjs)  if (c.active && !c.collected) c.z -= dz

        // Collision — obstacle
        let dead = false
        for (const o of s.obstacles) {
          if (!o.active) continue
          if (isHit(s.lane, s.playerY, s.isRolling, o.lane, o.z, o.type)) { dead = true; break }
        }

        if (dead) {
          s.phase  = 'gameover'
          s.score  = calcScore(s.distance, s.coins)
          saveHigh(s.score)
          const hi = loadHigh()
          setPhase('gameover'); setFinalScore(s.score); setHighScore(hi)
        } else {
          // Coin collection
          for (const c of s.coinObjs) {
            if (!c.active || c.collected) continue
            if (isCoinCollected(s.lane, s.playerY, c.lane, c.z)) { c.collected = true; s.coins++ }
          }
          // Recycle
          for (const o of s.obstacles) if (o.active && o.z < RECYCLE_Z) o.active = false
          for (const c of s.coinObjs)  if (c.active && c.z < RECYCLE_Z) c.active = false

          s.score = calcScore(s.distance, s.coins)
          if (frameRef.current % 3 === 0) {
            setHudScore(s.score); setHudCoins(s.coins); setHudDist(Math.floor(s.distance))
          }
        }
      }

      // ── Draw ────────────────────────────────────────────────────────────────
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const W = canvas.width, H = canvas.height

        drawBackground(ctx, W, H)
        drawRoad(ctx, W, H, s.scrollOffset)

        // Painter's algorithm: sort by z (far first), interleave coins + obstacles
        const aC = s.coinObjs.filter(c => c.active && !c.collected).sort((a, b) => b.z - a.z)
        const aO = s.obstacles.filter(o => o.active).sort((a, b) => b.z - a.z)
        let ci = 0, oi = 0
        while (ci < aC.length || oi < aO.length) {
          const cz = ci < aC.length ? aC[ci].z : -Infinity
          const oz = oi < aO.length ? aO[oi].z : -Infinity
          if (cz >= oz) drawCoin(ctx, aC[ci++], W, H, timeRef.current)
          else          drawObstacle(ctx, aO[oi++], W, H)
        }

        drawPlayer(ctx, s, W, H)
        if (s.speed > 28) drawSpeedLines(ctx, W, H, s.speed)

        if (s.phase === 'paused') {
          ctx.fillStyle = 'rgba(0,0,0,0.45)'
          ctx.fillRect(0, 0, W, H)
          ctx.save()
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = '#fff'
          ctx.font = `900 ${Math.floor(W * 0.055)}px monospace`
          ctx.fillText('PAUSED', W / 2, H / 2)
          ctx.fillStyle = 'rgba(255,255,255,0.45)'
          ctx.font = `${Math.floor(W * 0.021)}px monospace`
          ctx.fillText('Press P · ESC · or tap to resume', W / 2, H / 2 + W * 0.065)
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

    // Suppress context menu on canvas long-press
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
    <div className="relative w-full h-screen overflow-hidden bg-[#08081a]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />
      <SubwayHUD
        score={hudScore} coins={hudCoins} distance={hudDist}
        phase={phase} onPause={pauseGame}
      />
      <SubwayMenu
        phase={phase} score={finalScore} highScore={highScore}
        onStart={startGame}
      />
    </div>
  )
}
