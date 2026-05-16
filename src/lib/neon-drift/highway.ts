// ─── Neon Drift · Endless Highway ────────────────────────────────────────────
// Procedural road segment generator.
// World-space: +x right, +y down (canvas convention).

export const SEGMENT_LEN    = 55     // px between waypoints
export const ROAD_HALF_W    = 145    // px, half the driveable width (wider = more drift room)
export const LOOK_AHEAD_PX  = 3800   // generate this far ahead of car
export const LOOK_BEHIND_PX = 1400   // keep this far behind car

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoadSegment {
  id:    number
  x:     number
  y:     number
  angle: number   // direction of travel (radians)
  type:  'straight' | 'curve-left' | 'curve-right' | 'drift-zone' | 'sweeper'
}

export interface EnvObject {
  segId: number   // attach to this segment
  side:  -1 | 1  // -1 = left, 1 = right of road
  kind:  'pole' | 'billboard' | 'building' | 'sign'
  label?: string
}

// ─── Road chunk pacing ────────────────────────────────────────────────────────

interface ChunkPlan {
  type:  'straight' | 'curve-left' | 'curve-right' | 'drift-zone' | 'sweeper'
  count: number       // segments in this chunk
  curvature: number   // radians per segment (±)
}

function pickChunk(prevType: ChunkPlan['type'], usedRight: boolean): ChunkPlan {
  // After a drift-zone or sweeper, force a straight recovery section
  if (prevType === 'drift-zone' || prevType === 'sweeper') {
    return { type: 'straight', count: 16 + rndInt(10), curvature: 0 }
  }

  const r = Math.random()

  // ── Long straight (20 %) ─ builds anticipation before the next bend ────────
  if (r < 0.20) {
    return { type: 'straight', count: 38 + rndInt(28), curvature: 0 }
  }

  // ── Short straight / chicane gap (12 %) ───────────────────────────────────
  if (r < 0.32) {
    return { type: 'straight', count: 10 + rndInt(10), curvature: 0 }
  }

  // ── Gentle sweeping curve (22 %) ─ normal highway bend ────────────────────
  if (r < 0.54) {
    const side = prevType === 'curve-left'  ? 'curve-right'
               : prevType === 'curve-right' ? 'curve-left'
               : usedRight                  ? 'curve-left' : 'curve-right'
    return {
      type: side,
      count: 16 + rndInt(20),
      curvature: (side === 'curve-right' ? 1 : -1) * (0.013 + Math.random() * 0.020),
    }
  }

  // ── S-curve chain (16 %) ─ chicane / snake section ────────────────────────
  if (r < 0.70) {
    // Alternate hard from previous direction to create snaking
    const side = prevType === 'curve-right' ? 'curve-left'
               : prevType === 'curve-left'  ? 'curve-right'
               : usedRight                   ? 'curve-left' : 'curve-right'
    return {
      type: side,
      count: 10 + rndInt(12),
      curvature: (side === 'curve-right' ? 1 : -1) * (0.022 + Math.random() * 0.018),
    }
  }

  // ── Big sweeper (8 %) ─ long wide radius corner at high speed ─────────────
  if (r < 0.78) {
    const side = usedRight ? 'curve-left' : 'curve-right'
    return {
      type: 'sweeper',
      count: 22 + rndInt(16),
      curvature: (side === 'curve-right' ? 1 : -1) * (0.018 + Math.random() * 0.014),
    }
  }

  // ── Drift-zone (22 %) ─ tight technical bend, demands handbrake ───────────
  const side = usedRight ? 'curve-left' : 'curve-right'
  return {
    type: 'drift-zone',
    count: 8 + rndInt(10),
    curvature: (side === 'curve-right' ? 1 : -1) * (0.038 + Math.random() * 0.030),
  }
}

function rndInt(n: number) { return Math.floor(Math.random() * n) }

// ─── Highway class ────────────────────────────────────────────────────────────

export class Highway {
  segments:   RoadSegment[] = []
  envObjects: EnvObject[]   = []

  private nextId     = 0
  private genX:     number
  private genY:     number
  private genAngle: number

  // Chunk pacing state
  private currentChunk: ChunkPlan
  private chunkRemaining: number
  private lastCurveRight = false

  // Env generation state
  private nextPoleAt:      number = 0
  private nextBillboardAt: number = 0
  private nextBuildingAt:  number = 0
  private billboardSide:   -1 | 1 = 1

  private static readonly BILLBOARD_LABELS = [
    'NEON CITY 2099', 'DRIFT ZONE AHEAD', 'MAX SPEED', 'SYSTEM ONLINE',
    'CYBER CORP', 'GRID SECTOR 7', 'VELOCITY+', 'HYPERLANE',
    'NO LIMITS', 'ENTER FLOW STATE', 'SPEED IS FREEDOM', '∞ MILES',
    'DANGER AHEAD', 'FULL THROTTLE', 'NIGHT HIGHWAY', 'OVERDRIVE',
  ]
  private billboardIdx = 0

  constructor(startX: number, startY: number, startAngle: number) {
    this.genX     = startX
    this.genY     = startY
    this.genAngle = startAngle

    this.currentChunk   = { type: 'straight', count: 35, curvature: 0 }
    this.chunkRemaining = 35

    this.generateSegments(Math.ceil((LOOK_AHEAD_PX + 600) / SEGMENT_LEN))
  }

  // ── Per-frame update ─────────────────────────────────────────────────────

  update(carX: number, carY: number, carAngle: number): void {
    const aheadDist = this.distAheadOf(carX, carY, carAngle)
    if (aheadDist < LOOK_AHEAD_PX) {
      const needed = Math.ceil((LOOK_AHEAD_PX - aheadDist) / SEGMENT_LEN) + 10
      this.generateSegments(needed)
    }

    const minFwd = -LOOK_BEHIND_PX
    this.segments = this.segments.filter(s => {
      const dx = s.x - carX
      const dy = s.y - carY
      return dx * Math.cos(carAngle) + dy * Math.sin(carAngle) > minFwd
    })
    const minId = this.segments.length > 0 ? this.segments[0].id : 0
    this.envObjects = this.envObjects.filter(e => e.segId >= minId)
  }

  // ── Collision helpers ────────────────────────────────────────────────────

  nearestSegment(x: number, y: number): { seg: RoadSegment; dist: number } | null {
    if (this.segments.length === 0) return null
    let best = this.segments[0]
    let bestD = Math.hypot(x - best.x, y - best.y)
    for (const s of this.segments) {
      const d = Math.hypot(x - s.x, y - s.y)
      if (d < bestD) { best = s; bestD = d }
    }
    return { seg: best, dist: bestD }
  }

  isOnRoad(x: number, y: number): boolean {
    const r = this.nearestSegment(x, y)
    return r ? r.dist < ROAD_HALF_W : false
  }

  constrainToRoad(x: number, y: number): { x: number; y: number; hit: boolean } {
    const r = this.nearestSegment(x, y)
    if (!r || r.dist <= ROAD_HALF_W) return { x, y, hit: false }
    const nx = (x - r.seg.x) / r.dist
    const ny = (y - r.seg.y) / r.dist
    return {
      x: r.seg.x + nx * (ROAD_HALF_W - 2),
      y: r.seg.y + ny * (ROAD_HALF_W - 2),
      hit: true,
    }
  }

  /** Signed lateral offset of point from road centreline (+ = right) */
  lateralOffset(x: number, y: number): number {
    const r = this.nearestSegment(x, y)
    if (!r) return 0
    const perpX = -Math.sin(r.seg.angle)
    const perpY =  Math.cos(r.seg.angle)
    return (x - r.seg.x) * perpX + (y - r.seg.y) * perpY
  }

  /** Road angle at car's nearest segment */
  roadAngleAt(x: number, y: number): number {
    return this.nearestSegment(x, y)?.seg.angle ?? 0
  }

  /** Type of road section at car's position */
  roadTypeAt(x: number, y: number): RoadSegment['type'] {
    return this.nearestSegment(x, y)?.seg.type ?? 'straight'
  }

  // ── Private generators ───────────────────────────────────────────────────

  private generateSegments(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.chunkRemaining <= 0) {
        const next = pickChunk(this.currentChunk.type, this.lastCurveRight)
        if (next.type === 'curve-right' || next.type === 'sweeper') this.lastCurveRight = true
        if (next.type === 'curve-left') this.lastCurveRight = false
        this.currentChunk   = next
        this.chunkRemaining = next.count
      }
      this.chunkRemaining--

      this.genAngle += this.currentChunk.curvature
      this.genX += Math.cos(this.genAngle) * SEGMENT_LEN
      this.genY += Math.sin(this.genAngle) * SEGMENT_LEN

      const seg: RoadSegment = {
        id:    this.nextId,
        x:     this.genX,
        y:     this.genY,
        angle: this.genAngle,
        type:  this.currentChunk.type,
      }
      this.segments.push(seg)
      this.addEnvObject(seg)
      this.nextId++
    }
  }

  private addEnvObject(seg: RoadSegment): void {
    if (seg.id >= this.nextPoleAt) {
      this.envObjects.push({ segId: seg.id, side: -1, kind: 'pole' })
      this.envObjects.push({ segId: seg.id, side:  1, kind: 'pole' })
      this.nextPoleAt = seg.id + 6 + rndInt(5)
    }
    if (seg.id >= this.nextBillboardAt) {
      const label = Highway.BILLBOARD_LABELS[this.billboardIdx % Highway.BILLBOARD_LABELS.length]
      this.billboardIdx++
      this.envObjects.push({ segId: seg.id, side: this.billboardSide, kind: 'billboard', label })
      this.billboardSide = this.billboardSide === 1 ? -1 : 1
      this.nextBillboardAt = seg.id + 18 + rndInt(12)
    }
    if (seg.id >= this.nextBuildingAt) {
      this.envObjects.push({ segId: seg.id, side: -1, kind: 'building' })
      this.envObjects.push({ segId: seg.id, side:  1, kind: 'building' })
      this.nextBuildingAt = seg.id + 32 + rndInt(18)
    }
  }

  private distAheadOf(carX: number, carY: number, carAngle: number): number {
    let maxFwd = 0
    for (const s of this.segments) {
      const fwd = (s.x - carX) * Math.cos(carAngle) + (s.y - carY) * Math.sin(carAngle)
      if (fwd > maxFwd) maxFwd = fwd
    }
    return maxFwd
  }
}

// ─── Start constants ─────────────────────────────────────────────────────────

export const HIGHWAY_START_X     = 0
export const HIGHWAY_START_Y     = 0
export const HIGHWAY_START_ANGLE = 0
