"use client"

import type { GamePhase } from './types'
import type { PowerupType } from '@/lib/subway-surfer/powerups'
import { powerupGlyph, POWERUP_TINT } from './icons'

// Reuses the exact glyph art rendered on the in-world 3D pickup chips.
function PowerIcon({ kind, size }: { kind: PowerupType; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: 'block' }}
      dangerouslySetInnerHTML={{
        __html: `<rect x="6" y="6" width="88" height="88" rx="20" fill="${POWERUP_TINT[kind]}"/>${powerupGlyph(kind)}`,
      }}
    />
  )
}

export interface HudPowerup {
  type: PowerupType
  frac: number   // remaining fraction 0..1
}

interface Props {
  score: number
  coins: number
  distance: number
  powerups: HudPowerup[]
  multiplier: number
  phase: GamePhase
  onPause: () => void
}

const CHUNKY: React.CSSProperties = {
  fontFamily: "'Arial Black', system-ui, sans-serif",
  fontStyle: 'italic',
  WebkitTextStroke: '1px rgba(20,30,60,0.85)',
}

const POWER_META: Record<PowerupType, { color: string; label: string }> = {
  magnet:     { color: '#ff8a70', label: 'Magnet' },
  jetpack:    { color: '#7ab8ff', label: 'Jetpack' },
  multiplier: { color: '#ffd84d', label: 'Score ×2' },
  sneakers:   { color: '#7de8a0', label: 'Sneakers' },
}

export function SubwayHUD({ score, coins, distance, powerups, multiplier, phase, onPause }: Props) {
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
          {multiplier > 1 && (
            <span style={{ color: '#ffd84d', fontSize: 22, marginRight: 8, verticalAlign: '4px' }}>×2</span>
          )}
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

      {/* Distance — top left, beside pause */}
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

      {/* Active powerup chips with countdown bars — bottom left */}
      <div className="absolute bottom-5 left-4 flex flex-col gap-2">
        {powerups.map(p => {
          const meta = POWER_META[p.type]
          return (
            <div
              key={p.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(10,22,52,0.78)',
                border: `2px solid ${meta.color}`,
                borderRadius: 12,
                padding: '6px 12px 6px 8px',
                minWidth: 130,
                boxShadow: `0 0 14px ${meta.color}55`,
              }}
            >
              <PowerIcon kind={p.type} size={26} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    ...CHUNKY,
                    WebkitTextStroke: '0px',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    marginBottom: 3,
                  }}
                >
                  {meta.label}
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.18)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(0, Math.min(1, p.frac)) * 100}%`,
                      borderRadius: 3,
                      background: meta.color,
                      transition: 'width 0.1s linear',
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
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
