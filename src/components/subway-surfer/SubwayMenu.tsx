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
  background: 'linear-gradient(180deg, rgba(38,116,210,0.95) 0%, rgba(16,52,120,0.97) 100%)',
  border: '4px solid rgba(255,255,255,0.4)',
  borderRadius: 26,
  boxShadow: '0 14px 50px rgba(0,10,40,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
  padding: '32px 38px',
  textAlign: 'center',
  maxWidth: 410,
  width: '90%',
}

const TITLE: React.CSSProperties = {
  ...CHUNKY,
  fontSize: 56,
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
  lineHeight: 0.92,
  color: '#ffd84d',
  textShadow: '0 4px 0 #b8761a, 0 8px 0 rgba(10,24,60,0.6), 0 12px 26px rgba(0,0,0,0.45)',
  marginBottom: 6,
  transform: 'rotate(-2.5deg)',
}

const SUBTITLE: React.CSSProperties = {
  ...CHUNKY,
  color: '#a8e4ff',
  fontSize: 13,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  marginBottom: 24,
  textShadow: '0 2px 0 rgba(10,24,60,0.6)',
}

const BTN: React.CSSProperties = {
  ...CHUNKY,
  background: 'linear-gradient(180deg,#ffe26b 0%,#ffc31e 55%,#f0a800 100%)',
  border: '4px solid rgba(255,255,255,0.75)',
  borderRadius: 999,
  color: '#7a4a00',
  cursor: 'pointer',
  fontSize: 24,
  letterSpacing: '0.1em',
  padding: '15px 40px',
  textTransform: 'uppercase',
  width: '100%',
  marginTop: 4,
  textShadow: '0 1px 0 rgba(255,255,255,0.5)',
  boxShadow: '0 6px 0 #b87a10, 0 11px 22px rgba(0,10,30,0.4)',
  animation: 'rrPulse 1.1s ease-in-out infinite',
}

const HINT: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
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
  background: 'rgba(0,12,40,0.5)',
  border: '2px solid rgba(255,255,255,0.18)',
  borderRadius: 14,
  padding: '10px 6px',
}

const STAT_LABEL: React.CSSProperties = {
  ...CHUNKY,
  color: 'rgba(160,210,255,0.75)',
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
      style={{ background: 'rgba(4,12,32,0.4)', backdropFilter: 'blur(3px)' }}
    >
      <style>{`
        @keyframes rrPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.035); }
        }
      `}</style>
      <div style={PANEL}>
        {isGameOver ? (
          <>
            <div style={{ ...TITLE, fontSize: 42, color: '#ff6b4a', textShadow: '0 4px 0 #98301a, 0 8px 0 rgba(10,24,60,0.6)' }}>
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
              <div style={{ ...CHUNKY, color: '#ffd84d', fontSize: 15, marginBottom: 16 }}>
                Best: {highScore.toLocaleString()}
              </div>
            )}
            <div
              style={{
                ...STAT_BOX,
                textAlign: 'left',
                marginBottom: 14,
                color: 'rgba(225,240,255,0.92)',
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 18,
              }}
            >
              {[
                { icon: '🧲', label: 'Magnet' },
                { icon: '🚀', label: 'Jetpack' },
                { icon: '×2', label: 'Score' },
                { icon: '👟', label: 'Jump+' },
              ].map(p => (
                <div
                  key={p.label}
                  style={{
                    flex: 1,
                    background: 'rgba(0,12,40,0.5)',
                    border: '2px solid rgba(255,255,255,0.16)',
                    borderRadius: 12,
                    padding: '7px 2px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#ffd84d' }}>{p.icon}</div>
                  <div style={{ color: 'rgba(190,220,255,0.8)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>
                    {p.label}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <button style={BTN} onClick={onStart}>
          {isGameOver ? '↻ Run Again' : '▶ Tap to Play'}
        </button>
        <div style={HINT}>
          {isGameOver ? 'or press Space / tap' : 'or press Space to start'}
        </div>
      </div>
    </div>
  )
}
