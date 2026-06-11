"use client"

import type { GamePhase } from './types'

interface Props {
  phase: GamePhase
  score: number
  coins: number
  highScore: number
  onStart: () => void
}

const CHUNKY: React.CSSProperties = {
  fontFamily: "'Arial Black', system-ui, sans-serif",
  fontStyle: 'italic',
  fontWeight: 900,
}

const PANEL: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(24,52,110,0.94) 0%, rgba(14,30,68,0.96) 100%)',
  border: '3px solid rgba(255,255,255,0.25)',
  borderRadius: 22,
  boxShadow: '0 10px 40px rgba(0,10,40,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
  padding: '34px 42px',
  textAlign: 'center',
  maxWidth: 400,
  width: '90%',
}

const TITLE: React.CSSProperties = {
  ...CHUNKY,
  fontSize: 52,
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
  lineHeight: 0.95,
  color: '#ffd84d',
  textShadow: '0 4px 0 #b8761a, 0 7px 0 rgba(20,30,60,0.55), 0 10px 22px rgba(0,0,0,0.4)',
  marginBottom: 6,
  transform: 'rotate(-2deg)',
}

const SUBTITLE: React.CSSProperties = {
  ...CHUNKY,
  color: '#8fd4ff',
  fontSize: 13,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  marginBottom: 26,
  textShadow: '0 2px 0 rgba(20,30,60,0.6)',
}

const BTN: React.CSSProperties = {
  ...CHUNKY,
  background: 'linear-gradient(180deg,#8ee04a 0%,#4cb820 55%,#3da214 100%)',
  border: '3px solid rgba(255,255,255,0.55)',
  borderRadius: 999,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 22,
  letterSpacing: '0.12em',
  padding: '14px 40px',
  textTransform: 'uppercase',
  width: '100%',
  marginTop: 6,
  textShadow: '0 2px 0 rgba(30,80,10,0.7)',
  boxShadow: '0 5px 0 #2a7a0c, 0 9px 18px rgba(0,20,0,0.35)',
}

const HINT: React.CSSProperties = {
  color: 'rgba(255,255,255,0.45)',
  fontSize: 11,
  letterSpacing: '0.1em',
  marginTop: 14,
  fontFamily: 'system-ui, sans-serif',
}

const STAT_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 20,
  gap: 12,
}

const STAT_BOX: React.CSSProperties = {
  flex: 1,
  background: 'rgba(0,12,40,0.45)',
  border: '2px solid rgba(255,255,255,0.14)',
  borderRadius: 12,
  padding: '10px 6px',
}

const STAT_LABEL: React.CSSProperties = {
  ...CHUNKY,
  color: 'rgba(160,200,255,0.7)',
  fontSize: 10,
  letterSpacing: '0.2em',
  marginBottom: 4,
}

function Coin({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size, height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #ffe98a, #f2b418 65%, #c8850a)',
        border: '2px solid #a86e08',
        marginRight: 5,
        verticalAlign: '-2px',
      }}
    />
  )
}

export function SubwayMenu({ phase, score, coins, highScore, onStart }: Props) {
  if (phase === 'playing' || phase === 'paused') return null

  const isGameOver = phase === 'gameover'

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20"
      style={{ background: 'rgba(4,12,32,0.45)', backdropFilter: 'blur(3px)' }}
    >
      <div style={PANEL}>
        {isGameOver ? (
          <>
            <div style={{ ...TITLE, fontSize: 40, color: '#ff6b4a', textShadow: '0 4px 0 #98301a, 0 7px 0 rgba(20,30,60,0.55)' }}>
              Wipeout!
            </div>
            <div style={SUBTITLE}>Rail Runner</div>
            <div style={STAT_ROW}>
              <div style={STAT_BOX}>
                <div style={STAT_LABEL}>SCORE</div>
                <div style={{ ...CHUNKY, color: '#fff', fontSize: 24 }}>{score.toLocaleString()}</div>
              </div>
              <div style={STAT_BOX}>
                <div style={STAT_LABEL}>COINS</div>
                <div style={{ ...CHUNKY, color: '#ffd84d', fontSize: 24 }}><Coin />{coins}</div>
              </div>
              <div style={STAT_BOX}>
                <div style={STAT_LABEL}>BEST</div>
                <div style={{ ...CHUNKY, color: '#8ee04a', fontSize: 24 }}>{highScore.toLocaleString()}</div>
              </div>
            </div>
            {score >= highScore && score > 0 && (
              <div style={{ ...CHUNKY, color: '#ffd84d', fontSize: 15, marginBottom: 12, textShadow: '0 2px 0 rgba(120,70,0,0.6)' }}>
                ★ NEW HIGH SCORE! ★
              </div>
            )}
          </>
        ) : (
          <>
            <div style={TITLE}>Rail<br />Runner</div>
            <div style={SUBTITLE}>Dodge the trains!</div>
            {highScore > 0 && (
              <div style={{ ...CHUNKY, color: '#ffd84d', fontSize: 15, marginBottom: 18 }}>
                Best: {highScore.toLocaleString()}
              </div>
            )}
            <div
              style={{
                ...STAT_BOX,
                textAlign: 'left',
                marginBottom: 20,
                color: 'rgba(220,236,255,0.85)',
                fontSize: 13,
                lineHeight: 2,
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 600,
                padding: '12px 18px',
              }}
            >
              <div>⬅️ ➡️ &nbsp;Change lane</div>
              <div>⬆️ / Space &nbsp;Jump the barriers</div>
              <div>⬇️ &nbsp;Roll under the bars</div>
              <div>🚇 &nbsp;Never beat a train — dodge it!</div>
            </div>
          </>
        )}
        <button style={BTN} onClick={onStart}>
          {isGameOver ? '↻ Run Again' : '▶ Play'}
        </button>
        <div style={HINT}>
          {isGameOver ? 'or press Space / tap' : 'or press Space / tap to start'}
        </div>
      </div>
    </div>
  )
}
