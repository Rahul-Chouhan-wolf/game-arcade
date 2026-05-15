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

// ─── Engine (pure logic lives in lib/boxle/engine.ts) ────────────────────────

import type { Owner, Player, GameState } from '@/lib/boxle/engine'
import { edgeCount, findClaimableBox, createGame, placeLine } from '@/lib/boxle/engine'

// ─── SVG coordinate helpers ───────────────────────────────────────────────────

const dotX = (c: number) => PAD + c * CELL
const dotY = (r: number) => PAD + r * CELL

// ─── How to Play modal ────────────────────────────────────────────────────────

function BoxleHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rules = [
    { icon: '✏️', title: 'Draw Lines', body: 'Players take turns clicking any undrawn edge between two adjacent dots to claim it.' },
    { icon: '📦', title: 'Complete Boxes', body: 'If your line closes a box (completes the 4th side), you score that box and automatically claim any other completable boxes in the chain.' },
    { icon: '🔁', title: 'Bonus Turn', body: 'After scoring, the chain continues until no more boxes can be completed — giving one player a potentially large streak.' },
    { icon: '⚠️', title: 'Danger Boxes', body: 'Amber-tinted boxes have 3 sides drawn already. Avoid drawing the 3rd side of a box — it gifts a point to your opponent!' },
    { icon: '🏆', title: 'Win Condition', body: 'The player with the most boxes when the board is full wins. Ties are possible.' },
  ]
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.88, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#18181a',
              border: '1px solid #3a3a3c',
              borderRadius: 20,
              padding: '24px 24px 20px',
              width: 'min(360px, calc(100vw - 32px))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#538d4e' }}>
                How to Play Boxle
              </h2>
              <button
                onClick={onClose}
                style={{ color: '#555', fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                className="hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rules.map(r => (
                <div key={r.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e8e8e8', marginBottom: 2, letterSpacing: '0.05em' }}>{r.title}</div>
                    <div style={{ fontSize: '0.65rem', color: '#888', lineHeight: 1.5 }}>{r.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoxleGame() {
  const [dotCount, setDotCount] = useState(5)
  const [game, setGame]         = useState<GameState>(() => createGame(5))
  const [hovered, setHovered]   = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

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

        {/* Grid-size picker + help */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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
          <button
            onClick={() => setShowHelp(true)}
            aria-label="How to Play"
            style={{
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              border: '1px solid #3a3a3c', background: 'transparent',
              color: '#555', fontSize: '0.7rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            className="hover:border-white/30 hover:text-white transition-colors"
          >
            ?
          </button>
        </div>
      </header>

      <BoxleHelpModal open={showHelp} onClose={() => setShowHelp(false)} />

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
                  {curPlayer.name}&rsquo;s turn — tap a line
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
            maxHeight: 'calc(100dvh - 220px - env(safe-area-inset-bottom, 0px))',
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
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
        borderTop: '1px solid #3a3a3c',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
        <div style={{ fontSize: '0.44rem', color: '#666680', letterSpacing: '0.08em', textAlign: 'right' }}>
          v1.0 · Rahul Chouhan
        </div>
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
                borderRadius: 24,
                padding: 'clamp(24px, 6vw, 40px) clamp(20px, 6vw, 48px)',
                textAlign: 'center',
                width: 'min(340px, calc(100vw - 32px))',
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
