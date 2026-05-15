'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import {
  createHexGame, placeHexStone,
  type HexState, type HexPlayer,
} from '@/lib/hex/engine'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOUCH_DEBOUNCE_MS = 160

const BOARD_CONFIG = {
   7: { R: 34, pad: 56 },
   9: { R: 27, pad: 48 },
  11: { R: 22, pad: 42 },
} as const

const P1_COLOR  = '#38bdf8'  // sky blue  — left ↔ right
const P2_COLOR  = '#f87171'  // rose red  — top ↔ bottom
const P1_DARK   = '#0369a1'
const P2_DARK   = '#9f1239'
const WIN_GOLD  = '#e8b86d'

const PLAYERS = {
  1: { color: P1_COLOR, dark: P1_DARK, label: 'Blue',  dir: '← →', gradId: 'hex-p1' },
  2: { color: P2_COLOR, dark: P2_DARK, label: 'Red',   dir: '↑ ↓', gradId: 'hex-p2' },
} as const

// ─── Sounds ────────────────────────────────────────────────────────────────────

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
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.06), c.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.1))
      const src = c.createBufferSource(); src.buffer = buf
      const gain = c.createGain(); gain.gain.setValueAtTime(0.24, now)
      src.connect(gain); gain.connect(c.destination); src.start(now)
    } catch { /* ignore */ }
  }, [ctx])

  const playWin = useCallback(() => {
    try {
      const c = ctx(); if (!c) return
      const now = c.currentTime
      ;[330, 440, 550, 660].forEach((freq, i) => {
        const osc = c.createOscillator(); const gain = c.createGain()
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + i * 0.12)
        gain.gain.setValueAtTime(0.12, now + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3)
        osc.connect(gain); gain.connect(c.destination)
        osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.3)
      })
    } catch { /* ignore */ }
  }, [ctx])

  return { playStone, playWin }
}

// ─── Hex geometry helpers ──────────────────────────────────────────────────────

function hexVertices(cx: number, cy: number, R: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    pts.push(`${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

function cellCenter(r: number, c: number, R: number, pad: number) {
  const w = Math.sqrt(3) * R
  return { x: pad + c * w + r * w * 0.5, y: pad + r * 1.5 * R }
}

function svgDims(n: number, R: number, pad: number) {
  const w = Math.sqrt(3) * R
  return {
    w: pad + (n - 1) * 1.5 * w + w / 2 + pad,
    h: pad + (n - 1) * 1.5 * R + R + pad,
  }
}

function cellBgFill(r: number, c: number, n: number): string {
  const isLeftRight = c === 0 || c === n - 1
  const isTopBot    = r === 0 || r === n - 1
  if (isLeftRight && isTopBot) return '#0e0e1e'
  if (isLeftRight) return '#081828'
  if (isTopBot)    return '#1e0810'
  return '#0f0f1a'
}

function cellStroke(r: number, c: number, n: number): string {
  const isLeftRight = c === 0 || c === n - 1
  const isTopBot    = r === 0 || r === n - 1
  if (isLeftRight && isTopBot) return '#282838'
  if (isLeftRight) return '#1a3855'
  if (isTopBot)    return '#4a1a28'
  return '#1e1e30'
}

// ─── Mini board (for tutorial) ─────────────────────────────────────────────────

interface MiniStone { r: number; c: number; p: 1 | 2 }
interface MiniHL    { r: number; c: number; type: 'win' | 'nbr' | 'focus' | 'block' }

function MiniHexBoard({
  stones = [], highlights = [], size = 5,
}: { stones?: MiniStone[]; highlights?: MiniHL[]; size?: number }) {
  const R = 13, pad = 22
  const w = Math.sqrt(3) * R
  const { w: svgW, h: svgH } = svgDims(size, R, pad)
  const stoneMap = useMemo(() => new Map(stones.map(s => [`${s.r},${s.c}`, s.p])), [stones])
  const hlMap    = useMemo(() => new Map(highlights.map(h => [`${h.r},${h.c}`, h.type])), [highlights])

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH}>
      <defs>
        <radialGradient id="mb-p1" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#7dd3fc" /><stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
        <radialGradient id="mb-p2" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fca5a5" /><stop offset="100%" stopColor="#9f1239" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={svgW} height={svgH} rx={6} fill="#0a0a12" />
      {Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => {
          const { x: px, y: py } = cellCenter(r, c, R, pad)
          const verts = hexVertices(px, py, R - 0.5)
          const stone = stoneMap.get(`${r},${c}`)
          const hl    = hlMap.get(`${r},${c}`)
          return (
            <g key={`${r}-${c}`}>
              <polygon points={verts} fill={cellBgFill(r, c, size)} stroke={cellStroke(r, c, size)} strokeWidth={0.6} />
              {hl === 'focus' && <polygon points={verts} fill={`${WIN_GOLD}40`} stroke={WIN_GOLD} strokeWidth={1} />}
              {hl === 'nbr'   && <polygon points={verts} fill={`${P1_COLOR}25`} stroke={`${P1_COLOR}60`} strokeWidth={0.8} />}
              {hl === 'win'   && <polygon points={verts} fill={`${WIN_GOLD}45`} stroke={`${WIN_GOLD}80`} strokeWidth={1} />}
              {hl === 'block' && <polygon points={verts} fill={`${P2_COLOR}30`} stroke={`${P2_COLOR}60`} strokeWidth={0.8} />}
              {stone && (
                <motion.circle
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 300 }}
                  style={{ transformOrigin: `${px}px ${py}px` }}
                  cx={px} cy={py} r={R * 0.44}
                  fill={`url(#mb-p${stone})`}
                />
              )}
            </g>
          )
        })
      )}
      {/* Edge arrows — left/right (P1 blue) */}
      <text x={pad - w * 0.5 - 6} y={svgH / 2} textAnchor="end" fontSize={9} fill={P1_COLOR} fontWeight={700}>←</text>
      <text x={pad + (size - 1) * 1.5 * w + w * 0.5 + 6} y={svgH * 0.6} textAnchor="start" fontSize={9} fill={P1_COLOR} fontWeight={700}>→</text>
      {/* Top/bottom (P2 red) */}
      <text x={pad + (size / 2) * w - 4} y={pad - R - 4} textAnchor="middle" fontSize={9} fill={P2_COLOR} fontWeight={700}>↓</text>
      <text x={pad + (size / 2) * w + (size - 1) * w * 0.5} y={pad + (size - 1) * 1.5 * R + R + 12} textAnchor="middle" fontSize={9} fill={P2_COLOR} fontWeight={700}>↑</text>
    </svg>
  )
}

// ─── Tutorial pages ────────────────────────────────────────────────────────────

interface TutPage {
  title:   string
  body:    string
  stones:  MiniStone[]
  hls:     MiniHL[]
  caption: string
}

const TUTORIAL: TutPage[] = [
  {
    title:   'Welcome to Hexle',
    body:    'Hexle is played on a grid of hexagons. Two players take turns placing stones. The first player to form a connected chain across their assigned sides wins.',
    stones:  [
      {r:0,c:0,p:1},{r:1,c:0,p:1},{r:1,c:1,p:1},{r:2,c:1,p:1},{r:2,c:2,p:1},
      {r:0,c:2,p:2},{r:0,c:3,p:2},{r:1,c:3,p:2},{r:3,c:1,p:2},
    ],
    hls:     [{r:0,c:0,type:'win'},{r:1,c:0,type:'win'},{r:1,c:1,type:'win'},{r:2,c:1,type:'win'},{r:2,c:2,type:'win'}],
    caption: 'Blue (←→) won: connected left to right!',
  },
  {
    title:   'Six Neighbors',
    body:    'Every hex cell connects to up to 6 direct neighbors. Connections only count through these neighbors — gaps and diagonals do not count.',
    stones:  [],
    hls:     [
      {r:2,c:2,type:'focus'},
      {r:1,c:2,type:'nbr'},{r:1,c:3,type:'nbr'},
      {r:2,c:1,type:'nbr'},{r:2,c:3,type:'nbr'},
      {r:3,c:1,type:'nbr'},{r:3,c:2,type:'nbr'},
    ],
    caption: 'Gold = focused cell · Blue = its 6 neighbors',
  },
  {
    title:   'Your Goal',
    body:    'Blue (←→) must connect the LEFT edge to the RIGHT edge. Red (↑↓) must connect the TOP edge to the BOTTOM edge. The colored cell backgrounds show each player\'s starting sides.',
    stones:  [
      {r:0,c:0,p:1},{r:1,c:0,p:1},{r:2,c:1,p:1},{r:3,c:2,p:1},{r:4,c:3,p:1},{r:4,c:4,p:1},
      {r:0,c:3,p:2},{r:1,c:3,p:2},{r:2,c:3,p:2},
    ],
    hls:     [
      {r:0,c:0,type:'win'},{r:1,c:0,type:'win'},{r:2,c:1,type:'win'},
      {r:3,c:2,type:'win'},{r:4,c:3,type:'win'},{r:4,c:4,type:'win'},
    ],
    caption: 'Blue\'s winning path from column 0 → column 4',
  },
  {
    title:   'Blocking',
    body:    'When your opponent is building a path, place a stone in their way to cut it. Every stone you place is both a blocker and part of your own path.',
    stones:  [
      {r:2,c:0,p:1},{r:2,c:1,p:1},{r:2,c:2,p:1},
      {r:0,c:3,p:2},{r:1,c:3,p:2},{r:2,c:3,p:2},{r:3,c:3,p:2},{r:4,c:3,p:2},
    ],
    hls:     [{r:2,c:3,type:'block'}],
    caption: 'Red\'s stone at (2,3) blocked blue and wins ↓',
  },
  {
    title:   'The Bridge',
    body:    'A bridge connects two of your stones through two shared neighbors. Your opponent cannot cut it in a single move — one bridge cell remains free to connect through.',
    stones:  [{r:2,c:1,p:1},{r:3,c:2,p:1}],
    hls:     [{r:2,c:2,type:'focus'},{r:3,c:1,type:'focus'}],
    caption: 'Two gold cells = bridge: block one, use the other',
  },
  {
    title:   'Key Strategy Tips',
    body:    '1. Control the center — central stones can reach any edge.\n2. Build bridges — two paths are harder to block than one.\n3. Respond to threats — never ignore a near-complete opponent path.\n4. Zigzag wins — a winding path is still a valid path!',
    stones:  [
      {r:0,c:2,p:1},{r:1,c:1,p:1},{r:2,c:2,p:1},{r:3,c:3,p:1},{r:4,c:3,p:1},{r:4,c:4,p:1},
      {r:0,c:3,p:2},{r:1,c:3,p:2},{r:2,c:3,p:2},{r:2,c:4,p:2},
    ],
    hls:     [
      {r:0,c:2,type:'win'},{r:1,c:1,type:'win'},{r:2,c:2,type:'win'},
      {r:3,c:3,type:'win'},{r:4,c:3,type:'win'},{r:4,c:4,type:'win'},
    ],
    caption: 'Blue\'s zigzag path beats Red\'s attempt',
  },
]

// ─── Tutorial modal ────────────────────────────────────────────────────────────

function TutorialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState(0)
  if (!open) return null
  const p = TUTORIAL[page]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 280 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#18181a] shadow-2xl"
        style={{ overflow: 'hidden' }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${((page + 1) / TUTORIAL.length) * 100}%`, background: P1_COLOR }}
          />
        </div>

        <div className="p-5">
          {/* Page counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: P1_COLOR }}>
              Tutorial · {page + 1}/{TUTORIAL.length}
            </span>
            <button onClick={onClose} className="text-white/20 hover:text-white/50 text-xs transition-colors">✕ Skip</button>
          </div>

          {/* Title */}
          <h3 className="text-lg font-extrabold text-white mb-2 tracking-tight">{p.title}</h3>

          {/* Body */}
          <p className="text-xs text-white/45 mb-4 leading-relaxed whitespace-pre-line">{p.body}</p>

          {/* Mini board */}
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-2 mb-4"
            >
              <div className="rounded-xl overflow-hidden border border-white/8">
                <MiniHexBoard stones={p.stones} highlights={p.hls} />
              </div>
              <p className="text-[10px] text-white/30 text-center italic">{p.caption}</p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setPage(v => Math.max(0, v - 1))}
              disabled={page === 0}
              className="flex-1 py-2 rounded-xl text-xs font-bold border border-white/10 text-white/30 transition-all disabled:opacity-20 hover:border-white/20 hover:text-white/50"
            >
              ← Back
            </button>
            {page < TUTORIAL.length - 1 ? (
              <button
                onClick={() => setPage(v => v + 1)}
                className="flex-1 py-2 rounded-xl text-xs font-extrabold text-white transition-all active:scale-95"
                style={{ background: P1_COLOR }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl text-xs font-extrabold text-white transition-all active:scale-95"
                style={{ background: P1_COLOR }}
              >
                Play Now!
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Setup modal ───────────────────────────────────────────────────────────────

interface SetupProps {
  open:         boolean
  names:        [string, string]
  size:         number
  onStart:      (names: [string, string], size: 7 | 9 | 11) => void
  onTutorial:   () => void
}

function SetupModal({ open, names: initNames, size: initSize, onStart, onTutorial }: SetupProps) {
  const [names, setNames] = useState<[string, string]>(initNames)
  const [size, setSize]   = useState<7 | 9 | 11>(initSize as 7 | 9 | 11)
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 280 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#18181a] p-6 shadow-2xl"
      >
        <div className="mb-5 text-center">
          <div className="text-3xl mb-1">⬡</div>
          <h2 className="text-xl font-extrabold tracking-widest text-white uppercase">Hexle</h2>
          <p className="text-xs text-white/30 mt-1">Connect your sides before they do</p>
        </div>

        {/* Player names */}
        <div className="space-y-3 mb-4">
          {([0, 1] as const).map(i => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm w-4" style={{ color: i === 0 ? P1_COLOR : P2_COLOR }}>⬡</span>
              <input
                value={names[i]}
                onChange={e => { const n = [...names] as [string, string]; n[i] = e.target.value.slice(0, 16); setNames(n) }}
                placeholder={i === 0 ? 'Blue player (←→)' : 'Red player (↑↓)'}
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/25 transition-colors"
              />
            </div>
          ))}
        </div>

        {/* Board size */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Board size</p>
          <div className="flex gap-2">
            {([7, 9, 11] as const).map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  border:     `1px solid ${size === s ? P1_COLOR : '#3a3a3c'}`,
                  background: size === s ? `${P1_COLOR}18` : 'transparent',
                  color:      size === s ? P1_COLOR : '#555',
                }}
              >
                {s}×{s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onTutorial}
            className="py-3 px-4 rounded-xl text-xs font-bold border border-white/10 text-white/40 transition-all hover:border-white/20 hover:text-white/60"
          >
            Tutorial
          </button>
          <button
            onClick={() => onStart(names, size)}
            className="flex-1 py-3 rounded-xl font-extrabold uppercase tracking-widest text-sm text-white transition-all active:scale-95"
            style={{ background: P1_COLOR, boxShadow: `0 4px 20px ${P1_COLOR}40` }}
          >
            Start Game
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Winner modal ──────────────────────────────────────────────────────────────

function WinnerModal({
  game, names, onRematch, onMenu,
}: { game: HexState; names: [string, string]; onRematch: () => void; onMenu: () => void }) {
  const w = game.winner!
  const wName  = names[w - 1]
  const wColor = PLAYERS[w].color

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
    >
      <motion.div
        initial={{ scale: 0.82, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 16, stiffness: 260 }}
        className="rounded-2xl border p-6 text-center"
        style={{
          background:  '#18181a',
          border:      `1px solid ${wColor}50`,
          width:       'min(340px, calc(100vw - 32px))',
          boxShadow:   `0 0 80px ${wColor}30, 0 24px 48px rgba(0,0,0,0.6)`,
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', damping: 12 }}
          className="text-5xl mb-3"
        >
          🏆
        </motion.div>
        <div className="text-2xl font-extrabold mb-1" style={{ color: wColor }}>
          {wName} wins!
        </div>
        <div className="text-xs mb-2" style={{ color: `${wColor}80` }}>
          {PLAYERS[w].dir} connected in {game.moveCount} moves
        </div>
        <div className="text-[10px] text-white/25 mb-6 uppercase tracking-widest">
          {w === 1 ? 'Left → Right' : 'Top → Bottom'}
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
            style={{ background: wColor, boxShadow: `0 4px 20px ${wColor}40` }}
          >
            Rematch
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── SVG Board ─────────────────────────────────────────────────────────────────

interface BoardProps {
  game:      HexState
  hovered:   [number, number] | null
  isLocked:  boolean
  onCell:    (r: number, c: number) => void
  onHover:   (r: number, c: number) => void
  onHoverEnd: () => void
}

function HexBoard({ game, hovered, isLocked, onCell, onHover, onHoverEnd }: BoardProps) {
  const { size, board, turn, winner, winPath, lastMove } = game
  const cfg = BOARD_CONFIG[size as keyof typeof BOARD_CONFIG] ?? BOARD_CONFIG[9]
  const { R, pad } = cfg
  const w = Math.sqrt(3) * R
  const { w: svgW, h: svgH } = svgDims(size, R, pad)

  const winSet = useMemo(() => new Set(winPath.map(([r, c]) => `${r},${c}`)), [winPath])

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{
        width:    '100%',
        maxWidth: svgW,
        height:   'auto',
        display:  'block',
        touchAction: 'manipulation',
        userSelect:  'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <defs>
        {/* P1 stone gradient — blue */}
        <radialGradient id="hex-p1" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#7dd3fc" />
          <stop offset="45%"  stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
        {/* P2 stone gradient — red */}
        <radialGradient id="hex-p2" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#fca5a5" />
          <stop offset="45%"  stopColor="#ef4444" />
          <stop offset="100%" stopColor="#9f1239" />
        </radialGradient>
        {/* Win path glow gradient */}
        <radialGradient id="hex-win" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={`${WIN_GOLD}90`} />
          <stop offset="100%" stopColor={`${WIN_GOLD}20`} />
        </radialGradient>
        {/* Stone shadow */}
        <filter id="hex-shadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="1" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* ── Board background ────────────────────────────────────────────────── */}
      <rect x={0} y={0} width={svgW} height={svgH} rx={14} fill="#0a0a12" />

      {/* ── Cells ────────────────────────────────────────────────────────────── */}
      {board.map((row, r) => row.map((stone, c) => {
        const { x: cx, y: cy } = cellCenter(r, c, R, pad)
        const verts     = hexVertices(cx, cy, R - 0.8)
        const hitVerts  = hexVertices(cx, cy, R + 1)
        const isWinCell = winSet.has(`${r},${c}`)
        const isHov     = !isLocked && hovered?.[0] === r && hovered?.[1] === c
        const isLast    = lastMove?.[0] === r && lastMove?.[1] === c
        const canPlace  = !isLocked && stone === 0

        return (
          <g key={`cell-${r}-${c}`}>
            {/* Background fill */}
            <polygon points={verts} fill={cellBgFill(r, c, size)} stroke={cellStroke(r, c, size)} strokeWidth={0.8} />

            {/* Win path overlay */}
            {isWinCell && stone !== 0 && (
              <motion.polygon
                points={verts}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + winPath.findIndex(([pr,pc]) => pr===r && pc===c) * 0.06 }}
                fill={`url(#hex-win)`}
                stroke={WIN_GOLD}
                strokeWidth={1.2}
              />
            )}

            {/* Placed stone */}
            {stone !== 0 && (
              <motion.circle
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 290 }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
                cx={cx} cy={cy} r={R * 0.43}
                fill={`url(#hex-p${stone})`}
                filter="url(#hex-shadow)"
              />
            )}

            {/* Last move dot */}
            {isLast && stone !== 0 && (
              <motion.circle
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 12 }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
                cx={cx} cy={cy} r={R * 0.14}
                fill={stone === 1 ? '#fff' : '#1c1408'}
              />
            )}

            {/* Hover preview */}
            {isHov && stone === 0 && !winner && (
              <motion.circle
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.38 }}
                transition={{ duration: 0.08 }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
                cx={cx} cy={cy} r={R * 0.43}
                fill={`url(#hex-p${turn})`}
              />
            )}

            {/* Hit area */}
            <polygon
              points={hitVerts}
              fill="transparent"
              style={{ cursor: canPlace ? 'pointer' : 'default' }}
              onMouseEnter={() => !isLocked && onHover(r, c)}
              onMouseLeave={onHoverEnd}
              onClick={() => !isLocked && onCell(r, c)}
            />
          </g>
        )
      }))}

      {/* ── Edge direction labels ────────────────────────────────────────────── */}
      {/* P1 (Blue) — left label */}
      <text
        x={pad - w * 0.5 - 10}
        y={pad + Math.floor(size / 2) * (w * 0.5 + 1.5 * R * 0) + (Math.floor(size / 2)) * 1.5 * R}
        textAnchor="end" fontSize={R * 0.55} fontWeight={800} fill={P1_COLOR} opacity={0.7}
      >
        ←
      </text>
      {/* P1 (Blue) — right label */}
      <text
        x={pad + (size - 1) * w + Math.floor(size / 2) * w * 0.5 + w * 0.5 + 8}
        y={pad + Math.floor(size / 2) * 1.5 * R}
        textAnchor="start" fontSize={R * 0.55} fontWeight={800} fill={P1_COLOR} opacity={0.7}
      >
        →
      </text>
      {/* P2 (Red) — top label */}
      <text
        x={pad + Math.floor(size / 2) * w + 2}
        y={pad - R - 4}
        textAnchor="middle" fontSize={R * 0.5} fontWeight={800} fill={P2_COLOR} opacity={0.7}
      >
        ↓
      </text>
      {/* P2 (Red) — bottom label */}
      <text
        x={pad + Math.floor(size / 2) * w + (size - 1) * w * 0.5}
        y={pad + (size - 1) * 1.5 * R + R + R * 0.6}
        textAnchor="middle" fontSize={R * 0.5} fontWeight={800} fill={P2_COLOR} opacity={0.7}
      >
        ↑
      </text>
    </svg>
  )
}

// ─── Attribution ───────────────────────────────────────────────────────────────

function Attribution() {
  return (
    <div style={{ fontSize: '0.48rem', color: '#666680', letterSpacing: '0.08em', textAlign: 'right' }}>
      v1.0 · Created by Rahul Chouhan
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function HexGame() {
  const [showSetup,    setShowSetup]    = useState(true)
  const [showTutorial, setShowTutorial] = useState(false)
  const [names,        setNames]        = useState<[string, string]>(['Blue', 'Red'])
  const [boardSize,    setBoardSize]    = useState<7 | 9 | 11>(9)
  const [game,         setGame]         = useState<HexState>(() => createHexGame(9))
  const [hovered,      setHovered]      = useState<[number, number] | null>(null)

  const lastActionAt = useRef(0)
  const sounds       = useSounds()

  // ── Start / rematch ─────────────────────────────────────────────────────────

  const startGame = useCallback((newNames: [string, string], size: 7 | 9 | 11) => {
    setNames(newNames)
    setBoardSize(size)
    setGame(createHexGame(size))
    setHovered(null)
    setShowSetup(false)
  }, [])

  const handleRematch = useCallback(() => {
    setGame(createHexGame(boardSize))
    setHovered(null)
  }, [boardSize])

  // ── Place stone ──────────────────────────────────────────────────────────────

  const handleCell = useCallback((r: number, c: number) => {
    const now = performance.now()
    if (now - lastActionAt.current < TOUCH_DEBOUNCE_MS) return
    lastActionAt.current = now

    setGame(prev => {
      const result = placeHexStone(prev, r, c)
      if (result.error) return prev
      sounds.playStone()
      if (result.state.winner !== null) setTimeout(() => sounds.playWin(), 180)
      return result.state
    })
    setHovered(null)
  }, [sounds])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowTutorial(false); if (game.winner !== null) setShowSetup(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [game.winner])

  // ── Derived ──────────────────────────────────────────────────────────────────

  const { turn, winner, moveCount } = game
  const isLocked = winner !== null
  const activeName  = names[turn - 1]
  const activeColor = PLAYERS[turn].color

  return (
    <div style={{
      background:   '#0a0a10',
      color:        '#fff',
      fontFamily:   "'Segoe UI', system-ui, -apple-system, sans-serif",
      minHeight:    '100dvh',
      display:      'flex',
      flexDirection:'column',
      alignItems:   'center',
      overscrollBehavior: 'none',
      WebkitTapHighlightColor: 'transparent',
      userSelect:   'none',
      position:     'relative',
    }}>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <SetupModal
        open={showSetup}
        names={names}
        size={boardSize}
        onStart={startGame}
        onTutorial={() => { setShowTutorial(true) }}
      />
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} />
      <AnimatePresence>
        {winner !== null && !showSetup && (
          <WinnerModal
            game={game}
            names={names}
            onRematch={handleRematch}
            onMenu={() => setShowSetup(true)}
          />
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        width: '100%', maxWidth: 600, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #1e1e30',
      }}>
        <Link
          href="/"
          aria-label="Back to Arcade"
          style={{
            width: 36, height: 36, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 8, color: '#818384', textDecoration: 'none',
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
          background: `linear-gradient(135deg, ${P1_COLOR} 20%, #fff 60%, ${P2_COLOR} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Hexle
        </h1>

        {/* Board size selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([7, 9, 11] as const).map(s => (
            <button
              key={s}
              onClick={() => { setBoardSize(s); setGame(createHexGame(s)); setHovered(null) }}
              style={{
                width: 38, height: 28, borderRadius: 6, cursor: 'pointer',
                border:     `1px solid ${boardSize === s ? P1_COLOR : '#3a3a4c'}`,
                background: boardSize === s ? `${P1_COLOR}22` : 'transparent',
                color:      boardSize === s ? P1_COLOR : '#555',
                fontSize: '0.58rem', fontWeight: 700, transition: 'all 0.15s',
              }}
            >
              {s}×{s}
            </button>
          ))}
        </div>
      </header>

      {/* ── Score bar ───────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 600, flexShrink: 0,
        display: 'grid', gridTemplateColumns: '1fr 56px 1fr',
        borderBottom: '1px solid #1e1e30',
      }}>
        {([1, 2] as HexPlayer[]).map((pid, idx) => {
          const isLeft   = idx === 0
          const p        = PLAYERS[pid]
          const active   = turn === pid && !winner

          return (
            <div
              key={pid}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '8px 0',
                background: active ? `${p.color}08` : 'transparent',
                ...(isLeft
                  ? { borderRight: '1px solid #1e1e30' }
                  : { borderLeft: '1px solid #1e1e30', order: 2 }),
                transition: 'background 0.4s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <AnimatePresence>
                  {active && (
                    <motion.span
                      key={`dot-${pid}`}
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, flexShrink: 0, display: 'block' }}
                    />
                  )}
                </AnimatePresence>
                <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: p.color }}>
                  {names[pid - 1]}
                </span>
              </div>
              <span style={{ fontSize: '0.65rem', color: `${p.color}60`, fontWeight: 600 }}>
                {p.dir}
              </span>
            </div>
          )
        })}

        {/* Centre — move count */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 1, order: 1,
        }}>
          <span style={{ fontSize: '0.42rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#2a2a3c' }}>move</span>
          <span style={{ fontSize: '1.0rem', fontWeight: 700, color: '#333' }}>{moveCount}</span>
        </div>
      </div>

      {/* ── Turn hint ───────────────────────────────────────────────────────── */}
      <div style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {!winner && (
            <motion.span
              key={`turn-${turn}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: '0.68rem', color: activeColor, opacity: 0.7 }}
            >
              {activeName}'s turn {PLAYERS[turn].dir}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Board ───────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', padding: '4px 10px 8px',
      }}>
        <HexBoard
          game={game}
          hovered={hovered}
          isLocked={isLocked}
          onCell={handleCell}
          onHover={(r, c) => setHovered([r, c])}
          onHoverEnd={() => setHovered(null)}
        />
      </div>

      {/* ── Controls footer ─────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 600, flexShrink: 0,
        padding: '8px 16px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        borderTop: '1px solid #1e1e30',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setGame(createHexGame(boardSize)); setHovered(null) }}
            style={{
              padding: '7px 18px', borderRadius: 9999,
              border: '1px solid #3a3a4c', background: 'transparent',
              color: '#555', fontSize: '0.68rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
            }}
            className="hover:border-white/30 hover:text-white transition-colors"
          >
            New
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            style={{
              padding: '7px 18px', borderRadius: 9999,
              border: '1px solid #3a3a4c', background: 'transparent',
              color: '#555', fontSize: '0.68rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
            }}
            className="hover:border-white/30 hover:text-white transition-colors"
          >
            How to Play
          </button>
        </div>
        <Attribution />
      </div>
    </div>
  )
}
