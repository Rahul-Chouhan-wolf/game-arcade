import type { LaneIndex } from './track'
import type { ObstacleType } from './collision'

export interface ObstacleSpawn {
  lane: LaneIndex
  type: ObstacleType
}

export interface SpawnRow {
  obstacles: ObstacleSpawn[]
  clearLanes: LaneIndex[]
}

// Deterministic hash — lets tests assert specific patterns for a given seed.
function hash(n: number): number {
  let x = (n ^ (n >>> 16)) * 0x45d9f3b
  x = (x ^ (x >>> 16)) * 0x45d9f3b
  return (x ^ (x >>> 16)) >>> 0
}

// Generate one obstacle row for the given integer seed (use distance-tick as seed).
// Guarantees at least one clear lane. 66% chance of 1 blocked, 33% chance of 2 blocked.
export function spawnRow(seed: number): SpawnRow {
  const h1 = hash(seed)
  const h2 = hash(h1 + 1)
  const h3 = hash(h2 + 1)
  const h4 = hash(h3 + 1)

  // Decide block count
  const blockTwo = (h1 % 3) === 0

  // Shuffle lanes [0,1,2]
  const lanes: LaneIndex[] = [0, 1, 2]
  const s1 = (h2 % 3) as 0 | 1 | 2
  ;[lanes[0], lanes[s1]] = [lanes[s1], lanes[0]]
  const s2 = h3 % 2
  ;[lanes[1], lanes[1 + s2]] = [lanes[1 + s2], lanes[1]]

  const blockCount = blockTwo ? 2 : 1
  const blockedLanes = lanes.slice(0, blockCount) as LaneIndex[]
  const clearLanes = lanes.slice(blockCount) as LaneIndex[]

  // Pick obstacle type per blocked lane
  const obstacles: ObstacleSpawn[] = blockedLanes.map((lane, i) => ({
    lane,
    type: (hash(h4 + i) % 3 === 0 ? 'lowbar' : 'barrier') as ObstacleType,
  }))

  return { obstacles, clearLanes }
}

// Which lane should coins spawn in for this seed (always a clear lane).
export function coinLane(seed: number): LaneIndex {
  const { clearLanes } = spawnRow(seed)
  const h = hash(seed + 7919)
  return clearLanes[h % clearLanes.length]
}
