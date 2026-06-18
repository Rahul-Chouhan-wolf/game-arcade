// ─── Three-Body · scenarios ──────────────────────────────────────────────────
// Canonical initial conditions for the planar three-body problem. Each carries
// a plain-language explanation of what it teaches about real systems.

import type { Body } from './physics'

export interface Preset {
  id: string
  name: string
  blurb: string          // one line shown under the picker
  lesson: string         // longer explanation shown in the info panel
  G: number
  scale: number          // world half-extent to frame initially
  chaotic: boolean
  bodies: () => Body[]
}

const COLORS = ['#5b8cff', '#ff6b6b', '#ffd84d']
const LABELS = ['A', 'B', 'C']

function mk(
  data: { m: number; x: number; y: number; vx: number; vy: number }[],
  labels = LABELS, colors = COLORS,
): Body[] {
  return data.map((d, i) => ({
    x: d.x, y: d.y, vx: d.vx, vy: d.vy, ax: 0, ay: 0,
    mass: d.m, color: colors[i] ?? '#fff', label: labels[i] ?? `${i + 1}`, trail: [],
  }))
}

export const PRESETS: Preset[] = [
  {
    id: 'figure8',
    name: 'Figure-Eight',
    blurb: 'A rare stable periodic orbit',
    lesson:
      'Three equal masses chase each other along a single figure-eight path — a stable periodic solution discovered by Moore (1993) and proven by Chenciner & Montgomery (2000). Almost no three-body configuration is this orderly: it is a vanishingly rare island of stability in an ocean of chaos.',
    G: 1, scale: 1.6, chaotic: false,
    bodies: () => mk([
      { m: 1, x: -0.97000436, y: 0.24308753, vx: 0.466203685, vy: 0.43236573 },
      { m: 1, x: 0.97000436, y: -0.24308753, vx: 0.466203685, vy: 0.43236573 },
      { m: 1, x: 0, y: 0, vx: -0.93240737, vy: -0.86473146 },
    ]),
  },
  {
    id: 'lagrange',
    name: 'Lagrange Triangle',
    blurb: 'Equal masses on a spinning triangle',
    lesson:
      'Three equal masses sit at the corners of an equilateral triangle and rotate rigidly about their common centre of mass — one of Lagrange’s 1772 exact solutions. It is only marginally stable: nudge it and it drifts into chaos. The same physics fixes the L4/L5 points where Trojan asteroids share Jupiter’s orbit.',
    G: 1, scale: 1.7, chaotic: false,
    bodies: () => {
      const R = 1, w = Math.sqrt(1 / Math.sqrt(3))  // ω from centripetal balance
      return mk([0, 1, 2].map(k => {
        const a = (Math.PI / 2) + (k * 2 * Math.PI) / 3
        const x = R * Math.cos(a), y = R * Math.sin(a)
        return { m: 1, x, y, vx: -w * y, vy: w * x }     // tangential velocity
      }))
    },
  },
  {
    id: 'pythagorean',
    name: 'Pythagorean (Burrau)',
    blurb: 'Masses 3-4-5 from rest → chaos',
    lesson:
      'Masses 3, 4 and 5 are placed at the corners of a 3-4-5 right triangle and released from rest (Burrau, 1913). They fall together into a wild sequence of close encounters and slingshots, and after a famous near-collision one body is ejected while the other two settle into a tight binary — the typical fate of a chaotic triple star.',
    G: 1, scale: 5, chaotic: true,
    bodies: () => mk([
      { m: 3, x: 1, y: 3, vx: 0, vy: 0 },
      { m: 4, x: -2, y: -1, vx: 0, vy: 0 },
      { m: 5, x: 1, y: -1, vx: 0, vy: 0 },
    ], ['3', '4', '5']),
  },
  {
    id: 'hierarchy',
    name: 'Sun · Planet · Moon',
    blurb: 'Stable hierarchy (big mass ratios)',
    lesson:
      'A heavy “sun”, a lighter “planet” orbiting it, and a tiny “moon” orbiting the planet. Very unequal masses with well-separated orbits make a hierarchical system that stays stable for a long time — which is why our own Solar System is predictable even though the full N-body problem is chaotic.',
    G: 1, scale: 4, chaotic: false,
    bodies: () => {
      const Ms = 1, rp = 2.6, vp = Math.sqrt(Ms / rp)
      const mp = 0.05, rm = 0.4, vm = Math.sqrt(mp / rm)
      return mk([
        { m: Ms, x: 0, y: 0, vx: 0, vy: 0 },
        { m: mp, x: rp, y: 0, vx: 0, vy: vp },
        { m: 0.004, x: rp + rm, y: 0, vx: 0, vy: vp + vm },
      ], ['Sun', 'Planet', 'Moon'], ['#ffd84d', '#5b8cff', '#cfd8e6'])
    },
  },
]

/** A fresh random triple — almost always chaotic, usually ends in an ejection. */
export function randomPreset(seed: number): Preset {
  let s = seed >>> 0
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  const bodies = () => mk([0, 1, 2].map(() => ({
    m: 0.6 + rnd() * 1.0,
    x: (rnd() - 0.5) * 2.4, y: (rnd() - 0.5) * 2.4,
    vx: (rnd() - 0.5) * 0.6, vy: (rnd() - 0.5) * 0.6,
  })))
  return {
    id: 'random-' + seed, name: 'Random Triple', blurb: 'Three random stars → chaos',
    lesson:
      'Three stars with random masses, positions and velocities. Because the three-body problem is chaotic, the tiniest change in these starting numbers leads to a completely different future — there is no formula that predicts the outcome, only step-by-step simulation. Watch for one star being flung away, leaving a binary behind.',
    G: 1, scale: 2.2, chaotic: true, bodies,
  }
}
