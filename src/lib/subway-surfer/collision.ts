import { PLAYER_STAND_H, PLAYER_ROLL_H } from './physics'
import type { LaneIndex } from './track'

export type ObstacleType = 'train' | 'barrier' | 'lowbar'

// train:   full train car — cannot jump (height 3.6 > jump peak), must change lane
// barrier: blockade — must jump over (height 2.4, cleared by peak jump ~3.3)
// lowbar:  signal gantry — must roll under (gap below 1.0) or jump
export const TRAIN_H   = 3.6
export const BARRIER_H = 2.4
export const LOWBAR_H  = 1.0

// Obstacle depth (length along Z, extending away from the player)
export const OBSTACLE_LEN: Record<ObstacleType, number> = {
  train:   16,
  barrier: 0.6,
  lowbar:  0.6,
}

// Collision zone: how close in Z (depth) an obstacle edge must be to the player.
export const HIT_Z = 0.9

// Coin collect radius in world units
export const COIN_COLLECT_R = 1.2
export const COIN_Y = 1.2   // coin centre height

export function isHit(
  playerLane: LaneIndex,
  playerY: number,
  isRolling: boolean,
  obstLane: LaneIndex,
  obstZ: number,
  obstType: ObstacleType,
): boolean {
  if (playerLane !== obstLane) return false

  // Obstacle occupies [obstZ, obstZ + len]; overlap with player zone [-HIT_Z, HIT_Z]
  const len = OBSTACLE_LEN[obstType]
  if (obstZ > HIT_Z || obstZ + len < -HIT_Z) return false

  const playerH = isRolling ? PLAYER_ROLL_H : PLAYER_STAND_H
  const playerTop = playerY + playerH

  if (obstType === 'train') {
    // Trains are taller than any jump — only lane change avoids them
    return playerY < TRAIN_H
  }
  if (obstType === 'barrier') {
    return playerTop > 0 && playerY < BARRIER_H
  }
  // lowbar: gap from ground to LOWBAR_H — collide if player top pokes above the gap
  return playerY < LOWBAR_H && playerTop > LOWBAR_H
}

export function isCoinCollected(
  playerLane: LaneIndex,
  playerY: number,
  coinLane: LaneIndex,
  coinZ: number,
  coinY: number = COIN_Y,
): boolean {
  if (playerLane !== coinLane) return false
  const dz = Math.abs(coinZ)
  const dy = Math.abs((playerY + PLAYER_STAND_H / 2) - coinY)
  return dz < COIN_COLLECT_R && dy < COIN_COLLECT_R * 1.3
}
