'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import {
  createGame, placeStone, passTurn, resign, getStarPoints,
  type GameState, type Cell, type Player,
} from '@/lib/go/engine'
import { computeAIMove, type Difficulty } from '@/lib/go/ai'

// ─── Visual constants ──────────────────────────────────────────────────────────

// SVG coordinate space — CSS scales this to fit the viewport
const BOARD_CONFIG = {
   9: { cell: 58, pad: 42 },
  13: { cell: 50, pad: 36 },
  19: { cell: 42, pad: 30 },
} as const

const STONE_RATIO  = 0.46   // stone radius as fraction of cell
const HIT_RATIO    = 0.50   // click-target radius as fraction of cell
const TOUCH_DEBOUNCE_MS = 180

// ─── Player palette ────────────────────────────────────────────────────────────

const PLAYERS = {
  1: { color: '#d4d4d4', glow: '#d4d4d440', label: 'Black', short: '●', gradId: 'black-grad' },
  2: { color: '#6b7280', glow: '#e8b86d40', label: 'White', short: '○', gradId: 'white-grad' },
} as const

// ─── Sound hook ────────────────────────────────────────────────────────────────

function useSounds() {
  const ctxRef = useRef<AudioContext | null>(null)

  const ctx = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const playStone = useCallback(() => {
    try {
      const c = ctx(); if (!c) return
      const now = c.currentTime
      // Woody click: shaped noise burst
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.07), c.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.12))
      }
      const src = c.createBufferSource()
      src.buffer = buf
      const gain = c.createGain()
      gain.gain.setValueAtTime(0.28, now)
      src.connect(gain); gain.connect(c.destination)
      src.start(now)
    } catch { /* ignore on restricted environments */ }
  }, [ctx])

  const playCapture = useCallback(() => {
    try {
      const c = ctx(); if (!c) return
      const now = c.currentTime
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(280, now)
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.09)
      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc.connect(gain); gain.connect(c.destination)
      osc.start(now); osc.stop(now + 0.1)
    } catch { /* ignore */ }
  }, [ctx])

  const playPass = useCallback(() => {
    try {
      const c = ctx(); if (!c) return
      const now = c.currentTime
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(520, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc.connect(gain); gain.connect(c.destination)
      osc.start(now); osc.stop(now + 0.22)
    } catch { /* ignore */ }
  }, [ctx])

  const playEnd = useCallback(() => {
    try {
      const c = ctx(); if (!c) return
      const now = c.currentTime
      ;[440, 554, 659].forEach((freq, i) => {
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + i * 0.14)
        gain.gain.setValueAtTime(0.1, now + i * 0.14)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.25)
        osc.connect(gain); gain.connect(c.destination)
        osc.start(now + i * 0.14); osc.stop(now + i * 0.14 + 0.25)
      })
    } catch { /* ignore */ }
  }, [ctx])

  return { playStone, playCapture, playPass, playEnd }
}

// ─── Setup modal ───────────────────────────────────────────────────────────────

type GameMode = 'pvp' | 'cpu'

interface SetupModalProps {
  open:    boolean
  names:   [string, string]
  size:    number
  komi:    number
  mode:    GameMode
  cpuColor: Player
  difficulty: Difficulty
  onStart: (
    names: [string, string],
    size: number,
    komi: number,
    mode: GameMode,
    cpuColor: Player,
    difficulty: Difficulty,
  ) => void
}

const DIFF_META: Record<Difficulty, { label: string; color: string; hint: string }> = {
  easy:   { label: 'Easy',   color: '#538d4e', hint: 'Good for beginners' },
  medium: { label: 'Medium', color: '#b59f3b', hint: 'Tactical & fun' },
  hard:   { label: 'Hard',   color: '#c84b4b', hint: 'Deep strategy' },
}

function SetupModal({
  open,
  names: initNames, size: initSize, komi: initKomi,
  mode: initMode, cpuColor: initCpuColor, difficulty: initDiff,
  onStart,
}: SetupModalProps) {
  const [names,      setNames]      = useState<[string, string]>(initNames)
  const [size,       setSize]       = useState(initSize)
  const [komi,       setKomi]       = useState(initKomi)
  const [mode,       setMode]       = useState<GameMode>(initMode)
  const [cpuColor,   setCpuColor]   = useState<Player>(initCpuColor)
  const [difficulty, setDifficulty] = useState<Difficulty>(initDiff)

  if (!open) return null

  const humanColor: Player = cpuColor === 1 ? 2 : 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ backdropFilter: 'blur(8px)', overflowY: 'auto' }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 280 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#18181a] p-6 shadow-2xl my-4"
      >
        <div className="mb-5 text-center">
          <div className="text-3xl mb-1">⚫⚪</div>
          <h2 className="text-xl font-extrabold tracking-widest text-white uppercase">Go</h2>
          <p className="text-xs text-white/30 mt-1 tracking-wide">Ancient strategy — modern arena</p>
        </div>

        {/* Game mode */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Game mode</p>
          <div className="flex gap-2">
            {(['pvp', 'cpu'] as GameMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-3 rounded-lg text-xs font-bold transition-all min-h-[44px]"
                style={{
                  border:     `1px solid ${mode === m ? '#e8b86d' : '#3a3a3c'}`,
                  background: mode === m ? '#e8b86d18' : 'transparent',
                  color:      mode === m ? '#e8b86d' : '#555',
                }}
              >
                {m === 'pvp' ? '👥 2 Players' : '🤖 vs CPU'}
              </button>
            ))}
          </div>
        </div>

        {/* CPU options */}
        <AnimatePresence>
          {mode === 'cpu' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Human color choice */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">You play as</p>
                <div className="flex gap-2">
                  {([1, 2] as Player[]).map(col => (
                    <button
                      key={col}
                      onClick={() => setCpuColor(col === 1 ? 2 : 1)}
                      className="flex-1 py-3 rounded-lg text-xs font-bold transition-all min-h-[44px]"
                      style={{
                        border:     `1px solid ${humanColor === col ? '#e8b86d' : '#3a3a3c'}`,
                        background: humanColor === col ? '#e8b86d18' : 'transparent',
                        color:      humanColor === col ? '#e8b86d' : '#555',
                      }}
                    >
                      {col === 1 ? '⚫ Black' : '⚪ White'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Difficulty</p>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        border:     `1px solid ${difficulty === d ? DIFF_META[d].color : '#3a3a3c'}`,
                        background: difficulty === d ? `${DIFF_META[d].color}18` : 'transparent',
                        color:      difficulty === d ? DIFF_META[d].color : '#555',
                      }}
                    >
                      {DIFF_META[d].label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/25 mt-1.5 text-center">
                  {DIFF_META[difficulty].hint}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player names */}
        <div className="space-y-3 mb-4">
          {([0, 1] as const).map(i => {
            const isCPU = mode === 'cpu' && (i + 1) === cpuColor
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-base flex-shrink-0">{i === 0 ? '⚫' : '⚪'}</span>
                <input
                  value={isCPU ? 'CPU' : names[i]}
                  disabled={isCPU}
                  onChange={e => {
                    const n: [string, string] = [...names] as [string, string]
                    n[i] = e.target.value.slice(0, 18)
                    setNames(n)
                  }}
                  placeholder={i === 0 ? 'Black player' : 'White player'}
                  className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                />
              </div>
            )
          })}
        </div>

        {/* Board size */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Board size</p>
          <div className="flex gap-2">
            {([9, 13, 19] as const).map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className="flex-1 py-3 rounded-lg text-xs font-bold transition-all min-h-[44px]"
                style={{
                  border:     `1px solid ${size === s ? '#e8b86d' : '#3a3a3c'}`,
                  background: size === s ? '#e8b86d18' : 'transparent',
                  color:      size === s ? '#e8b86d' : '#555',
                }}
              >
                {s}×{s}
                {mode === 'cpu' && s === 19 && (
                  <span className="block text-[8px] opacity-50">slower</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Komi */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">
            Komi (White bonus) — {komi}
          </p>
          <div className="flex gap-2">
            {[0, 0.5, 6.5, 7.5].map(k => (
              <button
                key={k}
                onClick={() => setKomi(k)}
                className="flex-1 py-3 rounded-lg text-xs font-bold transition-all min-h-[44px]"
                style={{
                  border:     `1px solid ${komi === k ? '#c77dff' : '#3a3a3c'}`,
                  background: komi === k ? '#c77dff18' : 'transparent',
                  color:      komi === k ? '#c77dff' : '#555',
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            const finalNames: [string, string] = [...names] as [string, string]
            if (mode === 'cpu') finalNames[cpuColor - 1] = 'CPU'
            onStart(finalNames, size, komi, mode, cpuColor, difficulty)
          }}
          className="w-full py-3 rounded-xl font-extrabold uppercase tracking-widest text-sm text-white transition-all active:scale-95"
          style={{ background: '#e8b86d', boxShadow: '0 4px 20px #e8b86d40' }}
        >
          Start Game
        </button>
      </motion.div>
    </div>
  )
}

// ─── Game-over overlay ─────────────────────────────────────────────────────────

interface GameOverProps {
  game: GameState
  names: [string, string]
  onRematch: () => void
  onMenu: () => void
}

function GameOver({ game, names, onRematch, onMenu }: GameOverProps) {
  const { winner, finalScores, territoryCount, captures, komi } = game
  const winnerName = winner ? names[winner - 1] : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <motion.div
        initial={{ scale: 0.82, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 16, stiffness: 260 }}
        className="rounded-2xl border p-6 text-center"
        style={{
          background:   '#18181a',
          border:       `1px solid ${winner ? '#e8b86d50' : '#3a3a3c'}`,
          width:        'min(360px, calc(100vw - 32px))',
          boxShadow:    winner ? '0 0 80px #e8b86d30, 0 24px 48px rgba(0,0,0,0.6)' : '0 24px 48px rgba(0,0,0,0.6)',
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', damping: 12 }}
          className="text-5xl mb-3"
        >
          {winner ? '🏆' : '🤝'}
        </motion.div>

        <div className="text-2xl font-extrabold mb-1" style={{ color: '#e8b86d' }}>
          {winner ? `${winnerName} Wins!` : "It's a Tie!"}
        </div>
        {winner && (
          <div className="text-xs text-white/30 mb-4 tracking-wide">
            by {Math.abs(finalScores[0] - finalScores[1]).toFixed(1)} points
          </div>
        )}

        {/* Score table */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {([1, 2] as Player[]).map(pid => (
            <div
              key={pid}
              className="rounded-xl p-3 text-center"
              style={{
                border:     `1px solid ${winner === pid ? '#e8b86d50' : '#252527'}`,
                background: winner === pid ? '#e8b86d0e' : '#141416',
              }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                {pid === 1 ? '⚫ ' : '⚪ '}{names[pid - 1]}
              </div>
              <div
                className="text-2xl font-extrabold mb-1"
                style={{ color: winner === pid ? '#e8b86d' : '#fff' }}
              >
                {finalScores[pid - 1].toFixed(1)}
              </div>
              <div className="text-[9px] text-white/25 space-y-0.5">
                <div>Territory: {territoryCount[pid - 1]}</div>
                <div>Captures: {captures[pid - 1]}</div>
                {pid === 2 && <div>Komi: +{komi}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onMenu}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-white/10 text-white/40 transition-all hover:border-white/20 hover:text-white/60"
          >
            Menu
          </button>
          <button
            onClick={onRematch}
            className="flex-1 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-widest text-white transition-all active:scale-95"
            style={{ background: '#e8b86d', boxShadow: '0 4px 20px #e8b86d40' }}
          >
            Rematch
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function GoToast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence mode="wait">
      {msg && (
        <motion.div
          key={msg}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-30 rounded-full px-4 py-2 text-xs font-bold text-white/80 shadow-lg"
          style={{ background: '#1e1e20', border: '1px solid #3a3a3c', top: 56, whiteSpace: 'nowrap' }}
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── SVG Board ─────────────────────────────────────────────────────────────────

interface BoardProps {
  game: GameState
  hovered: [number, number] | null
  capturedFlash: { positions: [number, number][]; color: Cell }
  names: [string, string]
  onIntersection: (r: number, c: number) => void
  onHover: (r: number, c: number) => void
  onHoverEnd: () => void
  isLocked: boolean
}

function GoBoard({
  game, hovered, capturedFlash, onIntersection, onHover, onHoverEnd, isLocked,
}: BoardProps) {
  const { size, board, turn, done, lastMove, territory } = game
  const cfg = BOARD_CONFIG[size as keyof typeof BOARD_CONFIG] ?? BOARD_CONFIG[9]
  const { cell, pad } = cfg
  const svgSize  = 2 * pad + (size - 1) * cell
  const stoneR   = cell * STONE_RATIO
  const hitR     = cell * HIT_RATIO
  const x = (c: number) => pad + c * cell
  const y = (r: number) => pad + r * cell

  const starPoints = useMemo(() => getStarPoints(size), [size])

  return (
    <svg
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      style={{
        width:    '100%',
        maxWidth: svgSize,
        height:   'auto',
        display:  'block',
        touchAction: 'manipulation',
        userSelect:  'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <defs>
        {/* Black stone — radial gradient for 3-D sphere effect */}
        <radialGradient id="black-grad" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#707070" />
          <stop offset="40%"  stopColor="#202020" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        {/* White stone */}
        <radialGradient id="white-grad" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="55%"  stopColor="#e8e8e8" />
          <stop offset="100%" stopColor="#b8b8b8" />
        </radialGradient>
        {/* Drop shadow filter */}
        <filter id="stone-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* ── Board background ──────────────────────────────────────────────── */}
      <rect
        x={0} y={0} width={svgSize} height={svgSize}
        rx={12} fill="#1c1408"
      />
      {/* Inner board surface */}
      <rect
        x={pad - cell * 0.5} y={pad - cell * 0.5}
        width={(size - 1) * cell + cell} height={(size - 1) * cell + cell}
        rx={6} fill="#241a0c"
      />

      {/* ── Grid lines ────────────────────────────────────────────────────── */}
      {Array.from({ length: size }, (_, i) => (
        <g key={`grid-${i}`}>
          {/* Horizontal */}
          <line
            x1={x(0)} y1={y(i)} x2={x(size - 1)} y2={y(i)}
            stroke="#5c3d1e" strokeWidth={size <= 9 ? 1 : 0.8}
          />
          {/* Vertical */}
          <line
            x1={x(i)} y1={y(0)} x2={x(i)} y2={y(size - 1)}
            stroke="#5c3d1e" strokeWidth={size <= 9 ? 1 : 0.8}
          />
        </g>
      ))}

      {/* ── Star points (hoshi) ───────────────────────────────────────────── */}
      {starPoints.map(([sr, sc]) => (
        <circle
          key={`star-${sr}-${sc}`}
          cx={x(sc)} cy={y(sr)}
          r={size <= 9 ? 3.5 : size <= 13 ? 3 : 2.5}
          fill="#7a5530"
        />
      ))}

      {/* ── Territory overlay (shown when game is over) ───────────────────── */}
      {done && territory.map((row, r) => row.map((owner, c) => {
        if (owner === 0 || board[r][c] !== 0) return null
        return (
          <motion.rect
            key={`terr-${r}-${c}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + (r + c) * 0.008 }}
            x={x(c) - cell * 0.3} y={y(r) - cell * 0.3}
            width={cell * 0.6} height={cell * 0.6}
            rx={2}
            fill={owner === 1 ? '#d4d4d450' : '#e8b86d50'}
          />
        )
      }))}

      {/* ── Capture flash (stones being removed — animate out) ────────────── */}
      {capturedFlash.positions.map(([r, c], i) => (
        <motion.circle
          key={`cap-${r}-${c}`}
          initial={{ scale: 1, opacity: 0.85 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.35, delay: i * 0.04, ease: 'easeOut' }}
          style={{ transformOrigin: `${x(c)}px ${y(r)}px` }}
          cx={x(c)} cy={y(r)} r={stoneR}
          fill={`url(#${capturedFlash.color === 1 ? 'black-grad' : 'white-grad'})`}
        />
      ))}

      {/* ── Stones on board ───────────────────────────────────────────────── */}
      {board.map((row, r) => row.map((stone, c) => {
        if (stone === 0) return null
        const isLast = lastMove?.[0] === r && lastMove?.[1] === c
        const stoneKey = `${r}-${c}`

        return (
          <g key={`stone-${stoneKey}`}>
            <motion.circle
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 280 }}
              style={{ transformOrigin: `${x(c)}px ${y(r)}px` }}
              cx={x(c)} cy={y(r)} r={stoneR}
              fill={`url(#${stone === 1 ? 'black-grad' : 'white-grad'})`}
              filter="url(#stone-shadow)"
            />
            {/* Last move indicator — contrasting dot */}
            {isLast && (
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.12, type: 'spring', damping: 12 }}
                style={{ transformOrigin: `${x(c)}px ${y(r)}px` }}
                cx={x(c)} cy={y(r)} r={stoneR * 0.28}
                fill={stone === 1 ? '#e8b86d' : '#1c1408'}
              />
            )}
          </g>
        )
      }))}

      {/* ── Hover preview ─────────────────────────────────────────────────── */}
      {hovered && !done && !isLocked && board[hovered[0]][hovered[1]] === 0 && (
        <motion.circle
          key={`hover-${hovered[0]}-${hovered[1]}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.35 }}
          transition={{ duration: 0.1 }}
          style={{ transformOrigin: `${x(hovered[1])}px ${y(hovered[0])}px` }}
          cx={x(hovered[1])} cy={y(hovered[0])} r={stoneR}
          fill={`url(#${turn === 1 ? 'black-grad' : 'white-grad'})`}
        />
      )}

      {/* ── Hit areas — transparent, handle all click/touch ──────────────── */}
      {!done && board.map((row, r) => row.map((stone, c) => (
        <circle
          key={`hit-${r}-${c}`}
          cx={x(c)} cy={y(r)} r={hitR}
          fill="transparent"
          style={{ cursor: isLocked || stone !== 0 ? 'default' : 'pointer' }}
          onMouseEnter={() => !isLocked && onHover(r, c)}
          onMouseLeave={onHoverEnd}
          onClick={() => !isLocked && onIntersection(r, c)}
        />
      )))}
    </svg>
  )
}

// ─── How to Play modal ─────────────────────────────────────────────────────────

function GoHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rules = [
    {
      icon: '⚫',
      title: 'Placement',
      body: 'Players alternate placing one stone per turn on any empty intersection. Black moves first. Stones are never moved once placed.',
    },
    {
      icon: '💨',
      title: 'Liberties & Capture',
      body: 'Each empty point directly adjacent to a stone (or group) is a liberty. When all liberties of a group are filled by the opponent, those stones are captured and removed from the board.',
    },
    {
      icon: '🔗',
      title: 'Connected Groups',
      body: 'Stones of the same colour that are directly adjacent (orthogonally) form a group and share all their liberties. Connecting your groups makes them stronger and harder to capture.',
    },
    {
      icon: '🚫',
      title: 'No Suicide',
      body: 'You may not place a stone where it would immediately have zero liberties — unless doing so simultaneously captures enough opponent stones to give your group liberties.',
    },
    {
      icon: '🔄',
      title: 'Ko Rule',
      body: 'You may not make a move that recreates the exact board position from the previous turn. This prevents infinite capture loops. After a ko capture, you must play elsewhere before recapturing.',
    },
    {
      icon: '👁️',
      title: 'Two-Eye Life',
      body: 'A group with two separate enclosed empty spaces (eyes) is unconditionally alive — the opponent can never capture it. Securing two eyes for your groups is the primary strategic goal.',
    },
    {
      icon: '✋',
      title: 'Passing',
      body: 'Either player may pass their turn. Two consecutive passes end the game. Passing is typically only done in the endgame when no more profitable moves remain.',
    },
    {
      icon: '🏆',
      title: 'Scoring (Japanese Rules)',
      body: 'Count empty intersections your stones surround (territory) plus stones you captured. White adds komi (usually 6.5) to compensate for Black moving first. The higher score wins.',
    },
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
              padding: '20px 20px 16px',
              width: 'min(400px, calc(100vw - 32px))',
              maxHeight: 'min(85dvh, 640px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#e8b86d' }}>
                How to Play Go
              </h2>
              <button
                onClick={onClose}
                style={{ color: '#555', fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                className="hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
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

            {/* Link to full learning guide */}
            <div style={{ borderTop: '1px solid #2a2a2c', paddingTop: 14 }}>
              <p style={{ fontSize: '0.62rem', color: '#666', marginBottom: 10, textAlign: 'center' }}>
                Want to learn tactics & strategy in depth?
              </p>
              <Link
                href="/learn"
                onClick={onClose}
                style={{
                  display: 'block', textAlign: 'center',
                  padding: '10px 0', borderRadius: 12,
                  background: '#e8b86d18', border: '1px solid #e8b86d40',
                  color: '#e8b86d', fontSize: '0.72rem', fontWeight: 700,
                  textDecoration: 'none', letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
                className="hover:bg-[#e8b86d30] transition-colors"
              >
                Open Study Guide — 14 Concepts →
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function GoGame() {
  const [showSetup, setShowSetup] = useState(true)
  const [names, setNames]         = useState<[string, string]>(['Black', 'White'])
  const [boardSize, setBoardSize] = useState(9)
  const [komi, setKomi]           = useState(6.5)
  const [game, setGame]           = useState<GameState>(() => createGame(9))
  const [hovered, setHovered]     = useState<[number, number] | null>(null)
  const [capturedFlash, setCapturedFlash] = useState<{ positions: [number,number][]; color: Cell }>({ positions: [], color: 1 })
  const [toast, setToast]         = useState<string | null>(null)
  const [showResign, setShowResign] = useState(false)
  const [showHelp, setShowHelp]     = useState(false)

  const [gameMode, setGameMode]       = useState<GameMode>('pvp')
  const [cpuColor, setCpuColor]       = useState<Player>(2)
  const [difficulty, setDifficulty]   = useState<Difficulty>('medium')
  const [cpuThinking, setCpuThinking] = useState(false)

  const lastActionAt = useRef(0)
  const sounds = useSounds()
  const soundsRef = useRef(sounds)
  soundsRef.current = sounds

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }, [])

  // ── Start / rematch ─────────────────────────────────────────────────────────

  const startGame = useCallback((
    newNames: [string, string], size: number, newKomi: number,
    mode: GameMode, newCpuColor: Player, diff: Difficulty,
  ) => {
    setNames(newNames)
    setBoardSize(size)
    setKomi(newKomi)
    setGameMode(mode)
    setCpuColor(newCpuColor)
    setDifficulty(diff)
    setGame(createGame(size, newKomi))
    setHovered(null)
    setCapturedFlash({ positions: [], color: 1 })
    setToast(null)
    setShowResign(false)
    setCpuThinking(false)
    setShowSetup(false)
  }, [])

  const handleRematch = useCallback(() => {
    setGame(createGame(boardSize, komi))
    setHovered(null)
    setCapturedFlash({ positions: [], color: 1 })
    setToast(null)
    setCpuThinking(false)
  }, [boardSize, komi])

  // ── Place stone ──────────────────────────────────────────────────────────────

  const handleIntersection = useCallback((r: number, c: number) => {
    const now = performance.now()
    if (now - lastActionAt.current < TOUCH_DEBOUNCE_MS) return
    lastActionAt.current = now

    setGame(prev => {
      if (prev.done || prev.board[r][c] !== 0) return prev
      const result = placeStone(prev, r, c)
      if (result.error) {
        // Show toast outside the setter (schedule it)
        setTimeout(() => showToast(result.error!), 0)
        return prev
      }
      // Flash captures
      if (result.captured.length > 0) {
        const capturedColor = (prev.turn === 1 ? 2 : 1) as Cell
        setCapturedFlash({ positions: result.captured, color: capturedColor })
        setTimeout(() => setCapturedFlash({ positions: [], color: 1 }), 450)
        setTimeout(() => sounds.playCapture(), 60)
      }
      sounds.playStone()
      if (result.state.done) setTimeout(() => sounds.playEnd(), 300)
      return result.state
    })

    setHovered(null)
  }, [showToast, sounds])

  // ── Pass ─────────────────────────────────────────────────────────────────────

  const handlePass = useCallback(() => {
    const now = performance.now()
    if (now - lastActionAt.current < TOUCH_DEBOUNCE_MS) return
    lastActionAt.current = now

    setGame(prev => {
      if (prev.done) return prev
      const next = passTurn(prev)
      sounds.playPass()
      if (next.done) setTimeout(() => sounds.playEnd(), 300)
      return next
    })
    setHovered(null)
  }, [sounds])

  // ── Resign ───────────────────────────────────────────────────────────────────

  const handleResign = useCallback(() => {
    setGame(prev => {
      if (prev.done) return prev
      return resign(prev)
    })
    setShowResign(false)
    setTimeout(() => sounds.playEnd(), 200)
  }, [sounds])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') handlePass()
      if (e.key === 'Escape') setShowResign(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePass])

  // ── CPU turn ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameMode !== 'cpu' || game.done || game.turn !== cpuColor) return

    setCpuThinking(true)
    const snapshotMoveCount = game.moveCount
    const snapshotGame = game
    const delay = difficulty === 'hard' ? 700 : difficulty === 'medium' ? 500 : 350
    let cancelled = false

    const run = async () => {
      await new Promise<void>(resolve => setTimeout(resolve, delay))
      if (cancelled) return

      const move = await computeAIMove(snapshotGame, difficulty)
      if (cancelled) return

      let capturedPositions: [number, number][] = []
      let capturedColor: Cell = 1
      let played = false
      let gameEnded = false

      setGame(prev => {
        if (prev.done || prev.moveCount !== snapshotMoveCount) return prev

        if (move === 'pass') {
          const next = passTurn(prev)
          setTimeout(() => soundsRef.current.playPass(), 0)
          if (next.done) setTimeout(() => soundsRef.current.playEnd(), 300)
          return next
        }

        const result = placeStone(prev, move.r, move.c)
        if (result.error) {
          const next = passTurn(prev)
          setTimeout(() => soundsRef.current.playPass(), 0)
          return next
        }

        if (result.captured.length > 0) {
          capturedPositions = result.captured
          capturedColor = (prev.turn === 1 ? 2 : 1) as Cell
        }
        played = true
        gameEnded = result.state.done
        return result.state
      })

      if (played) {
        if (capturedPositions.length > 0) {
          setCapturedFlash({ positions: capturedPositions, color: capturedColor })
          setTimeout(() => setCapturedFlash({ positions: [], color: 1 }), 450)
          setTimeout(() => soundsRef.current.playCapture(), 60)
        }
        soundsRef.current.playStone()
        if (gameEnded) setTimeout(() => soundsRef.current.playEnd(), 300)
      }

      setCpuThinking(false)
    }

    run()

    return () => {
      cancelled = true
      setCpuThinking(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, gameMode, cpuColor, difficulty])

  // ── Derived state ────────────────────────────────────────────────────────────

  const { turn, done, captures, consecutivePasses } = game
  const displayScores = done
    ? game.finalScores
    : ([captures[0], captures[1] + komi] as [number, number])
  const isLocked = cpuThinking || (gameMode === 'cpu' && game.turn === cpuColor && !done)

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
      position: 'relative',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>

      {/* ── Setup Modal ─────────────────────────────────────────────────────── */}
      <SetupModal
        open={showSetup}
        names={names}
        size={boardSize}
        komi={komi}
        mode={gameMode}
        cpuColor={cpuColor}
        difficulty={difficulty}
        onStart={startGame}
      />

      {/* ── Game Over ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {done && !showSetup && (
          <GameOver
            game={game}
            names={names}
            onRematch={handleRematch}
            onMenu={() => setShowSetup(true)}
          />
        )}
      </AnimatePresence>

      {/* ── Resign confirm ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showResign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              className="rounded-2xl border border-white/10 bg-[#18181a] p-6 text-center shadow-2xl"
              style={{ width: 'min(300px, calc(100vw - 32px))' }}
            >
              <div className="text-3xl mb-3">🏳️</div>
              <div className="text-base font-bold text-white mb-1">Resign the game?</div>
              <div className="text-xs text-white/30 mb-5">
                {names[turn - 1]} will forfeit to {names[turn === 1 ? 1 : 0]}.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResign(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-white/40 transition-all hover:text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResign}
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all active:scale-95"
                  style={{ background: '#c84b4b' }}
                >
                  Resign
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        width: '100%', maxWidth: 560, flexShrink: 0,
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
          background: 'linear-gradient(135deg, #e8b86d 20%, #fff 60%, #e8b86d 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Go
        </h1>

        {/* Board size + settings */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {([9, 13, 19] as const).map(s => (
            <button
              key={s}
              onClick={() => {
                setBoardSize(s)
                setGame(createGame(s, komi))
                setHovered(null)
                setCpuThinking(false)
              }}
              style={{
                minWidth: 40, height: 36, borderRadius: 6, cursor: 'pointer',
                border:     `1px solid ${boardSize === s ? '#e8b86d' : '#3a3a3c'}`,
                background: boardSize === s ? '#e8b86d22' : 'transparent',
                color:      boardSize === s ? '#e8b86d'   : '#555',
                fontSize: '0.6rem', fontWeight: 700, transition: 'all 0.15s',
                padding: '0 6px',
              }}
            >
              {s}×{s}
            </button>
          ))}
          <button
            onClick={() => setShowHelp(true)}
            aria-label="How to Play"
            style={{
              width: 36, height: 36, borderRadius: 6, cursor: 'pointer',
              border: '1px solid #3a3a3c', background: 'transparent',
              color: '#555', fontSize: '0.75rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            className="hover:border-white/30 hover:text-white transition-colors"
          >
            ?
          </button>
        </div>
      </header>

      <GoHelpModal open={showHelp} onClose={() => setShowHelp(false)} />

      {/* ── Score bar ───────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 560, flexShrink: 0,
        display: 'grid', gridTemplateColumns: '1fr 64px 1fr',
        borderBottom: '1px solid #3a3a3c',
      }}>
        {/* Black */}
        {([1, 2] as Player[]).map((pid, idx) => {
          const isLeft = idx === 0
          const p = PLAYERS[pid]
          const score = displayScores[pid - 1]
          const active = turn === pid && !done

          return (
            <div
              key={pid}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '8px 0',
                background: active ? '#e8b86d08' : 'transparent',
                ...(isLeft ? { borderRight: '1px solid #3a3a3c' } : { borderLeft: '1px solid #3a3a3c', order: 2 }),
                transition: 'background 0.4s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <AnimatePresence>
                  {active && (
                    <motion.span
                      key={`dot-${pid}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      style={{ display: 'block', width: 5, height: 5, borderRadius: '50%', background: '#e8b86d', flexShrink: 0 }}
                    />
                  )}
                </AnimatePresence>
                <span style={{ fontSize: '0.7rem' }}>{pid === 1 ? '⚫' : '⚪'}</span>
                <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#d4d4d4' }}>
                  {names[pid - 1]}
                </span>
              </div>
              <motion.span
                key={score}
                initial={{ scale: 1.4, color: '#e8b86d' }}
                animate={{ scale: 1, color: '#ffffff' }}
                transition={{ duration: 0.3 }}
                style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1 }}
              >
                {done ? score.toFixed(1) : score.toFixed(1)}
              </motion.span>
              <span style={{ fontSize: '0.48rem', color: '#3a3a3c', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {done ? 'final' : 'pts'}
              </span>
            </div>
          )
        })}

        {/* Centre */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2, order: 1,
        }}>
          <span style={{ fontSize: '0.44rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3a3a3c' }}>komi</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#555' }}>{komi}</span>
          <span style={{ fontSize: '0.4rem', color: '#2a2a2c', textTransform: 'uppercase' }}>move {game.moveCount}</span>
        </div>
      </div>

      {/* ── Turn / pass indicator ────────────────────────────────────────────── */}
      <div style={{
        height: 36, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', width: '100%',
      }}>
        <GoToast msg={toast} />
        <AnimatePresence mode="wait">
          {!done && cpuThinking && (
            <motion.span
              key="cpu-thinking"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: [0.5, 1, 0.5], y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: '0.7rem', color: '#e8b86d' }}
            >
              ⚙ CPU thinking…
            </motion.span>
          )}
          {!done && !cpuThinking && (
            <motion.span
              key={`turn-${turn}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: '0.7rem', color: '#444' }}
            >
              {consecutivePasses === 1
                ? `${names[turn === 1 ? 1 : 0]} passed — ${names[turn - 1]}, pass to end`
                : `${names[turn - 1]}'s turn ${turn === 1 ? '⚫' : '⚪'} — tap to place`}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Board ───────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%',
        padding: '0 max(10px, env(safe-area-inset-left)) 8px max(10px, env(safe-area-inset-right))',
      }}>
        <GoBoard
          game={game}
          hovered={hovered}
          capturedFlash={capturedFlash}
          names={names}
          onIntersection={handleIntersection}
          onHover={(r, c) => setHovered([r, c])}
          onHoverEnd={() => setHovered(null)}
          isLocked={isLocked}
        />
      </div>

      {/* ── Controls footer ──────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 560, flexShrink: 0,
        padding: '10px 16px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
        borderTop: '1px solid #3a3a3c',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flex: 1 }}>
        {!done ? (
          <>
            <button
              onClick={handlePass}
              disabled={isLocked}
              style={{
                padding: '10px 20px', borderRadius: 9999, minHeight: 44,
                border: '1px solid #3a3a3c', background: 'transparent',
                color: '#555', fontSize: '0.7rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: isLocked ? 'default' : 'pointer',
                opacity: isLocked ? 0.4 : 1,
              }}
              className="hover:border-white/30 hover:text-white transition-colors disabled:pointer-events-none"
            >
              Pass
            </button>
            <button
              onClick={() => setShowResign(true)}
              disabled={isLocked}
              style={{
                padding: '10px 20px', borderRadius: 9999, minHeight: 44,
                border: '1px solid #3a3a3c', background: 'transparent',
                color: '#555', fontSize: '0.7rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: isLocked ? 'default' : 'pointer',
                opacity: isLocked ? 0.4 : 1,
              }}
              className="hover:border-red-500/40 hover:text-red-400 transition-colors disabled:pointer-events-none"
            >
              Resign
            </button>
            <button
              onClick={() => { setGame(createGame(boardSize, komi)); setHovered(null); setCpuThinking(false) }}
              style={{
                padding: '10px 18px', borderRadius: 9999, minHeight: 44,
                border: '1px solid #3a3a3c', background: 'transparent',
                color: '#555', fontSize: '0.7rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
              }}
              className="hover:border-white/30 hover:text-white transition-colors"
            >
              New
            </button>
          </>
        ) : (
          <button
            onClick={handleRematch}
            style={{
              padding: '12px 36px', borderRadius: 9999, minHeight: 44,
              border: 'none', background: '#e8b86d',
              color: '#1c1408', fontSize: '0.72rem', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
            }}
            className="active:scale-95 transition-transform"
          >
            Play Again
          </button>
        )}
        </div>
        <div style={{ fontSize: '0.44rem', color: '#666680', letterSpacing: '0.08em', textAlign: 'right', flexShrink: 0 }}>
          v1.0 · Rahul Chouhan
        </div>
      </div>
    </div>
  )
}
