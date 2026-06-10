"use client"

import type { GamePhase } from './types'

interface Props {
  score: number
  coins: number
  distance: number
  phase: GamePhase
  onPause: () => void
}

export function SubwayHUD({ score, coins, distance, phase, onPause }: Props) {
  if (phase !== 'playing') return null

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10">
      {/* Score — top right */}
      <div
        className="absolute top-4 right-5 text-right"
        style={{ fontFamily: 'monospace' }}
      >
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Score</div>
        <div style={{ color: '#fff', fontSize: 28, fontWeight: 900, lineHeight: 1, textShadow: '0 0 12px rgba(0,229,255,0.7)' }}>
          {score.toLocaleString()}
        </div>
      </div>

      {/* Coins — top left */}
      <div className="absolute top-4 left-5" style={{ fontFamily: 'monospace' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Coins</div>
        <div style={{ color: '#ffd700', fontSize: 22, fontWeight: 800, lineHeight: 1, textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>
          ● {coins}
        </div>
      </div>

      {/* Distance — top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center" style={{ fontFamily: 'monospace' }}>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Distance</div>
        <div style={{ color: '#a5f3fc', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
          {Math.floor(distance)}m
        </div>
      </div>

      {/* Pause button — pointer-events on */}
      <button
        onClick={onPause}
        className="pointer-events-auto absolute top-3 right-36"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          color: 'rgba(255,255,255,0.6)',
          fontSize: 13,
          padding: '4px 10px',
          cursor: 'pointer',
          letterSpacing: '0.1em',
        }}
      >
        ⏸
      </button>
    </div>
  )
}
