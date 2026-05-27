"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion } from "motion/react"
import { ArrowLeft, RotateCcw, Volume2, VolumeX, ChevronRight } from "lucide-react"
import Link from "next/link"
import {
  TILE, TileType,
  type GameState, type InputState, type Level,
  createGameState, createPlayer, updateGame, parseLevel, isTouchingWall,
  spawnCheckpointParticles,
} from "@/lib/neon-devil/engine"
import { LEVELS } from "@/lib/neon-devil/levels"
import * as audio from "@/lib/neon-devil/audio"

// ═══════════════════════════════════════════════════════════════════════════
// Neon Devil — Canvas Renderer & Game Component
// ═══════════════════════════════════════════════════════════════════════════

// ── Render constants ──────────────────────────────────────────────────────

const SCANLINE_ALPHA = 0.04
const BLOOM_PASSES = 2

// Cyberpunk color palette
const COLORS = {
  solid:      '#1a1a2e',
  solidEdge:  '#2a2a4a',
  spike:      '#ff2d87',
  checkpoint: '#2dd4bf',
  checkpointActive: '#22d3ee',
  exit:       '#fbbf24',
  collapse:   '#ff6b35',
  fakeSolid:  '#1a1a2e', // looks like solid
  bounce:     '#4ade80',
  laser:      '#ef4444',
  laserOff:   '#3a1010',
  conveyor:   '#818cf8',
  ice:        '#67e8f9',
  trampoline: '#c084fc',
  hazard:     '#dc2626',
  player:     '#ffffff',
  playerGlow: '#ff2d87',
  trail:      '#ff2d87',
}

// ── Tile Renderer ─────────────────────────────────────────────────────────

function drawTile(
  ctx: CanvasRenderingContext2D,
  type: TileType,
  x: number, y: number,
  time: number,
  level: Level,
): void {
  const s = TILE

  switch (type) {
    case TileType.Solid:
      ctx.fillStyle = COLORS.solid
      ctx.fillRect(x, y, s, s)
      // Edge highlights
      ctx.strokeStyle = COLORS.solidEdge
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
      break

    case TileType.Spike:
      ctx.fillStyle = COLORS.spike
      ctx.beginPath()
      ctx.moveTo(x + s / 2, y + 4)
      ctx.lineTo(x + s - 3, y + s)
      ctx.lineTo(x + 3, y + s)
      ctx.closePath()
      ctx.fill()
      // Glow
      ctx.shadowColor = COLORS.spike
      ctx.shadowBlur = 6
      ctx.fill()
      ctx.shadowBlur = 0
      break

    case TileType.Checkpoint: {
      const pulse = 0.7 + 0.3 * Math.sin(time * 3)
      ctx.fillStyle = COLORS.checkpoint
      ctx.globalAlpha = pulse
      ctx.fillRect(x + s / 2 - 2, y + 4, 4, s - 8)
      ctx.fillRect(x + s / 2 - 1, y + 4, 8, 6)
      ctx.globalAlpha = 1
      break
    }

    case TileType.Exit: {
      const pulse = 0.6 + 0.4 * Math.sin(time * 4)
      ctx.fillStyle = COLORS.exit
      ctx.shadowColor = COLORS.exit
      ctx.shadowBlur = 10 * pulse
      ctx.fillRect(x + 4, y + 4, s - 8, s - 8)
      ctx.shadowBlur = 0
      // Door shape
      ctx.fillStyle = '#0a0014'
      ctx.fillRect(x + 8, y + 8, s - 16, s - 8)
      break
    }

    case TileType.Collapse:
      ctx.fillStyle = COLORS.collapse
      ctx.globalAlpha = 0.7
      ctx.fillRect(x, y, s, s)
      ctx.globalAlpha = 1
      // Crack lines
      ctx.strokeStyle = '#ff8c42'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + 4, y + s / 2)
      ctx.lineTo(x + s / 2, y + 4)
      ctx.lineTo(x + s - 4, y + s / 2)
      ctx.stroke()
      break

    case TileType.FakeSolid:
      // Looks exactly like solid
      ctx.fillStyle = COLORS.fakeSolid
      ctx.fillRect(x, y, s, s)
      ctx.strokeStyle = COLORS.solidEdge
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
      // Subtle tell — very faint difference only visible if you look closely
      ctx.fillStyle = 'rgba(255,45,135,0.03)'
      ctx.fillRect(x, y, s, s)
      break

    case TileType.Bounce:
      ctx.fillStyle = COLORS.solid
      ctx.fillRect(x, y, s, s)
      // Spring pad on top
      ctx.fillStyle = COLORS.bounce
      ctx.fillRect(x + 2, y, s - 4, 4)
      ctx.shadowColor = COLORS.bounce
      ctx.shadowBlur = 4
      ctx.fillRect(x + 2, y, s - 4, 4)
      ctx.shadowBlur = 0
      break

    case TileType.LaserH:
    case TileType.LaserV:
      ctx.fillStyle = '#1a0a0a'
      ctx.fillRect(x, y, s, s)
      // Emitter dot
      ctx.fillStyle = COLORS.laser
      ctx.beginPath()
      ctx.arc(x + s / 2, y + s / 2, 4, 0, Math.PI * 2)
      ctx.fill()
      break

    case TileType.Conveyor: {
      ctx.fillStyle = COLORS.solid
      ctx.fillRect(x, y, s, s)
      // Animated arrows
      ctx.fillStyle = COLORS.conveyor
      const offset = (time * 40) % 16
      for (let ax = 0; ax < s; ax += 16) {
        const px = x + ax + offset
        if (px < x + s) {
          ctx.fillRect(px, y + s / 2 - 1, 6, 2)
        }
      }
      break
    }

    case TileType.Ice:
      ctx.fillStyle = '#0a1a2e'
      ctx.fillRect(x, y, s, s)
      ctx.fillStyle = COLORS.ice
      ctx.globalAlpha = 0.15
      ctx.fillRect(x, y, s, s)
      ctx.globalAlpha = 1
      // Shine
      ctx.strokeStyle = COLORS.ice
      ctx.globalAlpha = 0.3
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + 4, y + 4)
      ctx.lineTo(x + 12, y + 4)
      ctx.stroke()
      ctx.globalAlpha = 1
      break

    case TileType.Trampoline:
      ctx.fillStyle = COLORS.solid
      ctx.fillRect(x, y, s, s)
      ctx.fillStyle = COLORS.trampoline
      ctx.fillRect(x + 2, y, s - 4, 5)
      ctx.shadowColor = COLORS.trampoline
      ctx.shadowBlur = 6
      ctx.fillRect(x + 2, y, s - 4, 5)
      ctx.shadowBlur = 0
      break

    case TileType.Hazard: {
      const flash = 0.5 + 0.5 * Math.sin(time * 6)
      ctx.fillStyle = COLORS.hazard
      ctx.globalAlpha = 0.4 + 0.3 * flash
      ctx.fillRect(x, y, s, s)
      ctx.globalAlpha = 1
      break
    }
  }
}

// ── Full Frame Render ─────────────────────────────────────────────────────

function render(
  ctx: CanvasRenderingContext2D,
  gs: GameState,
  canvasW: number,
  canvasH: number,
  time: number,
): void {
  const { player, level, camera, cameraShake, particles } = gs
  const { grid, width: gw, height: gh, lasers, collapsingTiles, movingPlatforms, checkpoints } = level

  // ── Background gradient ──
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH)
  grad.addColorStop(0, level.bgColor1)
  grad.addColorStop(1, level.bgColor2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvasW, canvasH)

  // ── Background grid pattern ──
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'
  ctx.lineWidth = 1
  const gridSpacing = 48
  const bgOffsetX = (-camera.x * 0.3) % gridSpacing
  const bgOffsetY = (-camera.y * 0.3) % gridSpacing
  for (let x = bgOffsetX; x < canvasW; x += gridSpacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke()
  }
  for (let y = bgOffsetY; y < canvasH; y += gridSpacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke()
  }

  // ── Camera transform ──
  ctx.save()
  const camX = Math.round(camera.x + cameraShake.offsetX - canvasW / 2)
  const camY = Math.round(camera.y + cameraShake.offsetY - canvasH / 2)
  ctx.translate(-camX, -camY)

  // ── Tiles ──
  // Only render visible tiles
  const startCol = Math.max(0, Math.floor(camX / TILE))
  const endCol   = Math.min(gw, Math.ceil((camX + canvasW) / TILE) + 1)
  const startRow = Math.max(0, Math.floor(camY / TILE))
  const endRow   = Math.min(gh, Math.ceil((camY + canvasH) / TILE) + 1)

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const tile = grid[r]?.[c]
      if (tile === undefined || tile === TileType.Empty || tile === TileType.Decor) continue

      // Check if collapse tile is collapsed
      if (tile === TileType.Collapse) {
        const ct = collapsingTiles.find(ct => ct.col === c && ct.row === r)
        if (ct?.collapsed) {
          // Draw crumbling particles
          ctx.fillStyle = COLORS.collapse
          ctx.globalAlpha = 0.3
          ctx.fillRect(c * TILE + 4, r * TILE + 4, 6, 4)
          ctx.fillRect(c * TILE + 18, r * TILE + 12, 5, 3)
          ctx.globalAlpha = 1
          continue
        }
        // Shaking if timer is ticking down
        if (ct && ct.timer < TILE) {
          const shake = (1 - ct.timer / 0.35) * 3
          ctx.save()
          ctx.translate(
            (Math.random() - 0.5) * shake,
            (Math.random() - 0.5) * shake
          )
          drawTile(ctx, tile, c * TILE, r * TILE, time, level)
          ctx.restore()
          continue
        }
      }

      // Activated checkpoints glow differently
      if (tile === TileType.Checkpoint) {
        const cp = checkpoints.find(cp =>
          Math.abs(cp.x - (c * TILE + TILE / 2)) < 1 &&
          Math.abs(cp.y - (r * TILE + TILE / 2)) < 1
        )
        if (cp?.active) {
          const pulse = 0.7 + 0.3 * Math.sin(time * 4)
          ctx.fillStyle = COLORS.checkpointActive
          ctx.shadowColor = COLORS.checkpointActive
          ctx.shadowBlur = 12 * pulse
          ctx.fillRect(c * TILE + TILE / 2 - 2, r * TILE + 2, 4, TILE - 4)
          ctx.fillRect(c * TILE + TILE / 2 - 1, r * TILE + 2, 10, 6)
          ctx.shadowBlur = 0
          continue
        }
      }

      drawTile(ctx, tile, c * TILE, r * TILE, time, level)
    }
  }

  // ── Laser beams ──
  for (const laser of lasers) {
    const emitterX = laser.col * TILE + TILE / 2
    const emitterY = laser.row * TILE + TILE / 2

    if (laser.horizontal) {
      const startX = (laser.col + 1) * TILE
      let endX = startX
      for (let c = laser.col + 1; c < gw; c++) {
        const t = grid[laser.row]?.[c]
        if (t === TileType.Solid || t === TileType.Ice || t === TileType.Conveyor) break
        endX = (c + 1) * TILE
      }

      if (laser.isOn) {
        // Main beam
        ctx.strokeStyle = COLORS.laser
        ctx.lineWidth = 3
        ctx.shadowColor = COLORS.laser
        ctx.shadowBlur = 8
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 20)
        ctx.beginPath()
        ctx.moveTo(startX, emitterY)
        ctx.lineTo(endX, emitterY)
        ctx.stroke()
        // Core
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(startX, emitterY)
        ctx.lineTo(endX, emitterY)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      } else {
        // Faint off-state line
        ctx.strokeStyle = COLORS.laserOff
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.3
        ctx.beginPath()
        ctx.moveTo(startX, emitterY)
        ctx.lineTo(endX, emitterY)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    } else {
      const startY = (laser.row + 1) * TILE
      let endY = startY
      for (let r = laser.row + 1; r < gh; r++) {
        const t = grid[r]?.[laser.col]
        if (t === TileType.Solid || t === TileType.Ice || t === TileType.Conveyor) break
        endY = (r + 1) * TILE
      }

      if (laser.isOn) {
        ctx.strokeStyle = COLORS.laser
        ctx.lineWidth = 3
        ctx.shadowColor = COLORS.laser
        ctx.shadowBlur = 8
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 20)
        ctx.beginPath()
        ctx.moveTo(emitterX, startY)
        ctx.lineTo(emitterX, endY)
        ctx.stroke()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(emitterX, startY)
        ctx.lineTo(emitterX, endY)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      } else {
        ctx.strokeStyle = COLORS.laserOff
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.3
        ctx.beginPath()
        ctx.moveTo(emitterX, startY)
        ctx.lineTo(emitterX, endY)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  }

  // ── Moving platforms ──
  for (const plat of movingPlatforms) {
    ctx.fillStyle = '#2a2a4a'
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h)
    ctx.strokeStyle = level.accentColor
    ctx.lineWidth = 1
    ctx.strokeRect(plat.x + 0.5, plat.y + 0.5, plat.w - 1, plat.h - 1)
    // Glow top edge
    ctx.fillStyle = level.accentColor
    ctx.globalAlpha = 0.4
    ctx.fillRect(plat.x + 2, plat.y, plat.w - 4, 2)
    ctx.globalAlpha = 1
  }

  // ── Player trail ──
  if (!player.isDead) {
    for (let i = 0; i < player.trail.length; i++) {
      const t = player.trail[i]
      const alpha = (1 - i / player.trail.length) * 0.25
      ctx.fillStyle = level.accentColor
      ctx.globalAlpha = alpha
      const trailSize = (1 - i / player.trail.length) * player.w * 0.6
      ctx.fillRect(
        t.x - trailSize / 2,
        t.y - trailSize / 2,
        trailSize, trailSize
      )
    }
    ctx.globalAlpha = 1
  }

  // ── Player ──
  if (!player.isDead) {
    const px = player.x - player.w / 2
    const py = player.y - player.h / 2

    // Glow
    ctx.shadowColor = level.accentColor
    ctx.shadowBlur = 10
    ctx.fillStyle = COLORS.player
    ctx.fillRect(px, py, player.w, player.h)
    ctx.shadowBlur = 0

    // Inner detail — "visor"
    ctx.fillStyle = level.accentColor
    const visorY = py + 4
    const visorX = player.facing === 1 ? px + 4 : px + 2
    ctx.fillRect(visorX, visorY, 8, 3)

    // Dash afterimage
    if (player.dashTimer > 0) {
      ctx.fillStyle = level.accentColor
      ctx.globalAlpha = 0.4
      ctx.fillRect(
        px - player.facing * 8,
        py + 2,
        player.w, player.h - 4
      )
      ctx.globalAlpha = 0.2
      ctx.fillRect(
        px - player.facing * 16,
        py + 4,
        player.w, player.h - 8
      )
      ctx.globalAlpha = 1
    }
  }

  // ── Particles ──
  for (const p of particles) {
    const lifeRatio = p.life / p.maxLife
    ctx.globalAlpha = lifeRatio
    ctx.fillStyle = p.color

    if (p.type === 'death') {
      ctx.shadowColor = p.color
      ctx.shadowBlur = 4
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      ctx.shadowBlur = 0
    } else if (p.type === 'checkpoint') {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2)
      ctx.fill()
    } else if (p.type === 'dash') {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size * lifeRatio, p.size * lifeRatio)
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1
  }

  ctx.restore()

  // ── Scanlines overlay ──
  ctx.fillStyle = `rgba(0,0,0,${SCANLINE_ALPHA})`
  for (let y = 0; y < canvasH; y += 3) {
    ctx.fillRect(0, y, canvasW, 1)
  }

  // ── Screen flash (on death) ──
  if (gs.screenFlash > 0) {
    ctx.fillStyle = level.accentColor
    ctx.globalAlpha = gs.screenFlash * 0.3
    ctx.fillRect(0, 0, canvasW, canvasH)
    ctx.globalAlpha = 1
  }

  // ── Glitch effect ──
  if (gs.glitchIntensity > 0) {
    const sliceCount = Math.floor(gs.glitchIntensity * 6)
    for (let i = 0; i < sliceCount; i++) {
      const y = Math.random() * canvasH
      const h = 2 + Math.random() * 8
      const offset = (Math.random() - 0.5) * gs.glitchIntensity * 20
      try {
        const imgData = ctx.getImageData(0, Math.max(0, Math.floor(y)), canvasW, Math.min(Math.ceil(h), canvasH - Math.floor(y)))
        ctx.putImageData(imgData, offset, Math.floor(y))
      } catch {
        // getImageData can fail in some contexts, ignore
      }
    }
  }

  // ── Vignette ──
  const vigGrad = ctx.createRadialGradient(
    canvasW / 2, canvasH / 2, canvasW * 0.3,
    canvasW / 2, canvasH / 2, canvasW * 0.75,
  )
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)')
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = vigGrad
  ctx.fillRect(0, 0, canvasW, canvasH)
}

// ── HUD Renderer ──────────────────────────────────────────────────────────

function renderHUD(
  ctx: CanvasRenderingContext2D,
  gs: GameState,
  canvasW: number,
  canvasH: number,
): void {
  // Deaths counter — top left
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'left'
  ctx.fillStyle = gs.level.accentColor
  ctx.shadowColor = gs.level.accentColor
  ctx.shadowBlur = 4
  ctx.fillText(`☠ ${gs.deaths}`, 16, 28)
  ctx.shadowBlur = 0

  // Timer — top right
  const mins = Math.floor(gs.timer / 60)
  const secs = Math.floor(gs.timer % 60)
  const ms = Math.floor((gs.timer % 1) * 100)
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText(timeStr, canvasW - 16, 28)

  // Level name — top center
  ctx.textAlign = 'center'
  ctx.font = 'bold 11px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText(gs.level.name, canvasW / 2, 22)
}

// ═══════════════════════════════════════════════════════════════════════════
// React Component
// ═══════════════════════════════════════════════════════════════════════════

export function NeonDevilGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GameState | null>(null)
  const inputRef = useRef<InputState>({
    left: false, right: false, jump: false,
    jumpPressed: false, dash: false, dashPressed: false,
  })
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const timeRef = useRef<number>(0)

  const [screen, setScreen] = useState<'menu' | 'playing' | 'levelComplete' | 'gameComplete'>('menu')
  const [currentLevel, setCurrentLevel] = useState(0)
  const [muted, setMuted] = useState(false)
  const [deaths, setDeaths] = useState(0)
  const [levelDeaths, setLevelDeaths] = useState(0)
  const [timer, setTimer] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const [showTip, setShowTip] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 })

  // Track checkpoints activated in current session for audio
  const prevCheckpointsRef = useRef<number>(0)
  const prevDeathsRef = useRef<number>(0)
  const wasOnGroundRef = useRef<boolean>(false)

  // Responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      const maxW = Math.min(window.innerWidth - 32, 900)
      const maxH = Math.min(window.innerHeight - 200, 600)
      const aspect = 16 / 10
      let w = maxW
      let h = w / aspect
      if (h > maxH) { h = maxH; w = h * aspect }
      setCanvasSize({ w: Math.round(w), h: Math.round(h) })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // ── Start Level ──
  const startLevel = useCallback((idx: number) => {
    const levelDef = LEVELS[idx]
    if (!levelDef) return
    const level = parseLevel(levelDef)
    const gs = createGameState(level, idx)
    gs.showingTitle = false
    gsRef.current = gs
    prevCheckpointsRef.current = 0
    prevDeathsRef.current = 0
    wasOnGroundRef.current = false
    setCurrentLevel(idx)
    setScreen('playing')
    setDeaths(0)
    setTimer(0)
    setShowTip(true)
    setTimeout(() => setShowTip(false), 4000)
    audio.initAudio()
    audio.startDrone()
  }, [])

  // ── Restart current level ──
  const restartLevel = useCallback(() => {
    startLevel(currentLevel)
  }, [startLevel, currentLevel])

  // ── Next level ──
  const nextLevel = useCallback(() => {
    if (currentLevel + 1 < LEVELS.length) {
      startLevel(currentLevel + 1)
    } else {
      setScreen('gameComplete')
      audio.stopDrone()
    }
  }, [currentLevel, startLevel])

  // ── Input handling ──
  useEffect(() => {
    if (screen !== 'playing') return

    const onKeyDown = (e: KeyboardEvent) => {
      const input = inputRef.current
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA':
          input.left = true; e.preventDefault(); break
        case 'ArrowRight': case 'KeyD':
          input.right = true; e.preventDefault(); break
        case 'ArrowUp': case 'KeyW': case 'Space':
          input.jump = true
          input.jumpPressed = true
          e.preventDefault()
          break
        case 'ShiftLeft': case 'ShiftRight': case 'KeyX':
          input.dash = true
          input.dashPressed = true
          e.preventDefault()
          break
        case 'KeyR':
          restartLevel()
          e.preventDefault()
          break
        case 'Escape':
          setScreen('menu')
          audio.stopDrone()
          e.preventDefault()
          break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const input = inputRef.current
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA':
          input.left = false; break
        case 'ArrowRight': case 'KeyD':
          input.right = false; break
        case 'ArrowUp': case 'KeyW': case 'Space':
          input.jump = false; break
        case 'ShiftLeft': case 'ShiftRight': case 'KeyX':
          input.dash = false; break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      // Reset input on cleanup
      inputRef.current = {
        left: false, right: false, jump: false,
        jumpPressed: false, dash: false, dashPressed: false,
      }
    }
  }, [screen, restartLevel])

  // ── Touch controls ──
  useEffect(() => {
    if (screen !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return

    let touchLeft = false
    let touchRight = false
    let touchJump = false

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i]
        const rect = canvas.getBoundingClientRect()
        const rx = (t.clientX - rect.left) / rect.width
        const ry = (t.clientY - rect.top) / rect.height

        if (ry > 0.6) {
          // Bottom area: left/right
          if (rx < 0.4) touchLeft = true
          else if (rx > 0.6) touchRight = true
        } else {
          // Top area: jump
          touchJump = true
          inputRef.current.jumpPressed = true
        }
      }
      inputRef.current.left = touchLeft
      inputRef.current.right = touchRight
      inputRef.current.jump = touchJump
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      touchLeft = false; touchRight = false; touchJump = false
      // Check remaining touches
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i]
        const rect = canvas.getBoundingClientRect()
        const rx = (t.clientX - rect.left) / rect.width
        const ry = (t.clientY - rect.top) / rect.height
        if (ry > 0.6) {
          if (rx < 0.4) touchLeft = true
          else if (rx > 0.6) touchRight = true
        } else {
          touchJump = true
        }
      }
      inputRef.current.left = touchLeft
      inputRef.current.right = touchRight
      inputRef.current.jump = touchJump
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchStart, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [screen])

  // ── Game loop ──
  useEffect(() => {
    if (screen !== 'playing') return

    const loop = (timestamp: number) => {
      const gs = gsRef.current
      if (!gs) { rafRef.current = requestAnimationFrame(loop); return }

      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = timestamp
      timeRef.current += dt

      // Read input and clear one-shot flags after use
      const input = { ...inputRef.current }
      inputRef.current.jumpPressed = false
      inputRef.current.dashPressed = false

      // Update
      updateGame(gs, input, dt)

      // Audio triggers
      if (!muted) {
        // Death sound
        if (gs.deaths > prevDeathsRef.current) {
          audio.playDeath()
          prevDeathsRef.current = gs.deaths
        }

        // Jump sound
        if (input.jumpPressed && (gs.player.coyoteTimer > 0 || gs.player.onGround)) {
          // Note: jump already happened in updateGame but we check input
        }

        // Land sound
        if (gs.player.onGround && !wasOnGroundRef.current && !gs.player.isDead) {
          audio.playLand()
        }

        // Checkpoint sound
        const activeCheckpoints = gs.level.checkpoints.filter(cp => cp.active).length
        if (activeCheckpoints > prevCheckpointsRef.current) {
          audio.playCheckpoint()
          prevCheckpointsRef.current = activeCheckpoints
        }
      }
      wasOnGroundRef.current = gs.player.onGround

      // Level complete check
      if (gs.transitioning) {
        if (!muted) audio.playLevelComplete()
        setLevelDeaths(gs.deaths)
        setTimer(gs.timer)
        setDeaths(gs.totalDeaths)
        setScreen('levelComplete')
        audio.stopDrone()
        return
      }

      // Update React state occasionally for HUD
      if (Math.floor(timestamp) % 5 === 0) {
        setDeaths(gs.deaths)
        setTimer(gs.timer)
      }

      // Render
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          render(ctx, gs, canvas.width, canvas.height, timeRef.current)
          renderHUD(ctx, gs, canvas.width, canvas.height)
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    lastTimeRef.current = 0
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [screen, muted])

  // ── Volume toggle ──
  useEffect(() => {
    audio.setVolume(muted ? 0 : 0.3)
  }, [muted])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      audio.stopDrone()
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // UI
  // ═══════════════════════════════════════════════════════════════════════

  const accentColor = LEVELS[currentLevel]?.accentColor ?? '#ff2d87'

  // ── Menu Screen ──
  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Back button */}
        <div className="p-4">
          <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1
              className="text-5xl sm:text-7xl font-black uppercase tracking-tight select-none mb-3"
              style={{
                background: 'linear-gradient(135deg, #ff2d87, #ef4444, #ff2d87)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 30px rgba(255,45,135,0.3))',
              }}
            >
              Neon Devil
            </h1>
            <p className="text-[13px] tracking-[0.25em] uppercase text-white/30 font-medium">
              Cyberpunk Rage Platformer
            </p>
          </motion.div>

          {/* Level select */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="w-full max-w-sm space-y-2"
          >
            {LEVELS.map((lvl, i) => (
              <button
                key={i}
                onClick={() => startLevel(i)}
                className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 group text-left"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.12)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                  (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
                  style={{
                    background: `${lvl.accentColor ?? '#ff2d87'}20`,
                    color: lvl.accentColor ?? '#ff2d87',
                    border: `1px solid ${lvl.accentColor ?? '#ff2d87'}40`,
                  }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">{lvl.name}</div>
                  <div className="text-white/30 text-[11px]">{lvl.subtitle}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
              </button>
            ))}
          </motion.div>

          {/* Controls hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-10"
          >
            <button
              onClick={() => setShowControls(!showControls)}
              className="text-[11px] tracking-widest uppercase text-white/25 hover:text-white/50 transition-colors"
            >
              {showControls ? 'Hide' : 'Show'} Controls
            </button>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 text-[12px] text-white/40 space-y-1.5 text-center"
              >
                <p><span className="text-white/60 font-mono">A/D</span> or <span className="text-white/60 font-mono">←/→</span> — Move</p>
                <p><span className="text-white/60 font-mono">W/↑/Space</span> — Jump</p>
                <p><span className="text-white/60 font-mono">Shift/X</span> — Dash</p>
                <p><span className="text-white/60 font-mono">R</span> — Restart  •  <span className="text-white/60 font-mono">Esc</span> — Menu</p>
                <p className="text-white/25 mt-2">Mobile: tap left/right to move, tap top to jump</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Level Complete Screen ──
  if (screen === 'levelComplete') {
    const mins = Math.floor(timer / 60)
    const secs = Math.floor(timer % 60)
    const ms = Math.floor((timer % 1) * 100)
    const parDeaths = LEVELS[currentLevel]?.par ?? 999
    const rating = levelDeaths <= parDeaths * 0.5 ? 'S' : levelDeaths <= parDeaths ? 'A' : levelDeaths <= parDeaths * 2 ? 'B' : 'C'
    const ratingColors: Record<string, string> = { S: '#fbbf24', A: '#4ade80', B: '#818cf8', C: '#ef4444' }

    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div
            className="text-6xl font-black mb-2"
            style={{ color: ratingColors[rating], filter: `drop-shadow(0 0 20px ${ratingColors[rating]}50)` }}
          >
            {rating}
          </div>
          <h2 className="text-white font-bold text-xl mb-1">
            {LEVELS[currentLevel]?.name} — Clear!
          </h2>
          <p className="text-white/40 text-sm mb-6">
            {mins}:{String(secs).padStart(2, '0')}.{String(ms).padStart(2, '0')} · {levelDeaths} deaths
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={restartLevel}
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-white/60 transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Retry
            </button>
            <button
              onClick={nextLevel}
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-black transition-colors"
              style={{ background: accentColor, boxShadow: `0 4px 20px ${accentColor}40` }}
            >
              {currentLevel + 1 < LEVELS.length ? 'Next Level' : 'Finish'}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Game Complete Screen ──
  if (screen === 'gameComplete') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h1
            className="text-4xl sm:text-5xl font-black uppercase mb-4"
            style={{
              background: 'linear-gradient(135deg, #ff2d87, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Devil Conquered
          </h1>
          <p className="text-white/40 text-sm mb-2">Total deaths: {deaths}</p>
          <p className="text-white/30 text-xs mb-8">You faced the rage. You survived.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setScreen('menu'); setCurrentLevel(0) }}
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-white/60 transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Menu
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-black"
              style={{ background: '#ff2d87', boxShadow: '0 4px 20px rgba(255,45,135,0.3)' }}
            >
              Back to Arcade
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Playing Screen ──
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Top bar */}
      <div className="w-full flex items-center justify-between mb-3" style={{ maxWidth: canvasSize.w }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setScreen('menu'); audio.stopDrone() }}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-white/20 text-[11px] tracking-widest uppercase font-bold">
            {LEVELS[currentLevel]?.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={restartLevel}
            className="text-white/30 hover:text-white/60 transition-colors"
            title="Restart (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMuted(!muted)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{
          width: canvasSize.w,
          height: canvasSize.h,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: `0 0 60px rgba(255,45,135,0.08), inset 0 0 60px rgba(0,0,0,0.3)`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className="block"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Floating tip */}
        {showTip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p className="text-white/50 text-[11px] tracking-wide text-center">
              <span className="text-white/70 font-mono">A/D</span> Move · <span className="text-white/70 font-mono">Space</span> Jump · <span className="text-white/70 font-mono">Shift</span> Dash · <span className="text-white/70 font-mono">R</span> Restart
            </p>
          </motion.div>
        )}
      </div>

      {/* Mobile controls indicator */}
      <div className="mt-3 sm:hidden text-center">
        <p className="text-white/20 text-[10px] tracking-widest uppercase">
          Tap left/right to move · top to jump
        </p>
      </div>
    </div>
  )
}
