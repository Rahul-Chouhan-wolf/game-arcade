// ─── Orbital · Puzzle definitions ─────────────────────────────────────────────
// Hand-crafted gravity puzzles. Coordinates are in world-space pixels where
// (0,0) is the centre of the scene. Typical puzzle span: ±360 x, ±230 y.

import type { CelestialBody } from './physics'

export interface PuzzleTarget {
  x:      number
  y:      number
  radius: number
}

export interface PuzzleDef {
  id:          number
  name:        string
  description: string
  difficulty:  1 | 2 | 3 | 4 | 5   // stars
  startX:      number
  startY:      number
  bodies:      CelestialBody[]
  target:      PuzzleTarget
  hint:        string
}

// ─── Level registry ───────────────────────────────────────────────────────────

export const PUZZLES: PuzzleDef[] = [
  // ── 1 · First Contact (Tutorial) ─────────────────────────────────────────
  // Gentle gravity from a planet below the direct path.
  // Launch almost straight right — gravity provides a barely perceptible arc.
  {
    id: 1,
    name: 'First Contact',
    description: 'A gentle planet curves space around it. Reach the beacon.',
    difficulty: 1,
    startX: -325, startY: 0,
    bodies: [
      { id: 1, x: 0, y: 155, mass: 2200, radius: 36, type: 'planet', fixed: true },
    ],
    target: { x: 320, y: 0, radius: 28 },
    hint: 'Drag right to launch. A planet below gently bends your path.',
  },

  // ── 2 · Arc Around ───────────────────────────────────────────────────────
  // Planet dead-centre of the direct path. Must arc over or under it.
  {
    id: 2,
    name: 'Arc Around',
    description: 'The planet sits in your way. Curve around it to reach the beacon.',
    difficulty: 1,
    startX: -315, startY: 0,
    bodies: [
      { id: 1, x: 0, y: 0, mass: 4000, radius: 50, type: 'planet', fixed: true },
    ],
    target: { x: 315, y: 0, radius: 26 },
    hint: 'Aim slightly up or down — let gravity finish the curve.',
  },

  // ── 3 · Gravity Assist ────────────────────────────────────────────────────
  // Classic slingshot: launch toward the planet, arc around, exit toward target.
  {
    id: 3,
    name: 'Gravity Assist',
    description: 'Slingshot around the planet to redirect your probe to the far beacon.',
    difficulty: 2,
    startX: -330, startY: 200,
    bodies: [
      { id: 1, x: -20, y: -10, mass: 5000, radius: 52, type: 'planet', fixed: true },
    ],
    target: { x: 320, y: -195, radius: 28 },
    hint: 'Swing close to the planet — it bends your trajectory toward the target.',
  },

  // ── 4 · Binary Dance ─────────────────────────────────────────────────────
  // Two planets form a gravitational corridor the probe must thread through.
  {
    id: 4,
    name: 'Binary Dance',
    description: 'Two planets pull from opposite sides. Find the path between them.',
    difficulty: 2,
    startX: -350, startY: 0,
    bodies: [
      { id: 1, x: -60, y: -110, mass: 3200, radius: 44, type: 'planet', fixed: true },
      { id: 2, x:  70, y:  110, mass: 3200, radius: 44, type: 'planet', fixed: true },
    ],
    target: { x: 345, y: 0, radius: 26 },
    hint: 'Thread between both planets — their gravity will guide you if aimed right.',
  },

  // ── 5 · Dark Passage ─────────────────────────────────────────────────────
  // Black hole in direct path. Small planet above provides a slingshot bypass.
  {
    id: 5,
    name: 'Dark Passage',
    description: 'A black hole consumes everything that passes too close. Survive.',
    difficulty: 3,
    startX: -340, startY: 80,
    bodies: [
      { id: 1, x:   0, y:   0, mass: 16000, radius: 42, type: 'blackhole', fixed: true },
      { id: 2, x:  50, y: -230, mass: 2200, radius: 32, type: 'planet',    fixed: true },
    ],
    target: { x: 330, y: 80, radius: 26 },
    hint: 'Use the planet above to arc around the black hole — not through it.',
  },

  // ── 6 · The Triangle ─────────────────────────────────────────────────────
  // Three planets in a triangle. Route through the gaps using combined gravity.
  {
    id: 6,
    name: 'The Triangle',
    description: 'Three gravity wells. Navigate through the gaps with precision.',
    difficulty: 3,
    startX: -360, startY: 0,
    bodies: [
      { id: 1, x:   0, y: -165, mass: 3400, radius: 46, type: 'planet', fixed: true },
      { id: 2, x: -120, y: 130, mass: 3400, radius: 46, type: 'planet', fixed: true },
      { id: 3, x:  130, y: 115, mass: 3400, radius: 46, type: 'planet', fixed: true },
    ],
    target: { x: 355, y: 0, radius: 26 },
    hint: 'Aim toward the upper planet — let it deflect you through the lower gap.',
  },

  // ── 7 · Solar Escape ─────────────────────────────────────────────────────
  // Massive star dominates gravity. Must fight it to reach a small distant moon.
  {
    id: 7,
    name: 'Solar Escape',
    description: 'The star\'s gravity is immense. Fight it and reach the distant moon.',
    difficulty: 4,
    startX: -310, startY: 110,
    bodies: [
      { id: 1, x:   0, y:  0, mass: 11000, radius: 68, type: 'star',   fixed: true },
      { id: 2, x: 255, y: -185, mass: 1800, radius: 28, type: 'planet', fixed: true },
    ],
    target: { x: 280, y: -215, radius: 30 },
    hint: 'Launch with high power — aim to arc above the star and reach the moon.',
  },

  // ── 8 · Gauntlet ─────────────────────────────────────────────────────────
  // Full complexity: four planets + black hole forming a dangerous maze.
  {
    id: 8,
    name: 'Gauntlet',
    description: 'Five celestial obstacles. Only a precise trajectory survives.',
    difficulty: 5,
    startX: -360, startY: 0,
    bodies: [
      { id: 1, x: -120, y: -135, mass: 3000, radius: 42, type: 'planet',   fixed: true },
      { id: 2, x:  120, y: -135, mass: 3000, radius: 42, type: 'planet',   fixed: true },
      { id: 3, x:    0, y:   45, mass: 9000, radius: 36, type: 'blackhole', fixed: true },
      { id: 4, x: -120, y:  155, mass: 2500, radius: 38, type: 'planet',   fixed: true },
      { id: 5, x:  120, y:  155, mass: 2500, radius: 38, type: 'planet',   fixed: true },
    ],
    target: { x: 345, y: 0, radius: 26 },
    hint: 'Arc above the upper planets — thread the corridor away from the black hole.',
  },
]
