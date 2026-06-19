import type { LaneIndex } from './track'
import type { SpawnRow } from './spawn'

// A coin placement relative to a spawn row.
// dz: world units IN FRONT of the row anchor (toward the player; negative = behind)
// y:  height above the default coin line (0 = ground-level coin)
export interface CoinSpec {
  lane: LaneIndex
  dz: number
  y: number
}

const GAP = 2.4

function hash(n: number): number {
  let x = (n ^ (n >>> 16)) * 0x45d9f3b
  x = (x ^ (x >>> 16)) * 0x45d9f3b
  return (x ^ (x >>> 16)) >>> 0
}

function line(lane: LaneIndex, n: number): CoinSpec[] {
  return Array.from({ length: n }, (_, i) => ({ lane, dz: 2 + i * GAP, y: 0 }))
}

// Coin pattern for one spawn row. Deterministic per seed.
// Variants: straight line · arc over a barrier · zigzag · double line.
export function coinPattern(seed: number, row: SpawnRow): CoinSpec[] {
  const h = hash(seed * 31 + 7)
  const clear = row.clearLanes
  const lane = clear[hash(h + 1) % clear.length]

  switch (h % 4) {
    case 0:
      return line(lane, 7)

    case 1: {
      // Arc that carries a jumping player over a barrier (peak > barrier height).
      // Centred on the row anchor in the barrier's lane; falls back to a clear lane.
      const bar = row.obstacles.find(o => o.type === 'barrier')
      const arcLane = bar ? bar.lane : lane
      const N = 7
      return Array.from({ length: N }, (_, i) => {
        const t = i / (N - 1)
        return { lane: arcLane, dz: 3 - i * 1.0, y: Math.sin(t * Math.PI) * 3.1 }
      })
    }

    case 2: {
      // Zigzag between two clear lanes (straight line when only one is clear)
      if (clear.length < 2) return line(lane, 8)
      const l2 = clear.find(l => l !== lane) as LaneIndex
      return Array.from({ length: 8 }, (_, i) => ({
        lane: (i % 4) < 2 ? lane : l2,
        dz: 2 + i * GAP,
        y: 0,
      }))
    }

    default: {
      // Double line across two clear lanes
      if (clear.length < 2) return line(lane, 7)
      const [a, b] = clear
      const out: CoinSpec[] = []
      for (let i = 0; i < 5; i++) {
        out.push({ lane: a, dz: 2 + i * GAP, y: 0 })
        out.push({ lane: b, dz: 2 + i * GAP, y: 0 })
      }
      return out
    }
  }
}

// Sky coin line while the jetpack is active.
export function skyLine(lane: LaneIndex, alt: number, n = 8): CoinSpec[] {
  return Array.from({ length: n }, (_, i) => ({ lane, dz: 2 + i * GAP, y: alt }))
}
