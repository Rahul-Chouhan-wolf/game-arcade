// Lane indices 0=left 1=center 2=right
export type LaneIndex = 0 | 1 | 2

// Normalised lane X offsets: -1, 0, +1 (multiplied by road half-width at render time)
export const LANE_OFFSETS = [-1, 0, 1] as const

// Depth at which obstacles spawn (world units ahead of player)
export const SPAWN_Z = 120
// Depth at which objects are recycled (behind player)
export const RECYCLE_Z = -5

export function speedAtDistance(distance: number): number {
  const BASE = 18
  const MAX = 44
  const t = Math.min(1, distance / 4500)
  return BASE + (MAX - BASE) * t
}

// Metres between spawned obstacle rows
export function spawnIntervalAt(distance: number): number {
  const BASE = 30
  const MIN = 13
  const t = Math.min(1, distance / 4500)
  return BASE - (BASE - MIN) * t
}
