// ─── Orbital · Puzzle definitions + Procedural Generator ─────────────────────
// Hand-crafted levels 1-8. Level 9+ are procedurally generated via seeded LCG.
// Every puzzle now has MULTIPLE sequential targets and optional ASTEROIDS.

import type { CelestialBody, AsteroidDef } from './physics'

export interface PuzzleTarget {
  x:      number
  y:      number
  radius: number
}

export interface PuzzleDef {
  id:          number
  name:        string
  description: string
  difficulty:  1 | 2 | 3 | 4 | 5
  startX:      number
  startY:      number
  bodies:      CelestialBody[]
  targets:     PuzzleTarget[]   // hit in order (1 → 2 → 3 ...)
  asteroids:   AsteroidDef[]
  hint:        string
}

// ─── Seeded LCG (for deterministic procedural levels) ────────────────────────

function makeLCG(seed: number): () => number {
  let s = ((seed | 0) + 1) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ─── Hand-crafted levels 1–8 ──────────────────────────────────────────────────

export const PUZZLES: PuzzleDef[] = [

  // ── 1 · First Contact ─ Tutorial ────────────────────────────────────────────
  // Two checkpoints along a gently curved path. Barely any gravity needed.
  {
    id: 1, name: 'First Contact', difficulty: 1,
    description: 'Two beacons. One gentle planet. Find the arc.',
    startX: -325, startY: 10,
    bodies: [
      { id: 1, x: 10, y: 155, mass: 2200, radius: 36, type: 'planet', fixed: true },
    ],
    targets: [
      { x: 90, y: -22, radius: 32 },
      { x: 320, y: 8, radius: 28 },
    ],
    asteroids: [],
    hint: 'Drag right to launch. Hit beacon 1 then let the path carry you to beacon 2.',
  },

  // ── 2 · Arc Around ─────────────────────────────────────────────────────────
  // Planet dead-centre. Two targets require arcing over the obstacle.
  // One asteroid orbiting — time your launch or dodge the rock.
  {
    id: 2, name: 'Arc Around', difficulty: 1,
    description: 'Thread above the planet. One orbiting rock wants to stop you.',
    startX: -315, startY: 20,
    bodies: [
      { id: 1, x: 0, y: 0, mass: 4200, radius: 50, type: 'planet', fixed: true },
    ],
    targets: [
      { x:  30, y: -195, radius: 30 },
      { x: 310, y:  -10, radius: 26 },
    ],
    asteroids: [
      { id: 1, centerX: 0, centerY: 0, orbitRadius: 135, speed: 0.75, phase: 0.8, radius: 15 },
    ],
    hint: 'Aim above the planet. Watch the orbiting asteroid — time your shot.',
  },

  // ── 3 · Gravity Assist ──────────────────────────────────────────────────────
  // Classic slingshot: two sequential beacons require a gravity-assisted arc.
  {
    id: 3, name: 'Gravity Assist', difficulty: 2,
    description: 'Slingshot around the planet to chain two distant beacons.',
    startX: -330, startY: 210,
    bodies: [
      { id: 1, x: -20, y: -15, mass: 5200, radius: 52, type: 'planet', fixed: true },
    ],
    targets: [
      { x:  60, y: -205, radius: 30 },
      { x: 320, y: -200, radius: 26 },
    ],
    asteroids: [
      { id: 1, centerX: -20, centerY: -15, orbitRadius: 160, speed: -0.55, phase: 2.0, radius: 13 },
    ],
    hint: 'Swing tight around the planet. The first beacon redirects you toward the second.',
  },

  // ── 4 · Binary Dance ────────────────────────────────────────────────────────
  // Two planets create a gravitational corridor. Three checkpoints test precision.
  {
    id: 4, name: 'Binary Dance', difficulty: 2,
    description: 'Three checkpoints scattered through a binary planet system.',
    startX: -355, startY: 0,
    bodies: [
      { id: 1, x: -65, y: -115, mass: 3200, radius: 44, type: 'planet', fixed: true },
      { id: 2, x:  75, y:  110, mass: 3200, radius: 44, type: 'planet', fixed: true },
    ],
    targets: [
      { x: -60, y:   80, radius: 28 },
      { x: 140, y:  -80, radius: 26 },
      { x: 340, y:   10, radius: 26 },
    ],
    asteroids: [
      { id: 1, centerX: -65, centerY: -115, orbitRadius: 115, speed:  0.60, phase: 3.1, radius: 12 },
      { id: 2, centerX:  75, centerY:  110, orbitRadius: 110, speed: -0.55, phase: 0.5, radius: 12 },
    ],
    hint: 'Use each planet\'s gravity in sequence. Watch both orbiting rocks.',
  },

  // ── 5 · Dark Passage ────────────────────────────────────────────────────────
  // Black hole plus two asteroids in tight orbit. Two targets beyond the danger zone.
  {
    id: 5, name: 'Dark Passage', difficulty: 3,
    description: 'A black hole, two orbiting asteroids, two distant beacons. Survive.',
    startX: -340, startY: 100,
    bodies: [
      { id: 1, x:   0, y:   0, mass: 17000, radius: 42, type: 'blackhole', fixed: true },
      { id: 2, x:  55, y: -235, mass: 2400, radius: 32, type: 'planet',    fixed: true },
    ],
    targets: [
      { x: 190, y: -140, radius: 30 },
      { x: 335, y:   80, radius: 26 },
    ],
    asteroids: [
      { id: 1, centerX: 0, centerY: 0, orbitRadius: 120, speed:  1.1, phase: 0.0, radius: 14 },
      { id: 2, centerX: 0, centerY: 0, orbitRadius: 160, speed: -0.8, phase: 1.8, radius: 14 },
    ],
    hint: 'Arc via the upper planet — dodge the orbiting rocks and stay wide of the black hole.',
  },

  // ── 6 · The Triangle ────────────────────────────────────────────────────────
  // Three planets form a triangle. Three checkpoints — one near each planet gap.
  {
    id: 6, name: 'The Triangle', difficulty: 3,
    description: 'Three gravity wells, three checkpoints, one orbiting hazard.',
    startX: -360, startY: 0,
    bodies: [
      { id: 1, x:   0, y: -165, mass: 3400, radius: 46, type: 'planet', fixed: true },
      { id: 2, x: -120, y: 130, mass: 3400, radius: 46, type: 'planet', fixed: true },
      { id: 3, x:  130, y: 115, mass: 3400, radius: 46, type: 'planet', fixed: true },
    ],
    targets: [
      { x: -40, y:  -80, radius: 28 },
      { x:  60, y:  -60, radius: 26 },
      { x: 350, y:   0, radius: 26 },
    ],
    asteroids: [
      { id: 1, centerX: 0, centerY: -165, orbitRadius: 115, speed: 0.7, phase: 1.2, radius: 13 },
      { id: 2, centerX: 5, centerY:  30,  orbitRadius: 195, speed: 0.3, phase: 4.0, radius: 16 },
    ],
    hint: 'Aim toward the top planet — thread each gap between the triangle vertices.',
  },

  // ── 7 · Solar Escape ────────────────────────────────────────────────────────
  // Massive star with an asteroid belt (three rocks). Three sequential targets.
  {
    id: 7, name: 'Solar Escape', difficulty: 4,
    description: 'Pierce through the asteroid belt around the star. Three beacons await.',
    startX: -310, startY: 115,
    bodies: [
      { id: 1, x:   0, y:   0, mass: 11500, radius: 68, type: 'star',   fixed: true },
      { id: 2, x: 255, y: -185, mass: 1800, radius: 28, type: 'planet', fixed: true },
    ],
    targets: [
      { x:  70, y: -220, radius: 30 },
      { x: 225, y: -130, radius: 28 },
      { x: 285, y: -215, radius: 28 },
    ],
    asteroids: [
      { id: 1, centerX: 0, centerY: 0, orbitRadius: 155, speed:  0.50, phase: 0.3, radius: 16 },
      { id: 2, centerX: 0, centerY: 0, orbitRadius: 180, speed: -0.45, phase: 2.5, radius: 15 },
      { id: 3, centerX: 0, centerY: 0, orbitRadius: 205, speed:  0.35, phase: 4.8, radius: 14 },
    ],
    hint: 'High-speed arc past the star — find the gap in the belt on your way to the moon.',
  },

  // ── 8 · Gauntlet ────────────────────────────────────────────────────────────
  // Full chaos: five bodies, three asteroids, three sequential checkpoints.
  {
    id: 8, name: 'Gauntlet', difficulty: 5,
    description: 'Five celestial hazards. Three orbiting rocks. Thread three beacons. Survive.',
    startX: -360, startY: 0,
    bodies: [
      { id: 1, x: -120, y: -135, mass: 3100, radius: 42, type: 'planet',    fixed: true },
      { id: 2, x:  120, y: -135, mass: 3100, radius: 42, type: 'planet',    fixed: true },
      { id: 3, x:    0, y:   45, mass: 9500, radius: 36, type: 'blackhole', fixed: true },
      { id: 4, x: -120, y:  155, mass: 2600, radius: 38, type: 'planet',    fixed: true },
      { id: 5, x:  120, y:  155, mass: 2600, radius: 38, type: 'planet',    fixed: true },
    ],
    targets: [
      { x: -55, y: -195, radius: 28 },
      { x:  55, y: -195, radius: 26 },
      { x: 345, y:    0, radius: 26 },
    ],
    asteroids: [
      { id: 1, centerX:    0, centerY:   45, orbitRadius: 110, speed:  1.0, phase: 0.0, radius: 14 },
      { id: 2, centerX: -120, centerY: -135, orbitRadius: 100, speed: -0.7, phase: 2.2, radius: 13 },
      { id: 3, centerX:  120, centerY: -135, orbitRadius: 100, speed:  0.8, phase: 1.1, radius: 13 },
    ],
    hint: 'Arc between the upper two planets — cross both upper beacons then thread away from the black hole.',
  },
]

// ─── Procedural Level Generator (Level 9+) ───────────────────────────────────
//
// Four rotating templates, each solvable by design. Parameters are randomised
// within safe ranges using a seeded LCG so the same level number always yields
// the same puzzle (deterministic + sharable).

export function generateLevel(n: number): PuzzleDef {
  const rng   = makeLCG(n * 3571 + 1009)
  const r     = () => rng()
  const rflt  = (lo: number, hi: number)  => lo + r() * (hi - lo)
  const rint  = (lo: number, hi: number)  => lo + Math.floor(r() * (hi - lo + 1))
  const rsign = ()                        => r() > 0.5 ? 1 : -1

  // Progressive difficulty bands
  const era    = Math.floor((n - 9) / 4)           // 0 at L9, +1 every 4 levels
  const diff   = (Math.min(5, 2 + Math.ceil(era / 2))) as 1|2|3|4|5
  const nTgts  = era >= 2 ? 3 : 2
  const nRocks = Math.min(era + 1, 4)
  const hasBH  = era >= 3 && r() > 0.45
  const hasStar = !hasBH && era >= 2 && r() > 0.55

  // Four templates cycling 0-3
  const template = (n - 9) % 4

  if (template === 0) {
    // ── Template A: Single large planet, arc targets around it ──────────────
    const px = rflt(-50, 50), py = rflt(-50, 50)
    const mass = rflt(4500, 8000), rad = rflt(44, 65)
    const bodyType: CelestialBody['type'] = hasStar ? 'star' : 'planet'

    const targets: PuzzleTarget[] = Array.from({ length: nTgts }, (_, i) => {
      const ang  = Math.PI * 0.55 + (i / nTgts) * Math.PI * 1.1
      const dist = rad + rflt(90, 160)
      return { x: px + Math.cos(ang) * dist, y: py + Math.sin(ang) * dist, radius: 26 }
    })

    const asteroids: AsteroidDef[] = Array.from({ length: nRocks }, (_, i) => ({
      id: i + 1,
      centerX: px, centerY: py,
      orbitRadius: rad + rflt(55, 115) + i * 28,
      speed: rsign() * rflt(0.35, 0.90),
      phase: rflt(0, Math.PI * 2),
      radius: rint(12, 17),
    }))

    return {
      id: n, name: `Level ${n}`, difficulty: diff,
      description: 'Arc around the body — hit every beacon in sequence.',
      startX: rflt(-345, -280), startY: rflt(-40, 40),
      bodies: [{ id: 1, x: px, y: py, mass, radius: rad, type: bodyType, fixed: true }],
      targets, asteroids,
      hint: 'Thread the arc — asteroid orbits are your clock.',
    }
  }

  if (template === 1) {
    // ── Template B: Binary system, targets through the corridor ─────────────
    const sep  = rflt(140, 220)
    const b1y  = -rflt(80, 130), b2y = rflt(80, 130)
    const mass = rflt(3000, 5000), rad = rflt(38, 50)

    const bodies: CelestialBody[] = [
      { id: 1, x: rflt(-80, 0),  y: b1y, mass, radius: rad, type: 'planet', fixed: true },
      { id: 2, x: rflt(0,  80),  y: b2y, mass, radius: rad, type: 'planet', fixed: true },
    ]
    if (hasBH) bodies.push({ id: 3, x: rflt(50, 120), y: rflt(-30, 30), mass: rflt(10000, 18000), radius: rint(32, 44), type: 'blackhole', fixed: true })

    const targets: PuzzleTarget[] = [
      { x: rflt(-20, 30),  y: rflt(-40, 40),   radius: 28 },
      ...Array.from({ length: nTgts - 1 }, (_, i) => ({
        x: rflt(130 + i * 90, 210 + i * 90),
        y: rflt(-60, 60),
        radius: 26,
      })),
    ]

    const asteroids: AsteroidDef[] = Array.from({ length: nRocks }, (_, i) => ({
      id: i + 1,
      centerX: bodies[i % 2].x,
      centerY: bodies[i % 2].y,
      orbitRadius: rad + rflt(55, 100) + (i > 1 ? 35 : 0),
      speed: rsign() * rflt(0.4, 0.85),
      phase: rflt(0, Math.PI * 2),
      radius: rint(11, 16),
    }))

    return {
      id: n, name: `Level ${n}`, difficulty: diff,
      description: 'Two gravity anchors, ' + (hasBH ? 'a black hole, ' : '') + 'and ' + nTgts + ' beacons.',
      startX: rflt(-345, -290), startY: rflt(-20, 20),
      bodies, targets, asteroids,
      hint: 'Thread the binary corridor — gravity from both sides guides you.',
    }
  }

  if (template === 2) {
    // ── Template C: Star + orbiting planet, asteroid belt, targets ───────────
    const starMass = rflt(9000, 14000), starRad = rflt(58, 78)
    const pOrbit   = rflt(200, 280)
    const pAngle   = rflt(0, Math.PI * 2)

    const bodies: CelestialBody[] = [
      { id: 1, x: 0, y: 0, mass: starMass, radius: starRad, type: 'star', fixed: true },
      { id: 2,
        x: Math.cos(pAngle) * pOrbit,
        y: Math.sin(pAngle) * pOrbit,
        mass: rflt(1600, 2800), radius: rint(24, 36), type: 'planet', fixed: true },
    ]

    const beltR = starRad + rflt(110, 160)
    const asteroids: AsteroidDef[] = Array.from({ length: nRocks }, (_, i) => ({
      id: i + 1,
      centerX: 0, centerY: 0,
      orbitRadius: beltR + i * rflt(20, 32),
      speed: rsign() * rflt(0.30, 0.65),
      phase: (i / nRocks) * Math.PI * 2 + rflt(0, 0.8),
      radius: rint(13, 18),
    }))

    const targets: PuzzleTarget[] = Array.from({ length: nTgts }, (_, i) => {
      const ang  = pAngle - Math.PI * 0.4 + i * (Math.PI * 0.55)
      const dist = rflt(beltR + 40, beltR + 110)
      return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, radius: 28 }
    })

    return {
      id: n, name: `Level ${n}`, difficulty: diff,
      description: 'Breach the asteroid belt around a star. ' + nTgts + ' beacons beyond it.',
      startX: rflt(-320, -270), startY: rflt(-30, 30),
      bodies, targets, asteroids,
      hint: 'High speed arc — find the gap in the belt, then curve to each beacon.',
    }
  }

  // ── Template D: Multi-planet maze + black hole ────────────────────────────
  const nPlanets = rint(2, 3)
  const bodies: CelestialBody[] = []
  for (let i = 0; i < nPlanets; i++) {
    const ang  = (i / nPlanets) * Math.PI * 1.6 - Math.PI * 0.4
    const dist = rflt(120, 200)
    bodies.push({
      id: i + 1,
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      mass: rflt(2800, 4500), radius: rflt(36, 48), type: 'planet', fixed: true,
    })
  }
  if (hasBH) {
    bodies.push({
      id: nPlanets + 1,
      x: rflt(-40, 40), y: rflt(-40, 40),
      mass: rflt(11000, 18000), radius: rint(30, 42), type: 'blackhole', fixed: true,
    })
  }

  const targets: PuzzleTarget[] = Array.from({ length: nTgts }, (_, i) => ({
    x: rflt(100 + i * 80, 200 + i * 80),
    y: rflt(-80, 80),
    radius: 26,
  }))

  const asteroids: AsteroidDef[] = Array.from({ length: nRocks }, (_, i) => {
    const b = bodies[i % bodies.length]
    return {
      id: i + 1,
      centerX: b.x, centerY: b.y,
      orbitRadius: b.radius + rflt(55, 100),
      speed: rsign() * rflt(0.45, 0.95),
      phase: rflt(0, Math.PI * 2),
      radius: rint(12, 17),
    }
  })

  return {
    id: n, name: `Level ${n}`, difficulty: diff,
    description: nPlanets + ' planets' + (hasBH ? ' + a black hole' : '') + '. Navigate the gravity maze.',
    startX: rflt(-345, -290), startY: rflt(-30, 30),
    bodies, targets, asteroids,
    hint: 'Plan your arc before launching — each gravity well reshapes your path.',
  }
}
