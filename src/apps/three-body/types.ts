// ─── Three-Body · shared types ───────────────────────────────────────────────

export interface Settings {
  speed: number          // time multiplier (0.25–4)
  paused: boolean
  showTrails: boolean
  showVectors: boolean   // velocity arrows
  showCom: boolean       // centre-of-mass marker
  showLabels: boolean
  chaosGhost: boolean    // run a perturbed twin to reveal chaos
  uiHidden: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  speed: 1,
  paused: false,
  showTrails: true,
  showVectors: true,
  showCom: true,
  showLabels: true,
  chaosGhost: false,
  uiHidden: false,
}

export interface Stats {
  time: number
  energy: number
  energy0: number
  drift: number          // |E−E₀|/|E₀| as %
  ke: number
  pe: number
  momentum: number
  divergence: number | null   // ghost separation distance (chaos demo)
  ejected: boolean
  energyHistory: number[]
}

export const EMPTY_STATS: Stats = {
  time: 0, energy: 0, energy0: 0, drift: 0, ke: 0, pe: 0,
  momentum: 0, divergence: null, ejected: false, energyHistory: [],
}
