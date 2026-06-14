import type { Level } from '../types'

// ─── Simulation configuration ────────────────────────────────────────────────
// Resolutions are derived from the canvas; these are the simulation-grid sizes.

export const SIM_RESOLUTION = 128        // velocity/pressure grid
export const DYE_RESOLUTION = 1024       // colour grid (auto-reduced on weak/mobile)
export const DYE_RESOLUTION_MOBILE = 512

export const DENSITY_DISSIPATION = 0.97  // dye fades slowly (never abruptly)
export const VELOCITY_DISSIPATION = 0.2
export const PRESSURE = 0.8
export const PRESSURE_ITERATIONS = 20
export const CURL = 30                    // vorticity confinement strength
export const SPLAT_RADIUS = 0.0025

export const BLOOM_ITERATIONS = 8
export const BLOOM_RESOLUTION = 256
export const BLOOM_INTENSITY = 0.8
export const BLOOM_THRESHOLD = 0.6
export const BLOOM_SOFT_KNEE = 0.7

// Fluid-strength presets scale how hard the pointer pushes velocity + dye.
export const FLUID_STRENGTH: Record<Level, { force: number; splat: number }> = {
  low:    { force: 4000,  splat: 0.7 },
  medium: { force: 6000,  splat: 1.0 },
  high:   { force: 9000,  splat: 1.4 },
}

// Colour-randomization presets: how often the auto-cycling hue jumps.
export const COLOR_RANDOMIZATION: Record<Level, number> = {
  low: 0.15,
  medium: 0.5,
  high: 1.0,
}

export const UI_AUTOHIDE_MS = 3200
