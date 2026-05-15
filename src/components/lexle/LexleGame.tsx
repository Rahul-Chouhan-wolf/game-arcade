'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Tile, TileState, GameSettings } from '@/lib/lexle/types'
import { WIN_MSGS } from '@/lib/lexle/constants'
import { CATEGORY_DATA } from '@/lib/lexle/categories'
import { evaluateGuess, checkHardMode } from '@/lib/lexle/evaluate'
import { useLayout } from '@/hooks/useLayout'
import { useWordPool } from '@/hooks/useWordPool'
import { Board } from './Board'
import { Keyboard } from './Keyboard'
import { Toast } from './Toast'
import { HelpModal } from './HelpModal'
import { SettingsModal } from './SettingsModal'
import { GameModal } from './GameModal'
import { Scratchpad, ScratchpadHandle } from './Scratchpad'

type GameStatus = 'playing' | 'won' | 'lost'

function makeEmptyBoard(rows: number, cols: number): Tile[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ letter: '', state: 'empty' as TileState }))
  )
}

export function LexleGame() {
  const [settings, setSettings] = useState<GameSettings>({
    wordLength: 5,
    difficulty: 'normal',
    category: 'any',
    maxGuesses: 6,
  })

  const { layout, recompute } = useLayout(settings.wordLength, settings.maxGuesses)
  const wordPool = useWordPool()

  // Game state
  const [target, setTarget] = useState('')
  const [board, setBoard] = useState<Tile[][]>(() => makeEmptyBoard(6, 5))
  const [currentRow, setCurrentRow] = useState(0)
  const [currentCol, setCurrentCol] = useState(0)
  const [keyMap, setKeyMap] = useState<Record<string, TileState>>({})
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing')
  const [isRevealing, setIsRevealing] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [hardCorrect, setHardCorrect] = useState<Record<number, string>>({})
  const [hardPresent, setHardPresent] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; persist: boolean } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGameModal, setShowGameModal] = useState(false)
  const [modalWon, setModalWon] = useState(false)
  const [guessCount, setGuessCount] = useState(0)
  const [shakingRow, setShakingRow] = useState<number | null>(null)
  const [bouncingRow, setBouncingRow] = useState<number | null>(null)
  const [flippingTiles, setFlippingTiles] = useState<Map<string, 'first' | 'second'>>(new Map())
  const [scratchVisible, setScratchVisible] = useState(false)
  const [scratchFocused, setScratchFocused] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const usedWords = useRef<Set<string>>(new Set())
  const scratchpadRef = useRef<ScratchpadHandle>(null)

  // Refs for mutable game state used in callbacks
  const boardRef = useRef(board)
  const currentRowRef = useRef(currentRow)
  const currentColRef = useRef(currentCol)
  const gameStatusRef = useRef(gameStatus)
  const isRevealingRef = useRef(isRevealing)
  const isValidatingRef = useRef(isValidating)
  const targetRef = useRef(target)
  const settingsRef = useRef(settings)
  const hardCorrectRef = useRef(hardCorrect)
  const hardPresentRef = useRef(hardPresent)

  boardRef.current = board
  currentRowRef.current = currentRow
  currentColRef.current = currentCol
  gameStatusRef.current = gameStatus
  isRevealingRef.current = isRevealing
  isValidatingRef.current = isValidating
  targetRef.current = target
  settingsRef.current = settings
  hardCorrectRef.current = hardCorrect
  hardPresentRef.current = hardPresent

  const showToast = useCallback((msg: string, persist = false) => {
    setToast({ msg, persist })
    if (!persist) {
      setTimeout(() => setToast(null), 1800 + 280)
    }
  }, [])

  const shakeRow = useCallback((r: number) => {
    setShakingRow(r)
    setTimeout(() => setShakingRow(null), 400)
  }, [])

  const bounceRow = useCallback((r: number) => {
    setBouncingRow(r)
    setTimeout(() => setBouncingRow(null), 500 + (settingsRef.current.wordLength - 1) * 75)
  }, [])

  const revealRow = useCallback((r: number, tiles: Tile[], onDone: () => void) => {
    setIsRevealing(true)
    isRevealingRef.current = true
    let done = 0
    const wl = tiles.length
    tiles.forEach((tile, c) => {
      const key = `${r}-${c}`
      setTimeout(() => {
        // Phase 1: flip down
        setFlippingTiles(prev => new Map(prev).set(key, 'first'))
        setTimeout(() => {
          // Update board state for this tile
          setBoard(prev => {
            const next = prev.map(row => [...row])
            next[r][c] = tile
            return next
          })
          // Phase 2: flip up
          setFlippingTiles(prev => new Map(prev).set(key, 'second'))
          setTimeout(() => {
            setFlippingTiles(prev => {
              const next = new Map(prev)
              next.delete(key)
              return next
            })
            done++
            if (done === wl) {
              setIsRevealing(false)
              isRevealingRef.current = false
              onDone()
            }
          }, 155)
        }, 155)
      }, c * 300)
    })
  }, [])

  const resetGame = useCallback((newSettings?: GameSettings) => {
    const s = newSettings ?? settingsRef.current
    const newTarget = wordPool.getRandomWord(s.wordLength, s.category, usedWords.current)
    setTarget(newTarget)
    targetRef.current = newTarget
    setBoard(makeEmptyBoard(s.maxGuesses, s.wordLength))
    setCurrentRow(0)
    setCurrentCol(0)
    setKeyMap({})
    setGameStatus('playing')
    gameStatusRef.current = 'playing'
    setIsRevealing(false)
    isRevealingRef.current = false
    setIsValidating(false)
    isValidatingRef.current = false
    setHardCorrect({})
    setHardPresent(new Set())
    setToast(null)
    setShowGameModal(false)
    setShakingRow(null)
    setBouncingRow(null)
    setFlippingTiles(new Map())
    recompute()
  }, [wordPool, recompute])

  const submitGuess = useCallback(async () => {
    const row = currentRowRef.current
    const col = currentColRef.current
    const s = settingsRef.current

    if (col < s.wordLength) {
      shakeRow(row)
      showToast('Not enough letters')
      return
    }

    const word = boardRef.current[row].map(t => t.letter).join('').toLowerCase()

    if (s.difficulty === 'hard') {
      const err = checkHardMode(word, hardCorrectRef.current, hardPresentRef.current)
      if (err) {
        shakeRow(row)
        showToast(err)
        return
      }
    }

    setIsValidating(true)
    isValidatingRef.current = true
    const valid = await wordPool.isValidWord(word)
    setIsValidating(false)
    isValidatingRef.current = false

    if (!valid) {
      shakeRow(row)
      showToast('Not in dictionary')
      return
    }

    const tiles = evaluateGuess(word, targetRef.current)
    const won = tiles.every(t => t.state === 'correct')

    revealRow(row, tiles, () => {
      // Update keyMap
      const rank: Record<TileState, number> = { correct: 3, present: 2, absent: 1, tbd: 0, empty: 0 }
      setKeyMap(prev => {
        const next = { ...prev }
        tiles.forEach(({ letter, state }) => {
          if (!next[letter] || rank[state] > rank[next[letter]]) {
            next[letter] = state
          }
        })
        return next
      })

      // Update hard mode state
      if (s.difficulty === 'hard') {
        setHardCorrect(prev => {
          const next = { ...prev }
          tiles.forEach(({ letter, state }, i) => {
            if (state === 'correct') next[i] = letter
          })
          return next
        })
        setHardPresent(prev => {
          const next = new Set(prev)
          tiles.forEach(({ letter, state }) => {
            if (state === 'present') next.add(letter)
          })
          return next
        })
      }

      const newRow = row + 1
      setCurrentRow(newRow)
      currentRowRef.current = newRow
      setCurrentCol(0)
      currentColRef.current = 0

      if (won) {
        setGameStatus('won')
        gameStatusRef.current = 'won'
        showToast(WIN_MSGS[Math.min(row, WIN_MSGS.length - 1)])
        bounceRow(row)
        setTimeout(() => {
          setGuessCount(newRow)
          setModalWon(true)
          setShowGameModal(true)
        }, 1600)
      } else if (newRow >= s.maxGuesses) {
        setGameStatus('lost')
        gameStatusRef.current = 'lost'
        showToast(targetRef.current.toUpperCase(), true)
        setTimeout(() => {
          setGuessCount(newRow)
          setModalWon(false)
          setShowGameModal(true)
        }, 1600)
      }
    })
  }, [wordPool, revealRow, shakeRow, showToast, bounceRow])

  const typeGameLetter = useCallback((letter: string) => {
    const row = currentRowRef.current
    const col = currentColRef.current
    const s = settingsRef.current
    if (col >= s.wordLength) return

    setBoard(prev => {
      const next = prev.map(r => [...r])
      next[row][col] = { letter, state: 'tbd' }
      return next
    })
    setCurrentCol(col + 1)
    currentColRef.current = col + 1
  }, [])

  const deleteGameLetter = useCallback(() => {
    const row = currentRowRef.current
    const col = currentColRef.current
    if (col === 0) return

    const newCol = col - 1
    setBoard(prev => {
      const next = prev.map(r => [...r])
      next[row][newCol] = { letter: '', state: 'empty' }
      return next
    })
    setCurrentCol(newCol)
    currentColRef.current = newCol
  }, [])

  const handleGameKey = useCallback((key: string) => {
    if (gameStatusRef.current !== 'playing' || isRevealingRef.current || isValidatingRef.current) return
    if (key === 'ENTER') { submitGuess(); return }
    if (key === '⌫' || key === 'BACKSPACE') { deleteGameLetter(); return }
    if (/^[A-Z]$/.test(key)) typeGameLetter(key)
  }, [submitGuess, deleteGameLetter, typeGameLetter])

  // Keyboard event listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key === 'Enter'     ? 'ENTER'
                : e.key === 'Backspace' ? 'BACKSPACE'
                : e.key === 'Escape'    ? 'ESCAPE'
                : /^[a-zA-Z]$/.test(e.key) ? e.key.toUpperCase()
                : null
      if (!key) return
      // Try scratchpad first if focused
      if (scratchFocused && scratchVisible && scratchpadRef.current?.handleKey) {
        if (scratchpadRef.current.handleKey(key)) return
      }
      if (key !== 'ESCAPE') handleGameKey(key)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleGameKey, scratchFocused, scratchVisible])

  // Initial load
  useEffect(() => {
    wordPool.preCacheAllCategories()
    wordPool.fetchPool(5).then(() => {
      setTimeout(() => {
        setInitialLoading(false)
        // Reset game now that pool is loaded
        const newTarget = wordPool.getRandomWord(5, 'any', usedWords.current)
        setTarget(newTarget)
        targetRef.current = newTarget
        setBoard(makeEmptyBoard(6, 5))
        setCurrentRow(0); currentRowRef.current = 0
        setCurrentCol(0); currentColRef.current = 0
        setKeyMap({})
        setGameStatus('playing'); gameStatusRef.current = 'playing'
        recompute()
      }, 900)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplySettings = useCallback(async (newSettings: GameSettings) => {
    // Fetch pool for new length if needed
    if (newSettings.wordLength !== settings.wordLength) {
      await wordPool.fetchPool(newSettings.wordLength)
    }
    setSettings(newSettings)
    settingsRef.current = newSettings
    setShowSettings(false)
    usedWords.current.clear()
    // Reset scratchpad word length handled by Scratchpad component itself
    const newTarget = wordPool.getRandomWord(newSettings.wordLength, newSettings.category, usedWords.current)
    setTarget(newTarget)
    targetRef.current = newTarget
    setBoard(makeEmptyBoard(newSettings.maxGuesses, newSettings.wordLength))
    setCurrentRow(0); currentRowRef.current = 0
    setCurrentCol(0); currentColRef.current = 0
    setKeyMap({})
    setGameStatus('playing'); gameStatusRef.current = 'playing'
    setIsRevealing(false); isRevealingRef.current = false
    setIsValidating(false); isValidatingRef.current = false
    setHardCorrect({})
    setHardPresent(new Set())
    setToast(null)
    setShowGameModal(false)
    setShakingRow(null)
    setBouncingRow(null)
    setFlippingTiles(new Map())
    recompute()
  }, [settings.wordLength, wordPool, recompute])

  const handleNewWord = useCallback(() => {
    usedWords.current.clear()
    resetGame()
  }, [resetGame])

  if (initialLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0f0f10',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          zIndex: 100,
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(1.8rem, 8vw, 2.5rem)',
            fontWeight: 800,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #fff 30%, #818384 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >Lexle</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['#538d4e', '#b59f3b', '#818384'].map((color, i) => (
              <div
                key={i}
                className="animate-dot"
                style={{
                  width: 12,
                  height: 12,
                  background: color,
                  borderRadius: '50%',
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </div>
          <p style={{ color: '#818384', fontSize: '0.875rem', letterSpacing: '0.05em' }}>
            {wordPool.loadingStatus}
          </p>
        </div>
      </div>
    )
  }

  const categoryData = settings.category !== 'any' ? CATEGORY_DATA[settings.category] : null

  return (
    <div
      style={{
        background: '#0f0f10',
        color: '#fff',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overscrollBehavior: 'none',
        WebkitTapHighlightColor: 'transparent',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Header */}
      <header
        style={{
          width: '100%',
          maxWidth: 540,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #3a3a3c',
          flexShrink: 0,
        }}
      >
        {/* Left buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Link
            href="/"
            aria-label="Back to Arcade"
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: '#818384', textDecoration: 'none' }}
            className="hover:text-white hover:bg-[#1a1a1c] transition-colors"
          >
            <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </Link>
          <button
            aria-label="How to play"
            onClick={() => setShowHelp(true)}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: '#818384', cursor: 'pointer' }}
            className="hover:text-white hover:bg-[#1a1a1c] transition-colors"
          >
            <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
            </svg>
          </button>
          <button
            aria-label="Settings"
            onClick={() => setShowSettings(true)}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: '#818384', cursor: 'pointer' }}
            className="hover:text-white hover:bg-[#1a1a1c] transition-colors"
          >
            <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a6.94 6.94 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.47.47 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
          </button>
        </div>

        {/* Center title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          <h1
            style={{
              fontSize: 'clamp(1.1rem, 5vw, 1.5rem)',
              fontWeight: 800,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              background: 'linear-gradient(135deg, #fff 30%, #818384 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.2,
            }}
          >Lexle</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {settings.difficulty === 'hard' && (
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#c84b4b', border: '1px solid #c84b4b', padding: '2px 6px', borderRadius: 9999 }}>
                Hard
              </span>
            )}
            {categoryData && (
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#b59f3b', border: '1px solid #b59f3b', padding: '2px 6px', borderRadius: 9999 }}>
                {categoryData.label}
              </span>
            )}
          </div>
        </div>

        {/* Right buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            aria-label="Scratchpad"
            onClick={() => setScratchVisible(v => !v)}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: '#818384', cursor: 'pointer' }}
            className="hover:text-white hover:bg-[#1a1a1c] transition-colors"
          >
            <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button
            aria-label="New word"
            onClick={handleNewWord}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: '#538d4e', color: '#fff', cursor: 'pointer' }}
            className="hover:bg-[#6aaf65] active:scale-95 transition-all"
          >
            <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Toast */}
      <div style={{ width: '100%', maxWidth: 540, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 36, pointerEvents: 'none', flexShrink: 0 }}>
        <Toast message={toast?.msg ?? null} persist={toast?.persist ?? false} />
      </div>

      {/* Board */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 0 }}>
        <Board
          board={board}
          wordLength={settings.wordLength}
          maxGuesses={settings.maxGuesses}
          tileSize={layout.tileSize}
          tileFontSize={layout.tileFontSize}
          shakingRow={shakingRow}
          bouncingRow={bouncingRow}
          flippingTiles={flippingTiles}
        />
      </main>

      {/* Keyboard */}
      <div style={{ width: '100%', maxWidth: 540, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '0 4px', paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))', gap: 5 }}>
        <div style={{ textAlign: 'right', fontSize: '0.42rem', color: '#666680', letterSpacing: '0.08em', paddingRight: 4, paddingBottom: 2 }}>
          v1.0 · Rahul Chouhan
        </div>
        <Keyboard
          keyMap={keyMap}
          keyH={layout.keyH}
          keyFontSize={layout.keyFontSize}
          onKey={handleGameKey}
        />
      </div>

      {/* Validating overlay */}
      {isValidating && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64 }}
        >
          <div style={{ background: '#1a1a1c', border: '1px solid #3a3a3c', color: '#818384', fontSize: '0.75rem', fontWeight: 700, padding: '8px 16px', borderRadius: 9999, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg className="animate-spin" style={{ width: 12, height: 12, color: '#b59f3b' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            Checking word…
          </div>
        </div>
      )}

      {/* Modals */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onApply={handleApplySettings}
        loading={wordPool.loading}
      />
      <GameModal
        open={showGameModal}
        won={modalWon}
        guessCount={guessCount}
        target={target}
        onClose={() => setShowGameModal(false)}
        onNext={() => { usedWords.current.clear(); resetGame() }}
        fetchDefinition={wordPool.fetchDefinition}
      />

      {/* Scratchpad */}
      <Scratchpad
        ref={scratchpadRef}
        visible={scratchVisible}
        onClose={() => setScratchVisible(false)}
        wordLength={settings.wordLength}
        tileSz={layout.scratchTileSz}
        isMobile={layout.isMobile}
        onFocusChange={setScratchFocused}
      />
    </div>
  )
}
