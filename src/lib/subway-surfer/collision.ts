import { PLAYER_STAND_H, PLAYER_ROLL_H } from './physics'
import type { LaneIndex } from './track'

export type ObstacleType = 'barrier' | 'lowbar'

// barrier: tall wall — must jump over (height 2.4, cleared by peak jump ~3.3)
// lowbar:  low bar  — must roll under (height 1.0) or jump (also clears it)
export const BARRIER_H = 2.4
export const LOWBAR_H = 1.0

// Collision zone: how close in Z (depth) an obstacle must be to the player.
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
  if (Math.abs(obstZ) > HIT_Z) return false

  const playerH = isRolling ? PLAYER_ROLL_H : PLAYER_STAND_H
  const playerTop = playerY + playerH

  if (obstType === 'barrier') {
    // Collide if player top is above ground and player Y is below barrier top
    return playerTop > 0 && playerY < BARRIER_H
  }
  // lowbar: gap from ground to LOWBAR_H — collide if player top > LOWBAR_H (and player is on ground level)
  return playerY < LOWBAR_H && playerTop > LOWBAR_H
}

export function isCoinCollected(
  playerLane: LaneIndex,
  playerY: number,
  coinLane: LaneIndex,
  coinZ: number,
): boolean {
  if (playerLane !== coinLane) return false
  const dz = Math.abs(coinZ)
  const dy = Math.abs((playerY + PLAYER_STAND_H / 2) - COIN_Y)
  return dz < COIN_COLLECT_R && dy < COIN_COLLECT_R
}
