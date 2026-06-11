"use client"

import type { GamePhase } from './types'

interface Props {
  score: number
  coins: number
  distance: number
  phase: GamePhase
  onPause: () => void
}

const CHUNKY: React.CSSProperties = {
  fontFamily: "'Arial Black', system-ui, sans-serif",
  fontStyle: 'italic',
  WebkitTextStroke: '1px rgba(20,30,60,0.85)',
}

export function SubwayHUD({ score, coins, distance, phase, onPause }: Props) {
  if (phase !== 'playing') return null

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10">
      {/* Score — top right */}
      <div className="absolute top-3 right-4 text-right">
        <div
          style={{
            ...CHUNKY,
            color: '#fff',
            fontSize: 34,
            fontWeight: 900,
            lineHeight: 1,
            textShadow: '0 3px 0 rgba(20,30,60,0.7), 0 5px 12px rgba(0,0,0,0.35)',
          }}
        >
          {score.toLocaleString()}
        </div>
        <div
          style={{
            ...CHUNKY,
            color: '#ffd84d',
            fontSize: 20,
            fontWeight: 900,
            marginTop: 6,
            textShadow: '0 2px 0 rgba(120,70,0,0.7)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 16, height: 16,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #ffe98a, #f2b418 65%, #c8850a)',
              border: '2px solid #a86e08',
              marginRight: 6,
              verticalAlign: '-2px',
            }}
          />
          {coins}
        </div>
      </div>

      {/* Distance — top left, below pause */}
      <div className="absolute top-3 left-16">
        <div
          style={{
            ...CHUNKY,
            color: 'rgba(255,255,255,0.92)',
            fontSize: 17,
            fontWeight: 900,
            textShadow: '0 2px 0 rgba(20,30,60,0.6)',
          }}
        >
          {Math.floor(distance)}m
        </div>
      </div>

      {/* Pause button */}
      <button
        onClick={onPause}
        className="pointer-events-auto absolute top-2.5 left-3"
        style={{
          width: 38, height: 38,
          background: 'linear-gradient(180deg,#5ba8e8,#2f6fc0)',
          border: '2px solid rgba(255,255,255,0.65)',
          borderRadius: 10,
          color: '#fff',
          fontSize: 16,
          fontWeight: 900,
          cursor: 'pointer',
          boxShadow: '0 3px 0 rgba(20,40,90,0.55)',
        }}
        aria-label="Pause"
      >
        ❚❚
      </button>
    </div>
  )
}
