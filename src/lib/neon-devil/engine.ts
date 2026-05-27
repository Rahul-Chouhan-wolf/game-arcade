// ═══════════════════════════════════════════════════════════════════════════
// Neon Devil — Game Engine
// Cyberpunk rage-platformer core: physics, collision, traps, particles, death
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────────────────

export interface Vec2 { x: number; y: number }

export enum TileType {
  Empty       = 0,
  Solid       = 1,
  Spike       = 2,
  Checkpoint  = 3,
  Exit        = 4,
  Collapse    = 5,  // floor that crumbles after stepping
  FakeSolid   = 6,  // looks solid, you fall through
  Bounce      = 7,  // spring pad
  LaserH      = 8,  // horizontal laser emitter
  LaserV      = 9,  // vertical laser emitter
  Conveyor    = 10, // pushes player sideways
  Ice         = 11, // slippery surface
  Trampoline  = 12, // super bounce
  Hazard      = 13, // instant kill zone
  Decor       = 14, // background tile (non-collidable)
}

export interface Player {
  x: number; y: number
  vx: number; vy: number
  w: number; h: number
  onGround: boolean
  coyoteTimer: number
  jumpBuffer: number
  facing: 1 | -1
  isDead: boolean
  deathTimer: number
  dashTimer: number
  dashCooldown: number
  trail: Vec2[]
}

export interface Checkpoint {
  x: number; y: number
  active: boolean
}

export interface CollapsingTile {
  col: number; row: number
  timer: number      // seconds until collapse
  collapsed: boolean
  respawnTimer: number
}

export interface MovingPlatform {
  x: number; y: number
  w: number; h: number
  startX: number; startY: number
  endX: number; endY: number
  speed: number
  t: number
  dir: 1 | -1
}

export interface LaserBeam {
  col: number; row: number
  horizontal: boolean
  onTimer: number
  offTimer: number
  phase: number  // current phase timer
  isOn: boolean
}

export interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number
  maxLife: number
  size: number
  color: string
  type: 'death' | 'trail' | 'spark' | 'checkpoint' | 'land' | 'dash'
}

export interface CameraShake {
  intensity: number
  decay: number
  offsetX: number
  offsetY: number
}

export interface Level {
  name: string
  subtitle: string
  grid: TileType[][]
  width: number     // in tiles
  height: number    // in tiles
  spawn: Vec2
  checkpoints: Checkpoint[]
  collapsingTiles: CollapsingTile[]
  movingPlatforms: MovingPlatform[]
  lasers: LaserBeam[]
  par: number       // par deaths for ranking
  bgColor1: string
  bgColor2: string
  accentColor: string
}

export interface GameState {
  level: Level
  levelIndex: number
  player: Player
  camera: Vec2
  cameraShake: CameraShake
  particles: Particle[]
  deaths: number
  totalDeaths: number
  timer: number
  paused: boolean
  gameOver: boolean
  showingTitle: boolean
  transitioning: boolean
  transitionAlpha: number
  screenFlash: number
  glitchIntensity: number
}

// ── Constants ─────────────────────────────────────────────────────────────

export const TILE = 32
export const GRAVITY = 1800
export const MAX_FALL = 700
export const MOVE_SPEED = 220
export const MOVE_ACCEL = 2200
export const MOVE_DECEL = 2600
export const ICE_ACCEL = 600
export const ICE_DECEL = 200
export const JUMP_VEL = -480
export const WALL_JUMP_VEL_X = 280
export const WALL_JUMP_VEL_Y = -420
export const COYOTE_TIME = 0.09
export const JUMP_BUFFER = 0.1
export const BOUNCE_VEL = -620
export const TRAMPOLINE_VEL = -780
export const DASH_SPEED = 550
export const DASH_DURATION = 0.12
export const DASH_COOLDOWN = 0.4
export const CONVEYOR_SPEED = 120
export const COLLAPSE_DELAY = 0.35
export const COLLAPSE_RESPAWN = 3.0
export const DEATH_FREEZE = 0.25
export const RESPAWN_TIME = 0.4
export const TRAIL_INTERVAL = 0.016
export const MAX_TRAIL = 12
export const CAMERA_LERP = 6.0
export const CAMERA_LOOKAHEAD = 40

// ── Level Parsing ─────────────────────────────────────────────────────────

const CHAR_MAP: Record<string, TileType> = {
  '.': TileType.Empty,
  '#': TileType.Solid,
  '^': TileType.Spike,
  'C': TileType.Checkpoint,
  'E': TileType.Exit,
  '~': TileType.Collapse,
  'F': TileType.FakeSolid,
  'B': TileType.Bounce,
  'H': TileType.LaserH,
  'V': TileType.LaserV,
  '>': TileType.Conveyor,
  'I': TileType.Ice,
  'T': TileType.Trampoline,
  'X': TileType.Hazard,
  'd': TileType.Decor,
}

export interface LevelDef {
  name: string
  subtitle: string
  map: string[]
  platforms?: { sx: number; sy: number; ex: number; ey: number; w: number; h: number; speed: number }[]
  laserTimings?: { col: number; row: number; on: number; off: number }[]
  par: number
  bgColor1?: string
  bgColor2?: string
  accentColor?: string
}

export function parseLevel(def: LevelDef): Level {
  const rows = def.map
  const height = rows.length
  const width = Math.max(...rows.map(r => r.length))
  const grid: TileType[][] = []
  let spawn: Vec2 = { x: 2 * TILE, y: 2 * TILE }
  const checkpoints: Checkpoint[] = []
  const collapsingTiles: CollapsingTile[] = []
  const lasers: LaserBeam[] = []

  for (let r = 0; r < height; r++) {
    const row: TileType[] = []
    for (let c = 0; c < width; c++) {
      const ch = rows[r]?.[c] ?? '.'
      if (ch === 'S') {
        spawn = { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }
        row.push(TileType.Empty)
      } else {
        const tile = CHAR_MAP[ch] ?? TileType.Empty
        row.push(tile)
        if (tile === TileType.Checkpoint) {
          checkpoints.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, active: false })
        }
        if (tile === TileType.Collapse) {
          collapsingTiles.push({ col: c, row: r, timer: COLLAPSE_DELAY, collapsed: false, respawnTimer: 0 })
        }
        if (tile === TileType.LaserH || tile === TileType.LaserV) {
          const timing = def.laserTimings?.find(lt => lt.col === c && lt.row === r)
          lasers.push({
            col: c, row: r,
            horizontal: tile === TileType.LaserH,
            onTimer: timing?.on ?? 1.5,
            offTimer: timing?.off ?? 1.0,
            phase: 0,
            isOn: true,
          })
        }
      }
    }
    grid.push(row)
  }

  const movingPlatforms: MovingPlatform[] = (def.platforms ?? []).map(p => ({
    x: p.sx * TILE, y: p.sy * TILE,
    w: p.w * TILE, h: p.h * TILE,
    startX: p.sx * TILE, startY: p.sy * TILE,
    endX: p.ex * TILE, endY: p.ey * TILE,
    speed: p.speed,
    t: 0, dir: 1 as const,
  }))

  return {
    name: def.name,
    subtitle: def.subtitle,
    grid, width, height, spawn,
    checkpoints, collapsingTiles, movingPlatforms, lasers,
    par: def.par,
    bgColor1: def.bgColor1 ?? '#0a0014',
    bgColor2: def.bgColor2 ?? '#1a0028',
    accentColor: def.accentColor ?? '#ff2d87',
  }
}

// ── Player Factory ────────────────────────────────────────────────────────

export function createPlayer(spawn: Vec2): Player {
  return {
    x: spawn.x, y: spawn.y,
    vx: 0, vy: 0,
    w: 14, h: 22,
    onGround: false,
    coyoteTimer: 0,
    jumpBuffer: 0,
    facing: 1,
    isDead: false,
    deathTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    trail: [],
  }
}

// ── Collision Helpers ─────────────────────────────────────────────────────

function tileAt(grid: TileType[][], col: number, row: number, w: number, h: number): TileType {
  if (col < 0 || col >= w || row < 0 || row >= h) return TileType.Solid // out of bounds = wall
  return grid[row][col]
}

function isSolid(t: TileType): boolean {
  return t === TileType.Solid || t === TileType.Ice || t === TileType.Conveyor || t === TileType.Bounce || t === TileType.Trampoline
}

function isOneWaySolid(t: TileType): boolean {
  return t === TileType.FakeSolid // looks solid but isn't
}

function isKill(t: TileType): boolean {
  return t === TileType.Spike || t === TileType.Hazard
}

// Resolve player vs tile grid collision along one axis
function resolveAxis(
  player: Player,
  grid: TileType[][],
  gw: number, gh: number,
  axis: 'x' | 'y',
  collapsingTiles: CollapsingTile[],
): { touchedCollapse: CollapsingTile | null, hitBounce: boolean, hitTrampoline: boolean, onIce: boolean, conveyorDir: number } {
  const hw = player.w / 2
  const hh = player.h / 2
  let hitBounce = false
  let hitTrampoline = false
  let onIce = false
  let conveyorDir = 0
  let touchedCollapse: CollapsingTile | null = null

  const left   = player.x - hw
  const right  = player.x + hw
  const top    = player.y - hh
  const bottom = player.y + hh

  const c0 = Math.floor(left / TILE)
  const c1 = Math.floor((right - 0.01) / TILE)
  const r0 = Math.floor(top / TILE)
  const r1 = Math.floor((bottom - 0.01) / TILE)

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const t = tileAt(grid, c, r, gw, gh)
      if (!isSolid(t)) continue

      // Check if this is a collapsed tile
      const ct = collapsingTiles.find(ct => ct.col === c && ct.row === r && ct.collapsed)
      if (ct) continue

      const tLeft   = c * TILE
      const tRight  = (c + 1) * TILE
      const tTop    = r * TILE
      const tBottom = (r + 1) * TILE

      // Overlap
      const overlapL = right - tLeft
      const overlapR = tRight - left
      const overlapT = bottom - tTop
      const overlapB = tBottom - top

      if (overlapL <= 0 || overlapR <= 0 || overlapT <= 0 || overlapB <= 0) continue

      if (axis === 'x') {
        if (overlapL < overlapR) {
          player.x -= overlapL; player.vx = 0
        } else {
          player.x += overlapR; player.vx = 0
        }
      } else {
        if (overlapT < overlapB) {
          player.y -= overlapT
          if (player.vy > 0) {
            player.vy = 0
            player.onGround = true
            if (t === TileType.Bounce) hitBounce = true
            if (t === TileType.Trampoline) hitTrampoline = true
            if (t === TileType.Ice) onIce = true
            if (t === TileType.Conveyor) conveyorDir = 1
            // Check collapse tiles
            const cTile = collapsingTiles.find(ct => ct.col === c && ct.row === r && !ct.collapsed)
            if (cTile) touchedCollapse = cTile
          }
        } else {
          player.y += overlapB
          if (player.vy < 0) player.vy = 0
        }
      }
    }
  }

  return { touchedCollapse, hitBounce, hitTrampoline, onIce, conveyorDir }
}

// Check if player overlaps any kill tile
function checkKillTiles(player: Player, grid: TileType[][], gw: number, gh: number): boolean {
  const hw = player.w / 2
  const hh = player.h / 2
  const margin = 3 // smaller hitbox for spikes (forgiveness)

  const left   = player.x - hw + margin
  const right  = player.x + hw - margin
  const top    = player.y - hh + margin
  const bottom = player.y + hh - margin

  const c0 = Math.floor(left / TILE)
  const c1 = Math.floor((right - 0.01) / TILE)
  const r0 = Math.floor(top / TILE)
  const r1 = Math.floor((bottom - 0.01) / TILE)

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isKill(tileAt(grid, c, r, gw, gh))) return true
    }
  }
  return false
}

// ── Moving Platform Collision ─────────────────────────────────────────────

function checkMovingPlatforms(player: Player, platforms: MovingPlatform[]): { onPlatform: MovingPlatform | null } {
  const hw = player.w / 2
  const hh = player.h / 2
  let onPlatform: MovingPlatform | null = null

  for (const plat of platforms) {
    const pLeft   = plat.x
    const pRight  = plat.x + plat.w
    const pTop    = plat.y
    const pBottom = plat.y + plat.h

    // Player feet overlap check
    const feetY = player.y + hh
    const headY = player.y - hh
    const left  = player.x - hw
    const right = player.x + hw

    if (right > pLeft && left < pRight && feetY >= pTop && feetY <= pTop + 8 && headY < pTop && player.vy >= 0) {
      player.y = pTop - hh
      player.vy = 0
      player.onGround = true
      onPlatform = plat
    }
    // Side/bottom collision
    else if (right > pLeft && left < pRight && feetY > pTop + 8 && headY < pBottom) {
      if (player.x < plat.x + plat.w / 2) {
        player.x = pLeft - hw
      } else {
        player.x = pRight + hw
      }
      player.vx = 0
    }
  }

  return { onPlatform }
}

// ── Laser Collision ───────────────────────────────────────────────────────

function checkLasers(player: Player, lasers: LaserBeam[], grid: TileType[][], gw: number, gh: number): boolean {
  const hw = player.w / 2
  const hh = player.h / 2

  for (const laser of lasers) {
    if (!laser.isOn) continue

    if (laser.horizontal) {
      // Beam goes right from emitter until hitting solid
      const beamY = laser.row * TILE + TILE / 2
      const beamStartX = (laser.col + 1) * TILE
      let beamEndX = beamStartX
      for (let c = laser.col + 1; c < gw; c++) {
        if (isSolid(tileAt(grid, c, laser.row, gw, gh))) break
        beamEndX = (c + 1) * TILE
      }
      // Check player overlap with beam line (4px thick)
      if (player.x + hw > beamStartX && player.x - hw < beamEndX &&
          player.y + hh > beamY - 2 && player.y - hh < beamY + 2) {
        return true
      }
    } else {
      // Beam goes down from emitter
      const beamX = laser.col * TILE + TILE / 2
      const beamStartY = (laser.row + 1) * TILE
      let beamEndY = beamStartY
      for (let r = laser.row + 1; r < gh; r++) {
        if (isSolid(tileAt(grid, laser.col, r, gw, gh))) break
        beamEndY = (r + 1) * TILE
      }
      if (player.x + hw > beamX - 2 && player.x - hw < beamX + 2 &&
          player.y + hh > beamStartY && player.y - hh < beamEndY) {
        return true
      }
    }
  }
  return false
}

// ── Particle Spawners ─────────────────────────────────────────────────────

export function spawnDeathParticles(x: number, y: number, color: string): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.3
    const speed = 120 + Math.random() * 280
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      life: 0.5 + Math.random() * 0.4,
      maxLife: 0.5 + Math.random() * 0.4,
      size: 2 + Math.random() * 4,
      color,
      type: 'death',
    })
  }
  return particles
}

export function spawnCheckpointParticles(x: number, y: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < 16; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
    const speed = 60 + Math.random() * 140
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.3,
      maxLife: 0.6 + Math.random() * 0.3,
      size: 2 + Math.random() * 3,
      color: '#2dd4bf',
      type: 'checkpoint',
    })
  }
  return particles
}

export function spawnLandParticles(x: number, y: number, color: string): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2
    particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y,
      vx: Math.cos(angle) * (30 + Math.random() * 60) * (Math.random() > 0.5 ? 1 : -1),
      vy: -20 - Math.random() * 40,
      life: 0.2 + Math.random() * 0.2,
      maxLife: 0.3,
      size: 1.5 + Math.random() * 2,
      color,
      type: 'land',
    })
  }
  return particles
}

export function spawnDashParticles(x: number, y: number, facing: number, color: string): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < 4; i++) {
    particles.push({
      x: x - facing * 6,
      y: y + (Math.random() - 0.5) * 16,
      vx: -facing * (80 + Math.random() * 60),
      vy: (Math.random() - 0.5) * 30,
      life: 0.15 + Math.random() * 0.1,
      maxLife: 0.2,
      size: 2 + Math.random() * 2,
      color,
      type: 'dash',
    })
  }
  return particles
}

// ── Input State ───────────────────────────────────────────────────────────

export interface InputState {
  left: boolean
  right: boolean
  jump: boolean
  jumpPressed: boolean  // just pressed this frame
  dash: boolean
  dashPressed: boolean
}

// ── Update ────────────────────────────────────────────────────────────────

export function updateGame(gs: GameState, input: InputState, dt: number): void {
  if (gs.paused || gs.gameOver) return

  // Clamp dt to prevent spiral of death
  dt = Math.min(dt, 0.033)

  const { player, level } = gs
  const { grid, width: gw, height: gh, collapsingTiles, movingPlatforms, lasers } = level

  // Update timer
  gs.timer += dt

  // Screen flash decay
  if (gs.screenFlash > 0) gs.screenFlash -= dt * 4

  // Glitch decay
  if (gs.glitchIntensity > 0) gs.glitchIntensity -= dt * 3

  // Camera shake
  if (gs.cameraShake.intensity > 0) {
    gs.cameraShake.intensity *= (1 - gs.cameraShake.decay * dt)
    gs.cameraShake.offsetX = (Math.random() - 0.5) * gs.cameraShake.intensity
    gs.cameraShake.offsetY = (Math.random() - 0.5) * gs.cameraShake.intensity
    if (gs.cameraShake.intensity < 0.3) {
      gs.cameraShake.intensity = 0
      gs.cameraShake.offsetX = 0
      gs.cameraShake.offsetY = 0
    }
  }

  // ── Update particles ──
  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const p = gs.particles[i]
    p.life -= dt
    if (p.life <= 0) { gs.particles.splice(i, 1); continue }
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.type === 'death' || p.type === 'land') {
      p.vy += 600 * dt
    }
  }

  // ── Update lasers ──
  for (const laser of lasers) {
    laser.phase += dt
    const period = laser.isOn ? laser.onTimer : laser.offTimer
    if (laser.phase >= period) {
      laser.phase -= period
      laser.isOn = !laser.isOn
    }
  }

  // ── Update collapsing tiles ──
  for (const ct of collapsingTiles) {
    if (ct.collapsed) {
      ct.respawnTimer -= dt
      if (ct.respawnTimer <= 0) {
        ct.collapsed = false
        ct.timer = COLLAPSE_DELAY
      }
    }
  }

  // ── Update moving platforms ──
  for (const plat of movingPlatforms) {
    const dx = plat.endX - plat.startX
    const dy = plat.endY - plat.startY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) continue
    plat.t += (plat.dir * plat.speed * dt) / dist
    if (plat.t >= 1) { plat.t = 1; plat.dir = -1 }
    if (plat.t <= 0) { plat.t = 0; plat.dir = 1 }
    const oldX = plat.x
    const oldY = plat.y
    plat.x = plat.startX + dx * plat.t
    plat.y = plat.startY + dy * plat.t
    // Carry player if standing on platform
    // (handled in platform collision below)
    void oldX; void oldY
  }

  // ── Death / respawn ──
  if (player.isDead) {
    player.deathTimer -= dt
    if (player.deathTimer <= 0) {
      respawnPlayer(gs)
    }
    return
  }

  // ── Dash ──
  if (player.dashCooldown > 0) player.dashCooldown -= dt

  if (input.dashPressed && player.dashCooldown <= 0) {
    player.dashTimer = DASH_DURATION
    player.dashCooldown = DASH_COOLDOWN
    player.vy = 0
    gs.particles.push(...spawnDashParticles(player.x, player.y, player.facing, level.accentColor))
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt
    player.vx = player.facing * DASH_SPEED
    player.vy = 0
    // Emit trail particles
    gs.particles.push(...spawnDashParticles(player.x, player.y, player.facing, level.accentColor))
  }

  // ── Horizontal movement ──
  if (player.dashTimer <= 0) {
    const targetVx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    if (targetVx !== 0) {
      player.facing = targetVx as 1 | -1
      const accel = player.onGround ? MOVE_ACCEL : MOVE_ACCEL * 0.85
      player.vx += targetVx * accel * dt
      if (Math.abs(player.vx) > MOVE_SPEED) {
        player.vx = Math.sign(player.vx) * MOVE_SPEED
      }
    } else {
      // Decelerate
      const decel = player.onGround ? MOVE_DECEL : MOVE_DECEL * 0.5
      if (Math.abs(player.vx) > decel * dt) {
        player.vx -= Math.sign(player.vx) * decel * dt
      } else {
        player.vx = 0
      }
    }
  }

  // ── Gravity ──
  if (player.dashTimer <= 0) {
    player.vy += GRAVITY * dt
    if (player.vy > MAX_FALL) player.vy = MAX_FALL
  }

  // ── Coyote time ──
  if (player.onGround) {
    player.coyoteTimer = COYOTE_TIME
  } else {
    player.coyoteTimer -= dt
  }

  // ── Jump buffer ──
  if (input.jumpPressed) {
    player.jumpBuffer = JUMP_BUFFER
  } else {
    player.jumpBuffer -= dt
  }

  // ── Jump ──
  const canJump = player.coyoteTimer > 0 || player.onGround
  if (player.jumpBuffer > 0 && canJump) {
    player.vy = JUMP_VEL
    player.onGround = false
    player.coyoteTimer = 0
    player.jumpBuffer = 0
  }

  // ── Variable jump height — cut upward velocity on release ──
  if (!input.jump && player.vy < JUMP_VEL * 0.5) {
    player.vy = player.vy * 0.65
  }

  // ── Move X then resolve ──
  const wasOnGround = player.onGround
  player.onGround = false
  player.x += player.vx * dt
  resolveAxis(player, grid, gw, gh, 'x', collapsingTiles)

  // ── Move Y then resolve ──
  player.y += player.vy * dt
  const result = resolveAxis(player, grid, gw, gh, 'y', collapsingTiles)

  // Land particles
  if (!wasOnGround && player.onGround) {
    gs.particles.push(...spawnLandParticles(player.x, player.y + player.h / 2, level.accentColor))
  }

  // Handle bounce tiles
  if (result.hitBounce) {
    player.vy = BOUNCE_VEL
    player.onGround = false
  }
  if (result.hitTrampoline) {
    player.vy = TRAMPOLINE_VEL
    player.onGround = false
  }

  // Conveyor
  if (result.conveyorDir !== 0) {
    player.x += CONVEYOR_SPEED * result.conveyorDir * dt
  }

  // Collapse tiles
  if (result.touchedCollapse) {
    const ct = result.touchedCollapse
    ct.timer -= dt
    if (ct.timer <= 0 && !ct.collapsed) {
      ct.collapsed = true
      ct.respawnTimer = COLLAPSE_RESPAWN
      // Spark particles
      gs.particles.push(...spawnLandParticles(ct.col * TILE + TILE / 2, ct.row * TILE + TILE / 2, '#ff6b35'))
    }
  }

  // ── Moving platforms ──
  const platResult = checkMovingPlatforms(player, movingPlatforms)
  if (platResult.onPlatform) {
    // Carry player
    const plat = platResult.onPlatform
    const dx = plat.endX - plat.startX
    const dy = plat.endY - plat.startY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 1) {
      player.x += (plat.dir * plat.speed * dt / dist) * dx
      player.y += (plat.dir * plat.speed * dt / dist) * dy
    }
  }

  // ── Kill checks ──
  if (checkKillTiles(player, grid, gw, gh)) {
    killPlayer(gs)
    return
  }

  if (checkLasers(player, lasers, grid, gw, gh)) {
    killPlayer(gs)
    return
  }

  // Fall out of level
  if (player.y > (gh + 3) * TILE) {
    killPlayer(gs)
    return
  }

  // ── Checkpoint activation ──
  const hw = player.w / 2
  const hh = player.h / 2
  for (const cp of level.checkpoints) {
    if (cp.active) continue
    const dx = Math.abs(player.x - cp.x)
    const dy = Math.abs(player.y - cp.y)
    if (dx < hw + TILE * 0.4 && dy < hh + TILE * 0.4) {
      cp.active = true
      gs.particles.push(...spawnCheckpointParticles(cp.x, cp.y))
    }
  }

  // ── Exit check ──
  const pc = Math.floor(player.x / TILE)
  const pr = Math.floor(player.y / TILE)
  if (pc >= 0 && pc < gw && pr >= 0 && pr < gh && grid[pr][pc] === TileType.Exit) {
    gs.transitioning = true
  }

  // ── Trail ──
  player.trail.unshift({ x: player.x, y: player.y })
  if (player.trail.length > MAX_TRAIL) player.trail.length = MAX_TRAIL

  // ── Camera ──
  const targetCamX = player.x + player.facing * CAMERA_LOOKAHEAD
  const targetCamY = player.y - 20
  gs.camera.x += (targetCamX - gs.camera.x) * CAMERA_LERP * dt
  gs.camera.y += (targetCamY - gs.camera.y) * CAMERA_LERP * dt
}

// ── Kill Player ───────────────────────────────────────────────────────────

function killPlayer(gs: GameState): void {
  const { player, level } = gs
  if (player.isDead) return

  player.isDead = true
  player.deathTimer = DEATH_FREEZE + RESPAWN_TIME
  gs.deaths++
  gs.totalDeaths++
  gs.screenFlash = 1
  gs.glitchIntensity = 1
  gs.cameraShake = { intensity: 12, decay: 8, offsetX: 0, offsetY: 0 }
  gs.particles.push(...spawnDeathParticles(player.x, player.y, level.accentColor))
}

// ── Respawn Player ────────────────────────────────────────────────────────

function respawnPlayer(gs: GameState): void {
  const { level } = gs
  // Find latest active checkpoint, or use spawn
  let spawnPt = level.spawn
  for (const cp of level.checkpoints) {
    if (cp.active) spawnPt = { x: cp.x, y: cp.y }
  }

  const p = createPlayer(spawnPt)
  Object.assign(gs.player, p)
}

// ── GameState Factory ─────────────────────────────────────────────────────

export function createGameState(level: Level, levelIndex: number): GameState {
  return {
    level,
    levelIndex,
    player: createPlayer(level.spawn),
    camera: { x: level.spawn.x, y: level.spawn.y },
    cameraShake: { intensity: 0, decay: 0, offsetX: 0, offsetY: 0 },
    particles: [],
    deaths: 0,
    totalDeaths: 0,
    timer: 0,
    paused: false,
    gameOver: false,
    showingTitle: true,
    transitioning: false,
    transitionAlpha: 0,
    screenFlash: 0,
    glitchIntensity: 0,
  }
}

// ── Wall-touching check (for visual feedback) ─────────────────────────────

export function isTouchingWall(player: Player, grid: TileType[][], gw: number, gh: number, dir: 1 | -1): boolean {
  const hw = player.w / 2
  const hh = player.h / 2
  const checkX = dir === 1 ? player.x + hw + 1 : player.x - hw - 1
  const c = Math.floor(checkX / TILE)
  const r0 = Math.floor((player.y - hh + 2) / TILE)
  const r1 = Math.floor((player.y + hh - 2) / TILE)
  for (let r = r0; r <= r1; r++) {
    if (isSolid(tileAt(grid, c, r, gw, gh))) return true
  }
  return false
}
