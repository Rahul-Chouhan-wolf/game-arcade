'use client'

import { useEffect, useState } from 'react'
import { Definition } from '@/lib/lexle/types'
import { POS_COLORS } from '@/lib/lexle/constants'

interface GameModalProps {
  open: boolean
  won: boolean
  guessCount: number
  target: string
  onClose: () => void
  onNext: () => void
  fetchDefinition: (word: string) => Promise<Definition[] | null>
}

export function GameModal({ open, won, guessCount, target, onClose, onNext, fetchDefinition }: GameModalProps) {
  const [defs, setDefs] = useState<Definition[] | null | 'loading'>('loading')

  useEffect(() => {
    if (!open || !target) return
    setDefs('loading')
    fetchDefinition(target).then(d => setDefs(d))
  }, [open, target, fetchDefinition])

  if (!open) return null

  const tileSize = Math.max(36, Math.min(48, Math.floor((Math.min(typeof window !== 'undefined' ? window.innerWidth : 400, 400) - 32 - (target.length - 1) * 6) / target.length)))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-modal-in bg-[#1a1a1c] border border-[#3a3a3c] rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 64px)' }}
      >
        <div className="text-5xl mb-3">{won ? '🎉' : '😔'}</div>
        <h2 className="text-xl font-extrabold text-white mb-1">{won ? 'You got it!' : 'Better luck next time'}</h2>
        <p className="text-[#818384] text-sm mb-4">
          {won
            ? `Solved in ${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'}`
            : 'The word was'}
        </p>

        {/* Word tiles */}
        <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
          {target.toUpperCase().split('').map((l, i) => (
            <div
              key={i}
              style={{
                width: tileSize,
                height: tileSize,
                background: '#538d4e',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: tileSize * 0.45,
                fontWeight: 800,
              }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* Definition */}
        <div className="mb-5 text-left bg-[#0f0f10] rounded-xl p-4 flex flex-col gap-3 min-h-16">
          {defs === 'loading' ? (
            <div className="flex items-center gap-2 text-[#555] text-xs">
              <svg className="animate-spin w-3 h-3 flex-shrink-0 text-[#b59f3b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              Loading definition…
            </div>
          ) : !defs ? (
            <div>
              <p className="text-[#818384] text-xs italic mb-2">
                No definition found for &quot;<strong className="text-white">{target}</strong>&quot;.
              </p>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`meaning of ${target}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-white bg-[#1e3a5f] hover:bg-[#1a4f8a] border border-[#2a5a9f] px-3 py-2 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"/>
                </svg>
                Search Google for &quot;<span className="text-[#6fa8dc]">{target}</span>&quot;
              </a>
            </div>
          ) : (
            defs.map(({ pos, definition, example }, i) => {
              const color = POS_COLORS[pos] ?? '#818384'
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{pos}</span>
                    <div className="flex-1 h-px bg-[#2a2a2c]" />
                  </div>
                  <p className="text-[#ccc] text-sm leading-relaxed">{definition}</p>
                  {example && <p className="text-[#555] text-xs italic mt-0.5">&quot;{example}&quot;</p>}
                </div>
              )
            })
          )}
        </div>

        <button
          onClick={onNext}
          className="w-full bg-[#538d4e] hover:bg-[#6aaf65] active:scale-95 text-white font-bold text-sm py-3 rounded-xl transition-all tracking-wide uppercase"
        >
          Next Word →
        </button>
        <p className="text-[#555] text-xs mt-3">or tap outside to continue</p>
      </div>
    </div>
  )
}
