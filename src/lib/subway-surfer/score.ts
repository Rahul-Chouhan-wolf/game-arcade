const HS_KEY = 'rail-runner-hs'

export const COIN_VALUE = 10
export const DIST_DIVISOR = 4   // 1 point per 4 world-units run

export function calcScore(distance: number, coins: number): number {
  return Math.floor(distance / DIST_DIVISOR) + coins * COIN_VALUE
}

export function loadHigh(): number {
  if (typeof window === 'undefined') return 0
  return Math.max(0, parseInt(localStorage.getItem(HS_KEY) ?? '0', 10) || 0)
}

export function saveHigh(score: number): void {
  if (typeof window === 'undefined') return
  if (score > loadHigh()) localStorage.setItem(HS_KEY, String(score))
}
