'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'

// ─── Visual constants ─────────────────────────────────────────────────────────

const CELL          = 72    // SVG coordinate space: px between adjacent dots
const PAD           = 40    // padding around the grid
const DOT_R         = 6     // dot radius
const HIT           = 22    // invisible hit-area half-width on each side of a line
const AUTO_CLAIM_MS = 420   // delay (ms) between each automatic chain-capture step

// ─── Player palette ───────────────────────────────────────────────────────────

const PLAYERS = {
  1: { color: '#538d4e', bg: '#538d4e38', glow: '#538d4e55', label: 'P1', name: 'Player 1' },
  2: { color: '#c77dff', bg: '#c77dff38', glow: '#c77dff55', label: 'P2', name: 'Player 2' },
} as const

// Amber tint shown on 3-sided "danger" boxes
const DANGER_BG     = '#b59f3b14'
const DANGER_STROKE = '#b59f3b50'

// ─── Types ────────────────────────────────────────────────────────────────────

type Owner  = 0 | 1 | 2   // 0 = unowned / undrawn
type Player = 1 | 2

/**
 * Full deterministic board state. Never mutated — replaced on each move.
 *
 * Box at (br, bc) has edges:
 *   top    = H[br][bc]
 *   bottom = H[br+1][bc]
 *   left   = V[br][bc]
 *   right  = V[br][bc+1]
 */
interface GameState {
  N: number           // dots per side  (N=5 → 4×4 grid → 16 boxes)
  H: Owner[][]        // horizontal edges  H[row 0..N-1][col 0..N-2]
  V: Owner[][]        // vertical edges    V[row 0..N-2][col 0..N-1]
  B: Owner[][]        // box owners        B[row 0..N-2][col 0..N-2]
  turn: Player
  scores: [number, number]
  done: boolean
  winner: Player | null   // null on tie
  extraTurn: boolean      // current player claimed ≥1 box → stays their turn
  lastGained: number      // boxes claimed on the most-recent move (for +N badge)
  newBoxes: string[]      // ordered keys of boxes claimed this move, e.g. "2-1"
}

// ─── Board helpers ────────────────────────────────────────────────────────────

/** How many of the 4 edges of box (br, bc) are currently drawn? */
function edgeCount(H: Owner[][], V: Owner[][], br: number, bc: number): number {
  return (H[br    ][bc    ] !== 0 ? 1 : 0)   // top
       + (H[br + 1][bc    ] !== 0 ? 1 : 0)   // bottom
       + (V[br    ][bc    ] !== 0 ? 1 : 0)   // left
       + (V[br    ][bc + 1] !== 0 ? 1 : 0)   // right
}

/**
 * Scan the board for any unowned box that has exactly 3 edges drawn.
 * Returns the coordinates of the one missing edge — drawing it completes the box.
 * Returns null when no such box exists (no auto-claim possible).
 */
function findClaimableBox(
  N: number, H: Owner[][], V: Owner[][], B: Owner[][]
): { isH: boolean; r: number; c: number } | null {
  for (let br = 0; br < N - 1; br++) {
    for (let bc = 0; bc < N - 1; bc++) {
      if (B[br][bc] !== 0) continue
      if (edgeCount(H, V, br, bc) !== 3) continue
      // Identify the one undrawn edge
      if (H[br    ][bc    ] === 0) return { isH: true,  r: br,     c: bc     }
      if (H[br + 1][bc    ] === 0) return { isH: true,  r: br + 1, c: bc     }
      if (V[br    ][bc    ] === 0) return { isH: false, r: br,     c: bc     }
      if (V[br    ][bc + 1] === 0) return { isH: false, r: br,     c: bc + 1 }
    }
  }
  return null
}

function createGame(N: number): GameState {
  return {
    N,
    H: Array.from({ length: N },     () => Array<Owner>(N - 1).fill(0)),
    V: Array.from({ length: N - 1 }, () => Array<Owner>(N).fill(0)),
    B: Array.from({ length: N - 1 }, () => Array<Owner>(N - 1).fill(0)),
    turn:       1,
    scores:     [0, 0],
    done:       false,
    winner:     null,
    extraTurn:  false,
    lastGained: 0,
    newBoxes:   [],
  }
}

/**
 * Pure reducer — place one line and return the next game state.
 *
 * Chain-capture rule (canonical Dots and Boxes):
 *   • If placing a line closes ≥1 box the player keeps their turn and may
 *     continue claiming chained boxes on the very next move — with no cap.
 *   • Turn only switches when a move produces zero completed boxes.
 *   • A single line can simultaneously close 2 adjacent boxes (scored together).
 *
 * Logic is resolved entirely here; UI animations only reflect final state.
 */
function placeLine(prev: GameState, isH: boolean, r: number, c: number): GameState {
  // Idempotent guard — already drawn lines are silently ignored
  if (isH  && prev.H[r][c] !== 0) return prev
  if (!isH && prev.V[r][c] !== 0) return prev

  // Deep-clone all mutable arrays (keeps prev immutable)
  const s: GameState = {
    ...prev,
    H:          prev.H.map(row => [...row] as Owner[]),
    V:          prev.V.map(row => [...row] as Owner[]),
    B:          prev.B.map(row => [...row] as Owner[]),
    scores:     [...prev.scores] as [number, number],
    extraTurn:  false,
    lastGained: 0,
    newBoxes:   [],   // reset every move; repopulated below in claim order
  }

  const p = s.turn
  if (isH) s.H[r][c] = p
  else     s.V[r][c] = p

  // The (up to) 2 boxes that share this edge
  const adjacent: [number, number][] = isH
    ? [[r - 1, c], [r, c]]    // horizontal line → box above + box below
    : [[r, c - 1], [r, c]]    // vertical line   → box left  + box right

  let gained = 0
  for (const [br, bc] of adjacent) {
    // Skip out-of-bounds and already-owned boxes
    if (br < 0 || bc < 0 || br >= s.N - 1 || bc >= s.N - 1) continue
    if (s.B[br][bc] !== 0) continue

    // Box is complete when all 4 edges are drawn (edgeCount uses updated s.H/V)
    if (edgeCount(s.H, s.V, br, bc) === 4) {
      s.B[br][bc]       = p
      s.scores[p - 1]++
      gained++
      s.newBoxes.push(`${br}-${bc}`)   // record claim order for stagger animation
    }
  }

  s.lastGained = gained

  // ── Game-over check ───────────────────────────────────────────────────────
  const totalBoxes = (s.N - 1) * (s.N - 1)
  if (s.scores[0] + s.scores[1] >= totalBoxes) {
    s.done   = true
    s.winner = s.scores[0] > s.scores[1] ? 1
             : s.scores[1] > s.scores[0] ? 2
             : null
    return s
  }

  // ── Chain-capture / turn-switch ───────────────────────────────────────────
  // Claiming ≥1 box grants an extra turn (unlimited chain captures supported).
  // Only switch when the move was "safe" (zero boxes completed).
  if (gained > 0) {
    s.extraTurn = true
  } else {
    s.turn = p === 1 ? 2 : 1
  }

  return s
}

// ─── SVG coordinate helpers ───────────────────────────────────────────────────

const dotX = (c: number) => PAD + c * CELL
const dotY = (r: number) => PAD + r * CELL

// ─── Component ────────────────────────────────────────────────────────────────

export function BoxleGame() {
  const [dotCount, setDotCount] = useState(5)
  const [game, setGame]         = useState<GameState>(() => createGame(5))
  const [hovered, setHovered]   = useState<string | null>(null)

  // True while the engine is automatically cascading through a chain.
  // Blocks all manual input during the sequence.
  const [autoChaining, setAutoChaining] = useState(false)

  // Touch debounce — prevents ghost clicks / accidental double-taps on mobile
  const lastActionAt = useRef(0)
  // Holds the pending auto-claim setTimeout so we can cancel it on reset
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auto-chain engine ────────────────────────────────────────────────────
  // Runs after every state change. When the current player just scored
  // (extraTurn === true) and a 3-sided box exists anywhere on the board,
  // schedule an automatic line-draw after AUTO_CLAIM_MS to complete it.
  // The effect re-fires on every completion, chaining indefinitely until
  // no more 3-sided boxes remain.
  useEffect(() => {
    if (autoRef.current) {
      clearTimeout(autoRef.current)
      autoRef.current = null
    }

    if (!game.extraTurn || game.done) {
      setAutoChaining(false)
      return
    }

    // Re-evaluate on the live state in case board changed since render
    const next = findClaimableBox(game.N, game.H, game.V, game.B)
    if (!next) {
      setAutoChaining(false)
      return
    }

    // A chain is in progress — lock input and schedule the next capture
    setAutoChaining(true)
    autoRef.current = setTimeout(() => {
      setGame(prev => {
        // Safety: abort if state changed (reset mid-chain, etc.)
        if (!prev.extraTurn || prev.done) return prev
        const claimable = findClaimableBox(prev.N, prev.H, prev.V, prev.B)
        if (!claimable) return prev
        return placeLine(prev, claimable.isH, claimable.r, claimable.c)
      })
    }, AUTO_CLAIM_MS)

    return () => {
      if (autoRef.current) clearTimeout(autoRef.current)
    }
  }, [game.extraTurn, game.scores[0], game.scores[1], game.done]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleLine = useCallback((isH: boolean, r: number, c: number) => {
    if (autoChaining) return                       // chain in progress — ignore clicks
    const now = performance.now()
    if (now - lastActionAt.current < 180) return   // drop duplicate taps
    lastActionAt.current = now
    setGame(prev => placeLine(prev, isH, r, c))
  }, [autoChaining])

  const reset = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current)
    setAutoChaining(false)
    setGame(createGame(dotCount))
    setHovered(null)
    lastActionAt.current = 0
  }, [dotCount])

  const changeSize = useCallback((n: number) => {
    if (autoRef.current) clearTimeout(autoRef.current)
    setAutoChaining(false)
    setDotCount(n)
    setGame(createGame(n))
    setHovered(null)
    lastActionAt.current = 0
  }, [])

  // ── Derived values ────────────────────────────────────────────────────────

  const { N, H, V, B, turn, scores, done, winner, extraTurn, lastGained } = game
  const svgSize    = 2 * PAD + (N - 1) * CELL
  const totalBoxes = (N - 1) * (N - 1)
  const remaining  = totalBoxes - scores[0] - scores[1]
  const curPlayer  = PLAYERS[turn]
  const fontSize   = Math.max(10, Math.round(CELL * 0.26))   // scales with grid size
  const isLocked   = autoChaining                             // combined input lock

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#0f0f10',
      color: '#fff',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overscrollBehavior: 'none',
      WebkitTapHighlightColor: 'transparent',
      userSelect: 'none',
    }}>

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header style={{
        width: '100%', maxWidth: 520, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #3a3a3c',
      }}>
        <Link
          href="/"
          aria-label="Back to Arcade"
          style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, color: '#818384', textDecoration: 'none',
          }}
          className="hover:text-white hover:bg-[#1a1a1c] transition-colors"
        >
          <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </Link>

        <h1 style={{
          fontSize: 'clamp(1.1rem, 5vw, 1.5rem)', fontWeight: 800,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          background: 'linear-gradient(135deg, #fff 30%, #818384 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Boxle
        </h1>

        {/* Grid-size picker */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([4, 5, 6] as const).map(n => (
            <button
              key={n}
              onClick={() => changeSize(n)}
              style={{
                width: 36, height: 28, borderRadius: 6, cursor: 'pointer',
                border:      `1px solid ${dotCount === n ? '#538d4e' : '#3a3a3c'}`,
                background:  dotCount === n ? '#538d4e22' : 'transparent',
                color:       dotCount === n ? '#538d4e'   : '#555',
                fontSize: '0.6rem', fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              {n - 1}×{n - 1}
            </button>
          ))}
        </div>
      </header>

      {/* ══ SCORE BAR ════════════════════════════════════════════════════════ */}
      <div style={{
        width: '100%', maxWidth: 520, flexShrink: 0,
        display: 'grid', gridTemplateColumns: '1fr 72px 1fr',
        borderBottom: '1px solid #3a3a3c',
      }}>

        {/* Player 1 */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '10px 0',
          background: turn === 1 && !done ? `${PLAYERS[1].color}0e` : 'transparent',
          borderRight: '1px solid #3a3a3c',
          transition: 'background 0.4s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <AnimatePresence>
              {turn === 1 && !done && (
                <motion.span
                  key="p1-dot"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  style={{ display: 'block', width: 5, height: 5, borderRadius: '50%', background: PLAYERS[1].color, flexShrink: 0 }}
                />
              )}
            </AnimatePresence>
            <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: PLAYERS[1].color }}>
              {PLAYERS[1].name}
            </span>
          </div>
          <motion.span
            key={scores[0]}
            initial={{ scale: 1.5, color: PLAYERS[1].color }}
            animate={{ scale: 1,   color: '#ffffff' }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, display: 'block' }}
          >
            {scores[0]}
          </motion.span>
          <span style={{ fontSize: '0.52rem', color: '#3a3a3c', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            boxes
          </span>
        </div>

        {/* Centre: remaining count */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2,
        }}>
          <span style={{ fontSize: '0.48rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3a3a3c' }}>
            left
          </span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#555' }}>
            {remaining}
          </span>
          <span style={{ fontSize: '0.44rem', color: '#2a2a2c', textTransform: 'uppercase' }}>
            of {totalBoxes}
          </span>
        </div>

        {/* Player 2 */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '10px 0',
          background: turn === 2 && !done ? `${PLAYERS[2].color}0e` : 'transparent',
          borderLeft: '1px solid #3a3a3c',
          transition: 'background 0.4s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <AnimatePresence>
              {turn === 2 && !done && (
                <motion.span
                  key="p2-dot"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  style={{ display: 'block', width: 5, height: 5, borderRadius: '50%', background: PLAYERS[2].color, flexShrink: 0 }}
                />
              )}
            </AnimatePresence>
            <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: PLAYERS[2].color }}>
              {PLAYERS[2].name}
            </span>
          </div>
          <motion.span
            key={scores[1]}
            initial={{ scale: 1.5, color: PLAYERS[2].color }}
            animate={{ scale: 1,   color: '#ffffff' }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, display: 'block' }}
          >
            {scores[1]}
          </motion.span>
          <span style={{ fontSize: '0.52rem', color: '#3a3a3c', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            boxes
          </span>
        </div>
      </div>

      {/* ══ TURN HINT / CHAIN BADGE ══════════════════════════════════════════ */}
      <div style={{
        height: 38, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AnimatePresence mode="wait">
          {!done && (
            <motion.div
              key={`hint-${turn}-${autoChaining}-${lastGained}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.16 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {autoChaining ? (
                /* ── Chain-capture running ── */
                <>
                  <motion.span
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ fontSize: '0.85rem' }}
                  >
                    ⛓️
                  </motion.span>
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
                    style={{ fontSize: '0.71rem', fontWeight: 700, color: curPlayer.color }}
                  >
                    {curPlayer.name} chain capturing…
                  </motion.span>
                  <motion.span
                    initial={{ scale: 0, rotate: -12 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 320 }}
                    style={{
                      background: curPlayer.color,
                      color: '#fff',
                      fontSize: '0.62rem', fontWeight: 900,
                      padding: '2px 7px', borderRadius: 999,
                    }}
                  >
                    +{scores[turn - 1]}
                  </motion.span>
                </>
              ) : extraTurn && lastGained > 0 ? (
                /* ── Just scored, no more chain ── */
                <>
                  <motion.span
                    initial={{ scale: 0, rotate: -12 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 320 }}
                    style={{
                      background: curPlayer.color,
                      color: '#fff',
                      fontSize: '0.62rem', fontWeight: 900,
                      padding: '2px 7px', borderRadius: 999,
                    }}
                  >
                    +{lastGained}
                  </motion.span>
                  <span style={{ fontSize: '0.71rem', fontWeight: 600, color: curPlayer.color }}>
                    {curPlayer.name} plays again!
                  </span>
                </>
              ) : (
                /* ── Normal turn ── */
                <span style={{ fontSize: '0.71rem', color: '#444' }}>
                  {curPlayer.name}&rsquo;s turn — click a line
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ BOARD ════════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', padding: '0 10px 10px',
      }}>
        <svg
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          style={{
            width: '100%',
            maxWidth: svgSize,
            maxHeight: 'calc(100dvh - 220px)',  // never overflow the viewport
            height: 'auto',
            display: 'block',
            touchAction: 'manipulation',
            overflow: 'visible',
          }}
        >

          {/* ── Danger boxes (3 sides drawn — about to be claimed) ── */}
          {B.map((row, br) => row.map((owner, bc) => {
            if (owner !== 0) return null
            const ec = edgeCount(H, V, br, bc)
            if (ec !== 3) return null
            const cx = dotX(bc) + CELL / 2
            const cy = dotY(br) + CELL / 2
            return (
              <rect
                key={`danger-${br}-${bc}`}
                x={dotX(bc) + 4} y={dotY(br) + 4}
                width={CELL - 8} height={CELL - 8}
                rx={7}
                fill={DANGER_BG}
                stroke={DANGER_STROKE}
                strokeWidth={1}
                style={{ pointerEvents: 'none' }}
              />
            )
          }))}

          {/* ── Claimed boxes: staggered fill + player label ── */}
          {B.map((row, br) => row.map((owner, bc) => {
            if (owner === 0) return null
            const p      = owner as Player
            const cx     = dotX(bc) + CELL / 2
            const cy     = dotY(br) + CELL / 2
            const boxKey = `${br}-${bc}`

            // newBoxes holds the ordered list of boxes claimed THIS move.
            // Index determines stagger delay; -1 means already on board.
            const newIdx = game.newBoxes.indexOf(boxKey)
            const isNew  = newIdx !== -1
            const staggerDelay = newIdx * 0.16   // 160 ms between each box

            return (
              <g key={`owned-${br}-${bc}`}>
                {/* Glow ring — only for newly claimed boxes, fades after appearing */}
                {isNew && (
                  <motion.rect
                    initial={{ opacity: 0.9, scale: 1.18 }}
                    animate={{ opacity: 0,   scale: 1.35 }}
                    transition={{ delay: staggerDelay + 0.12, duration: 0.45, ease: 'easeOut' }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                    x={dotX(bc) + 3} y={dotY(br) + 3}
                    width={CELL - 6} height={CELL - 6}
                    rx={10}
                    fill="none"
                    stroke={PLAYERS[p].color}
                    strokeWidth={3}
                  />
                )}

                {/* Filled background — spring-pops in, staggered for new boxes */}
                <motion.rect
                  // initial={false} = no re-animation for already-on-board boxes
                  initial={isNew ? { opacity: 0, scale: 0.25 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={isNew
                    ? { type: 'spring', damping: 10, stiffness: 200, delay: staggerDelay }
                    : { duration: 0 }
                  }
                  style={{ transformOrigin: `${cx}px ${cy}px` }}
                  x={dotX(bc) + 3} y={dotY(br) + 3}
                  width={CELL - 6} height={CELL - 6}
                  rx={8}
                  fill={PLAYERS[p].bg}
                />

                {/* Player label — fades in after its box appears */}
                <motion.text
                  initial={isNew ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={isNew
                    ? { delay: staggerDelay + 0.12, duration: 0.22 }
                    : { duration: 0 }
                  }
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={PLAYERS[p].color}
                  fontSize={fontSize}
                  fontWeight={800}
                  fontFamily="'Segoe UI', system-ui, sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {PLAYERS[p].label}
                </motion.text>
              </g>
            )
          }))}

          {/* ── Horizontal lines + hit areas ── */}
          {H.map((row, r) => row.map((owner, c) => {
            const key = `h-${r}-${c}`
            const hov = hovered === key && !done && owner === 0 && !isLocked
            return (
              <g key={key}>
                <line
                  x1={dotX(c)} y1={dotY(r)}
                  x2={dotX(c + 1)} y2={dotY(r)}
                  stroke={
                    owner === 1 ? PLAYERS[1].color :
                    owner === 2 ? PLAYERS[2].color :
                    hov          ? `${curPlayer.color}cc` : '#222224'
                  }
                  strokeWidth={owner !== 0 ? 5 : hov ? 4 : 2}
                  strokeLinecap="round"
                  style={{ transition: 'stroke 0.1s, stroke-width 0.1s', pointerEvents: 'none' }}
                />
                {owner === 0 && !done && (
                  <rect
                    x={dotX(c)}  y={dotY(r) - HIT}
                    width={CELL} height={HIT * 2}
                    fill="transparent"
                    style={{ cursor: isLocked ? 'default' : 'pointer' }}
                    onMouseEnter={() => !isLocked && setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleLine(true, r, c)}
                  />
                )}
              </g>
            )
          }))}

          {/* ── Vertical lines + hit areas ── */}
          {V.map((row, r) => row.map((owner, c) => {
            const key = `v-${r}-${c}`
            const hov = hovered === key && !done && owner === 0 && !isLocked
            return (
              <g key={key}>
                <line
                  x1={dotX(c)} y1={dotY(r)}
                  x2={dotX(c)} y2={dotY(r + 1)}
                  stroke={
                    owner === 1 ? PLAYERS[1].color :
                    owner === 2 ? PLAYERS[2].color :
                    hov          ? `${curPlayer.color}cc` : '#222224'
                  }
                  strokeWidth={owner !== 0 ? 5 : hov ? 4 : 2}
                  strokeLinecap="round"
                  style={{ transition: 'stroke 0.1s, stroke-width 0.1s', pointerEvents: 'none' }}
                />
                {owner === 0 && !done && (
                  <rect
                    x={dotX(c) - HIT} y={dotY(r)}
                    width={HIT * 2}   height={CELL}
                    fill="transparent"
                    style={{ cursor: isLocked ? 'default' : 'pointer' }}
                    onMouseEnter={() => !isLocked && setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleLine(false, r, c)}
                  />
                )}
              </g>
            )
          }))}

          {/* ── Dots — always topmost so lines don't visually bleed over them ── */}
          {Array.from({ length: N }, (_, r) =>
            Array.from({ length: N }, (_, c) => (
              <circle
                key={`d-${r}-${c}`}
                cx={dotX(c)} cy={dotY(r)} r={DOT_R}
                fill="#6b7280"
                style={{ pointerEvents: 'none' }}
              />
            ))
          )}
        </svg>
      </div>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <div style={{
        width: '100%', maxWidth: 520, flexShrink: 0,
        padding: '10px 16px',
        borderTop: '1px solid #3a3a3c',
        display: 'flex', justifyContent: 'center',
      }}>
        <button
          onClick={reset}
          style={{
            padding: '8px 28px', borderRadius: 9999,
            border: '1px solid #3a3a3c', background: 'transparent',
            color: '#555', fontSize: '0.72rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
          }}
          className="hover:border-white/30 hover:text-white transition-colors"
        >
          New Game
        </button>
      </div>

      {/* ══ GAME-OVER OVERLAY ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.82)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 50,
              backdropFilter: 'blur(10px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 36 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 260 }}
              style={{
                background: '#18181a',
                border: `1px solid ${winner ? PLAYERS[winner].color + '50' : '#3a3a3c'}`,
                borderRadius: 24, padding: '40px 48px',
                textAlign: 'center', minWidth: 290,
                boxShadow: winner
                  ? `0 0 80px ${PLAYERS[winner].glow}, 0 24px 48px rgba(0,0,0,0.5)`
                  : '0 24px 48px rgba(0,0,0,0.5)',
              }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', damping: 12, stiffness: 280 }}
                style={{ fontSize: '3.5rem', marginBottom: 10 }}
              >
                {winner ? '🏆' : '🤝'}
              </motion.div>

              <div style={{
                fontSize: '1.65rem', fontWeight: 800,
                color: winner ? PLAYERS[winner].color : '#818384',
                letterSpacing: '0.04em', marginBottom: 6,
              }}>
                {winner ? `${PLAYERS[winner].name} Wins!` : "It's a Tie!"}
              </div>

              {/* Score breakdown */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '20px 0 28px' }}>
                {([1, 2] as Player[]).map(pid => (
                  <div
                    key={pid}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 4,
                      padding: '12px 18px', borderRadius: 14,
                      border: `1px solid ${winner === pid ? PLAYERS[pid].color + '70' : '#252527'}`,
                      background: winner === pid ? `${PLAYERS[pid].color}12` : '#141416',
                    }}
                  >
                    <span style={{
                      fontSize: '0.58rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.12em',
                      color: PLAYERS[pid].color,
                    }}>
                      {PLAYERS[pid].name}
                    </span>
                    <span style={{
                      fontSize: '1.9rem', fontWeight: 800,
                      color: winner === pid ? PLAYERS[pid].color : '#fff',
                    }}>
                      {scores[pid - 1]}
                    </span>
                    <span style={{ fontSize: '0.5rem', color: '#3a3a3c', textTransform: 'uppercase' }}>
                      boxes
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={reset}
                style={{
                  padding: '13px 40px', borderRadius: 9999, border: 'none',
                  background: winner ? PLAYERS[winner].color : '#538d4e',
                  color: '#fff', fontSize: '0.82rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  cursor: 'pointer',
                  boxShadow: winner ? `0 6px 24px ${PLAYERS[winner].glow}` : undefined,
                }}
                className="hover:opacity-90 active:scale-95 transition-all"
              >
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
