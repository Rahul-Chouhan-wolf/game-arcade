'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'

// ─── Board rendering ──────────────────────────────────────────────────────────
// Cell codes:  '.' empty  'B' black  'W' white
//              '*' key-point (highlighted empty)  'b' black+mark  'w' white+mark
//              'A'–'Z' numbered black  'a'–'z' numbered white

type CellCode = '.' | 'B' | 'W' | '*' | 'b' | 'w' | string

interface MiniBoard {
  grid:    CellCode[][]      // rows of columns
  caption: string
  labels?: { r: number; c: number; text: string; color?: string }[]
  arrows?: { from: [number,number]; to: [number,number] }[]
}

const CELL  = 32  // SVG cell size
const PAD   = 20  // board padding
const SR    = 10  // stone radius
const DOT_R = 3   // liberty dot radius

function MiniGoBoard({ grid, labels, arrows }: MiniBoard) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const W    = PAD * 2 + (cols - 1) * CELL
  const H    = PAD * 2 + (rows - 1) * CELL
  const x    = (c: number) => PAD + c * CELL
  const y    = (r: number) => PAD + r * CELL

  const stoneColor = (code: CellCode) => {
    const lc = code.toLowerCase()
    if (lc === 'b' || (code >= 'A' && code <= 'Z')) return '#d4d4d4'   // black stone — light
    if (lc === 'w' || (code >= 'a' && code <= 'z')) return '#505060'   // white stone — darker
    return null
  }

  const isBlack = (code: CellCode) => {
    const lc = code.toLowerCase()
    return lc === 'b' || (code >= 'A' && code <= 'Z')
  }

  const isWhite = (code: CellCode) => {
    const lc = code.toLowerCase()
    return lc === 'w' || (code >= 'a' && code <= 'z')
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W * 2, height: 'auto', display: 'block' }}>
      {/* Board background */}
      <rect x={0} y={0} width={W} height={H} fill="#1a1a0f" rx={6} />
      <rect x={PAD/2} y={PAD/2} width={W - PAD} height={H - PAD} fill="#c8a96a" rx={4} />

      {/* Grid lines */}
      {Array.from({ length: cols }, (_, c) => (
        <line key={`v${c}`} x1={x(c)} y1={y(0)} x2={x(c)} y2={y(rows-1)} stroke="#7a6020" strokeWidth={0.8} />
      ))}
      {Array.from({ length: rows }, (_, r) => (
        <line key={`h${r}`} x1={x(0)} y1={y(r)} x2={x(cols-1)} y2={y(r)} stroke="#7a6020" strokeWidth={0.8} />
      ))}

      {/* Arrows */}
      {arrows?.map(({ from, to }, i) => {
        const [fr, fc] = from, [tr, tc] = to
        const x1 = x(fc), y1 = y(fr), x2 = x(tc), y2 = y(tr)
        const dx = x2 - x1, dy = y2 - y1
        const len = Math.sqrt(dx*dx+dy*dy)
        const ux = dx/len, uy = dy/len
        return (
          <g key={i}>
            <defs>
              <marker id={`arr${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#e8b86d" />
              </marker>
            </defs>
            <line
              x1={x1 + ux * SR} y1={y1 + uy * SR}
              x2={x2 - ux * SR} y2={y2 - uy * SR}
              stroke="#e8b86d" strokeWidth={2}
              markerEnd={`url(#arr${i})`}
            />
          </g>
        )
      })}

      {/* Stones and markers */}
      {grid.map((row, r) =>
        row.map((code, c) => {
          if (code === '.') return null
          if (code === '*') {
            return (
              <g key={`${r},${c}`}>
                <circle cx={x(c)} cy={y(r)} r={SR} fill="#e8b86d" opacity={0.3} />
                <circle cx={x(c)} cy={y(r)} r={4} fill="#e8b86d" />
              </g>
            )
          }
          const sColor = stoneColor(code)
          if (!sColor) return null
          const textColor = isBlack(code) ? '#0a0a0a' : '#e8e8e8'
          const isNumbered = (code >= '1' && code <= '9') || (code.length > 1)
          return (
            <g key={`${r},${c}`}>
              <defs>
                <radialGradient id={`sg-${r}-${c}`} cx="38%" cy="32%" r="60%">
                  <stop offset="0%" stopColor={isBlack(code) ? '#e0e0e0' : '#888'} />
                  <stop offset="100%" stopColor={isBlack(code) ? '#2a2a2a' : '#1a1a2a'} />
                </radialGradient>
              </defs>
              <circle cx={x(c)} cy={y(r)} r={SR} fill={`url(#sg-${r}-${c})`} />
              {code === 'b' && <circle cx={x(c)} cy={y(r)} r={4} fill="#e8b86d" />}
              {code === 'w' && <circle cx={x(c)} cy={y(r)} r={4} fill="#e8b86d" />}
              {!isNaN(Number(code)) && (
                <text x={x(c)} y={y(r)+1} textAnchor="middle" dominantBaseline="middle"
                  fill={textColor} fontSize={10} fontWeight={700}>{code}</text>
              )}
            </g>
          )
        })
      )}

      {/* Liberty dots on empty cells adjacent to groups (for illustration) */}

      {/* Custom labels */}
      {labels?.map((lbl, i) => (
        <text key={i}
          x={x(lbl.c)} y={y(lbl.r) + 1}
          textAnchor="middle" dominantBaseline="middle"
          fill={lbl.color ?? '#e8b86d'} fontSize={9} fontWeight={800}
        >
          {lbl.text}
        </text>
      ))}
    </svg>
  )
}

// ─── Tactic definitions ───────────────────────────────────────────────────────
// Validated from: American Go Association (usgo.org), Sensei's Library
// (senseis.xmp.net), Go Magic (gomagic.org), British Go Association (britgo.org)

interface Tactic {
  id:      string
  title:   string
  jp?:     string
  level:   'basics' | 'tactics' | 'strategy'
  summary: string
  body:    string
  source:  string
  board:   MiniBoard
  board2?: MiniBoard
}

const TACTICS: Tactic[] = [
  // ── BASICS ──────────────────────────────────────────────────────────────────
  {
    id: 'liberties',
    title: 'Liberties & Capture',
    level: 'basics',
    summary: 'Every stone must have at least one empty adjacent point (liberty) to survive.',
    body: `A stone's liberties are the empty intersections immediately to its north, south, east, and west. Stones of the same colour that are directly connected share liberties as a group.

When a player fills the last liberty of an opponent's group, those stones are captured and removed from the board. You score one point for each stone you capture (Japanese rules).

Critically, you cannot place a stone that would immediately have zero liberties (suicide), unless doing so simultaneously captures opponent stones.`,
    source: 'American Go Association — AGA Rules of Go; British Go Association introductory guide',
    board: {
      grid: [
        ['.','W','.','.','.'],
        ['W','B','W','.','.'],
        ['.','W','.','.','.'],
        ['.','.','.','.','.',],
        ['.','.','.','.','.',],
      ],
      caption: 'Black has no liberties — surrounded on all four sides by White',
      labels: [
        { r: 0, c: 1, text: 'L', color: '#38bdf8' },
        { r: 2, c: 1, text: 'L', color: '#38bdf8' },
        { r: 1, c: 0, text: 'L', color: '#38bdf8' },
        { r: 1, c: 2, text: 'L', color: '#38bdf8' },
      ],
    },
  },
  {
    id: 'atari',
    title: 'Atari',
    jp: '当たり',
    level: 'basics',
    summary: 'A stone or group reduced to its last liberty — capture is threatened next move.',
    body: `Atari means a stone or group has only one liberty remaining. The opponent can capture it on their next turn by filling that last liberty.

Announcing "atari" is like saying "check" in chess — the opponent must respond by escaping (extending to gain more liberties), capturing the threatening stone, or connecting to a stronger group.

Not every atari demands a response; sometimes ignoring it to play a bigger move elsewhere wins more territory than saving the attacked stones.`,
    source: 'Go Magic (gomagic.org/go-term/atari); Sensei\'s Library — Atari',
    board: {
      grid: [
        ['.','.','.','.','.'],
        ['.','W','W','W','.'],
        ['.','W','B','W','.'],
        ['.','W','.','W','.'],
        ['.','W','W','W','.'],
      ],
      caption: 'Black is in atari — one liberty remains at (3,2). White plays there next to capture.',
      labels: [{ r: 3, c: 2, text: '!', color: '#f87171' }],
    },
  },
  {
    id: 'ladder',
    title: 'Ladder',
    jp: 'シチョウ (Shicho)',
    level: 'basics',
    summary: 'A chasing sequence that drives a group in atari diagonally across the board.',
    body: `A ladder (shicho) is one of Go's most fundamental tactics. When a stone in atari tries to escape, the attacker keeps putting it in atari in a zig-zag pattern toward the board edge, where the group eventually runs out of room to manoeuvre.

A ladder fails if the escaping player has a "ladder breaker" — a friendly stone already sitting on the ladder's projected path. This is why ladders must be read out all the way to the wall before initiating them.

Checking whether a ladder works is a critical reading skill for beginners. Professionals often play ladder-breakers many moves in advance.`,
    source: 'Sensei\'s Library — Shicho; Go Magic (gomagic.org/go-term/shicho); Kiseido: Elementary Go Series',
    board: {
      grid: [
        ['W','.','.','.','.','.','.'],
        ['W','B','.','.','.','.','.'],
        ['.','.','B','.','.','.','.',],
        ['.','.','.','B','.','.','.',],
        ['.','.','.','.','B','.','.',],
        ['.','.','.','.','.','B','.',],
        ['.','.','.','.','.','.','B'],
      ],
      caption: 'Black stones trace the ladder path diagonally — White fills in around them, capture is inevitable.',
      arrows: [{ from:[1,1], to:[6,6] }],
    },
  },
  {
    id: 'net',
    title: 'Net (Geta)',
    jp: 'ゲタ (Geta)',
    level: 'basics',
    summary: 'Trap stones by surrounding them — they cannot escape in any direction.',
    body: `A net (geta, literally "wooden sandal") traps enemy stones without the linear chase of a ladder. The attacker plays a stone that covers all escape routes simultaneously, creating an inescapable net.

Unlike a ladder, a net is not affected by stones on the escape path — those stones would need to be directly adjacent to the trapped group to help. Nets are often more reliable than ladders for this reason.

The key is to identify the single move that covers enough directions to make escape impossible, even if the opponent tries to push out in multiple ways.`,
    source: 'Go Magic (gomagic.org/go-term/geta); Sensei\'s Library — Geta; British Go Association tactics guide',
    board: {
      grid: [
        ['.','.','.','.','.'],
        ['.','B','B','.','.',],
        ['.','.','.','W','.',],
        ['.','.','.','.','.',],
        ['.','.','.','.','.',],
      ],
      caption: 'White at (2,3) creates a net — Black\'s two stones cannot escape even by pushing in any direction.',
      labels: [{ r: 2, c: 3, text: '▶', color: '#f87171' }],
    },
  },
  {
    id: 'double-atari',
    title: 'Double Atari',
    level: 'basics',
    summary: 'Attack two groups simultaneously — opponent can only save one.',
    body: `A double atari (nidan atari) is a move that puts two separate opponent groups in atari at the same time. Since the opponent can only play one move in response, at least one of the threatened groups will be captured.

Double ataris are extremely powerful and often game-deciding. They arise naturally from good positioning that keeps the opponent's groups separated and weak.

To avoid double ataris, try to keep your groups connected so they share liberties and cannot be split apart. Reading ahead to see if your moves might be answered with a double atari is an important defensive skill.`,
    source: 'Sensei\'s Library — Double Atari; American Go Association beginner series; Gomagic.org',
    board: {
      grid: [
        ['.','.','.','.','.'],
        ['.','W','.','W','.'],
        ['.','.','B','.','.'],
        ['.','W','.','W','.'],
        ['.','.','.','.','.',],
      ],
      caption: 'Black at (2,2) puts both White groups (top and bottom) in atari simultaneously.',
      labels: [{ r: 2, c: 2, text: '★', color: '#e8b86d' }],
    },
  },
  {
    id: 'ko',
    title: 'Ko',
    jp: '劫 (Ko)',
    level: 'basics',
    summary: 'The Ko rule prevents infinite board repetition by requiring a move elsewhere before recapturing.',
    body: `Ko ("eternity") arises when a capture would recreate the previous board position. The Ko rule forbids this — after a ko capture, the opponent must play somewhere else before recapturing.

This creates a "ko fight": each player must make a ko threat big enough to force the other to respond before winning the ko. Ko fights are a major strategic element and calculating ko threats accurately is an advanced skill.

There are many types of kos: simple kos, multi-step kos (moonshine life), and triple kos that can end in jigo (draw). Understanding ko is essential for high-level play.`,
    source: 'American Go Association — AGA Rules of Go; Sensei\'s Library — Ko; Robert Jasiek: Ko Compendium',
    board: {
      grid: [
        ['.','.','.','.','.',],
        ['.','W','B','.','.',],
        ['W','.','W','B','.',],
        ['.','W','B','.','.',],
        ['.','.','.','.','.',],
      ],
      caption: 'White just captured at (2,1). Black cannot recapture immediately — must play elsewhere first (Ko rule).',
      labels: [
        { r: 2, c: 1, text: '⬚', color: '#e8b86d' },
      ],
    },
  },
  {
    id: 'snapback',
    title: 'Snapback',
    jp: '打ち返し (Uttegaeshi)',
    level: 'basics',
    summary: 'Sacrifice a stone to lure the opponent into a position where you recapture more stones.',
    body: `A snapback (uttegaeshi) is a deceptive tactic where you sacrifice a stone by allowing it to be captured, then immediately recapture the stones that captured yours — plus the area around them.

The key feature: after the opponent captures your sacrificial stone, the resulting group has only one liberty left and you can recapture. This nets a material advantage (you lose fewer stones than you gain).

Snapbacks appear in life-and-death problems and endgame sequences. They also occur when a player tries to "fill" an opponent's eye only to find it was a snapback trap.`,
    source: 'Sensei\'s Library — Snapback (Uttegaeshi); Kiseido: Life and Death (Davies); Go Magic glossary',
    board: {
      grid: [
        ['.','.','.','.','.'],
        ['.','.','B','.','.'],
        ['.','B','W','B','.'],
        ['.','.','B','.','.'],
        ['.','.','.','.','.'],
      ],
      caption: 'If White fills the last liberty (center), Black recaptures all four Black stones — snapback.',
      labels: [{ r: 2, c: 2, text: '→', color: '#f87171' }],
    },
  },

  // ── TACTICS ──────────────────────────────────────────────────────────────────
  {
    id: 'two-eyes',
    title: 'Two-Eye Life',
    level: 'tactics',
    summary: 'A group with two separate true eyes cannot be captured under any circumstances.',
    body: `The cornerstone of Go strategy: a group with two genuine "eyes" (enclosed empty spaces) is unconditionally alive and cannot be captured regardless of opponent moves.

Why? To capture a group, all its liberties must be filled. But the opponent cannot fill an eye without committing self-capture (suicide), which is illegal. With two separate eyes, both must be filled simultaneously — which is impossible under the suicide rule.

Creating two eyes for your groups and preventing the opponent from doing the same is the primary strategic goal throughout the game. Groups without two eyes must either escape, connect to a safe group, or find other means of survival.`,
    source: 'Sensei\'s Library — Two Eyes; Polgote.com — Eyes and False Eyes; British Go Association',
    board: {
      grid: [
        ['.','B','B','B','.'],
        ['B','.','B','.','B'],
        ['B','B','B','B','B'],
        ['.','.','.','.','.',],
        ['.','.','.','.','.',],
      ],
      caption: 'Black has two separate eyes at (1,1) and (1,3) — unconditionally alive.',
      labels: [
        { r: 1, c: 1, text: '●', color: '#38bdf8' },
        { r: 1, c: 3, text: '●', color: '#38bdf8' },
      ],
    },
  },
  {
    id: 'false-eye',
    title: 'False Eye',
    level: 'tactics',
    summary: 'An eye that appears genuine but can be destroyed — a critical weakness in group life.',
    body: `A false eye looks like a real eye but has a diagonal defect: the opponent can capture one of the surrounding stones, turning the "eye" into an ordinary liberty rather than a secure enclosed space.

The classic test: if 2 or more diagonals of an enclosed empty point are opponent stones, it is a false eye. On the edge of the board, even one opponent diagonal can make it false.

A group relying on a false eye for life is actually dead — it effectively has only one real eye. Identifying false eyes is essential in life-and-death reading. This concept also underlies the nakade technique (see next card).`,
    source: 'Sensei\'s Library — False Eye; Polgote.com — Eyes and False Eyes; Go Magic educational materials',
    board: {
      grid: [
        ['.','B','B','B','.'],
        ['B','.','B','B','.'],
        ['B','B','W','B','.'],
        ['.','.','B','.','.'],
        ['.','.','.','.','.',],
      ],
      caption: 'The empty cell at (1,1) looks like an eye but White at (2,2) is a diagonal defect — it\'s a false eye.',
      labels: [
        { r: 1, c: 1, text: '?', color: '#f87171' },
        { r: 2, c: 2, text: 'W!', color: '#f87171' },
      ],
    },
  },
  {
    id: 'nakade',
    title: 'Nakade (Eye Stealing)',
    jp: '中手 (Nakade)',
    level: 'tactics',
    summary: 'Play the vital point inside opponent\'s eye space to prevent them forming two eyes.',
    body: `Nakade means playing inside an opponent's potential eye area at the single critical point (the vital point) that prevents the group from forming two separate eyes.

Every enclosed space with a particular shape has one vital point. For a straight three-in-a-row the vital point is the middle cell; for an L-shaped four it's the bend. Playing the vital point kills the group; the opponent defending it keeps it alive.

Nakade problems form the basis of life-and-death puzzles (tsumego). Solving tsumego daily is one of the most effective ways to improve at Go.`,
    source: 'Go Magic (gomagic.org/go-term/nakade); Sensei\'s Library — Nakade; Kiseido: Life and Death series',
    board: {
      grid: [
        ['B','B','B','B','B'],
        ['B','.','.','.','B'],
        ['B','.','.','.','.'],
        ['B','B','B','B','.'],
        ['.','.','.','.','.',],
      ],
      caption: 'White plays the vital point at (1,2) — Black\'s large eye space is reduced to one false eye.',
      labels: [{ r: 1, c: 2, text: '★', color: '#f87171' }],
    },
  },
  {
    id: 'seki',
    title: 'Seki (Mutual Life)',
    jp: '関 (Seki)',
    level: 'tactics',
    summary: 'A stand-off where neither player can capture the other — both groups survive without eyes.',
    body: `Seki (impasse/stalemate) is a position where two opposing groups share liberties in such a way that the player who fills one of those shared liberties would put their own group in atari, allowing capture. Neither player can move safely, so both groups live.

In seki, the shared liberties (dame) are NOT counted as territory for either player under Japanese rules. Under Chinese rules, the stones inside a seki are counted.

Seki most commonly arises in corners and edges where space is tight. Recognising seki prevents players from playing into their own loss by "filling" what appears to be opponent territory.`,
    source: 'Go Magic (gomagic.org/go-term/seki); Sensei\'s Library — Seki; Polgote.com — Seki: Life without Eyes',
    board: {
      grid: [
        ['B','B','W','W','.'],
        ['B','.','.','W','.'],
        ['B','B','W','W','.'],
        ['.','.','.','.','.',],
        ['.','.','.','.','.',],
      ],
      caption: 'Black and White both live in seki — neither can fill the shared liberties at (1,1) or (1,2).',
      labels: [
        { r: 1, c: 1, text: '△', color: '#e8b86d' },
        { r: 1, c: 2, text: '△', color: '#e8b86d' },
      ],
    },
  },

  // ── STRATEGY ─────────────────────────────────────────────────────────────────
  {
    id: 'sente-gote',
    title: 'Sente & Gote',
    jp: '先手 / 後手',
    level: 'strategy',
    summary: 'Sente (initiative) means your move forces a response — Gote means you lose the initiative.',
    body: `Sente (先手, "first hand") is the initiative — a move that creates such an urgent threat the opponent must respond to it. Gote (後手, "second hand") means you responded to an opponent's move, surrendering the initiative.

The player who maintains sente dictates the game's pace. Sente moves are typically worth more than gote moves of the same size because they also preserve the right to play elsewhere next.

A key principle: "big moves before small moves" and "sente over gote." Endgame (yose) involves precisely calculating which sequence of moves maintains sente while claiming the most points. A sente play in the endgame can shift the result by many points.`,
    source: 'Sensei\'s Library — Sente and Gote; British Go Association strategy guide; Kageyama: Lessons in the Fundamentals of Go',
    board: {
      grid: [
        ['.','.','.','.','.','.'],
        ['.','.','B','B','.','.'],
        ['.','.','.','.','B','.'],
        ['.','.','.','.','.','.'],
        ['.','W','W','.','.','.',],
        ['.','.','.','.','.','.'],
      ],
      caption: 'Black\'s move at (2,4) extends the group AND threatens a cut — a sente move. White must respond.',
      labels: [
        { r: 2, c: 4, text: '→', color: '#e8b86d' },
      ],
    },
  },
  {
    id: 'territory-influence',
    title: 'Territory vs. Influence',
    level: 'strategy',
    summary: 'Two contrasting styles: territory (secure bounded areas) vs. influence (radiating control).',
    body: `Territory style focuses on claiming clear, enclosed regions of the board quickly and defending their borders. It is concrete and direct but requires careful management of boundaries.

Influence (or "thickness") style builds strong walls and positions that radiate outward, threatening to surround large central areas. Thickness is hard to invade but must be converted into actual territory to win.

The best players balance both: use influence-style play where the board is open and territorial play to consolidate. A famous principle is "don't make territory with weak groups" — you can't claim area you can't defend.`,
    source: 'American Go Association strategy resources; Sensei\'s Library — Influence; Kageyama: Lessons in the Fundamentals of Go',
    board: {
      grid: [
        ['.','.','.','.','.','.','.'],
        ['.','.','B','.','.','.','.'],
        ['.','.','.','.','.','.','.'],
        ['W','W','.','.','.','.','.',],
        ['W','.','W','.','.','.','.'],
        ['W','W','.','.','.','.','.',],
        ['.','.','.','.','.','.','.'],
      ],
      caption: 'White walls (left) exert influence toward the centre. Black stones (top) claim direct territory.',
    },
  },
  {
    id: 'cutting-connecting',
    title: 'Cutting & Connecting',
    level: 'strategy',
    summary: 'Cut to separate opponent groups; connect to unify your own — foundational to all fighting.',
    body: `"The strength of a position is determined by cutting and connecting." Cutting divides the opponent's stones into separate, weaker groups that must be defended individually. Connecting joins your own groups so they share liberties and are stronger.

A "cut point" (kirakana) is an intersection where, if the opponent plays, they would sever your two groups. Defending your cut points and threatening the opponent's is a constant strategic priority.

The bamboo joint (take no fushi) — two stones diagonally adjacent with the bridging points empty — is nearly unbreakable. The tiger's mouth is a three-stone shape that captures any attempt to cut. Learning these patterns dramatically improves fighting ability.`,
    source: 'Nordic Go Dojo tactical guides; Go Magic (gomagic.org/go-term/tesuji); Sensei\'s Library — Cut; Kiseido: Graded Go Problems',
    board: {
      grid: [
        ['.','.','.','.','.','.'],
        ['.','B','.','B','.','.'],
        ['.','.','*','.','.','.'],
        ['.','B','.','B','.','.'],
        ['.','.','.','.','.','.'],
        ['.','.','.','.','.','.'],
      ],
      caption: 'The cut point (*) between Black\'s groups — if White plays there, Black\'s position is split in two.',
      labels: [{ r: 2, c: 2, text: '✂', color: '#f87171' }],
    },
  },
  {
    id: 'joseki',
    title: 'Joseki',
    jp: '定石 (Joseki)',
    level: 'strategy',
    summary: 'Established corner sequences considered optimal for both players — a balanced local result.',
    body: `Joseki (定石, "fixed stone") are well-researched sequences of play in corner positions that result in a fair outcome for both sides. Thousands of joseki exist, covering every common corner approach and response.

Joseki knowledge is fundamental to strong play. However, choosing the right joseki requires whole-board awareness: a sequence that gives you territory may be wrong if you need influence, or vice versa.

A key principle: "joseki played in the wrong place is a mistake." The real skill is not memorising joseki but understanding the direction of play they create and when to apply them. Modern AI (AlphaGo / Katago) has also discovered entirely new joseki sequences.`,
    source: 'American Go Association — joseki resources; Sensei\'s Library — Joseki; Kiseido: Dictionary of Basic Joseki',
    board: {
      grid: [
        ['.','.','.','.','.'],
        ['.','.','.','.','.'],
        ['.','.','4','2','.',],
        ['.','3','.','.','.',],
        ['.','.','1','.','.'],
      ],
      caption: 'A common corner joseki: Black 1 (komoku/4-3 approach), White 2, Black 3, White 4 — balanced result.',
      labels: [],
    },
    board2: {
      grid: [
        ['.','.','.','.','.'],
        ['.','4','.','.','.'],
        ['.','.','.','.','.',],
        ['.','3','.','2','.',],
        ['.','.','1','.','.'],
      ],
      caption: 'Star point (5-5) joseki: Black 1 to star point, White approaches, sequence continues.',
    },
  },
]

// ─── Level filter tabs ─────────────────────────────────────────────────────────

const LEVELS = [
  { id: 'basics',   label: 'Basics',    emoji: '🟢' },
  { id: 'tactics',  label: 'Tactics',   emoji: '🟡' },
  { id: 'strategy', label: 'Strategy',  emoji: '🔴' },
] as const

type Level = typeof LEVELS[number]['id']

// ─── Tactic card ──────────────────────────────────────────────────────────────

function TacticCard({ tactic }: { tactic: Tactic }) {
  const [expanded, setExpanded] = useState(false)

  const levelColor = tactic.level === 'basics' ? '#4ade80'
    : tactic.level === 'tactics' ? '#facc15' : '#f87171'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      style={{
        background: '#18181a',
        border: '1px solid #2a2a2c',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '16px 20px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}
        className="hover:bg-white/[0.02] transition-colors"
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: levelColor,
              border: `1px solid ${levelColor}40`, borderRadius: 4,
              padding: '1px 5px',
            }}>
              {tactic.level}
            </span>
            {tactic.jp && (
              <span style={{ fontSize: '0.6rem', color: '#555', fontStyle: 'italic' }}>{tactic.jp}</span>
            )}
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>
            {tactic.title}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#777', lineHeight: 1.5 }}>
            {tactic.summary}
          </div>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: '#555', flexShrink: 0, fontSize: '1rem' }}
        >
          ▾
        </motion.span>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 20px 20px', borderTop: '1px solid #252528' }}>
              {/* Board diagrams */}
              <div style={{
                display: 'flex', gap: 16, flexWrap: 'wrap',
                marginTop: 16, marginBottom: 16,
              }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <MiniGoBoard {...tactic.board} />
                  <p style={{ fontSize: '0.62rem', color: '#666', marginTop: 8, lineHeight: 1.5, textAlign: 'center' }}>
                    {tactic.board.caption}
                  </p>
                </div>
                {tactic.board2 && (
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <MiniGoBoard {...tactic.board2} />
                    <p style={{ fontSize: '0.62rem', color: '#666', marginTop: 8, lineHeight: 1.5, textAlign: 'center' }}>
                      {tactic.board2.caption}
                    </p>
                  </div>
                )}
              </div>

              {/* Body text */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tactic.body.split('\n\n').map((para, i) => (
                  <p key={i} style={{ fontSize: '0.72rem', color: '#aaa', lineHeight: 1.65, margin: 0 }}>
                    {para}
                  </p>
                ))}
              </div>

              {/* Source citation */}
              <div style={{
                marginTop: 16, paddingTop: 12,
                borderTop: '1px solid #252528',
                fontSize: '0.58rem', color: '#444', lineHeight: 1.5,
              }}>
                📚 Sources: {tactic.source}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function GoLearnPage() {
  const [activeLevel, setActiveLevel] = useState<Level | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return TACTICS.filter(t => {
      if (activeLevel !== 'all' && t.level !== activeLevel) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          (t.jp?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [activeLevel, search])

  return (
    <div style={{
      background: '#0f0f10', color: '#fff',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      minHeight: '100dvh',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: '#0f0f10ee',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #2a2a2c',
        padding: '0 16px',
        paddingTop: 'max(8px, env(safe-area-inset-top))',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/go"
            style={{
              width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, color: '#818384', textDecoration: 'none', flexShrink: 0,
            }}
            className="hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Back to Go game"
          >
            <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </Link>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#e8b86d', margin: 0 }}>
              Go — Learn & Study
            </h1>
            <p style={{ fontSize: '0.58rem', color: '#555', margin: 0, letterSpacing: '0.08em' }}>
              {TACTICS.length} concepts · sourced from AGA, Sensei's Library & Go Magic
            </p>
          </div>

          <Link
            href="/"
            style={{ fontSize: '0.6rem', color: '#555', textDecoration: 'none', flexShrink: 0, letterSpacing: '0.08em' }}
            className="hover:text-white transition-colors"
          >
            ← Hub
          </Link>
        </div>

        {/* Search + filters */}
        <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search concepts..."
            style={{
              flex: 1, minWidth: 160, height: 36,
              background: '#1a1a1c', border: '1px solid #2a2a2c', borderRadius: 8,
              color: '#e8e8e8', fontSize: '0.72rem', padding: '0 12px',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {([{ id: 'all', label: 'All', emoji: '⬡' }, ...LEVELS] as const).map(lv => (
              <button
                key={lv.id}
                onClick={() => setActiveLevel(lv.id as Level | 'all')}
                style={{
                  height: 36, padding: '0 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${activeLevel === lv.id ? '#e8b86d' : '#2a2a2c'}`,
                  background: activeLevel === lv.id ? '#e8b86d18' : 'transparent',
                  color: activeLevel === lv.id ? '#e8b86d' : '#555',
                  fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {lv.emoji} {lv.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}>

        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: '#18181a', border: '1px solid #e8b86d30',
            borderRadius: 16, padding: '20px', marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '2rem', flexShrink: 0 }}>⚫</span>
            <div>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#e8b86d', margin: '0 0 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                About This Guide
              </h2>
              <p style={{ fontSize: '0.7rem', color: '#888', margin: 0, lineHeight: 1.7 }}>
                All content is validated from authoritative Go sources: the <strong style={{ color: '#bbb' }}>American Go Association</strong>, <strong style={{ color: '#bbb' }}>Sensei's Library</strong> (the community-maintained Go wiki), <strong style={{ color: '#bbb' }}>Go Magic</strong>, and classic texts by <strong style={{ color: '#bbb' }}>Kiseido Publications</strong>. Click any card to expand the full explanation with a board diagram.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {LEVELS.map(lv => {
            const count = TACTICS.filter(t => t.level === lv.id).length
            const isActive = activeLevel === lv.id
            return (
              <button
                key={lv.id}
                onClick={() => setActiveLevel(isActive ? 'all' : lv.id)}
                style={{
                  flex: 1, minWidth: 100, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${isActive ? '#e8b86d40' : '#2a2a2c'}`,
                  background: isActive ? '#e8b86d08' : '#18181a',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{lv.emoji}</div>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888' }}>{lv.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#e8e8e8', marginTop: 2 }}>{count}</div>
              </button>
            )
          })}
        </div>

        {/* Tactic list */}
        <AnimatePresence>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ textAlign: 'center', color: '#555', fontSize: '0.75rem', padding: '40px 0' }}
              >
                No results for "{search}"
              </motion.div>
            ) : (
              filtered.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <TacticCard tactic={t} />
                </motion.div>
              ))
            )}
          </div>
        </AnimatePresence>

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <p style={{ fontSize: '0.6rem', color: '#333', lineHeight: 1.8 }}>
            Content validated from: American Go Association (usgo.org) · Sensei's Library (senseis.xmp.net)<br />
            Go Magic (gomagic.org) · British Go Association (britgo.org) · Kiseido Publications<br />
            <span style={{ color: '#252528' }}>v1.0 · Created by Rahul Chouhan</span>
          </p>
        </div>
      </main>
    </div>
  )
}
