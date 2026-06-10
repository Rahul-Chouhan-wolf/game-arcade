export const GRAVITY = -30
export const JUMP_VELOCITY = 14
export const ROLL_DURATION = 0.75

export const LANE_LERP_SPEED = 9   // normalised lane offsets per second

export const PLAYER_STAND_H = 1.5
export const PLAYER_ROLL_H = 0.7

// Integrate one physics step for a jumping player.
export function integrateJump(
  y: number, vy: number, dt: number,
): { y: number; vy: number; landed: boolean } {
  const newVy = vy + GRAVITY * dt
  const newY = y + newVy * dt
  if (newY <= 0) return { y: 0, vy: 0, landed: true }
  return { y: newY, vy: newVy, landed: false }
}

// Smoothly move currentX toward targetX at LANE_LERP_SPEED.
// Both values are normalised lane offsets (-1, 0, 1).
export function lerpLane(currentX: number, targetX: number, dt: number): number {
  const diff = targetX - currentX
  const step = LANE_LERP_SPEED * dt
  if (Math.abs(diff) <= step) return targetX
  return currentX + Math.sign(diff) * step
}
