// ─── Rail Runner · Three.js renderer ─────────────────────────────────────────
// Real 3D: perspective chase camera, fog, lit geometry for tracks, trains,
// walls and an articulated runner. World convention matches the game logic:
// lanes at x = laneOffset * LANE_W, player plane at z = 0, +z away from camera.

import * as THREE from 'three'
import type { LaneIndex } from '@/lib/subway-surfer/track'
import { LANE_OFFSETS } from '@/lib/subway-surfer/track'
import { OBSTACLE_LEN, type ObstacleType } from '@/lib/subway-surfer/collision'
import type { PowerupType } from '@/lib/subway-surfer/powerups'

export const LANE_W = 2.2

// ─── Slot mirrors of the game state (same shapes the component keeps) ────────
export interface ObSlot { active: boolean; z: number; lane: LaneIndex; type: ObstacleType; colorId: number; vz: number }
export interface CoinSlot { active: boolean; z: number; lane: LaneIndex; yw: number }
export interface PickSlot { active: boolean; z: number; lane: LaneIndex; kind: PowerupType }

export interface RenderState {
  phase: 'menu' | 'playing' | 'paused' | 'gameover'
  laneX: number
  playerY: number
  isJumping: boolean
  isRolling: boolean
  runPhase: number
  lean: number
  jetpack: boolean
  magnet: boolean
  sneakers: boolean
  speed: number
  scrollOffset: number
  crashT: number
  obstacles: ObSlot[]
  coinObjs: CoinSlot[]
  pickups: PickSlot[]
}

// ─── Canvas-texture helpers (all art generated, nothing downloaded) ──────────

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const c = cv.getContext('2d')!
  draw(c)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function skyTexture(): THREE.CanvasTexture {
  return canvasTex(64, 512, c => {
    const g = c.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#2f8fe0')
    g.addColorStop(0.55, '#7cc4ef')
    g.addColorStop(0.8, '#cfe9f4')
    g.addColorStop(1, '#ffe9c4')
    c.fillStyle = g
    c.fillRect(0, 0, 64, 512)
  })
}

function gravelTexture(): THREE.CanvasTexture {
  const tex = canvasTex(256, 256, c => {
    c.fillStyle = '#7a7165'
    c.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 256, y = Math.random() * 256
      const r = 1 + Math.random() * 2.6
      const v = 70 + Math.floor(Math.random() * 90)
      c.fillStyle = `rgba(${v},${v - 8},${v - 18},${0.5 + Math.random() * 0.5})`
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function wallTexture(seed: number): THREE.CanvasTexture {
  return canvasTex(512, 256, c => {
    const base = 150 + (seed * 37) % 26
    c.fillStyle = `rgb(${base},${base - 14},${base - 30})`
    c.fillRect(0, 0, 512, 256)
    // Panel seams + coping
    c.fillStyle = 'rgba(95,85,70,0.6)'
    c.fillRect(0, 0, 512, 10)
    for (let x = 0; x < 512; x += 128) c.fillRect(x, 0, 3, 256)
    // Drip stains
    c.fillStyle = 'rgba(80,70,58,0.18)'
    for (let i = 0; i < 5; i++) {
      const x = (i * 97 + seed * 53) % 500
      c.fillRect(x, 12, 4 + (i % 3) * 3, 60 + ((i * 67) % 120))
    }
    // Graffiti tag (~60% of variants)
    if ((seed * 7) % 10 < 6) {
      const hues = [205, 345, 40, 135, 285]
      const hue = hues[(seed * 13) % hues.length]
      const gx = 80 + (seed * 91) % 280, gy = 150
      c.fillStyle = `hsl(${hue},82%,52%)`
      c.beginPath()
      for (let b = 0; b < 4; b++) {
        c.ellipse(gx + b * 38, gy + ((b * 29 + seed) % 14) - 7, 24, 38 + (b * 17) % 12, 0, 0, Math.PI * 2)
      }
      c.fill()
      c.fillStyle = `hsl(${(hue + 40) % 360},88%,68%)`
      c.beginPath()
      for (let b = 0; b < 4; b++) {
        c.ellipse(gx + b * 38 - 5, gy - 12, 10, 18, 0, 0, Math.PI * 2)
      }
      c.fill()
      c.strokeStyle = `hsl(${hue},65%,26%)`
      c.lineWidth = 7
      c.beginPath()
      c.moveTo(gx - 34, gy + 48)
      c.quadraticCurveTo(gx + 60, gy + 72, gx + 152, gy + 42)
      c.stroke()
    }
  })
}

function stripeTexture(fg: string, bg: string): THREE.CanvasTexture {
  const tex = canvasTex(128, 64, c => {
    c.fillStyle = bg
    c.fillRect(0, 0, 128, 64)
    c.fillStyle = fg
    for (let x = -64; x < 128; x += 48) {
      c.beginPath()
      c.moveTo(x, 64); c.lineTo(x + 24, 64); c.lineTo(x + 24 + 64, 0); c.lineTo(x + 64, 0)
      c.closePath(); c.fill()
    }
  })
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

function skylineTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 256, c => {
    c.clearRect(0, 0, 1024, 256)
    c.fillStyle = 'rgba(110,140,175,0.85)'
    for (let i = 0; i < 30; i++) {
      const bw = 18 + (i * 29) % 36
      const bh = 40 + (i * 67) % 150
      c.fillRect((i / 30) * 1024, 256 - bh, bw, bh)
    }
    c.fillStyle = 'rgba(130,158,190,0.7)'
    for (let i = 0; i < 18; i++) {
      const bw = 30 + (i * 41) % 50
      const bh = 24 + (i * 53) % 80
      c.fillRect((i / 18) * 1024 + 20, 256 - bh, bw, bh)
    }
  })
}

function cloudTexture(): THREE.CanvasTexture {
  return canvasTex(256, 128, c => {
    c.clearRect(0, 0, 256, 128)
    c.fillStyle = 'rgba(255,255,255,0.95)'
    c.beginPath()
    c.ellipse(128, 78, 95, 32, 0, 0, Math.PI * 2)
    c.ellipse(78, 62, 48, 30, 0, 0, Math.PI * 2)
    c.ellipse(170, 58, 52, 32, 0, 0, Math.PI * 2)
    c.fill()
  })
}

function glowTexture(color: string): THREE.CanvasTexture {
  return canvasTex(128, 128, c => {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 62)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 128, 128)
  })
}

function pickupTexture(kind: PowerupType): THREE.CanvasTexture {
  const colors: Record<PowerupType, string> = {
    magnet: '#e34234', jetpack: '#3a7bc8', multiplier: '#e8a020', sneakers: '#3aa860',
  }
  return canvasTex(128, 128, c => {
    c.clearRect(0, 0, 128, 128)
    // Chip
    c.fillStyle = colors[kind]
    c.beginPath()
    c.roundRect(14, 14, 100, 100, 22)
    c.fill()
    c.strokeStyle = 'rgba(255,255,255,0.9)'
    c.lineWidth = 6
    c.stroke()
    // Icon
    c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineCap = 'round'
    if (kind === 'magnet') {
      c.lineWidth = 16
      c.beginPath(); c.arc(64, 58, 26, Math.PI * 0.05, Math.PI * 0.95, false); c.stroke()
      c.fillRect(28, 36, 18, 22); c.fillRect(82, 36, 18, 22)
    } else if (kind === 'jetpack') {
      c.beginPath()
      c.moveTo(64, 26)
      c.quadraticCurveTo(86, 56, 76, 84); c.lineTo(52, 84)
      c.quadraticCurveTo(42, 56, 64, 26)
      c.fill()
      c.fillStyle = '#ffb020'
      c.beginPath(); c.moveTo(55, 88); c.lineTo(64, 108); c.lineTo(73, 88); c.closePath(); c.fill()
    } else if (kind === 'multiplier') {
      c.font = '900 56px system-ui, sans-serif'
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('×2', 64, 66)
    } else {
      c.beginPath(); c.ellipse(70, 74, 30, 16, 0, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.moveTo(42, 62); c.lineTo(18, 40); c.lineTo(46, 46); c.closePath(); c.fill()
    }
  })
}

// ─── Materials (shared) ───────────────────────────────────────────────────────

const TRAIN_LIVERIES = [
  { body: 0xe8a020, stripe: 0xd23c28 },
  { body: 0x3a7bc8, stripe: 0xe8e8e8 },
  { body: 0xd23c28, stripe: 0xf0d040 },
  { body: 0x3aa860, stripe: 0xe8e8e8 },
]

interface FxParticle {
  sprite: THREE.Sprite
  vel: THREE.Vector3
  life: number
  maxLife: number
  gravity: number
}

// ─── Scene class ──────────────────────────────────────────────────────────────

export class ThreeScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera

  // World
  private gravel!: THREE.Mesh
  private gravelTex!: THREE.CanvasTexture
  private sleepers!: THREE.InstancedMesh
  private wallSegs: THREE.Mesh[] = []
  private posts: THREE.Group[] = []
  private clouds: THREE.Sprite[] = []

  // Pools
  private trainPool: THREE.Group[] = []
  private barrierPool: THREE.Group[] = []
  private lowbarPool: THREE.Group[] = []
  private coinPool: THREE.Mesh[] = []
  private pickupPool: THREE.Sprite[] = []
  private pickupTexs!: Record<PowerupType, THREE.CanvasTexture>

  // Runner
  private runner!: THREE.Group
  private legL!: THREE.Group
  private legR!: THREE.Group
  private armL!: THREE.Group
  private armR!: THREE.Group
  private rollBall!: THREE.Mesh
  private shadowBlob!: THREE.Mesh
  private magnetRing!: THREE.Sprite
  private jetFlames: THREE.Mesh[] = []
  private jetPackMesh!: THREE.Group

  // FX
  private fx: FxParticle[] = []
  private fxFree: THREE.Sprite[] = []
  private dustTex!: THREE.CanvasTexture
  private sparkTex!: THREE.CanvasTexture
  private greenTex!: THREE.CanvasTexture

  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220)
    this.camera.position.set(0, 4.4, -6.8)
    this.camera.lookAt(0, 1.6, 14)

    this.scene.background = skyTexture()
    this.scene.fog = new THREE.Fog(0xffe9c4, 55, 150)

    // Lights
    this.scene.add(new THREE.HemisphereLight(0xbfdfff, 0x8a7a60, 1.05))
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.6)
    sun.position.set(26, 55, 30)
    this.scene.add(sun)

    this.buildWorld()
    this.buildPools()
    this.buildRunner()
    this.buildFx()
    this.resize()
  }

  // ── World ───────────────────────────────────────────────────────────────────
  private buildWorld() {
    // Gravel bed
    this.gravelTex = gravelTexture()
    this.gravelTex.repeat.set(3, 40)
    this.gravel = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 170),
      new THREE.MeshLambertMaterial({ map: this.gravelTex }),
    )
    this.gravel.rotation.x = -Math.PI / 2
    this.gravel.position.set(0, 0, 70)
    this.scene.add(this.gravel)

    // Side ground (dirt aprons beyond the walls)
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 170),
      new THREE.MeshLambertMaterial({ color: 0xcbb89a }),
    )
    apron.rotation.x = -Math.PI / 2
    apron.position.set(0, -0.05, 70)
    this.scene.add(apron)

    // Rails — 2 per lane, static (they look identical while scrolling)
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.85, roughness: 0.35 })
    const railGeo = new THREE.BoxGeometry(0.09, 0.14, 170)
    for (const lane of [-1, 0, 1]) {
      for (const off of [-0.72, 0.72]) {
        const rail = new THREE.Mesh(railGeo, railMat)
        rail.position.set(lane * LANE_W + off, 0.13, 70)
        this.scene.add(rail)
      }
    }

    // Sleepers — instanced, scrolled by reposition
    const SLEEP_N = 150
    this.sleepers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.05, 0.1, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x4a3826 }),
      SLEEP_N,
    )
    this.scene.add(this.sleepers)

    // Walls — textured segments, wrapped
    const wallGeo = new THREE.BoxGeometry(0.4, 3.4, 6)
    const wallTexs = [0, 1, 2, 3, 4, 5].map(i => wallTexture(i + 1))
    for (let i = 0; i < 32; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const mat = new THREE.MeshLambertMaterial({ map: wallTexs[(i * 7 + side + 1) % wallTexs.length] })
      const seg = new THREE.Mesh(wallGeo, mat)
      seg.position.set(6.55 * side, 1.7, 0)
      this.scene.add(seg)
      this.wallSegs.push(seg)
    }

    // Catenary posts + crossbeams
    const postMat = new THREE.MeshLambertMaterial({ color: 0x464c54 })
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 5.6, 8)
    const beamGeo = new THREE.BoxGeometry(10.8, 0.12, 0.12)
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group()
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(poleGeo, postMat)
        pole.position.set(5.4 * side, 2.8, 0)
        g.add(pole)
      }
      const beam = new THREE.Mesh(beamGeo, postMat)
      beam.position.set(0, 5.62, 0)
      g.add(beam)
      this.scene.add(g)
      this.posts.push(g)
    }
    // Contact wires — static thin strips
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x32373e })
    const wireGeo = new THREE.BoxGeometry(0.025, 0.025, 170)
    for (const lane of [-1, 0, 1]) {
      const wire = new THREE.Mesh(wireGeo, wireMat)
      wire.position.set(lane * LANE_W, 5.2, 70)
      this.scene.add(wire)
    }

    // Skyline backdrop + clouds + sun glow (unaffected by fog)
    const skyline = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 26),
      new THREE.MeshBasicMaterial({ map: skylineTexture(), transparent: true, fog: false }),
    )
    skyline.position.set(0, 11, 152)
    skyline.rotation.y = Math.PI
    this.scene.add(skyline)

    const cloudT = cloudTexture()
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudT, transparent: true, opacity: 0.92, fog: false }))
      sp.scale.set(26 + (i % 3) * 9, 12 + (i % 2) * 4, 1)
      sp.position.set(-70 + i * 28, 26 + (i * 13) % 12, 148)
      this.scene.add(sp)
      this.clouds.push(sp)
    }

    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,250,215,0.95)'), transparent: true, fog: false, depthWrite: false,
    }))
    sunGlow.scale.set(55, 55, 1)
    sunGlow.position.set(55, 38, 150)
    this.scene.add(sunGlow)
  }

  // ── Object pools ───────────────────────────────────────────────────────────
  private buildPools() {
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x141e2a })
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xc8cdd4 })
    const underMat = new THREE.MeshLambertMaterial({ color: 0x1e2022 })

    // Trains (rear toward camera; nose at +z end)
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group()
      const len = OBSTACLE_LEN.train
      const livery = TRAIN_LIVERIES[i % TRAIN_LIVERIES.length]

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 2.9, len),
        new THREE.MeshLambertMaterial({ color: livery.body }),
      )
      body.position.set(0, 0.45 + 1.45, len / 2)
      g.add(body)

      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.18, len * 0.97), roofMat)
      roof.position.set(0, 3.0, len / 2)
      g.add(roof)
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 1.6), roofMat)
      ac.position.set(0, 3.2, len * 0.35)
      g.add(ac)

      const under = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, len * 0.96), underMat)
      under.position.set(0, 0.45, len / 2)
      g.add(under)

      // Rear face details (toward player)
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.95), windowMat)
      win.position.set(0, 2.45, -0.011)
      win.rotation.y = Math.PI
      g.add(win)
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(1.96, 0.3),
        new THREE.MeshBasicMaterial({ color: livery.stripe }),
      )
      stripe.position.set(0, 1.65, -0.012)
      stripe.rotation.y = Math.PI
      g.add(stripe)
      // Side window bands
      const bandGeo = new THREE.PlaneGeometry(len * 0.92, 0.6)
      for (const side of [-1, 1]) {
        const band = new THREE.Mesh(bandGeo, windowMat)
        band.position.set(1.01 * side, 2.4, len / 2)
        band.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
        g.add(band)
      }
      // Lights (swapped by tint at update: red = parked, white = oncoming)
      const lightGeo = new THREE.SphereGeometry(0.085, 10, 10)
      for (const side of [-1, 1]) {
        const li = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff4030 }))
        li.position.set(0.75 * side, 1.05, -0.05)
        li.name = 'light'
        g.add(li)
      }

      g.visible = false
      this.scene.add(g)
      this.trainPool.push(g)
    }

    // Barriers — posts + two red/white striped planks (jump over)
    const barStripe = stripeTexture('#d23c28', '#e8e4dc')
    const plankGeo = new THREE.BoxGeometry(1.9, 0.62, 0.12)
    const bPostGeo = new THREE.BoxGeometry(0.14, 2.3, 0.14)
    const bPostMat = new THREE.MeshLambertMaterial({ color: 0x5a6068 })
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group()
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(bPostGeo, bPostMat)
        post.position.set(0.88 * side, 1.15, 0)
        g.add(post)
      }
      const plankMat = new THREE.MeshLambertMaterial({ map: barStripe })
      for (const y of [1.95, 0.95]) {
        const plank = new THREE.Mesh(plankGeo, plankMat)
        plank.position.set(0, y, 0)
        g.add(plank)
      }
      g.visible = false
      this.scene.add(g)
      this.barrierPool.push(g)
    }

    // Lowbars — gantry with hazard bar from y 1.0 → 2.0 (roll under)
    const hazard = stripeTexture('#2a2c30', '#f0c020')
    const lbPostGeo = new THREE.BoxGeometry(0.13, 2.1, 0.13)
    const lbBarGeo = new THREE.BoxGeometry(2.1, 1.0, 0.14)
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group()
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(lbPostGeo, bPostMat)
        post.position.set(1.0 * side, 1.05, 0)
        g.add(post)
      }
      const bar = new THREE.Mesh(lbBarGeo, new THREE.MeshLambertMaterial({ map: hazard }))
      bar.position.set(0, 1.52, 0)
      g.add(bar)
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffb020 }),
      )
      lamp.position.set(0, 2.18, 0)
      lamp.name = 'lamp'
      g.add(lamp)
      g.visible = false
      this.scene.add(g)
      this.lowbarPool.push(g)
    }

    // Coins — gold discs facing the player
    const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.07, 22)
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xf2b418, metalness: 0.65, roughness: 0.3,
      emissive: 0x6b4a00,
    })
    for (let i = 0; i < 60; i++) {
      const coin = new THREE.Mesh(coinGeo, coinMat)
      coin.rotation.x = Math.PI / 2
      coin.visible = false
      this.scene.add(coin)
      this.coinPool.push(coin)
    }

    // Pickups — glowing sprite chips
    this.pickupTexs = {
      magnet: pickupTexture('magnet'),
      jetpack: pickupTexture('jetpack'),
      multiplier: pickupTexture('multiplier'),
      sneakers: pickupTexture('sneakers'),
    }
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.pickupTexs.magnet, transparent: true }))
      sp.scale.set(1.05, 1.05, 1)
      sp.visible = false
      this.scene.add(sp)
      this.pickupPool.push(sp)
    }
  }

  // ── Runner ──────────────────────────────────────────────────────────────────
  private buildRunner() {
    const SKIN = 0xe8b48a, HOODIE = 0x2563eb, JEANS = 0x27384f, CAP = 0xd92b20
    const skinM = new THREE.MeshLambertMaterial({ color: SKIN })
    const hoodieM = new THREE.MeshLambertMaterial({ color: HOODIE })
    const jeansM = new THREE.MeshLambertMaterial({ color: JEANS })
    const capM = new THREE.MeshLambertMaterial({ color: CAP })
    const shoeM = new THREE.MeshLambertMaterial({ color: 0xf2f2f0 })

    this.runner = new THREE.Group()

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.34), hoodieM)
    torso.position.y = 1.0
    this.runner.add(torso)
    // Backpack (faces the camera at -z)
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.16), new THREE.MeshLambertMaterial({ color: 0xcf7a1e }))
    pack.position.set(0, 1.04, -0.25)
    this.runner.add(pack)

    // Head + cap
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 14), skinM)
    head.position.y = 1.49
    this.runner.add(head)
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.195, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      capM,
    )
    capDome.position.y = 1.52
    this.runner.add(capDome)
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.18), capM)
    brim.position.set(0, 1.5, 0.22)
    this.runner.add(brim)

    // Limb factory: a group pivoted at the joint with a capsule hanging down
    const limb = (len: number, r: number, mat: THREE.Material, foot?: boolean) => {
      const g = new THREE.Group()
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat)
      seg.position.y = -len / 2 - r
      g.add(seg)
      if (foot) {
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.3), shoeM)
        shoe.position.set(0, -len - r * 1.6, 0.06)
        g.add(shoe)
      }
      return g
    }

    this.legL = limb(0.55, 0.085, jeansM, true)
    this.legL.position.set(-0.15, 0.74, 0)
    this.legR = limb(0.55, 0.085, jeansM, true)
    this.legR.position.set(0.15, 0.74, 0)
    this.runner.add(this.legL, this.legR)

    this.armL = limb(0.46, 0.066, hoodieM)
    this.armL.position.set(-0.34, 1.24, 0)
    this.armR = limb(0.46, 0.066, hoodieM)
    this.armR.position.set(0.34, 1.24, 0)
    this.runner.add(this.armL, this.armR)

    this.scene.add(this.runner)

    // Roll ball (replaces the body while rolling)
    this.rollBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 20, 16),
      hoodieM,
    )
    const ballStripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.485, 0.07, 8, 24),
      capM,
    )
    ballStripe.rotation.y = Math.PI / 2
    this.rollBall.add(ballStripe)
    this.rollBall.visible = false
    this.scene.add(this.rollBall)

    // Blob shadow
    this.shadowBlob = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 24),
      new THREE.MeshBasicMaterial({ color: 0x1a140c, transparent: true, opacity: 0.32, depthWrite: false }),
    )
    this.shadowBlob.rotation.x = -Math.PI / 2
    this.shadowBlob.position.y = 0.02
    this.scene.add(this.shadowBlob)

    // Magnet aura
    this.magnetRing = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(60,220,255,0.55)'), transparent: true, depthWrite: false,
    }))
    this.magnetRing.scale.set(3.2, 3.2, 1)
    this.magnetRing.visible = false
    this.scene.add(this.magnetRing)

    // Jetpack: thrusters + flames
    this.jetPackMesh = new THREE.Group()
    const thrMat = new THREE.MeshLambertMaterial({ color: 0x8a929c })
    for (const side of [-1, 1]) {
      const thr = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 10), thrMat)
      thr.position.set(0.14 * side, 1.05, -0.34)
      this.jetPackMesh.add(thr)
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.55, 10),
        new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.85 }),
      )
      flame.rotation.x = Math.PI
      flame.position.set(0.14 * side, 0.52, -0.34)
      this.jetPackMesh.add(flame)
      this.jetFlames.push(flame)
    }
    this.jetPackMesh.visible = false
    this.runner.add(this.jetPackMesh)
  }

  // ── FX particles ────────────────────────────────────────────────────────────
  private buildFx() {
    this.dustTex = glowTexture('rgba(184,169,143,0.9)')
    this.sparkTex = glowTexture('rgba(255,216,77,1)')
    this.greenTex = glowTexture('rgba(120,235,140,1)')
    for (let i = 0; i < 50; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, transparent: true, depthWrite: false }))
      sp.visible = false
      this.scene.add(sp)
      this.fxFree.push(sp)
    }
  }

  private spawnFx(
    tex: THREE.CanvasTexture, pos: THREE.Vector3, vel: THREE.Vector3,
    life: number, size: number, gravity: number,
  ) {
    const sp = this.fxFree.pop()
    if (!sp) return
    ;(sp.material as THREE.SpriteMaterial).map = tex
    sp.material.needsUpdate = true
    sp.position.copy(pos)
    sp.scale.set(size, size, 1)
    sp.visible = true
    this.fx.push({ sprite: sp, vel, life, maxLife: life, gravity })
  }

  emitDust(laneX: number, count = 1) {
    for (let i = 0; i < count; i++) {
      this.spawnFx(
        this.dustTex,
        new THREE.Vector3(laneX * LANE_W + (Math.random() - 0.5) * 0.5, 0.1, 0.3 + Math.random() * 0.4),
        new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 1.2, -1.5),
        0.4 + Math.random() * 0.25, 0.35 + Math.random() * 0.3, 1.5,
      )
    }
  }

  emitSparks(lane: LaneIndex, z: number, y: number, count = 7) {
    for (let i = 0; i < count; i++) {
      this.spawnFx(
        this.sparkTex,
        new THREE.Vector3(LANE_OFFSETS[lane] * LANE_W, y, Math.max(z, 0.3)),
        new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 2),
        0.3 + Math.random() * 0.2, 0.28 + Math.random() * 0.2, -6,
      )
    }
  }

  emitGreen(laneX: number) {
    this.spawnFx(
      this.greenTex,
      new THREE.Vector3(laneX * LANE_W + (Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.3, 0.3),
      new THREE.Vector3((Math.random() - 0.5) * 1.5, 1 + Math.random(), -1),
      0.3, 0.22, 0,
    )
  }

  // ── Per-frame update ────────────────────────────────────────────────────────
  render(rs: RenderState, dt: number, t: number) {
    if (this.disposed) return

    // Scrolling world
    const SLEEP_GAP = 1.5
    const slOff = rs.scrollOffset % SLEEP_GAP
    const m = new THREE.Matrix4()
    let idx = 0
    for (let row = 0; row < 50; row++) {
      const z = row * SLEEP_GAP - slOff - 4
      for (let lane = -1; lane <= 1; lane++) {
        m.setPosition(lane * LANE_W, 0.06, z)
        this.sleepers.setMatrixAt(idx++, m)
      }
    }
    this.sleepers.instanceMatrix.needsUpdate = true

    this.gravelTex.offset.y = (rs.scrollOffset / (170 / 40)) % 1

    const WALL_GAP = 6
    for (let i = 0; i < this.wallSegs.length; i++) {
      const seg = this.wallSegs[i]
      const k = Math.floor(i / 2)
      const wOff = rs.scrollOffset % WALL_GAP
      seg.position.z = k * WALL_GAP - wOff - 4
    }

    const POST_GAP = 14
    for (let i = 0; i < this.posts.length; i++) {
      const pOff = rs.scrollOffset % POST_GAP
      const z = i * POST_GAP - pOff
      this.posts[i].position.z = z
      this.posts[i].visible = z > 2.5
    }

    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i]
      c.position.x += dt * (0.6 + i * 0.18)
      if (c.position.x > 95) c.position.x = -95
    }

    // Obstacles (barriers/lowbars are culled once behind the player so they
    // don't smear across the camera; trains clip naturally on the near plane)
    let trainI = 0, barI = 0, lowI = 0
    for (const o of rs.obstacles) {
      if (!o.active) continue
      if (o.type !== 'train' && o.z < -2.5) continue
      const x = LANE_OFFSETS[o.lane] * LANE_W
      if (o.type === 'train' && trainI < this.trainPool.length) {
        const g = this.trainPool[trainI++]
        g.visible = true
        g.position.set(x, 0, o.z)
        const lightColor = o.vz > 0 ? 0xfffbe0 : 0xff4030
        g.children.forEach(ch => {
          if (ch.name === 'light') ((ch as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(lightColor)
        })
      } else if (o.type === 'barrier' && barI < this.barrierPool.length) {
        const g = this.barrierPool[barI++]
        g.visible = true
        g.position.set(x, 0, o.z)
      } else if (o.type === 'lowbar' && lowI < this.lowbarPool.length) {
        const g = this.lowbarPool[lowI++]
        g.visible = true
        g.position.set(x, 0, o.z)
        const lamp = g.children.find(ch => ch.name === 'lamp') as THREE.Mesh | undefined
        if (lamp) {
          const blink = (Math.sin(t * 7 + o.z) + 1) / 2
          ;(lamp.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.45 + blink * 0.45, 0.1)
        }
      }
    }
    for (let i = trainI; i < this.trainPool.length; i++) this.trainPool[i].visible = false
    for (let i = barI; i < this.barrierPool.length; i++) this.barrierPool[i].visible = false
    for (let i = lowI; i < this.lowbarPool.length; i++) this.lowbarPool[i].visible = false

    // Coins (culled once behind the player)
    let coinI = 0
    for (const c of rs.coinObjs) {
      if (!c.active || c.z < -1.5 || coinI >= this.coinPool.length) continue
      const mesh = this.coinPool[coinI++]
      mesh.visible = true
      mesh.position.set(
        LANE_OFFSETS[c.lane] * LANE_W,
        1.25 + c.yw + Math.sin(t * 3.2 + c.z * 0.7) * 0.08,
        c.z,
      )
      mesh.rotation.y = t * 4 + c.z * 0.5
    }
    for (let i = coinI; i < this.coinPool.length; i++) this.coinPool[i].visible = false

    // Pickups (culled once behind the player)
    let pickI = 0
    for (const p of rs.pickups) {
      if (!p.active || p.z < -1.5 || pickI >= this.pickupPool.length) continue
      const sp = this.pickupPool[pickI++]
      const mat = sp.material as THREE.SpriteMaterial
      if (mat.map !== this.pickupTexs[p.kind]) {
        mat.map = this.pickupTexs[p.kind]
        mat.needsUpdate = true
      }
      sp.visible = true
      const pulse = 1 + Math.sin(t * 4 + p.z) * 0.08
      sp.scale.set(1.05 * pulse, 1.05 * pulse, 1)
      sp.position.set(LANE_OFFSETS[p.lane] * LANE_W, 1.5 + Math.sin(t * 2.6 + p.z) * 0.12, p.z)
    }
    for (let i = pickI; i < this.pickupPool.length; i++) this.pickupPool[i].visible = false

    // Runner
    const px = rs.laneX * LANE_W
    const showRunner = rs.phase !== 'menu'
    if (rs.isRolling && showRunner) {
      this.runner.visible = false
      this.rollBall.visible = true
      this.rollBall.position.set(px, 0.48, 0)
      this.rollBall.rotation.x += dt * rs.speed / 0.48
    } else {
      this.rollBall.visible = false
      this.runner.visible = showRunner
      this.runner.position.set(px, rs.playerY, 0)
      this.runner.rotation.z = -rs.lean * 0.14

      const φ = rs.runPhase
      if (rs.jetpack) {
        this.legL.rotation.x = 0.45 + Math.sin(φ * 0.5) * 0.08
        this.legR.rotation.x = 0.5 + Math.sin(φ * 0.5 + 1.2) * 0.08
        this.armL.rotation.x = 0.35
        this.armR.rotation.x = 0.35
        this.armL.rotation.z = 0.5
        this.armR.rotation.z = -0.5
      } else if (rs.isJumping) {
        this.legL.rotation.x = -1.5
        this.legR.rotation.x = -1.35
        this.armL.rotation.x = -2.4
        this.armR.rotation.x = -2.4
        this.armL.rotation.z = 0.35
        this.armR.rotation.z = -0.35
      } else {
        const swing = Math.sin(φ)
        this.legL.rotation.x = swing * 0.85
        this.legR.rotation.x = -swing * 0.85
        this.armL.rotation.x = -swing * 0.95
        this.armR.rotation.x = swing * 0.95
        this.armL.rotation.z = 0.08
        this.armR.rotation.z = -0.08
        this.runner.position.y = rs.playerY + Math.abs(Math.cos(φ)) * 0.05
      }
      this.jetPackMesh.visible = rs.jetpack
      if (rs.jetpack) {
        for (let i = 0; i < this.jetFlames.length; i++) {
          const f = this.jetFlames[i]
          f.scale.y = 0.8 + Math.sin(t * 30 + i * 2) * 0.3
          ;(f.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(t * 26 + i) * 0.25
        }
      }
    }

    this.shadowBlob.visible = showRunner
    this.shadowBlob.position.x = px
    const airT = Math.min(1, rs.playerY / 3)
    this.shadowBlob.scale.setScalar(1 - airT * 0.45)
    ;(this.shadowBlob.material as THREE.MeshBasicMaterial).opacity = 0.32 - airT * 0.2

    this.magnetRing.visible = showRunner && rs.magnet
    if (rs.magnet) {
      const pulse = 1 + Math.sin(t * 5) * 0.12
      this.magnetRing.scale.set(3.2 * pulse, 3.2 * pulse, 1)
      this.magnetRing.position.set(px, rs.playerY + 1.0, 0)
    }
    if (rs.sneakers && showRunner && !rs.isRolling && Math.random() < 0.3) this.emitGreen(rs.laneX)

    // FX step
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const p = this.fx[i]
      p.life -= dt
      if (p.life <= 0) {
        p.sprite.visible = false
        this.fxFree.push(p.sprite)
        this.fx.splice(i, 1)
        continue
      }
      p.sprite.position.addScaledVector(p.vel, dt)
      p.vel.y -= p.gravity * dt
      ;(p.sprite.material as THREE.SpriteMaterial).opacity = p.life / p.maxLife
    }

    // Camera: gentle lateral follow, speed FOV, crash shake
    const targetX = px * 0.42
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 6)
    const speedN = Math.min(1, Math.max(0, (rs.speed - 18) / 26))
    const fov = 58 + speedN * 9
    if (Math.abs(this.camera.fov - fov) > 0.1) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
    let cy = 4.4, cz = -6.8
    if (rs.crashT > 0) {
      const k = rs.crashT / 0.65
      this.camera.position.x += (Math.random() - 0.5) * 0.5 * k
      cy += (Math.random() - 0.5) * 0.4 * k
    }
    this.camera.position.y = cy
    this.camera.position.z = cz
    this.camera.lookAt(this.camera.position.x * 0.55, 1.6, 14)

    this.renderer.render(this.scene, this.camera)
  }

  resize() {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose())
      else if (mat) mat.dispose()
    })
    this.renderer.dispose()
  }
}
