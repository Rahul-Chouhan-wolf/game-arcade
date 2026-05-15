'use client'

import { Tile } from '@/lib/lexle/types'

interface BoardProps {
  board: Tile[][]
  wordLength: number
  maxGuesses: number
  tileSize: number
  tileFontSize: string
  shakingRow: number | null
  bouncingRow: number | null
  flippingTiles: Map<string, 'first' | 'second'>
}

function getTileStyle(tile: Tile): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    textTransform: 'uppercase',
    borderRadius: 4,
    border: '2px solid',
    flexShrink: 0,
    userSelect: 'none',
  }
  if (tile.state === 'correct') return { ...base, background: '#538d4e', borderColor: '#538d4e', color: '#fff' }
  if (tile.state === 'present') return { ...base, background: '#b59f3b', borderColor: '#b59f3b', color: '#fff' }
  if (tile.state === 'absent')  return { ...base, background: '#3a3a3c', borderColor: '#3a3a3c', color: '#555' }
  if (tile.state === 'tbd')     return { ...base, background: 'transparent', borderColor: '#565758', color: '#fff' }
  return { ...base, background: 'transparent', borderColor: '#3a3a3c', color: '#fff' }
}

export function Board({
  board,
  wordLength,
  maxGuesses,
  tileSize,
  tileFontSize,
  shakingRow,
  bouncingRow,
  flippingTiles,
}: BoardProps) {
  return (
    <div
      role="grid"
      aria-label="Game board"
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {Array.from({ length: maxGuesses }, (_, r) => {
        const isShaking = shakingRow === r
        const isBouncing = bouncingRow === r
        return (
          <div
            key={r}
            className={isShaking ? 'animate-shake' : ''}
            style={{ display: 'flex', gap: 6 }}
          >
            {Array.from({ length: wordLength }, (_, c) => {
              const tile = board[r]?.[c] ?? { letter: '', state: 'empty' as const }
              const key = `${r}-${c}`
              const flipPhase = flippingTiles.get(key)
              const tileStyle = getTileStyle(tile)
              const isTbd = tile.state === 'tbd' && tile.letter !== ''

              let transform: string | undefined
              let transition: string | undefined
              if (flipPhase === 'first') {
                transform = 'rotateX(-90deg)'
                transition = 'transform 0.15s ease-in-out'
              } else if (flipPhase === 'second') {
                transform = 'rotateX(0deg)'
                transition = 'transform 0.15s ease-in-out'
              }

              const bounceDelay = isBouncing ? `${c * 75}ms` : undefined

              return (
                <div
                  key={c}
                  className={[
                    isTbd ? 'animate-pop' : '',
                    isBouncing ? 'animate-tile-bounce' : '',
                  ].filter(Boolean).join(' ')}
                  style={{
                    ...tileStyle,
                    width: tileSize,
                    height: tileSize,
                    fontSize: tileFontSize,
                    transform,
                    transition,
                    animationDelay: bounceDelay,
                  }}
                >
                  {tile.letter}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
