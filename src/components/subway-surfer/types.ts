export type { LaneIndex } from '@/lib/subway-surfer/track'
export type { ObstacleType } from '@/lib/subway-surfer/collision'

export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover'

// Number of coins in a row cluster
export const COINS_PER_ROW = 5
// Spacing between coins in a cluster (world units in Z)
export const COIN_SPACING = 2.5
