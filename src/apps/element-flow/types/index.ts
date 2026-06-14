// ─── Element Flow · shared types ─────────────────────────────────────────────

export type BackgroundMode = 'dark' | 'light'
export type Level = 'low' | 'medium' | 'high'

export interface ElementFlowSettings {
  bloom: boolean
  background: BackgroundMode
  colorRandomization: Level
  fluidStrength: Level
  paused: boolean
  uiHidden: boolean
  audio: boolean
}

export const DEFAULT_SETTINGS: ElementFlowSettings = {
  bloom: true,
  background: 'dark',
  colorRandomization: 'medium',
  fluidStrength: 'medium',
  paused: false,
  uiHidden: false,
  audio: false,
}

export interface PointerState {
  id: number
  x: number          // texcoord 0..1
  y: number
  dx: number         // delta in texcoord space
  dy: number
  down: boolean
  moved: boolean
  color: [number, number, number]
}

export interface RGB { r: number; g: number; b: number }
