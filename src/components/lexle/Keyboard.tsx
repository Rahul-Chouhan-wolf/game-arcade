'use client'

import { TileState } from '@/lib/lexle/types'
import { KEYBOARD_ROWS } from '@/lib/lexle/constants'

interface KeyboardProps {
  keyMap: Record<string, TileState>
  keyH: number
  keyFontSize: string
  onKey: (key: string) => void
}

function getKeyStyle(key: string, state: TileState | undefined, keyH: number, keyFontSize: string): React.CSSProperties {
  const wide = key === 'ENTER' || key === '⌫'
  let bg = '#818384'
  let color = '#fff'
  if (state === 'correct')      { bg = '#538d4e' }
  else if (state === 'present') { bg = '#b59f3b' }
  else if (state === 'absent')  { bg = '#3a3a3c'; color = '#555' }

  return {
    height: keyH,
    borderRadius: 6,
    fontWeight: 700,
    fontSize: wide ? '0.7rem' : keyFontSize,
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    background: bg,
    color,
    transition: 'transform .07s, background .2s',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    flex: wide ? 1.6 : 1,
    minWidth: wide ? 56 : 24,
    maxWidth: wide ? 72 : undefined,
  }
}

export function Keyboard({ keyMap, keyH, keyFontSize, onKey }: KeyboardProps) {
  return (
    <div
      aria-label="Keyboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', maxWidth: 540 }}
    >
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
          {row.map(key => (
            <button
              key={key}
              onPointerDown={e => { e.preventDefault(); onKey(key) }}
              style={getKeyStyle(key, keyMap[key], keyH, keyFontSize)}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
