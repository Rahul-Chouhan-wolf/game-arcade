export interface NeonPalette {
  id: string
  name: string
  /** dominant neon colour (grid, glow, borders) */
  primary: string
  /** secondary accent (gradients, highlights) */
  secondary: string
  /** tertiary pop colour */
  accent: string
  /** deep background */
  bg: string
  /** mid background (fog, mid-sky) */
  bgMid: string
  /** grid line colour */
  grid: string
  /** sun gradient stops [top → mid → bottom] */
  sunColors: [string, string, string]
  /** bloom / glow colour */
  glow: string
  /** HUD glassmorphism border */
  hudBorder: string
}

export const PALETTES: Record<string, NeonPalette> = {
  synthwave: {
    id: "synthwave",
    name: "Purple Synthwave",
    primary: "#c026d3",
    secondary: "#ec4899",
    accent: "#22d3ee",
    bg: "#020012",
    bgMid: "#0d0030",
    grid: "#7c3aed",
    sunColors: ["#f97316", "#ec4899", "#c026d3"],
    glow: "#ec4899",
    hudBorder: "#c026d3",
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyan Cyberpunk",
    primary: "#06b6d4",
    secondary: "#f97316",
    accent: "#facc15",
    bg: "#000a14",
    bgMid: "#001a24",
    grid: "#0891b2",
    sunColors: ["#ea580c", "#f97316", "#facc15"],
    glow: "#06b6d4",
    hudBorder: "#06b6d4",
  },
  deepblue: {
    id: "deepblue",
    name: "Deep Blue Neon",
    primary: "#3b82f6",
    secondary: "#818cf8",
    accent: "#34d399",
    bg: "#00000f",
    bgMid: "#00001e",
    grid: "#1d4ed8",
    sunColors: ["#1d4ed8", "#818cf8", "#c7d2fe"],
    glow: "#818cf8",
    hudBorder: "#3b82f6",
  },
  crimson: {
    id: "crimson",
    name: "Crimson Nightcity",
    primary: "#ef4444",
    secondary: "#f97316",
    accent: "#fbbf24",
    bg: "#0a0005",
    bgMid: "#1a0008",
    grid: "#dc2626",
    sunColors: ["#dc2626", "#f97316", "#fbbf24"],
    glow: "#ef4444",
    hudBorder: "#ef4444",
  },
}

export type PaletteId = keyof typeof PALETTES
