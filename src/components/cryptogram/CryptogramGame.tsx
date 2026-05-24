"use client"

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowLeft, Lightbulb, RotateCcw, BarChart2, X, ChevronRight } from "lucide-react"
import Link from "next/link"
import {
  buildCipherKey, encodeText, setGuess, clearGuess, resetMapping,
  checkCompletion, getFrequencies, getUniqueCipherLetters, getHintCandidates,
  applyHint, EN_FREQ, ALPHA,
} from "@/lib/cryptogram/cipher"
import {
  getDailyPuzzle, getInfinitePuzzle, DIFFICULTY_LABEL,
  CATEGORY_LABEL, DIFFICULTY_HINTS, type Difficulty, type CryptoQuote,
} from "@/lib/cryptogram/puzzles"
import { CryptogramAudio } from "@/lib/cryptogram/audio"

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'menu' | 'playing' | 'won' | 'tutorial' | 'stats'
type GameMode = 'daily' | 'infinite'

interface ActiveGame {
  mode:          GameMode
  infiniteIndex: number
  quote:         CryptoQuote
  cipherSeed:    number
  ciphertext:    string
  reverseKey:    Record<string, string>   // cipher → plain (truth)
  userMapping:   Record<string, string>   // cipher → guess (mutable)
  selectedCipher: string | null
  startTime:     number
  hintsUsed:     number
  hintsAllowed:  number
}

interface Stats {
  totalSolved:    number
  currentStreak:  number
  bestStreak:     number
  totalHintsUsed: number
  avgTimeSeconds: number
  lastSolvedDate: string | null
  bestTimeMs:     number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT  = '#00d4aa'   // mint teal
const GOLD    = '#f0b429'   // amber (selected)
const GREEN   = '#22c55e'   // correct
const DIM     = 'rgba(255,255,255,0.28)'
const SURFACE = 'rgba(255,255,255,0.04)'

const QWERTY_ROWS = [
  'QWERTYUIOP',
  'ASDFGHJKL',
  'ZXCVBNM',
] as const

const STORAGE_STATS    = 'cryptogram-stats'
const STORAGE_PROGRESS = 'cryptogram-progress'

const DEFAULT_STATS: Stats = {
  totalSolved: 0, currentStreak: 0, bestStreak: 0,
  totalHintsUsed: 0, avgTimeSeconds: 0,
  lastSolvedDate: null, bestTimeMs: null,
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STORAGE_STATS)
    return raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : DEFAULT_STATS
  } catch { return DEFAULT_STATS }
}

function saveStats(s: Stats) {
  try { localStorage.setItem(STORAGE_STATS, JSON.stringify(s)) } catch { /* ignore */ }
}

function saveProgress(game: ActiveGame | null) {
  try {
    if (!game) { localStorage.removeItem(STORAGE_PROGRESS); return }
    localStorage.setItem(STORAGE_PROGRESS, JSON.stringify({
      mode: game.mode, infiniteIndex: game.infiniteIndex,
      quoteId: game.quote.id, cipherSeed: game.cipherSeed,
      userMapping: game.userMapping, startTime: game.startTime,
      hintsUsed: game.hintsUsed, difficulty: game.quote.difficulty,
    }))
  } catch { /* ignore */ }
}

// ─── Animated menu background ─────────────────────────────────────────────────

function CipherRain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const COLS     = 22
    const FONT_H   = 16
    const SPEED    = 0.5

    let W = canvas.offsetWidth
    let H = canvas.offsetHeight
    canvas.width  = W
    canvas.height = H

    // Each column: current y offset, speed, characters
    const cols = Array.from({ length: COLS }, (_, i) => ({
      x:     (W / COLS) * i + (W / COLS) * 0.3,
      y:     Math.random() * -H,
      speed: SPEED * (0.7 + Math.random() * 0.8),
      chars: Array.from({ length: 40 }, () =>
        ALPHA[Math.floor(Math.random() * 26)]),
      tick: 0,
    }))

    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight
      canvas.width = W; canvas.height = H
    }
    window.addEventListener('resize', resize)

    let last = 0
    const draw = (now: number) => {
      const dt = now - last; last = now
      ctx.clearRect(0, 0, W, H)
      ctx.font = `${FONT_H}px monospace`

      for (const col of cols) {
        col.tick += dt
        if (col.tick > 180) {
          col.tick = 0
          const ri = Math.floor(Math.random() * col.chars.length)
          col.chars[ri] = ALPHA[Math.floor(Math.random() * 26)]
        }

        for (let j = 0; j < col.chars.length; j++) {
          const cy = col.y + j * FONT_H
          if (cy < -FONT_H || cy > H + FONT_H) continue
          const fade = 1 - Math.abs(cy - H * 0.5) / (H * 0.5)
          ctx.globalAlpha = 0.04 + fade * 0.05
          ctx.fillStyle   = ACCENT
          ctx.fillText(col.chars[j], col.x, cy)
        }
        col.y += col.speed * (dt / 16)
        if (col.y > H + col.chars.length * FONT_H)
          col.y = -(col.chars.length * FONT_H)
      }
      ctx.globalAlpha = 1
      frameRef.current = requestAnimationFrame(draw)
    }
    frameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}

// ─── Letter cell ──────────────────────────────────────────────────────────────

interface LetterCellProps {
  cipher:     string
  guess:      string | undefined
  isSelected: boolean
  isCorrect:  boolean
  onClick:    () => void
}

function LetterCell({ cipher, guess, isSelected, isCorrect, onClick }: LetterCellProps) {
  const borderColor = isCorrect  ? GREEN
                    : isSelected ? GOLD
                    : guess      ? `rgba(255,255,255,0.18)`
                    : 'rgba(255,255,255,0.10)'

  const guessBg     = isCorrect  ? `${GREEN}1a`
                    : isSelected ? `${GOLD}18`
                    : 'transparent'

  const guessColor  = isCorrect  ? GREEN
                    : isSelected ? GOLD
                    : guess      ? '#ffffff'
                    : 'transparent'

  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center cursor-pointer select-none"
      style={{ minWidth: 28 }}
    >
      {/* Guess slot */}
      <motion.div
        animate={{
          borderColor,
          background: guessBg,
          scale: isSelected ? 1.08 : 1,
        }}
        transition={{ duration: 0.15 }}
        className="flex items-center justify-center rounded"
        style={{
          width: 28, height: 30,
          border: `1.5px solid ${borderColor}`,
          background: guessBg,
          fontSize: 14,
          fontFamily: 'var(--font-geist-mono)',
          fontWeight: 700,
          color: guessColor,
          letterSpacing: '0.05em',
        }}
      >
        {guess ?? ''}
      </motion.div>

      {/* Cipher letter */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 28, height: 20,
          borderBottom: `1.5px solid rgba(255,255,255,0.14)`,
          fontSize: 11,
          fontFamily: 'var(--font-geist-mono)',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.1em',
        }}
      >
        {cipher}
      </div>
    </div>
  )
}

// ─── Puzzle board ─────────────────────────────────────────────────────────────

interface PuzzleBoardProps {
  ciphertext:     string
  userMapping:    Record<string, string>
  reverseKey:     Record<string, string>
  selectedCipher: string | null
  onSelect:       (cipher: string) => void
}

function PuzzleBoard({ ciphertext, userMapping, reverseKey, selectedCipher, onSelect }: PuzzleBoardProps) {
  // Split ciphertext into word-groups preserving punctuation
  const wordGroups = useMemo(() => {
    const tokens: Array<{ type: 'word'; chars: string[] } | { type: 'space' }> = []
    let current: string[] = []
    for (const ch of ciphertext) {
      if (ch === ' ') {
        if (current.length) { tokens.push({ type: 'word', chars: current }); current = [] }
        tokens.push({ type: 'space' })
      } else {
        current.push(ch)
      }
    }
    if (current.length) tokens.push({ type: 'word', chars: current })
    return tokens
  }, [ciphertext])

  return (
    <div
      className="flex flex-wrap items-end gap-y-6"
      style={{ gap: '0 6px', rowGap: 24 }}
    >
      {wordGroups.map((token, ti) => {
        if (token.type === 'space') {
          return <div key={ti} style={{ width: 10 }} />
        }
        return (
          <div key={ti} className="flex items-end" style={{ gap: 3 }}>
            {token.chars.map((ch, ci) => {
              if (!/[A-Z]/.test(ch)) {
                // Punctuation / number — just render inline
                return (
                  <div
                    key={ci}
                    className="flex items-end pb-1"
                    style={{
                      height: 52,
                      fontSize: 13,
                      fontFamily: 'var(--font-geist-mono)',
                      color: 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {ch}
                  </div>
                )
              }
              return (
                <LetterCell
                  key={ci}
                  cipher={ch}
                  guess={userMapping[ch]}
                  isSelected={selectedCipher === ch}
                  isCorrect={userMapping[ch] === reverseKey[ch]}
                  onClick={() => onSelect(ch)}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── On-screen keyboard ───────────────────────────────────────────────────────

interface CipherKeyboardProps {
  userMapping:    Record<string, string>
  reverseKey:     Record<string, string>
  selectedCipher: string | null
  onKey:          (letter: string) => void
  onBackspace:    () => void
}

function CipherKeyboard({ userMapping, reverseKey, selectedCipher, onKey, onBackspace }: CipherKeyboardProps) {
  // Build inverse map: plain → cipher (for keyboard coloring)
  const plainToUsed = useMemo(() => {
    const m: Record<string, string> = {}
    for (const [cipher, plain] of Object.entries(userMapping)) m[plain] = cipher
    return m
  }, [userMapping])

  const selectedPlain = selectedCipher ? (userMapping[selectedCipher] ?? null) : null

  function keyStyle(plain: string) {
    const isUsed      = plain in plainToUsed
    const isCorrect   = isUsed && userMapping[plainToUsed[plain]] === reverseKey[plainToUsed[plain]]
    const isActive    = plain === selectedPlain

    if (isCorrect) return {
      background: `${GREEN}22`, border: `1.5px solid ${GREEN}66`, color: GREEN,
    }
    if (isActive) return {
      background: `${GOLD}28`, border: `1.5px solid ${GOLD}aa`, color: GOLD,
    }
    if (isUsed) return {
      background: `${ACCENT}14`, border: `1.5px solid ${ACCENT}44`, color: ACCENT,
    }
    return {
      background: SURFACE, border: '1.5px solid rgba(255,255,255,0.08)', color: DIM,
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {QWERTY_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1.5">
          {row.split('').map(key => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.90 }}
              onClick={() => onKey(key)}
              className="rounded-md font-mono font-bold transition-colors flex items-center justify-center"
              style={{
                width: 32, height: 40, fontSize: 12,
                ...keyStyle(key),
              }}
            >
              {key}
            </motion.button>
          ))}
          {ri === 2 && (
            <motion.button
              whileTap={{ scale: 0.90 }}
              onClick={onBackspace}
              className="rounded-md flex items-center justify-center transition-colors"
              style={{
                width: 44, height: 40, fontSize: 11,
                background: SURFACE,
                border: '1.5px solid rgba(255,255,255,0.08)',
                color: DIM,
              }}
            >
              ⌫
            </motion.button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Frequency analysis panel ─────────────────────────────────────────────────

function FrequencyPanel({ ciphertext, userMapping, reverseKey, onClose }: {
  ciphertext:  string
  userMapping: Record<string, string>
  reverseKey:  Record<string, string>
  onClose:     () => void
}) {
  const freqs    = useMemo(() => getFrequencies(ciphertext), [ciphertext])
  const maxCount = freqs[0]?.count ?? 1

  // Sort English frequencies for reference
  const enSorted = useMemo(() =>
    Object.entries(EN_FREQ).sort((a, b) => b[1] - a[1]).map(([l]) => l),
  [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl border p-4"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(24px)',
        borderColor: 'rgba(255,255,255,0.10)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
            Frequency Analysis
          </span>
        </div>
        <button onClick={onClose}>
          <X className="w-4 h-4 text-white/30 hover:text-white/60 transition-colors" />
        </button>
      </div>

      {/* Bars */}
      <div className="space-y-1 mb-3">
        {freqs.slice(0, 12).map(({ letter, count, pct }) => {
          const guess     = userMapping[letter]
          const isCorrect = guess && guess === reverseKey[letter]
          const barColor  = isCorrect ? GREEN : guess ? ACCENT : 'rgba(255,255,255,0.2)'
          return (
            <div key={letter} className="flex items-center gap-2">
              <span className="font-mono text-xs w-4 text-white/50">{letter}</span>
              <div className="flex-1 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / maxCount) * 100}%` }}
                  className="h-3 rounded-full"
                  style={{ background: barColor }}
                />
              </div>
              <span className="font-mono text-xs w-4 text-white/30">{guess || '?'}</span>
              <span className="font-mono text-[10px] w-8 text-right text-white/25">
                {(pct * 100).toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>

      {/* English reference */}
      <div className="border-t border-white/10 pt-2">
        <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1.5">
          English reference (most → least common)
        </p>
        <div className="flex flex-wrap gap-1">
          {enSorted.slice(0, 13).map(l => (
            <span key={l} className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Tutorial overlay ─────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to Cryptogram',
    body: 'Each letter in the puzzle has been replaced with a different letter. Your mission: decode the message.',
    demo: null,
  },
  {
    title: 'Click to select',
    body: 'Tap any cipher letter (bottom row) to select it. It will glow gold.',
    demo: 'select',
  },
  {
    title: 'Type your guess',
    body: 'Use the keyboard to assign a plain letter to your selection. Every occurrence updates instantly.',
    demo: 'type',
  },
  {
    title: 'One letter, one code',
    body: 'Each cipher letter always decodes to the same plain letter — and no two cipher letters decode to the same plain letter.',
    demo: null,
  },
  {
    title: 'Find patterns',
    body: 'Start with short words: single-letter words are almost always A or I. The frequency chart hints at E, T, A, O, N.',
    demo: null,
  },
]

function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const current = TUTORIAL_STEPS[step]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 p-6"
        style={{ background: 'rgba(6,10,18,0.97)' }}
      >
        {/* Step indicator */}
        <div className="flex gap-1.5 mb-5">
          {TUTORIAL_STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full flex-1 transition-all duration-300"
              style={{ background: i <= step ? ACCENT : 'rgba(255,255,255,0.12)' }}
            />
          ))}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2"
          style={{ color: ACCENT }}>
          Step {step + 1} of {TUTORIAL_STEPS.length}
        </p>
        <h3 className="text-white font-extrabold text-xl mb-3">{current.title}</h3>
        <p className="text-white/50 text-sm leading-relaxed mb-6">{current.body}</p>

        {/* Mini demo for step 1 */}
        {current.demo === 'select' && (
          <div className="flex gap-3 items-end mb-6 justify-center">
            {['X', 'Y', 'Z'].map((ch, i) => (
              <div key={ch} className="flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center font-mono text-sm font-bold mb-1"
                  style={{
                    border: i === 0 ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.12)',
                    color: i === 0 ? GOLD : 'transparent',
                    background: i === 0 ? `${GOLD}18` : 'transparent',
                  }}
                >
                  {i === 0 ? '?' : ''}
                </div>
                <div className="font-mono text-xs text-white/35 border-b border-white/15 w-8 text-center pb-1">
                  {ch}
                </div>
              </div>
            ))}
          </div>
        )}
        {current.demo === 'type' && (
          <div className="flex gap-3 items-end mb-6 justify-center">
            {[['T', 'X'], ['H', 'Y'], ['E', 'Z']].map(([plain, cipher], i) => (
              <motion.div
                key={cipher}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.3 }}
                className="flex flex-col items-center"
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center font-mono text-sm font-bold mb-1"
                  style={{
                    border: `1.5px solid ${GREEN}66`,
                    color: GREEN,
                    background: `${GREEN}18`,
                  }}
                >
                  {plain}
                </div>
                <div className="font-mono text-xs text-white/35 border-b border-white/15 w-8 text-center pb-1">
                  {cipher}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 rounded-full border border-white/10 py-2.5 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white/60 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => step < TUTORIAL_STEPS.length - 1 ? setStep(s => s + 1) : onDone()}
            className="flex-1 rounded-full py-2.5 text-xs font-bold uppercase tracking-widest text-black transition-all"
            style={{ background: ACCENT }}
          >
            {step === TUTORIAL_STEPS.length - 1 ? "Let's Play" : 'Next'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Stats screen ─────────────────────────────────────────────────────────────

function StatsScreen({ stats, onBack }: { stats: Stats; onBack: () => void }) {
  const rows: Array<{ label: string; value: string | number }> = [
    { label: 'Puzzles Solved',  value: stats.totalSolved },
    { label: 'Current Streak',  value: `${stats.currentStreak} 🔥` },
    { label: 'Best Streak',     value: stats.bestStreak },
    { label: 'Avg Solve Time',  value: stats.avgTimeSeconds > 0 ? `${stats.avgTimeSeconds}s` : '—' },
    { label: 'Best Time',       value: stats.bestTimeMs ? `${(stats.bestTimeMs / 1000).toFixed(1)}s` : '—' },
    { label: 'Hints Used',      value: stats.totalHintsUsed },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full max-w-sm mx-auto"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 transition-colors"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <h2 className="text-white font-extrabold text-2xl mb-1 tracking-tight">Statistics</h2>
      <p className="text-xs uppercase tracking-widest mb-6" style={{ color: ACCENT }}>
        Your solving history
      </p>

      <div className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(20px)' }}
      >
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
          >
            <span className="text-xs font-bold uppercase tracking-widest text-white/35">{label}</span>
            <span className="font-mono font-bold text-white">{value}</span>
          </div>
        ))}
      </div>

      {stats.lastSolvedDate && (
        <p className="text-center text-[10px] text-white/20 mt-4 font-mono">
          Last solved {stats.lastSolvedDate}
        </p>
      )}
    </motion.div>
  )
}

// ─── Win screen ───────────────────────────────────────────────────────────────

function WonScreen({
  game, elapsedMs, onNext, onMenu,
}: {
  game:      ActiveGame
  elapsedMs: number
  onNext:    () => void
  onMenu:    () => void
}) {
  const seconds = (elapsedMs / 1000).toFixed(1)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-sm mx-auto text-center"
    >
      {/* Glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 180, delay: 0.1 }}
        className="text-6xl mb-5"
      >
        🔓
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="font-extrabold text-3xl text-white mb-1 tracking-tight"
      >
        Decoded!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xs uppercase tracking-[0.25em] mb-6"
        style={{ color: ACCENT }}
      >
        Message deciphered
      </motion.p>

      {/* Solved quote */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-white/10 p-5 mb-5 text-left"
        style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(20px)' }}
      >
        <p className="text-white font-semibold text-sm leading-relaxed mb-3 italic">
          "{game.quote.text}"
        </p>
        <p className="text-xs font-bold" style={{ color: ACCENT }}>
          — {game.quote.author}
        </p>
        <p className="text-[10px] text-white/25 mt-0.5">{game.quote.source}</p>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-around mb-6"
      >
        {[
          { label: 'Time', value: `${seconds}s` },
          { label: 'Hints', value: game.hintsUsed },
          { label: 'Difficulty', value: DIFFICULTY_LABEL[game.quote.difficulty] },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">{label}</span>
            <span className="font-mono font-bold text-white text-lg">{value}</span>
          </div>
        ))}
      </motion.div>

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex gap-3"
      >
        <button
          onClick={onMenu}
          className="flex-1 rounded-full border border-white/10 py-3 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white hover:border-white/20 transition-all"
        >
          Menu
        </button>
        {game.mode === 'infinite' && (
          <button
            onClick={onNext}
            className="flex-1 rounded-full py-3 text-xs font-bold uppercase tracking-widest text-black flex items-center justify-center gap-2 transition-all"
            style={{ background: ACCENT }}
          >
            Next Puzzle <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CryptogramGame() {
  const [screen,     setScreen]     = useState<Screen>('menu')
  const [game,       setGame]       = useState<ActiveGame | null>(null)
  const [stats,      setStats]      = useState<Stats>(DEFAULT_STATS)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [showFreq,   setShowFreq]   = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [elapsedMs,  setElapsedMs]  = useState(0)
  const [solveFlash, setSolveFlash] = useState(false)

  // Undo history for userMapping
  const undoStack = useRef<Record<string, string>[]>([])

  // Navigation: list of cipher letters in order for keyboard navigation
  const cipherLetterOrder = useMemo(() =>
    game ? getUniqueCipherLetters(game.ciphertext) : [],
  [game])

  const audioRef = useRef<CryptogramAudio | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load stats on mount ──
  useEffect(() => {
    setStats(loadStats())
    audioRef.current = new CryptogramAudio()
    return () => {
      audioRef.current?.dispose()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Timer ──
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (screen === 'playing' && game) {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - game.startTime)
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [screen, game])

  // ── Start game ──
  const startGame = useCallback((mode: GameMode, infiniteIndex = 0) => {
    const { quote, cipherSeed } = mode === 'daily'
      ? getDailyPuzzle(difficulty)
      : getInfinitePuzzle(infiniteIndex)

    const { cipherKey, reverseKey } = buildCipherKey(cipherSeed)
    const ciphertext  = encodeText(quote.text, cipherKey)
    const hintsAllowed = DIFFICULTY_HINTS[quote.difficulty]

    const newGame: ActiveGame = {
      mode, infiniteIndex, quote, cipherSeed, ciphertext, reverseKey,
      userMapping: {}, selectedCipher: null,
      startTime: Date.now(), hintsUsed: 0, hintsAllowed,
    }
    undoStack.current = []
    setGame(newGame)
    setElapsedMs(0)
    setShowFreq(false)
    setScreen('playing')
    audioRef.current?.start()
  }, [difficulty])

  // ── Select a cipher letter ──
  const selectCipher = useCallback((cipher: string) => {
    if (!game) return
    audioRef.current?.playSelect()
    setGame(g => g ? { ...g, selectedCipher: g.selectedCipher === cipher ? null : cipher } : g)
  }, [game])

  // ── Input a plain letter guess ──
  const inputGuess = useCallback((plain: string) => {
    if (!game || !game.selectedCipher) return
    undoStack.current.push(game.userMapping)

    const newMapping = setGuess(game.selectedCipher, plain, game.userMapping)
    audioRef.current?.playKeyClick()

    // Auto-advance to next unsolved cipher letter
    const unique = getUniqueCipherLetters(game.ciphertext)
    const currentIdx = unique.indexOf(game.selectedCipher)
    let nextCipher: string | null = null
    for (let i = 1; i <= unique.length; i++) {
      const candidate = unique[(currentIdx + i) % unique.length]
      if (!newMapping[candidate]) { nextCipher = candidate; break }
    }

    const updated: ActiveGame = {
      ...game,
      userMapping: newMapping,
      selectedCipher: nextCipher ?? game.selectedCipher,
    }

    // Check completion
    const { solved } = checkCompletion(game.ciphertext, game.reverseKey, newMapping)
    if (solved) {
      handleSolve(updated)
      return
    }

    setGame(updated)
    saveProgress(updated)
  }, [game])

  // ── Backspace / clear ──
  const handleBackspace = useCallback(() => {
    if (!game || !game.selectedCipher) return
    undoStack.current.push(game.userMapping)
    const newMapping = clearGuess(game.selectedCipher, game.userMapping)
    audioRef.current?.playClear()
    const updated = { ...game, userMapping: newMapping }
    setGame(updated)
    saveProgress(updated)
  }, [game])

  // ── Undo ──
  const handleUndo = useCallback(() => {
    if (!game || undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    const updated = { ...game, userMapping: prev }
    setGame(updated)
    saveProgress(updated)
  }, [game])

  // ── Hint ──
  const handleHint = useCallback(() => {
    if (!game || game.hintsUsed >= game.hintsAllowed) return
    const candidates = getHintCandidates(game.ciphertext, game.reverseKey, game.userMapping)
    if (candidates.length === 0) return

    undoStack.current.push(game.userMapping)
    const target     = candidates[0]
    const newMapping = applyHint(target, game.reverseKey, game.userMapping)
    audioRef.current?.playHint()

    const updated: ActiveGame = {
      ...game,
      userMapping: newMapping,
      selectedCipher: target,
      hintsUsed: game.hintsUsed + 1,
    }

    const { solved } = checkCompletion(game.ciphertext, game.reverseKey, newMapping)
    if (solved) { handleSolve(updated); return }

    setGame(updated)
    saveProgress(updated)
  }, [game])

  // ── Reset puzzle ──
  const handleReset = useCallback(() => {
    if (!game) return
    undoStack.current = []
    const updated = { ...game, userMapping: resetMapping(), selectedCipher: null, startTime: Date.now() }
    setGame(updated)
    saveProgress(updated)
  }, [game])

  // ── Solve handler ──
  const handleSolve = useCallback((solvedGame: ActiveGame) => {
    const elapsed = Date.now() - solvedGame.startTime
    audioRef.current?.playSolve()
    setSolveFlash(true)
    setTimeout(() => setSolveFlash(false), 600)

    setGame({ ...solvedGame, userMapping: { ...solvedGame.userMapping } })
    setElapsedMs(elapsed)
    saveProgress(null)

    // Update stats
    setStats(prev => {
      const today         = new Date().toISOString().slice(0, 10)
      const isNewDay      = prev.lastSolvedDate !== today
      const newStreak     = isNewDay ? prev.currentStreak + 1 : prev.currentStreak
      const newAvg        = prev.totalSolved === 0
        ? Math.round(elapsed / 1000)
        : Math.round((prev.avgTimeSeconds * prev.totalSolved + elapsed / 1000) / (prev.totalSolved + 1))
      const next: Stats = {
        totalSolved:    prev.totalSolved + 1,
        currentStreak:  newStreak,
        bestStreak:     Math.max(prev.bestStreak, newStreak),
        totalHintsUsed: prev.totalHintsUsed + solvedGame.hintsUsed,
        avgTimeSeconds:  newAvg,
        lastSolvedDate: today,
        bestTimeMs:     prev.bestTimeMs === null ? elapsed : Math.min(prev.bestTimeMs, elapsed),
      }
      saveStats(next)
      return next
    })

    setTimeout(() => setScreen('won'), 700)
  }, [])

  // ── Keyboard navigation (desktop) ──
  useEffect(() => {
    if (screen !== 'playing' || !game) return

    const onKey = (e: KeyboardEvent) => {
      // Ignore if focus is in an input element
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return

      const key = e.key.toUpperCase()

      if (key === 'BACKSPACE' || key === 'DELETE') {
        e.preventDefault()
        handleBackspace()
        return
      }
      if (key === 'ESCAPE') {
        setGame(g => g ? { ...g, selectedCipher: null } : g)
        return
      }
      if (e.ctrlKey && key === 'Z') {
        e.preventDefault()
        handleUndo()
        return
      }

      // Letter input
      if (/^[A-Z]$/.test(key) && game.selectedCipher) {
        e.preventDefault()
        inputGuess(key)
        return
      }

      // Navigation with arrow keys
      if ((key === 'ARROWRIGHT' || key === 'TAB') && cipherLetterOrder.length > 0) {
        e.preventDefault()
        const idx = game.selectedCipher ? cipherLetterOrder.indexOf(game.selectedCipher) : -1
        const next = cipherLetterOrder[(idx + 1) % cipherLetterOrder.length]
        selectCipher(next)
        return
      }
      if (key === 'ARROWLEFT' && cipherLetterOrder.length > 0) {
        e.preventDefault()
        const idx = game.selectedCipher ? cipherLetterOrder.indexOf(game.selectedCipher) : 0
        const prev = cipherLetterOrder[(idx - 1 + cipherLetterOrder.length) % cipherLetterOrder.length]
        selectCipher(prev)
        return
      }

      // Click on a cipher letter by pressing its key if unassigned (quick-select)
      if (/^[A-Z]$/.test(key) && !game.selectedCipher) {
        e.preventDefault()
        selectCipher(key)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, game, cipherLetterOrder, inputGuess, handleBackspace, handleUndo, selectCipher])

  // ── Timer display ──
  const timerDisplay = useMemo(() => {
    const s = Math.floor(elapsedMs / 1000)
    const m = Math.floor(s / 60)
    return `${m}:${(s % 60).toString().padStart(2, '0')}`
  }, [elapsedMs])

  // ── Completion state ──
  const completionState = useMemo(() =>
    game ? checkCompletion(game.ciphertext, game.reverseKey, game.userMapping) : null,
  [game])

  // ─────────────────────────────── SCREENS ─────────────────────────────────────

  // ── MENU ──
  if (screen === 'menu') {
    return (
      <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center px-4 py-10"
        style={{ background: '#060a12' }}
      >
        <CipherRain />

        {/* Back to hub */}
        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition-colors"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Arcade
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: ACCENT }}>
              Code-Breaking Puzzle
            </div>
            <h1
              className="text-5xl sm:text-6xl font-extrabold tracking-[0.18em] uppercase mb-3"
              style={{
                fontFamily: 'var(--font-geist-mono)',
                background: `linear-gradient(135deg, #fff 20%, ${ACCENT} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              CRYPTO
              <br />
              GRAM
            </h1>
            <p className="text-white/30 text-sm leading-relaxed max-w-xs mx-auto">
              Decrypt famous quotes using pattern recognition and logical deduction.
            </p>
          </div>

          {/* Difficulty selector */}
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 text-center">
              Difficulty
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className="rounded-lg py-2 text-[11px] font-bold uppercase tracking-widest transition-all"
                  style={difficulty === d ? {
                    background: ACCENT,
                    color: '#060a12',
                  } : {
                    background: SURFACE,
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {DIFFICULTY_LABEL[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Main buttons */}
          <div className="flex flex-col gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => startGame('daily')}
              className="w-full rounded-2xl py-4 font-extrabold text-sm uppercase tracking-widest text-black flex items-center justify-center gap-3 shadow-lg transition-all"
              style={{ background: ACCENT, boxShadow: `0 8px 32px ${ACCENT}40` }}
            >
              📅  Daily Puzzle
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => startGame('infinite', 0)}
              className="w-full rounded-2xl py-4 font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all"
              style={{
                background: SURFACE,
                border: `1.5px solid ${ACCENT}30`,
                color: 'rgba(255,255,255,0.70)',
                backdropFilter: 'blur(12px)',
              }}
            >
              ∞  Infinite Mode
            </motion.button>

            <div className="flex gap-2">
              <button
                onClick={() => setShowTutorial(true)}
                className="flex-1 rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-all"
                style={{
                  background: SURFACE,
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.40)',
                }}
              >
                How to Play
              </button>
              <button
                onClick={() => setScreen('stats')}
                className="flex-1 rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-all"
                style={{
                  background: SURFACE,
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.40)',
                }}
              >
                Statistics
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tutorial overlay */}
        <AnimatePresence>
          {showTutorial && (
            <TutorialOverlay onDone={() => setShowTutorial(false)} />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── STATS ──
  if (screen === 'stats') {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-10"
        style={{ background: '#060a12' }}
      >
        <CipherRain />
        <div className="relative z-10 w-full max-w-sm">
          <StatsScreen stats={stats} onBack={() => setScreen('menu')} />
        </div>
      </div>
    )
  }

  // ── WON ──
  if (screen === 'won' && game) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-10"
        style={{ background: '#060a12' }}
      >
        {/* Green solve flash */}
        <AnimatePresence>
          {solveFlash && (
            <motion.div
              initial={{ opacity: 0.5 }} animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 pointer-events-none z-50"
              style={{ background: GREEN }}
            />
          )}
        </AnimatePresence>
        <div className="relative z-10 w-full">
          <WonScreen
            game={game}
            elapsedMs={elapsedMs}
            onNext={() => startGame('infinite', game.infiniteIndex + 1)}
            onMenu={() => setScreen('menu')}
          />
        </div>
      </div>
    )
  }

  // ── PLAYING ──
  if (screen !== 'playing' || !game) return null

  const { ciphertext, reverseKey, userMapping, selectedCipher, hintsUsed, hintsAllowed } = game
  const progress = completionState ?? { correctCount: 0, totalUnique: 1 }

  return (
    <div
      className="flex flex-col min-h-screen w-full"
      style={{ background: '#060a12' }}
    >
      {/* Solve flash */}
      <AnimatePresence>
        {solveFlash && (
          <motion.div
            initial={{ opacity: 0.6 }} animate={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50"
            style={{ background: GREEN }}
          />
        )}
      </AnimatePresence>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => { setScreen('menu'); saveProgress(game) }}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition-colors"
          style={{ color: 'rgba(255,255,255,0.30)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Menu
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold" style={{ color: ACCENT }}>
            {CATEGORY_LABEL[game.quote.category]}
          </span>
          <span className="text-white/15">·</span>
          <span className="text-xs text-white/30">{DIFFICULTY_LABEL[game.quote.difficulty]}</span>
        </div>

        <div className="font-mono text-xs font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {timerDisplay}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">

          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5">
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                {progress.correctCount} / {progress.totalUnique} decoded
              </span>
              <span style={{ color: ACCENT }}>
                {Math.round((progress.correctCount / Math.max(progress.totalUnique, 1)) * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <motion.div
                className="h-1.5 rounded-full"
                animate={{
                  width: `${(progress.correctCount / Math.max(progress.totalUnique, 1)) * 100}%`,
                }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ background: `linear-gradient(90deg, ${ACCENT}, ${GREEN})` }}
              />
            </div>
          </div>

          {/* Puzzle board */}
          <div
            className="rounded-2xl border p-4 sm:p-5 mb-4"
            style={{
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(20px)',
              borderColor: 'rgba(255,255,255,0.08)',
              boxShadow: solveFlash ? `0 0 40px ${GREEN}40` : undefined,
            }}
          >
            <PuzzleBoard
              ciphertext={ciphertext}
              userMapping={userMapping}
              reverseKey={reverseKey}
              selectedCipher={selectedCipher}
              onSelect={selectCipher}
            />
          </div>

          {/* Author attribution (faint) */}
          <p className="text-[10px] text-white/20 text-right mb-4 font-mono tracking-wide">
            — {game.quote.author}
          </p>

          {/* Action buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowFreq(f => !f)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all flex-1"
              style={showFreq ? {
                background: `${ACCENT}18`,
                border: `1.5px solid ${ACCENT}60`,
                color: ACCENT,
              } : {
                background: SURFACE,
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Frequency
            </button>

            <button
              onClick={handleHint}
              disabled={hintsUsed >= hintsAllowed}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all flex-1 disabled:opacity-35 disabled:cursor-not-allowed"
              style={{
                background: SURFACE,
                border: `1px solid rgba(255,255,255,0.08)`,
                color: hintsUsed < hintsAllowed ? GOLD : 'rgba(255,255,255,0.25)',
              }}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Hint {hintsAllowed > 0 ? `(${hintsAllowed - hintsUsed})` : '(0)'}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all"
              style={{
                background: SURFACE,
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.30)',
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Frequency panel */}
          <AnimatePresence>
            {showFreq && (
              <FrequencyPanel
                ciphertext={ciphertext}
                userMapping={userMapping}
                reverseKey={reverseKey}
                onClose={() => setShowFreq(false)}
              />
            )}
          </AnimatePresence>

          {/* Desktop hint: undo */}
          <p className="text-[10px] text-white/15 text-center mb-2 hidden sm:block">
            Arrow keys to navigate · Type to fill · Ctrl+Z to undo
          </p>
        </div>
      </div>

      {/* ── Pinned keyboard ── */}
      <div
        className="flex-shrink-0 px-3 py-3 border-t"
        style={{
          background: 'rgba(0,0,0,0.70)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <CipherKeyboard
          userMapping={userMapping}
          reverseKey={reverseKey}
          selectedCipher={selectedCipher}
          onKey={inputGuess}
          onBackspace={handleBackspace}
        />
      </div>
    </div>
  )
}
