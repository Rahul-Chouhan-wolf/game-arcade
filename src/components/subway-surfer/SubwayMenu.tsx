"use client"

import type { GamePhase } from './types'

interface Props {
  phase: GamePhase
  score: number
  highScore: number
  onStart: () => void
}

const PANEL: React.CSSProperties = {
  background: 'rgba(8,8,28,0.88)',
  border: '1px solid rgba(0,229,255,0.25)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
  padding: '36px 48px',
  textAlign: 'center',
  maxWidth: 380,
  width: '90%',
  fontFamily: 'monospace',
}

const TITLE: React.CSSProperties = {
  fontSize: 48,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  background: 'linear-gradient(135deg,#00e5ff 0%,#7c3aed 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  lineHeight: 1.1,
  marginBottom: 8,
}

const SUBTITLE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.45)',
  fontSize: 12,
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  marginBottom: 28,
}

const BTN: React.CSSProperties = {
  background: 'linear-gradient(135deg,#00e5ff,#7c3aed)',
  border: 'none',
  borderRadius: 10,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: '0.15em',
  padding: '14px 40px',
  textTransform: 'uppercase',
  width: '100%',
  marginTop: 8,
}

const HINT: React.CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: 11,
  letterSpacing: '0.1em',
  marginTop: 16,
}

const STAT_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 24,
  gap: 16,
}

const STAT_BOX: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '10px 8px',
}

export function SubwayMenu({ phase, score, highScore, onStart }: Props) {
  if (phase === 'playing' || phase === 'paused') return null

  const isGameOver = phase === 'gameover'

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: isGameOver ? 'blur(2px)' : 'none' }}
    >
      <div style={PANEL} className="pointer-events-auto">
        {isGameOver ? (
          <>
            <div style={{ ...TITLE, fontSize: 38, marginBottom: 4 }}>Game Over</div>
            <div style={SUBTITLE}>Rail Runner</div>
            <div style={STAT_ROW}>
              <div style={STAT_BOX}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', marginBottom: 4 }}>SCORE</div>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{score.toLocaleString()}</div>
              </div>
              <div style={STAT_BOX}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', marginBottom: 4 }}>BEST</div>
                <div style={{ color: '#ffd700', fontSize: 22, fontWeight: 800 }}>{highScore.toLocaleString()}</div>
              </div>
            </div>
            {score >= highScore && score > 0 && (
              <div style={{ color: '#ffd700', fontSize: 12, letterSpacing: '0.2em', marginBottom: 12 }}>
                ★ NEW HIGH SCORE ★
              </div>
            )}
          </>
        ) : (
          <>
            <div style={TITLE}>Rail<br />Runner</div>
            <div style={SUBTITLE}>Endless runner · Arcade</div>
            {highScore > 0 && (
              <div style={{ color: '#ffd700', fontSize: 13, marginBottom: 20 }}>
                Best: {highScore.toLocaleString()}
              </div>
            )}
            <div style={{
              ...STAT_BOX,
              textAlign: 'left',
              marginBottom: 24,
              color: 'rgba(255,255,255,0.55)',
              fontSize: 12,
              lineHeight: 1.8,
            }}>
              <div>← → or A/D — change lane</div>
              <div>↑ or Space — jump</div>
              <div>↓ or S — roll</div>
              <div>Swipe on mobile</div>
            </div>
          </>
        )}
        <button style={BTN} onClick={onStart}>
          {isGameOver ? 'Try Again' : 'Play'}
        </button>
        <div style={HINT}>
          {isGameOver ? 'or press Space / tap' : 'or press Space / tap to start'}
        </div>
      </div>
    </div>
  )
}
