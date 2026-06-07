"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"

// ─── Constants ────────────────────────────────────────────────────────────────

const WORLD_W         = 5000
const WORLD_H         = 5000
const BASE_SPEED      = 2.8      // px per frame
const BOOST_MULT      = 1.95
const BASE_SEG_R      = 9        // base segment radius
const SEGMENT_PITCH   = 3        // world px between path nodes (physics)
const VISUAL_STRIDE   = 2        // render every Nth path node (gives 6px visual spacing)
const FOOD_COUNT      = 1400
const BOT_COUNT       = 14
const MIN_SEGS        = 12
const GROWTH_PER_SEG  = 2        // score points per extra segment (was 8 — too slow)
const BOOST_DRAIN     = 4        // score drained per boost tick
const BOOST_TICK      = 4        // frames between each boost drain
const BORDER_MARGIN   = 200      // px from edge where AI turns back
const AI_RETARGET     = 90       // frames between AI retargets
const TURN_RATE       = 0.065    // radians per frame max turn
const SPAWN_GRACE     = 150      // invincibility frames after spawning

// ─── Skin system ──────────────────────────────────────────────────────────────

const SKIN_IDS = [
  'classic','sausage','zombie','candy','rainbow','ghost','lava','cookie',
] as const
type SkinId = typeof SKIN_IDS[number]

interface SkinDef {
  label:    string
  emoji:    string
  tagline:  string
  // Player colours (bots keep BOT_COLORS; both use the style below)
  b1: string; b2: string; head: string; glow: string; name: string
  segStyle: 'default' | 'spotted' | 'rainbow' | 'ghost' | 'lava'
  eyeStyle: 'normal' | 'happy' | 'googly' | 'heart' | 'star' | 'scared' | 'angry'
  spotCol:  string
}

const SKINS: Record<SkinId, SkinDef> = {
  classic: { label:"Classic", emoji:"🐍", tagline:"OG slitherer",
    b1:"#ff3366", b2:"#ff6699", head:"#ff4477", glow:"#ff336644", name:"#ff6699",
    segStyle:"default", eyeStyle:"normal",  spotCol:"" },
  sausage: { label:"Sausage", emoji:"🌭", tagline:"Bratwurst mode",
    b1:"#c97020", b2:"#e89040", head:"#d98030", glow:"#c9702044", name:"#ebb060",
    segStyle:"spotted", eyeStyle:"happy",   spotCol:"#f5d5a0" },
  zombie:  { label:"Zombie",  emoji:"🧟", tagline:"Braaains...",
    b1:"#3d7a1a", b2:"#2a5610", head:"#4a8a20", glow:"#3d7a1a44", name:"#6ab030",
    segStyle:"spotted", eyeStyle:"googly",  spotCol:"#1a3a0a" },
  candy:   { label:"Candy",   emoji:"🍬", tagline:"Sweet & deadly",
    b1:"#ff1144", b2:"#fff0f5", head:"#ff2255", glow:"#ff114444", name:"#ff4477",
    segStyle:"default", eyeStyle:"heart",   spotCol:"" },
  rainbow: { label:"Rainbow", emoji:"🌈", tagline:"All the vibes",
    b1:"#ff0000", b2:"#ff8800", head:"#ff0000", glow:"#ff880044", name:"#ffee00",
    segStyle:"rainbow", eyeStyle:"star",    spotCol:"" },
  ghost:   { label:"Ghost",   emoji:"👻", tagline:"Boo! Spooky",
    b1:"#d0e4ff", b2:"#a8c8ff", head:"#e8f4ff", glow:"#8899ff44", name:"#b0c8ff",
    segStyle:"ghost",   eyeStyle:"scared",  spotCol:"" },
  lava:    { label:"Lava",    emoji:"🌋", tagline:"Too hot to handle",
    b1:"#ff4400", b2:"#ff8800", head:"#ff5500", glow:"#ff440066", name:"#ff9944",
    segStyle:"lava",    eyeStyle:"angry",   spotCol:"" },
  cookie:  { label:"Cookie",  emoji:"🍪", tagline:"Nom nom nom",
    b1:"#a0622a", b2:"#c07a38", head:"#b0702e", glow:"#a0622a44", name:"#d4935a",
    segStyle:"spotted", eyeStyle:"happy",   spotCol:"#3d2010" },
}

// Each bot gets a fixed funny skin (cycles through non-classic skins)
const BOT_SKIN_IDS: SkinId[] = [
  'sausage','zombie','candy','rainbow','ghost','lava','cookie','sausage',
  'zombie','candy','rainbow','ghost','lava','cookie',
]

// ─── Colour palettes ──────────────────────────────────────────────────────────

interface SnakeColors {
  b1: string   // primary body
  b2: string   // secondary / stripe
  head: string
  glow: string
  name: string // display name colour
}

const PLAYER_COLORS: SnakeColors = {
  b1:   "#ff3366",
  b2:   "#ff6699",
  head: "#ff4477",
  glow: "#ff336655",
  name: "#ff6699",
}

const BOT_COLORS: SnakeColors[] = [
  { b1:"#3b82f6", b2:"#60a5fa", head:"#4893ff", glow:"#3b82f655", name:"#60a5fa" },
  { b1:"#22c55e", b2:"#4ade80", head:"#33d66a", glow:"#22c55e55", name:"#4ade80" },
  { b1:"#f97316", b2:"#fb923c", head:"#ff8830", glow:"#f9731655", name:"#fb923c" },
  { b1:"#a855f7", b2:"#c084fc", head:"#b870ff", glow:"#a855f755", name:"#c084fc" },
  { b1:"#06b6d4", b2:"#22d3ee", head:"#10caec", glow:"#06b6d455", name:"#22d3ee" },
  { b1:"#eab308", b2:"#facc15", head:"#ffcc00", glow:"#eab30855", name:"#facc15" },
  { b1:"#ec4899", b2:"#f472b6", head:"#ff55b0", glow:"#ec489955", name:"#f472b6" },
  { b1:"#14b8a6", b2:"#2dd4bf", head:"#1dccc0", glow:"#14b8a655", name:"#2dd4bf" },
  { b1:"#8b5cf6", b2:"#a78bfa", head:"#9970ff", glow:"#8b5cf655", name:"#a78bfa" },
  { b1:"#f43f5e", b2:"#fb7185", head:"#ff5070", glow:"#f43f5e55", name:"#fb7185" },
  { b1:"#10b981", b2:"#34d399", head:"#20cc88", glow:"#10b98155", name:"#34d399" },
  { b1:"#0ea5e9", b2:"#38bdf8", head:"#1ab8ff", glow:"#0ea5e955", name:"#38bdf8" },
  { b1:"#d946ef", b2:"#e879f9", head:"#e855ff", glow:"#d946ef55", name:"#e879f9" },
  { b1:"#6366f1", b2:"#818cf8", head:"#7070ff", glow:"#6366f155", name:"#818cf8" },
]

const BOT_NAMES = [
  "Slithy","Toves","Noodle","Wiggler","Zephyr",
  "Cobalt","Viper","Coil","Specter","Blaze",
  "Drift","Echo","Nexus","Pyra",
]

const FOOD_COLORS = [
  "#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff6bff",
  "#ff9f43","#54a0ff","#48dbfb","#ff4757","#2ed573",
  "#ffa502","#eccc68","#a29bfe","#fd79a8","#00cec9",
  "#fdcb6e","#e17055","#74b9ff","#55efc4","#fd79a8",
]

// ─── Themes ───────────────────────────────────────────────────────────────────

const THEMES = {
  classic: { label:"Classic", bg:"#0c0c1e", bgAlt:"#0f0f28", grid:"rgba(255,255,255,0.028)", border:"#ff6b6b" },
  forest:  { label:"Forest",  bg:"#081408", bgAlt:"#0b1a0b", grid:"rgba(100,255,80,0.03)",  border:"#4ade80" },
  ocean:   { label:"Ocean",   bg:"#060d1e", bgAlt:"#08122a", grid:"rgba(50,180,255,0.03)",  border:"#38bdf8" },
  neon:    { label:"Neon",    bg:"#030007", bgAlt:"#060010", grid:"rgba(255,0,255,0.05)",   border:"#ff00ff" },
  desert:  { label:"Desert",  bg:"#1a1205", bgAlt:"#201607", grid:"rgba(255,210,80,0.03)", border:"#fbbf24" },
} as const
type ThemeId = keyof typeof THEMES

// ─── Game types ───────────────────────────────────────────────────────────────

interface Vec2 { x: number; y: number }

interface Snake {
  id:        number
  name:      string
  colors:    SnakeColors
  path:      Vec2[]       // path[0] = current head, each SEGMENT_PITCH apart
  pathAccum: number       // accumulated distance since last push
  physX:     number
  physY:     number
  numSegs:   number
  angle:     number
  tgtAngle:  number
  speed:     number
  boosting:  boolean
  alive:      boolean
  isPlayer:   boolean
  score:      number
  skinId:     SkinId
  spawnGrace: number   // frames of spawn invincibility
  // Multiplayer (remote players from other browsers — not simulated locally)
  remote?:     boolean
  targetPath?: Vec2[]  // latest networked body, lerped toward each frame
  // AI only
  aiFood:    number
  aiTimer:   number
  aiWander:  number
}

interface FoodOrb {
  x: number; y: number
  color: string
  r: number
  value: number
}

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  color: string; r: number
}

interface GState {
  snakes:     Snake[]
  food:       FoodOrb[]
  particles:  Particle[]
  tick:       number
  deathScore: number
  deathRank:  number
}

type Phase = "menu" | "playing" | "dead"

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x; const dy = a.y - b.y
  return dx * dx + dy * dy
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a
  while (d >  Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

// Camera zoom shrinks as the snake grows so big snakes don't feel slow / fill the screen
function zoomForRadius(r: number): number {
  const z = Math.pow(BASE_SEG_R / r, 0.5)
  return Math.max(0.5, Math.min(1, z))
}

// ─── Multiplayer (HTTP polling) ────────────────────────────────────────────────

const MP_ROOM    = "global"
const MP_POLL_MS = 110     // ~9 syncs / second
const MP_MAX_PTS = 48      // body points sent per sync (keeps payload small)

interface RemotePlayer {
  id:    string
  name?: string
  skin?: string
  score?: number
  pts?:  number[]
}

// Downsample the local player's body into a compact list of world points (head→tail)
function samplePlayerPts(s: Snake): number[] {
  const N = s.numSegs
  const step = Math.max(1, Math.floor(N / MP_MAX_PTS))
  const pts: number[] = []
  for (let i = 0; i < N; i += step) {
    const p = segPos(s, i * VISUAL_STRIDE)
    if (!p) break
    pts.push(Math.round(p.x), Math.round(p.y))
  }
  return pts
}

// Rebuild a remote snake's render path (length 2*numSegs, stride-interleaved) from
// the coarse points it sent, resampled to the segment count its score implies.
function remotePathFromPts(flat: number[], score: number): Vec2[] {
  const coarse: Vec2[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) coarse.push({ x: flat[i], y: flat[i + 1] })
  if (coarse.length === 0) return []

  let N = numSegsFromScore(score)
  if (N < MIN_SEGS) N = MIN_SEGS
  if (N > 300) N = 300   // bound render cost for very large remote snakes

  const path: Vec2[] = []
  for (let k = 0; k < N; k++) {
    let pt: Vec2
    if (coarse.length === 1) {
      pt = coarse[0]
    } else {
      const t = (k / (N - 1)) * (coarse.length - 1)
      const i = Math.min(coarse.length - 2, Math.floor(t))
      const f = t - i
      pt = { x: lerp(coarse[i].x, coarse[i + 1].x, f), y: lerp(coarse[i].y, coarse[i + 1].y, f) }
    }
    path.push({ x: pt.x, y: pt.y })
    path.push({ x: pt.x, y: pt.y })  // interleave duplicate so segPos(i*VISUAL_STRIDE) lands on each point
  }
  return path
}

function segRadius(score: number): number {
  return BASE_SEG_R + Math.sqrt(Math.max(0, score)) * 0.4
}

function numSegsFromScore(score: number): number {
  return MIN_SEGS + Math.floor(score / GROWTH_PER_SEG)
}

function headPos(s: Snake): Vec2 {
  return s.path[0] ?? { x: s.physX, y: s.physY }
}

function segPos(s: Snake, i: number): Vec2 | null {
  return s.path[i] ?? s.path[s.path.length - 1] ?? null
}

// ─── Factory functions ────────────────────────────────────────────────────────

function makeSnake(
  id: number, name: string, colors: SnakeColors,
  pos: Vec2, isPlayer: boolean, skinId: SkinId = 'classic',
): Snake {
  const angle = Math.random() * Math.PI * 2
  const path: Vec2[] = []
  const initLen = (MIN_SEGS + 60) * VISUAL_STRIDE  // enough nodes for visual stride rendering
  for (let i = 0; i < initLen; i++) {
    path.push({
      x: pos.x - Math.cos(angle) * i * SEGMENT_PITCH,
      y: pos.y - Math.sin(angle) * i * SEGMENT_PITCH,
    })
  }
  return {
    id, name, colors,
    path, pathAccum: 0,
    physX: pos.x, physY: pos.y,
    numSegs: MIN_SEGS,
    angle, tgtAngle: angle,
    speed: BASE_SPEED,
    boosting: false,
    alive: true, isPlayer,
    score: 0,
    skinId,
    spawnGrace: SPAWN_GRACE,
    aiFood: -1, aiTimer: 0, aiWander: 0,
  }
}

function makeFood(x?: number, y?: number): FoodOrb {
  const col = FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)]
  return {
    x: x ?? (40 + Math.random() * (WORLD_W - 80)),
    y: y ?? (40 + Math.random() * (WORLD_H - 80)),
    color: col,
    r: 3 + Math.random() * 3.5,
    value: 2 + Math.floor(Math.random() * 4),  // 2–5 pts: satisfying per-orb growth
  }
}

function initState(nickname: string, skinId: SkinId = 'classic'): GState {
  const px = WORLD_W / 2 + (Math.random() - 0.5) * 600
  const py = WORLD_H / 2 + (Math.random() - 0.5) * 600
  // Player colours come from their chosen skin
  const skin = SKINS[skinId]
  const playerColors: SnakeColors = { b1: skin.b1, b2: skin.b2, head: skin.head, glow: skin.glow, name: skin.name }
  const player = makeSnake(0, nickname.trim() || "You", playerColors, { x: px, y: py }, true, skinId)

  const bots: Snake[] = []
  for (let i = 0; i < BOT_COUNT; i++) {
    const pos = { x: 250 + Math.random() * (WORLD_W - 500), y: 250 + Math.random() * (WORLD_H - 500) }
    const botSkinId = BOT_SKIN_IDS[i % BOT_SKIN_IDS.length]
    bots.push(makeSnake(i + 1, BOT_NAMES[i % BOT_NAMES.length], BOT_COLORS[i % BOT_COLORS.length], pos, false, botSkinId))
  }

  const food: FoodOrb[] = []
  for (let i = 0; i < FOOD_COUNT; i++) food.push(makeFood())

  return { snakes: [player, ...bots], food, particles: [], tick: 0, deathScore: 0, deathRank: 0 }
}

// ─── AI steering ──────────────────────────────────────────────────────────────

function getAIAngle(snake: Snake, state: GState): number {
  const hd = headPos(snake)

  // Turn away from border
  const nearLeft   = hd.x < BORDER_MARGIN
  const nearRight  = hd.x > WORLD_W - BORDER_MARGIN
  const nearTop    = hd.y < BORDER_MARGIN
  const nearBottom = hd.y > WORLD_H - BORDER_MARGIN
  if (nearLeft || nearRight || nearTop || nearBottom) {
    const cx = WORLD_W / 2, cy = WORLD_H / 2
    return Math.atan2(cy - hd.y, cx - hd.x) + (Math.random() - 0.5) * 0.6
  }

  // Retarget food periodically
  snake.aiTimer--
  if (snake.aiTimer <= 0 || snake.aiFood < 0 || snake.aiFood >= state.food.length) {
    let best = -1, bestD = Infinity
    const sample = Math.min(state.food.length, 80)
    for (let i = 0; i < sample; i++) {
      const fi = Math.floor(Math.random() * state.food.length)
      const d = dist2(hd, state.food[fi])
      if (d < bestD) { bestD = d; best = fi }
    }
    snake.aiFood = best
    snake.aiTimer = AI_RETARGET + Math.floor(Math.random() * 60)
  }

  if (snake.aiFood >= 0 && snake.aiFood < state.food.length) {
    const f = state.food[snake.aiFood]
    const base = Math.atan2(f.y - hd.y, f.x - hd.x)
    snake.aiWander = lerpAngle(snake.aiWander, (Math.random() - 0.5) * 0.8, 0.05)
    return base + snake.aiWander * 0.4
  }

  return snake.angle + (Math.random() - 0.5) * 0.1
}

// ─── Snake movement ───────────────────────────────────────────────────────────

function moveSnake(snake: Snake) {
  const spd = snake.boosting ? BASE_SPEED * BOOST_MULT : BASE_SPEED
  snake.physX = Math.max(25, Math.min(WORLD_W - 25, snake.physX + Math.cos(snake.angle) * spd))
  snake.physY = Math.max(25, Math.min(WORLD_H - 25, snake.physY + Math.sin(snake.angle) * spd))

  snake.pathAccum += spd
  while (snake.pathAccum >= SEGMENT_PITCH) {
    snake.pathAccum -= SEGMENT_PITCH
    snake.path.unshift({ x: snake.physX, y: snake.physY })
  }

  const maxPath = snake.numSegs * VISUAL_STRIDE + 80
  if (snake.path.length > maxPath) snake.path.length = maxPath
}

// ─── Spawn death food ─────────────────────────────────────────────────────────

function spawnDeathFood(state: GState, snake: Snake) {
  const count = Math.floor(snake.score * 0.6)
  for (let i = 0; i < Math.min(count, 250); i++) {
    const si = Math.floor(Math.random() * snake.numSegs)
    const sp = segPos(snake, si)
    if (sp) {
      state.food.push(makeFood(
        sp.x + (Math.random() - 0.5) * 30,
        sp.y + (Math.random() - 0.5) * 30,
      ))
    }
  }
}

// ─── Main update ──────────────────────────────────────────────────────────────

function updateGame(state: GState, mouseAngle: number, boosting: boolean): boolean {
  state.tick++
  const { snakes, food, particles } = state
  const alive = snakes.filter(s => s.alive)

  // ── Steer & move ──
  for (const s of alive) {
    if (s.remote) continue   // remote players are driven by the network, not simulated
    // Target angle
    let tgt: number
    if (s.isPlayer) {
      tgt = mouseAngle
      s.boosting = boosting
    } else {
      tgt = getAIAngle(s, state)
      s.boosting = s.score > 30 && Math.random() < 0.008
    }

    // Clamp turn rate
    let d = tgt - s.angle
    while (d >  Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    s.angle += Math.max(-TURN_RATE, Math.min(TURN_RATE, d))

    moveSnake(s)

    // Update derived numSegs
    s.numSegs = numSegsFromScore(s.score)
    if (s.numSegs < MIN_SEGS) s.numSegs = MIN_SEGS

    // Boost drain
    if (s.boosting && s.score > 0 && state.tick % BOOST_TICK === 0) {
      const drain = Math.min(s.score, BOOST_DRAIN)
      s.score -= drain
      // Tail tip becomes food
      const tailIdx = s.numSegs - 1
      const tail = segPos(s, tailIdx)
      if (tail) {
        state.food.push(makeFood(tail.x + (Math.random() - 0.5) * 12, tail.y + (Math.random() - 0.5) * 12))
      }
    }
  }

  // ── Eat food ──
  for (const s of alive) {
    if (s.remote) continue   // remote players eat food on their own client
    const hd = headPos(s)
    const eatR = (segRadius(s.score) + 10) ** 2
    for (let fi = food.length - 1; fi >= 0; fi--) {
      const f = food[fi]
      const dx = f.x - hd.x, dy = f.y - hd.y
      if (dx * dx + dy * dy < eatR) {
        s.score += f.value
        food.splice(fi, 1)
        food.push(makeFood())  // replenish
        // Eat particles
        for (let p = 0; p < 5; p++) {
          const a = Math.random() * Math.PI * 2
          const v = 1.2 + Math.random() * 2.5
          particles.push({
            x: f.x, y: f.y,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            life: 20 + Math.floor(Math.random() * 20),
            maxLife: 40,
            color: f.color,
            r: 1.5 + Math.random() * 2,
          })
        }
      }
    }
  }

  // ── Boost trail particles ──
  if (state.tick % 2 === 0) {
    for (const s of alive) {
      if (!s.boosting) continue
      const tail = segPos(s, Math.max(0, s.numSegs - 3))
      if (tail) {
        particles.push({
          x: tail.x + (Math.random() - 0.5) * 8,
          y: tail.y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          life: 18, maxLife: 18,
          color: s.colors.b2,
          r: 2.5 + Math.random() * 2,
        })
      }
    }
  }

  // ── Particle update ──
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx; p.y += p.vy
    p.vx *= 0.93; p.vy *= 0.93
    if (--p.life <= 0) particles.splice(i, 1)
  }
  if (particles.length > 800) particles.splice(0, particles.length - 800)

  // ── Decrement spawn grace for all snakes ──
  for (const s of alive) {
    if (s.spawnGrace > 0) s.spawnGrace--
  }

  // ── Player collision vs snake bodies ──
  const player = alive.find(s => s.isPlayer)
  if (player && player.spawnGrace === 0) {
    const hd = headPos(player)
    const pr = segRadius(player.score)

    for (const other of alive) {
      // You can never die from your own body (authentic Slither.io rule)
      if (other.id === player.id) continue
      const or      = segRadius(other.score)
      const hitR    = (pr * 0.7 + or * 0.7) ** 2

      for (let vi = 0; vi < other.numSegs; vi++) {
        const sp = segPos(other, vi * VISUAL_STRIDE)
        if (!sp) break
        const dx = sp.x - hd.x, dy = sp.y - hd.y
        if (dx * dx + dy * dy < hitR) {
          spawnDeathFood(state, player)
          player.alive = false
          const rank = snakes.filter(s => s.alive && s.score > player.score).length + 1
          state.deathScore = Math.floor(player.score)
          state.deathRank  = rank
          return true
        }
      }
    }
  }

  // ── Bot head vs all snake bodies (same rules as player) ──
  // Each bot can die by running into ANY snake's body, including the player's.
  const botsToKill: Snake[] = []
  for (const bot of alive) {
    if (bot.isPlayer) continue
    if (bot.remote) continue   // remote players' deaths are decided by their own client
    if (bot.spawnGrace > 0) continue
    if (botsToKill.includes(bot)) continue   // already dying this tick

    const hd = headPos(bot)
    const pr = segRadius(bot.score)
    let killed = false

    for (const other of alive) {
      if (killed) break
      // Bots can't die from their own body either
      if (other.id === bot.id) continue
      const or      = segRadius(other.score)
      const hitR    = (pr * 0.7 + or * 0.7) ** 2

      for (let vi = 0; vi < other.numSegs; vi++) {
        const sp = segPos(other, vi * VISUAL_STRIDE)
        if (!sp) break
        const dx = sp.x - hd.x, dy = sp.y - hd.y
        if (dx * dx + dy * dy < hitR) {
          botsToKill.push(bot)
          killed = true
          break
        }
      }
    }
  }

  for (const bot of botsToKill) {
    spawnDeathFood(state, bot)
    bot.alive = false
    const botId  = bot.id
    const botSkin = bot.skinId
    setTimeout(() => {
      const s = state.snakes.find(x => x.id === botId)
      if (s) {
        const pos   = { x: 250 + Math.random() * (WORLD_W - 500), y: 250 + Math.random() * (WORLD_H - 500) }
        const fresh = makeSnake(s.id, s.name, s.colors, pos, false, botSkin)
        Object.assign(s, fresh)
      }
    }, 4000)
  }

  return false
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderScene(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  state: GState,
  theme: ThemeId,
  camX: number, camY: number,
  tick: number,
  zoom: number = 1,
) {
  const th = THEMES[theme]

  const sx = (wx: number) => (wx - camX) * zoom + W * 0.5
  const sy = (wy: number) => (wy - camY) * zoom + H * 0.5

  const pad = 80
  function inView(wx: number, wy: number, r: number) {
    const scx = sx(wx), scy = sy(wy)
    return scx > -r - pad && scx < W + r + pad && scy > -r - pad && scy < H + r + pad
  }

  // ── Clear ──
  ctx.fillStyle = th.bg
  ctx.fillRect(0, 0, W, H)

  // ── Grid ──
  const GRID = 55 * zoom
  const ox = ((W * 0.5 - camX * zoom) % GRID + GRID) % GRID
  const oy = ((H * 0.5 - camY * zoom) % GRID + GRID) % GRID
  ctx.strokeStyle = th.grid
  ctx.lineWidth = 0.8
  ctx.beginPath()
  for (let x = ox - GRID; x < W + GRID; x += GRID) { ctx.moveTo(x, 0); ctx.lineTo(x, H) }
  for (let y = oy - GRID; y < H + GRID; y += GRID) { ctx.moveTo(0, y); ctx.lineTo(W, y) }
  ctx.stroke()

  // ── World border ──
  const bx1 = sx(0), by1 = sy(0)
  const bx2 = sx(WORLD_W), by2 = sy(WORLD_H)
  ctx.save()
  ctx.shadowBlur  = 24
  ctx.shadowColor = th.border
  ctx.strokeStyle = th.border
  ctx.lineWidth   = 3
  ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1)
  // Inner glow strip
  ctx.shadowBlur  = 8
  ctx.lineWidth   = 1.2
  ctx.globalAlpha = 0.4
  ctx.strokeRect(bx1 + 4, by1 + 4, bx2 - bx1 - 8, by2 - by1 - 8)
  ctx.restore()

  // ── Food ──
  for (const f of state.food) {
    if (!inView(f.x, f.y, f.r + 10)) continue
    const fx = sx(f.x), fy = sy(f.y)
    const fr = f.r * zoom

    ctx.save()
    ctx.shadowBlur  = 10 * zoom
    ctx.shadowColor = f.color
    ctx.fillStyle   = f.color
    ctx.beginPath()
    ctx.arc(fx, fy, fr, 0, Math.PI * 2)
    ctx.fill()
    // Specular highlight
    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.5
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(fx - fr * 0.28, fy - fr * 0.28, fr * 0.38, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ── Particles ──
  ctx.save()
  for (const p of state.particles) {
    if (!inView(p.x, p.y, p.r + 4)) continue
    const alpha = (p.life / p.maxLife) * 0.9
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(sx(p.x), sy(p.y), p.r * zoom, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // ── Snakes ──
  const visSnakes = state.snakes.filter(s => {
    if (!s.alive) return false
    const hd = headPos(s)
    return inView(hd.x, hd.y, segRadius(s.score) * 40)
  })

  for (const snake of visSnakes) {
    renderSnake(ctx, snake, sx, sy, W, H, tick, zoom)
  }

  // ── Name tags ──
  ctx.save()
  ctx.font = "bold 11px 'Segoe UI', system-ui, sans-serif"
  ctx.textAlign = "center"
  for (const snake of visSnakes) {
    const hd = headPos(snake)
    const r  = segRadius(snake.score) * zoom
    const nhx = sx(hd.x)
    const nhy = sy(hd.y) - r * 1.5 - 8
    if (nhx < -60 || nhx > W + 60 || nhy < -20 || nhy > H + 20) continue

    const label = snake.isPlayer ? `${snake.name} ★` : snake.name
    const tw = ctx.measureText(label).width
    // Pill bg
    ctx.globalAlpha = 0.72
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    ctx.beginPath()
    ctx.roundRect(nhx - tw * 0.5 - 5, nhy - 11, tw + 10, 16, 4)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = snake.colors.name
    ctx.fillText(label, nhx, nhy)
  }
  ctx.restore()
}

// ─── Skin rendering helpers ───────────────────────────────────────────────────

function pathHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.5)
  ctx.bezierCurveTo(cx - r * 1.2, cy,         cx - r * 1.2, cy - r * 0.8, cx, cy - r * 0.2)
  ctx.bezierCurveTo(cx + r * 1.2, cy - r * 0.8, cx + r * 1.2, cy,         cx, cy + r * 0.5)
  ctx.closePath()
}

function pathStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const inner = r * 0.42
  ctx.beginPath()
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI / 5) - Math.PI / 2
    const rad = k % 2 === 0 ? r : inner
    if (k === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
    else         ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
  }
  ctx.closePath()
}

function renderSnake(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  sx: (x: number) => number,
  sy: (y: number) => number,
  W: number, H: number,
  tick: number,
  zoom: number = 1,
) {
  const skin            = SKINS[snake.skinId]
  const { colors, numSegs } = snake
  const sr              = segRadius(snake.score) * zoom
  const isGhosting      = snake.spawnGrace > 0

  // ── Body segments (tail → head) ──
  for (let i = numSegs - 1; i >= 0; i--) {
    const pos = segPos(snake, i * VISUAL_STRIDE)
    if (!pos) continue
    const scx = sx(pos.x), scy = sy(pos.y)
    if (scx < -sr * 3 || scx > W + sr * 3 || scy < -sr * 3 || scy > H + sr * 3) continue

    const isHead = i === 0
    const r      = isHead ? sr * 1.12 : sr

    // ── Colour override per skin ──
    let bcolor: string
    if (skin.segStyle === 'rainbow') {
      const hue = ((i * 26) + tick * 3) % 360
      bcolor = `hsl(${hue},100%,62%)`
    } else {
      bcolor = isHead ? colors.head : (i % 2 === 0 ? colors.b1 : colors.b2)
    }

    // ── Grace-period flicker (semi-transparent) ──
    const baseAlpha = isGhosting ? (Math.sin(tick * 0.4) * 0.3 + 0.5) : 1

    // ── Outer glow ──
    const glowR = r * (skin.segStyle === 'ghost' ? 2.1 : 1.55)
    ctx.globalAlpha = baseAlpha * (skin.segStyle === 'ghost' ? 0.10 : 0.22)
    ctx.fillStyle   = skin.segStyle === 'rainbow'
      ? `hsla(${((i * 26) + tick * 3) % 360},100%,62%,0.35)` : colors.glow
    ctx.beginPath()
    ctx.arc(scx, scy, glowR, 0, Math.PI * 2)
    ctx.fill()

    // ── Body ──
    ctx.globalAlpha = baseAlpha * (skin.segStyle === 'ghost' ? (isHead ? 0.75 : 0.45) : 1)
    if (skin.segStyle === 'lava') {
      ctx.shadowBlur  = 14 + Math.sin(tick * 0.12 + i * 0.4) * 7
      ctx.shadowColor = '#ff7700'
    }
    ctx.fillStyle = bcolor
    ctx.beginPath()
    ctx.arc(scx, scy, r, 0, Math.PI * 2)
    ctx.fill()
    if (skin.segStyle === 'lava') { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent' }

    // ── Spotted decoration (sausage cream spots, zombie decay, cookie chips) ──
    if (skin.segStyle === 'spotted' && !isHead && skin.spotCol) {
      const sa1 = (i * 1.9) % (Math.PI * 2)
      const sa2 = sa1 + Math.PI * 0.7
      const sOff = r * 0.42
      const sR   = r * 0.22
      ctx.globalAlpha = baseAlpha * 0.60
      ctx.fillStyle   = skin.spotCol
      ctx.beginPath(); ctx.arc(scx + Math.cos(sa1) * sOff, scy + Math.sin(sa1) * sOff, sR,       0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(scx + Math.cos(sa2) * sOff, scy + Math.sin(sa2) * sOff, sR * 0.7, 0, Math.PI * 2); ctx.fill()
    }

    // ── Specular highlight + shadow (skip for ghost) ──
    if (skin.segStyle !== 'ghost') {
      ctx.globalAlpha = baseAlpha * 0.28; ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(scx - r * 0.28, scy - r * 0.28, r * 0.48, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = baseAlpha * 0.15; ctx.fillStyle = '#000000'
      ctx.beginPath(); ctx.arc(scx + r * 0.2, scy + r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill()
    }

    ctx.globalAlpha = 1
  }

  // ── Eyes on head ──
  const hp = segPos(snake, 0)
  if (!hp) return
  const hscx = sx(hp.x), hscy = sy(hp.y)
  if (hscx < -sr * 3 || hscx > W + sr * 3 || hscy < -sr * 3 || hscy > H + sr * 3) return

  const ang    = snake.angle
  const style  = skin.eyeStyle
  const eyeOff = sr * 0.54
  let   eyeR   = sr * 0.31
  let   pupilR = eyeR * 0.58
  let   pupOff = eyeR * 0.28

  if (style === 'googly') { eyeR *= 1.35; pupilR = eyeR * 0.30; pupOff = eyeR * 0.52 }
  if (style === 'scared') { eyeR *= 1.20; pupilR *= 0.42;       pupOff = eyeR * 0.58 }

  // ── Happy: closed crescents ──
  if (style === 'happy') {
    ctx.save()
    ctx.lineWidth = eyeR * 0.65
    ctx.lineCap   = 'round'
    for (const side of [-1, 1]) {
      const perpAng = ang + side * (Math.PI / 2 - 0.15)
      const ex = hscx + Math.cos(perpAng) * eyeOff
      const ey = hscy + Math.sin(perpAng) * eyeOff
      ctx.fillStyle = '#f0f0f0'
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill()
      // Arc opens away from body (perpAng direction) → looks like ^^ squinting smile
      ctx.strokeStyle = '#222'
      ctx.beginPath()
      ctx.arc(ex, ey, eyeR * 0.52, perpAng - Math.PI / 2 + 0.3, perpAng + Math.PI / 2 - 0.3, true)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  // ── All other eye styles ──
  for (const side of [-1, 1]) {
    const perpAng = ang + side * (Math.PI / 2 - 0.15)
    let ex = hscx + Math.cos(perpAng) * eyeOff
    let ey = hscy + Math.sin(perpAng) * eyeOff

    // Googly: seeded wobble so eyes look silly/crossed
    if (style === 'googly') {
      const seed = ((snake.id * 7 + (side > 0 ? 3 : 0)) % 8) * 0.25
      ex += Math.cos(seed + tick * 0.03) * eyeR * 0.12
      ey += Math.sin(seed + tick * 0.05) * eyeR * 0.12
    }

    // White sclera
    ctx.fillStyle = '#f0f0f0'
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill()

    // Pupil position
    const px = ex + Math.cos(ang) * pupOff
    const py = ey + Math.sin(ang) * pupOff

    if (style === 'heart') {
      ctx.fillStyle = '#cc0033'
      pathHeart(ctx, px, py, pupilR)
      ctx.fill()
    } else if (style === 'star') {
      ctx.fillStyle   = '#ffcc00'
      ctx.shadowBlur  = 4
      ctx.shadowColor = '#ffaa00'
      pathStar(ctx, px, py, pupilR * 1.1)
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      // normal / googly / scared — regular circle pupil
      ctx.fillStyle = '#111'
      ctx.beginPath(); ctx.arc(px, py, pupilR, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.arc(px - pupilR * 0.25, py - pupilR * 0.25, pupilR * 0.28, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Angry brows: outer-back to inner-forward, slanting down = 😠 V ──
    if (style === 'angry') {
      const perpX2 = Math.cos(perpAng), perpY2 = Math.sin(perpAng)
      const fwdX   = Math.cos(ang),     fwdY   = Math.sin(ang)
      const b1x = ex + perpX2 * eyeR * 1.5 - fwdX * eyeR * 0.55  // outer-back (high)
      const b1y = ey + perpY2 * eyeR * 1.5 - fwdY * eyeR * 0.55
      const b2x = ex + perpX2 * eyeR * 0.9 + fwdX * eyeR * 0.55  // inner-fwd (low)
      const b2y = ey + perpY2 * eyeR * 0.9 + fwdY * eyeR * 0.55
      ctx.save()
      ctx.strokeStyle = '#1a0a00'
      ctx.lineWidth   = eyeR * 0.42
      ctx.lineCap     = 'round'
      ctx.beginPath(); ctx.moveTo(b1x, b1y); ctx.lineTo(b2x, b2y); ctx.stroke()
      ctx.restore()
    }
  }
}

function renderDirectionCursor(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  mouseX: number, mouseY: number,
  headScreenX: number, headScreenY: number,
  colors: SnakeColors,
  boosting: boolean,
) {
  const dx = mouseX - headScreenX
  const dy = mouseY - headScreenY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 8) return

  const nx = dx / dist
  const ny = dy / dist

  ctx.save()

  // ── Faint guide line from head toward cursor ──
  const lineStart = 28          // px from head where line starts
  const lineEnd   = Math.max(lineStart + 10, dist - 18)
  ctx.setLineDash([5, 8])
  ctx.lineDashOffset = (Date.now() / 40) % 13   // animated march
  ctx.globalAlpha  = 0.22
  ctx.strokeStyle  = colors.b2
  ctx.lineWidth    = 1.4
  ctx.beginPath()
  ctx.moveTo(headScreenX + nx * lineStart, headScreenY + ny * lineStart)
  ctx.lineTo(headScreenX + nx * lineEnd,   headScreenY + ny * lineEnd)
  ctx.stroke()
  ctx.setLineDash([])

  // ── Arrow ahead of head (30 px out) ──
  if (dist > 42) {
    const ax = headScreenX + nx * 34
    const ay = headScreenY + ny * 34
    const perpX = -ny * 6
    const perpY =  nx * 6
    const tipX  = ax + nx * 13
    const tipY  = ay + ny * 13

    ctx.globalAlpha  = boosting ? 0.95 : 0.7
    ctx.shadowBlur   = boosting ? 14 : 8
    ctx.shadowColor  = colors.glow.replace("55", "cc")
    ctx.fillStyle    = boosting ? colors.head : colors.b2
    ctx.beginPath()
    ctx.moveTo(tipX,          tipY)
    ctx.lineTo(ax + perpX,    ay + perpY)
    ctx.lineTo(ax - perpX,    ay - perpY)
    ctx.closePath()
    ctx.fill()
  }

  // ── Target ring at mouse position ──
  const ringR = boosting ? 11 : 9
  ctx.globalAlpha  = boosting ? 0.90 : 0.68
  ctx.shadowBlur   = boosting ? 18 : 10
  ctx.shadowColor  = colors.glow.replace("55", "bb")
  ctx.strokeStyle  = boosting ? colors.head : colors.b2
  ctx.lineWidth    = boosting ? 2.2 : 1.8
  ctx.beginPath()
  ctx.arc(mouseX, mouseY, ringR, 0, Math.PI * 2)
  ctx.stroke()

  // Inner dot
  ctx.globalAlpha = boosting ? 1 : 0.75
  ctx.shadowBlur  = 6
  ctx.fillStyle   = boosting ? colors.head : colors.b1
  ctx.beginPath()
  ctx.arc(mouseX, mouseY, boosting ? 3.5 : 2.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = 1
  ctx.shadowBlur  = 0
  ctx.restore()
}

function renderHUD(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  state: GState,
) {
  const player = state.snakes.find(s => s.isPlayer && s.alive)

  // ── Score pill (top-left) ──
  if (player) {
    const scoreText = `Length  ${player.numSegs}`
    const scoreLen  = `Score  ${Math.floor(player.score)}`
    ctx.save()
    ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif"
    const tw = Math.max(ctx.measureText(scoreText).width, ctx.measureText(scoreLen).width)
    const bw = tw + 24, bh = 52
    // Panel
    ctx.fillStyle   = "rgba(0,0,0,0.55)"
    ctx.strokeStyle = "rgba(255,255,255,0.1)"
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.roundRect(12, 12, bw, bh, 10)
    ctx.fill()
    ctx.stroke()
    // Text
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.fillText(scoreText, 24, 33)
    ctx.fillStyle = "rgba(255,255,255,0.58)"
    ctx.font      = "13px 'Segoe UI', system-ui, sans-serif"
    ctx.fillText(scoreLen, 24, 52)
    ctx.restore()
  }

  // ── Leaderboard (top-right) ──
  const sorted = [...state.snakes]
    .filter(s => s.alive)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (sorted.length > 0) {
    ctx.save()
    const lbW = 168, lbH = 30 + sorted.length * 20
    const lbX = W - lbW - 12, lbY = 12

    ctx.fillStyle   = "rgba(0,0,0,0.55)"
    ctx.strokeStyle = "rgba(255,255,255,0.1)"
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.roundRect(lbX, lbY, lbW, lbH, 10)
    ctx.fill()
    ctx.stroke()

    ctx.font      = "bold 10px 'Segoe UI', system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.40)"
    ctx.textAlign = "left"
    ctx.fillText("LEADERBOARD", lbX + 10, lbY + 16)

    ctx.font = "13px 'Segoe UI', system-ui, sans-serif"
    sorted.forEach((s, i) => {
      const ty = lbY + 30 + i * 20
      ctx.fillStyle = s.isPlayer ? "#ffd700" : "rgba(255,255,255,0.70)"
      const rank = `${i + 1}. ${s.name.slice(0, 9).padEnd(9, " ")}  ${Math.floor(s.score)}`
      ctx.fillText(rank, lbX + 10, ty)
    })
    ctx.restore()
  }

  // ── Minimap (bottom-right) ──
  const mmSize = 120
  const mmX    = W - mmSize - 14
  const mmY    = H - mmSize - 14
  const scaleX = mmSize / WORLD_W
  const scaleY = mmSize / WORLD_H

  ctx.save()
  ctx.fillStyle   = "rgba(0,0,0,0.50)"
  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.roundRect(mmX - 3, mmY - 3, mmSize + 6, mmSize + 6, 6)
  ctx.fill()
  ctx.stroke()

  // Food dots (sparse sample)
  ctx.globalAlpha = 0.35
  for (const f of state.food) {
    if (Math.random() > 0.15) continue
    ctx.fillStyle = f.color
    ctx.fillRect(mmX + f.x * scaleX - 0.5, mmY + f.y * scaleY - 0.5, 1.5, 1.5)
  }

  // Snakes
  ctx.globalAlpha = 1
  for (const s of state.snakes) {
    if (!s.alive) continue
    const hd = headPos(s)
    ctx.fillStyle = s.isPlayer ? "#ffffff" : s.colors.b1
    ctx.globalAlpha = s.isPlayer ? 1 : 0.85
    ctx.beginPath()
    ctx.arc(mmX + hd.x * scaleX, mmY + hd.y * scaleY, s.isPlayer ? 3.5 : 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  // ── Boost hint ──
  if (player && player.score > 5) {
    ctx.save()
    ctx.font      = "11px 'Segoe UI', system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.28)"
    ctx.textAlign = "center"
    ctx.fillText("Hold CLICK or SPACE to boost", W * 0.5, H - 16)
    ctx.restore()
  }
}

// ─── React component ──────────────────────────────────────────────────────────

export function SlitherGame() {
  const [phase,     setPhase]     = useState<Phase>("menu")
  const [nickname,  setNickname]  = useState("")
  const [theme,     setTheme]     = useState<ThemeId>("classic")
  const [skin,      setSkin]      = useState<SkinId>("classic")
  const [showGuide, setShowGuide] = useState(false)
  const [deathInfo, setDeathInfo] = useState({ score: 0, rank: 0 })

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const stateRef   = useRef<GState | null>(null)
  const mouseRef   = useRef<Vec2>({ x: 0, y: 0 })
  const boostRef   = useRef(false)
  const rafRef     = useRef(0)
  const camRef     = useRef<Vec2>({ x: WORLD_W / 2, y: WORLD_H / 2 })
  const zoomRef    = useRef(1)
  const phaseRef   = useRef<Phase>("menu")

  // Multiplayer
  const meIdRef     = useRef<string>("")
  const remoteRef   = useRef<Map<string, Snake>>(new Map())
  const remoteIdRef = useRef(10000)
  const [mpLive,    setMpLive]    = useState(false)
  const [mpPlayers, setMpPlayers] = useState(0)
  if (!meIdRef.current) {
    meIdRef.current =
      (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `p_${Math.random().toString(36).slice(2)}_${Date.now()}`
  }

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase }, [phase])

  // ── Start game ──
  const startGame = useCallback(() => {
    stateRef.current = initState(nickname, skin)
    const p = stateRef.current.snakes.find(s => s.isPlayer)
    if (p) { camRef.current = { x: p.physX, y: p.physY } }
    zoomRef.current = 1
    setPhase("playing")
  }, [nickname, skin])

  // ── Game loop ──
  useEffect(() => {
    if (phase !== "playing") return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function loop() {
      if (phaseRef.current !== "playing") return
      const gs = stateRef.current
      if (!gs) return

      const dpr = window.devicePixelRatio || 1
      const W   = canvas!.offsetWidth
      const H   = canvas!.offsetHeight
      canvas!.width  = W * dpr
      canvas!.height = H * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Smooth camera follow + zoom-out as the snake grows
      const player = gs.snakes.find(s => s.isPlayer && s.alive)
      if (player) {
        const hd = headPos(player)
        camRef.current.x = lerp(camRef.current.x, hd.x, 0.12)
        camRef.current.y = lerp(camRef.current.y, hd.y, 0.12)
        const tgtZoom = zoomForRadius(segRadius(player.score))
        zoomRef.current = lerp(zoomRef.current, tgtZoom, 0.05)
      }
      const zoom = zoomRef.current

      // Mouse angle relative to canvas centre
      const mx  = mouseRef.current.x - W * 0.5
      const my  = mouseRef.current.y - H * 0.5
      const mAng = Math.atan2(my, mx)

      const died = updateGame(gs, mAng, boostRef.current)

      // Smoothly interpolate remote players toward their latest networked body
      for (const s of gs.snakes) {
        if (!s.remote || !s.targetPath) continue
        const tp = s.targetPath
        if (s.path.length !== tp.length) {
          s.path = tp.map(p => ({ x: p.x, y: p.y }))
        } else {
          for (let i = 0; i < tp.length; i++) {
            s.path[i].x = lerp(s.path[i].x, tp[i].x, 0.3)
            s.path[i].y = lerp(s.path[i].y, tp[i].y, 0.3)
          }
        }
      }

      renderScene(ctx!, W, H, gs, theme, camRef.current.x, camRef.current.y, gs.tick, zoom)
      renderHUD(ctx!, W, H, gs)

      // ── Direction cursor (player only) ──
      if (player) {
        const hd = headPos(player)
        const hScreenX = (hd.x - camRef.current.x) * zoom + W * 0.5
        const hScreenY = (hd.y - camRef.current.y) * zoom + H * 0.5
        renderDirectionCursor(
          ctx!, W, H,
          mouseRef.current.x, mouseRef.current.y,
          hScreenX, hScreenY,
          player.colors,
          boostRef.current,
        )
      }

      if (died) {
        setDeathInfo({ score: gs.deathScore, rank: gs.deathRank })
        setPhase("dead")
        return
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, theme])

  // ── Multiplayer sync (HTTP polling) ──
  useEffect(() => {
    if (phase !== "playing") return
    let stopped = false
    const meId = meIdRef.current

    function applyRemote(gs: GState, players: RemotePlayer[]) {
      const seen = new Set<string>()
      for (const p of players) {
        if (!p || !p.id || !Array.isArray(p.pts)) continue
        const target = remotePathFromPts(p.pts, p.score || 0)
        if (target.length === 0) continue
        seen.add(p.id)

        const skinId: SkinId =
          (SKIN_IDS as readonly string[]).includes(p.skin || "") ? (p.skin as SkinId) : "classic"
        const sk = SKINS[skinId]
        const colors: SnakeColors = { b1: sk.b1, b2: sk.b2, head: sk.head, glow: sk.glow, name: sk.name }
        const numSegs = target.length / 2
        const name = (p.name || "Player").slice(0, 14)
        const angle = target.length >= 4
          ? Math.atan2(target[0].y - target[2].y, target[0].x - target[2].x)
          : 0

        let snake = remoteRef.current.get(p.id)
        if (!snake) {
          snake = {
            id: remoteIdRef.current++, name, colors,
            path: target.map(q => ({ x: q.x, y: q.y })), pathAccum: 0,
            physX: target[0].x, physY: target[0].y,
            numSegs, angle, tgtAngle: angle, speed: BASE_SPEED, boosting: false,
            alive: true, isPlayer: false, score: p.score || 0, skinId,
            spawnGrace: 0, remote: true, targetPath: target,
            aiFood: -1, aiTimer: 0, aiWander: 0,
          }
          remoteRef.current.set(p.id, snake)
          gs.snakes.push(snake)
        } else {
          snake.name = name; snake.colors = colors; snake.skinId = skinId
          snake.score = p.score || 0; snake.numSegs = numSegs; snake.angle = angle
          snake.targetPath = target
          if (snake.path.length !== target.length) snake.path = target.map(q => ({ x: q.x, y: q.y }))
          snake.physX = target[0].x; snake.physY = target[0].y
          if (!gs.snakes.includes(snake)) gs.snakes.push(snake)
        }
      }
      // Drop players who left / went stale
      for (const [id, snake] of remoteRef.current) {
        if (seen.has(id)) continue
        remoteRef.current.delete(id)
        const idx = gs.snakes.indexOf(snake)
        if (idx >= 0) gs.snakes.splice(idx, 1)
      }
    }

    async function tick() {
      if (stopped) return
      const gs = stateRef.current
      if (!gs) return
      const player = gs.snakes.find(s => s.isPlayer && s.alive)
      const body = player
        ? { room: MP_ROOM, me: {
            id: meId,
            name: player.name,
            skin: player.skinId,
            score: Math.floor(player.score),
            pts: samplePlayerPts(player),
          } }
        : { room: MP_ROOM, me: { id: meId }, leave: true }

      try {
        const res = await fetch("/api/slither/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (stopped) return
        const data = await res.json() as { enabled?: boolean; players?: RemotePlayer[] }
        const current = stateRef.current
        if (current) applyRemote(current, data.players || [])
        setMpLive(!!data.enabled)
        setMpPlayers((data.players || []).length)
      } catch {
        /* network blip — keep last known remotes */
      }
    }

    const iv = setInterval(tick, MP_POLL_MS)
    tick()

    return () => {
      stopped = true
      clearInterval(iv)
      // Best-effort "leave" so others drop us immediately
      try {
        const blob = new Blob(
          [JSON.stringify({ room: MP_ROOM, me: { id: meId }, leave: true })],
          { type: "application/json" },
        )
        navigator.sendBeacon("/api/slither/sync", blob)
      } catch { /* ignore */ }
      const gs = stateRef.current
      if (gs) gs.snakes = gs.snakes.filter(s => !s.remote)
      remoteRef.current.clear()
      setMpPlayers(0)
    }
  }, [phase])

  // ── Input events ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMove  = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onDown  = () => { boostRef.current = true }
    const onUp    = () => { boostRef.current = false }
    const onTouch = (e: TouchEvent) => {
      const r = canvas.getBoundingClientRect()
      const t = e.touches[0]
      if (t) mouseRef.current = { x: t.clientX - r.left, y: t.clientY - r.top }
      boostRef.current = e.touches.length > 1
    }
    const onKeyD  = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); boostRef.current = true } }
    const onKeyU  = (e: KeyboardEvent) => { if (e.code === "Space") boostRef.current = false }

    canvas.addEventListener("mousemove", onMove)
    canvas.addEventListener("mousedown", onDown)
    canvas.addEventListener("mouseup",   onUp)
    canvas.addEventListener("touchmove", onTouch, { passive: true })
    canvas.addEventListener("touchstart", onTouch, { passive: true })
    canvas.addEventListener("touchend",  () => { boostRef.current = false })
    window.addEventListener("keydown",   onKeyD)
    window.addEventListener("keyup",     onKeyU)

    return () => {
      canvas.removeEventListener("mousemove", onMove)
      canvas.removeEventListener("mousedown", onDown)
      canvas.removeEventListener("mouseup",   onUp)
      canvas.removeEventListener("touchmove", onTouch)
      canvas.removeEventListener("touchstart", onTouch)
      canvas.removeEventListener("touchend",  () => {})
      window.removeEventListener("keydown",   onKeyD)
      window.removeEventListener("keyup",     onKeyU)
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  const themeObj = THEMES[theme]

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: themeObj.bg, cursor: phase === "playing" ? "none" : "default" }}
    >
      {/* Canvas fills screen */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      />

      {/* ── Live multiplayer badge ── */}
      {phase === "playing" && mpLive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90 backdrop-blur-sm pointer-events-none">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          LIVE · {mpPlayers} {mpPlayers === 1 ? "player" : "players"} online
        </div>
      )}

      {/* ── Menu overlay ── */}
      <AnimatePresence>
        {phase === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(12px)" }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-5 w-full max-w-sm px-6"
            >
              {/* Logo */}
              <div className="text-center mb-2">
                <h1
                  className="font-black uppercase tracking-[-0.02em] leading-none"
                  style={{
                    fontSize: "clamp(60px, 14vw, 96px)",
                    background: "linear-gradient(135deg, #ff3366 0%, #ff9f43 55%, #ff6bff 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 32px rgba(255,51,102,0.5))",
                  }}
                >
                  SLITHER
                </h1>
                <p className="text-[13px] tracking-[0.22em] uppercase font-medium mt-2"
                   style={{ color: "rgba(255,255,255,0.38)" }}>
                  Eat · Grow · Dominate
                </p>
              </div>

              {/* Nickname */}
              <div className="w-full">
                <label className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-2"
                       style={{ color: "rgba(255,255,255,0.45)" }}>
                  Your Nickname
                </label>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value.slice(0, 16))}
                  onKeyDown={e => e.key === "Enter" && startGame()}
                  placeholder="Enter nickname…"
                  maxLength={16}
                  spellCheck={false}
                  className="w-full px-4 py-3 rounded-xl text-[15px] font-semibold outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                  }}
                  onFocus={e => (e.currentTarget.style.border = "1px solid rgba(255,51,102,0.7)")}
                  onBlur={e  => (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.14)")}
                />
              </div>

              {/* Theme selector */}
              <div className="w-full">
                <label className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-2"
                       style={{ color: "rgba(255,255,255,0.45)" }}>
                  Background
                </label>
                <div className="flex gap-2">
                  {(Object.keys(THEMES) as ThemeId[]).map(tid => (
                    <button
                      key={tid}
                      onClick={() => setTheme(tid)}
                      title={THEMES[tid].label}
                      className="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-lg transition-all"
                      style={{
                        background: tid === theme
                          ? `${THEMES[tid].border}22`
                          : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${tid === theme ? THEMES[tid].border : "rgba(255,255,255,0.10)"}`,
                        boxShadow: tid === theme ? `0 0 12px ${THEMES[tid].border}44` : "none",
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ background: THEMES[tid].bg, border: `2px solid ${THEMES[tid].border}` }}
                      />
                      <span className="text-[9px] font-bold uppercase tracking-widest"
                            style={{ color: tid === theme ? THEMES[tid].border : "rgba(255,255,255,0.35)" }}>
                        {THEMES[tid].label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin selector */}
              <div className="w-full">
                <label className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-2"
                       style={{ color: "rgba(255,255,255,0.45)" }}>
                  Snake Skin
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.keys(SKINS) as SkinId[]).map(sid => {
                    const s = SKINS[sid]
                    const active = sid === skin
                    return (
                      <button
                        key={sid}
                        onClick={() => setSkin(sid)}
                        title={s.tagline}
                        className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all"
                        style={{
                          background: active ? `${s.b1}28` : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${active ? s.b1 : "rgba(255,255,255,0.10)"}`,
                          boxShadow: active ? `0 0 12px ${s.b1}55` : "none",
                        }}
                      >
                        <span className="text-[18px] leading-none">{s.emoji}</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest leading-none"
                              style={{ color: active ? s.b1 : "rgba(255,255,255,0.35)" }}>
                          {s.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Buttons row */}
              <div className="flex gap-3 w-full mt-1">
                <button
                  onClick={() => setShowGuide(true)}
                  className="flex-1 py-3 rounded-xl text-[13px] font-bold uppercase tracking-[0.15em] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1.5px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.65)",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.13)"
                    e.currentTarget.style.color = "#fff"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.07)"
                    e.currentTarget.style.color = "rgba(255,255,255,0.65)"
                  }}
                >
                  How to Play
                </button>
                <button
                  onClick={startGame}
                  className="flex-[2] py-3 rounded-xl text-[14px] font-black uppercase tracking-[0.15em] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #ff3366, #ff6bff)",
                    color: "#fff",
                    boxShadow: "0 4px 22px rgba(255,51,102,0.45)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 30px rgba(255,51,102,0.65)" }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 22px rgba(255,51,102,0.45)" }}
                >
                  ▶ Play
                </button>
              </div>

              {/* Controls hint */}
              <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
                Move mouse to steer · Click or Space to boost
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── How to Play modal ── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            key="guide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-50"
            style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(16px)" }}
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.90, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm mx-6 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(10,8,28,0.96)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between"
                   style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="font-black text-[18px] tracking-tight text-white">How to Play</span>
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] transition-colors"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.18)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)" }}
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-5">
                {[
                  {
                    icon: "🎯", title: "Objective",
                    lines: ["Grow your snake as long as possible by eating glowing orbs.", "Outlast every other snake on the arena."],
                  },
                  {
                    icon: "🕹", title: "Controls",
                    lines: ["Mouse — steer your snake toward the cursor", "Click or Space — activate boost (shrinks tail)", "Touch — drag to steer, two fingers to boost"],
                  },
                  {
                    icon: "💡", title: "Tips & Strategy",
                    lines: [
                      "Encircle smaller snakes to trap them",
                      "Cross in front of bigger snakes — they'll crash into you",
                      "Use boost to escape danger or cut off enemies",
                      "Snakes that die leave behind glowing food — feast!",
                    ],
                  },
                  {
                    icon: "⚠️", title: "Game Over",
                    lines: ["Your snake dies if it hits any other snake's body.", "Your own body is always safe — coil up freely!"],
                  },
                ].map(sec => (
                  <div key={sec.title}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[18px]">{sec.icon}</span>
                      <span className="font-bold text-[13px] uppercase tracking-[0.15em]"
                            style={{ color: "rgba(255,255,255,0.85)" }}>
                        {sec.title}
                      </span>
                    </div>
                    <ul className="space-y-1 ml-7">
                      {sec.lines.map((l, i) => (
                        <li key={i} className="text-[12px] leading-relaxed"
                            style={{ color: "rgba(255,255,255,0.52)" }}>
                          · {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-full py-3 rounded-xl font-black text-[13px] uppercase tracking-[0.15em] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #ff3366, #ff6bff)",
                    color: "#fff",
                    boxShadow: "0 4px 18px rgba(255,51,102,0.4)",
                  }}
                >
                  Got it — Play!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Death screen ── */}
      <AnimatePresence>
        {phase === "dead" && (
          <motion.div
            key="death"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)" }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 28 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: "spring", damping: 20, stiffness: 280 }}
              className="flex flex-col items-center gap-4 text-center px-8 py-8 rounded-2xl w-full max-w-xs"
              style={{
                background: "rgba(10,6,28,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              }}
            >
              <span className="text-5xl">💀</span>
              <h2
                className="font-black text-[36px] uppercase tracking-tight leading-none"
                style={{
                  background: "linear-gradient(135deg, #ff3366, #ff6bff)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                You Died
              </h2>

              <div className="flex gap-6 mt-1">
                <div className="flex flex-col items-center">
                  <span className="text-[11px] uppercase tracking-[0.2em] font-bold"
                        style={{ color: "rgba(255,255,255,0.38)" }}>Score</span>
                  <span className="text-[28px] font-black text-white">{deathInfo.score}</span>
                </div>
                <div className="w-px" style={{ background: "rgba(255,255,255,0.10)" }} />
                <div className="flex flex-col items-center">
                  <span className="text-[11px] uppercase tracking-[0.2em] font-bold"
                        style={{ color: "rgba(255,255,255,0.38)" }}>Rank</span>
                  <span className="text-[28px] font-black text-white">#{deathInfo.rank}</span>
                </div>
              </div>

              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                {deathInfo.rank === 1
                  ? "🏆 You were the top snake!"
                  : deathInfo.rank <= 3
                  ? "🥈 So close to the top…"
                  : "Keep growing and try again!"}
              </p>

              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => setPhase("menu")}
                  className="flex-1 py-3 rounded-xl text-[12px] font-bold uppercase tracking-[0.15em] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1.5px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)" }}
                >
                  Menu
                </button>
                <button
                  onClick={startGame}
                  className="flex-[2] py-3 rounded-xl text-[14px] font-black uppercase tracking-[0.15em] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #ff3366, #ff6bff)",
                    color: "#fff",
                    boxShadow: "0 4px 22px rgba(255,51,102,0.45)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 30px rgba(255,51,102,0.65)" }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 22px rgba(255,51,102,0.45)" }}
                >
                  ▶ Play Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
