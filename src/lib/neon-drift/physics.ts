// ─── Neon Drift · Physics engine ─────────────────────────────────────────────
// Pure functions — no React, no DOM, no side effects.

export interface CarState {
  // World position & orientation
  x: number
  y: number
  heading: number     // radians, 0 = right (+x axis)

  // Velocity (world space, px/s)
  vx: number
  vy: number
  speed: number       // magnitude of velocity

  // Derived
  driftAngle: number  // angle between heading and velocity direction (rad)
  drifting: boolean

  // Scoring
  score: number
  combo: number
  comboTimer: number  // seconds remaining before combo resets
  curDriftPts: number // points in the active drift session
  driftTime: number   // seconds in the active drift session

  // Lap
  lapAngle: number    // cumulative angle traversed (each 2π = one lap)
  prevTrackAngle: number
  lap: number
}

export interface InputState {
  left: boolean
  right: boolean
  throttle: boolean
  brake: boolean
  handbrake: boolean
}

// ─── Physics constants ────────────────────────────────────────────────────────
const MAX_SPEED       = 460   // px/s
const ACCEL           = 210   // px/s²
const COAST_DRAG      = 70    // px/s² natural deceleration
const BRAKE_FORCE     = 420   // px/s²
const STEER_RATE      = 2.6   // rad/s at slow speed
const STEER_RATE_HI   = 1.8   // rad/s at max speed
const HANDBRAKE_STEER = 3.4   // rad/s during handbrake drift
const GRIP_RATE_NORM  = 7.5   // 1/s — lateral grip (higher = snappier)
const GRIP_RATE_DRIFT = 0.75  // 1/s — lateral grip during handbrake
const DRIFT_THRESH    = 0.14  // radians, min drift angle to score
const MIN_DRIFT_SPEED = 80    // px/s, min speed to count as drifting
const COMBO_TIMEOUT   = 1.8   // seconds before combo resets after drift ends
const OFF_TRACK_DRAG  = 3.5   // extra drag/s² when off track

export function createCar(x: number, y: number, heading: number): CarState {
  return {
    x, y, heading,
    vx: 0, vy: 0, speed: 0,
    driftAngle: 0, drifting: false,
    score: 0, combo: 1, comboTimer: 0,
    curDriftPts: 0, driftTime: 0,
    lapAngle: 0, prevTrackAngle: Math.atan2(y, x), lap: 0,
  }
}

export function normalizeAngle(a: number): number {
  while (a >  Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

// Called once per frame from game loop
export function stepCar(
  car: CarState,
  input: InputState,
  dt: number,
  onTrack: boolean,
): CarState {
  let {
    x, y, heading, vx, vy,
    score, combo, comboTimer, curDriftPts, driftTime,
    lapAngle, prevTrackAngle, lap,
  } = car

  // ── Steering ──────────────────────────────────────────────────────────────
  const speedT   = Math.min(car.speed / MAX_SPEED, 1)
  const steerRate = input.handbrake
    ? HANDBRAKE_STEER
    : STEER_RATE + (STEER_RATE_HI - STEER_RATE) * speedT

  const steerDir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (car.speed > 15) {
    heading += steerDir * steerRate * dt
  }

  // ── Engine + braking ──────────────────────────────────────────────────────
  if (input.throttle && car.speed < MAX_SPEED) {
    vx += Math.cos(heading) * ACCEL * dt
    vy += Math.sin(heading) * ACCEL * dt
  }

  const curSpd = Math.hypot(vx, vy)
  if (curSpd > 0.5) {
    const ux = vx / curSpd
    const uy = vy / curSpd

    if (input.brake) {
      const b = Math.min(BRAKE_FORCE * dt, curSpd)
      vx -= ux * b; vy -= uy * b
    } else if (!input.throttle) {
      const c = Math.min(COAST_DRAG * dt, curSpd)
      vx -= ux * c; vy -= uy * c
    }

    if (!onTrack) {
      const offDrag = Math.min(OFF_TRACK_DRAG * dt * curSpd, curSpd * 0.4)
      vx -= ux * offDrag; vy -= uy * offDrag
    }
  }

  // ── Grip / lateral slip (frame-rate independent) ──────────────────────────
  const gripRate = input.handbrake ? GRIP_RATE_DRIFT : GRIP_RATE_NORM
  const gripFactor = 1 - Math.exp(-gripRate * dt)

  const spd2 = Math.hypot(vx, vy)
  if (spd2 > 0.5) {
    const desiredVx = Math.cos(heading) * spd2
    const desiredVy = Math.sin(heading) * spd2
    vx += (desiredVx - vx) * gripFactor
    vy += (desiredVy - vy) * gripFactor
  }

  // ── Speed clamp ───────────────────────────────────────────────────────────
  const newSpd = Math.hypot(vx, vy)
  if (newSpd > MAX_SPEED) {
    const sc = MAX_SPEED / newSpd
    vx *= sc; vy *= sc
  }

  // ── Drift angle ───────────────────────────────────────────────────────────
  let driftAngle = 0
  const finalSpd = Math.hypot(vx, vy)
  if (finalSpd > 10) {
    driftAngle = normalizeAngle(heading - Math.atan2(vy, vx))
  }

  // ── Drift scoring ─────────────────────────────────────────────────────────
  const nowDrifting = Math.abs(driftAngle) > DRIFT_THRESH && finalSpd > MIN_DRIFT_SPEED

  let newScore     = score
  let newCombo     = combo
  let newComboTimer = comboTimer
  let newCurPts    = curDriftPts
  let newDriftTime = driftTime

  if (nowDrifting) {
    newDriftTime  = driftTime + dt
    newComboTimer = COMBO_TIMEOUT  // refresh timeout while actively drifting
    newCurPts     = curDriftPts + Math.abs(driftAngle) * finalSpd * dt * 0.38
  } else {
    // Was drifting last frame — bank points
    if (car.drifting && curDriftPts > 5) {
      newScore  = score + Math.round(curDriftPts * combo)
      newCurPts = 0
      newDriftTime = 0
      newCombo  = Math.min(combo + 1, 8)
      newComboTimer = COMBO_TIMEOUT
    }
    // Combo decay
    if (comboTimer > 0) {
      newComboTimer = comboTimer - dt
      if (newComboTimer <= 0) {
        newComboTimer = 0
        newCombo      = 1
      }
    }
  }

  // ── Position ──────────────────────────────────────────────────────────────
  x += vx * dt
  y += vy * dt

  // ── Lap tracking (based on track angle traversed) ─────────────────────────
  const trackAngle = Math.atan2(y, x)
  const angleDelta = normalizeAngle(trackAngle - prevTrackAngle)
  const newLapAngle = lapAngle + angleDelta
  const newLap      = Math.floor(newLapAngle / (2 * Math.PI))

  return {
    x, y, heading,
    vx, vy, speed: finalSpd,
    driftAngle, drifting: nowDrifting,
    score: newScore, combo: newCombo, comboTimer: newComboTimer,
    curDriftPts: newCurPts, driftTime: newDriftTime,
    lapAngle: newLapAngle, prevTrackAngle: trackAngle, lap: newLap,
  }
}
