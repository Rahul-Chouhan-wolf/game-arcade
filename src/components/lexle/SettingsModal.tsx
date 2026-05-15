'use client'

import { useState } from 'react'
import { GameSettings, Difficulty, Category, WordLength } from '@/lib/lexle/types'
import { CATEGORY_DATA } from '@/lib/lexle/categories'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  settings: GameSettings
  onApply: (s: GameSettings) => Promise<void>
  loading: boolean
}

const LENGTHS: WordLength[] = [4, 5, 6, 7]
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy · 8 tries' },
  { value: 'normal', label: 'Normal · 6 tries' },
  { value: 'hard', label: 'Hard · use hints' },
]
const CATEGORIES: Category[] = ['any', 'animals', 'countries', 'fruits', 'foods', 'sports', 'colors']

export function SettingsModal({ open, onClose, settings, onApply, loading }: SettingsModalProps) {
  const [pending, setPending] = useState<GameSettings>(settings)

  // Sync pending when settings change (e.g. on open)
  if (!open) return null

  const warn = pending.category !== 'any'
    ? (() => {
        const catData = CATEGORY_DATA[pending.category]
        const words = catData?.words?.[pending.wordLength] as string[] | undefined
        if (!words || words.length < 4) {
          return `⚠ Not enough ${catData?.label ?? ''} words at length ${pending.wordLength}. Will fall back to Any.`
        }
        return null
      })()
    : null

  const pillClass = (active: boolean, danger = false) =>
    `inline-flex items-center justify-center px-3 py-1 rounded-full border-2 font-bold cursor-pointer transition-all text-xs whitespace-nowrap select-none ${
      active
        ? danger
          ? 'border-transparent bg-[#c84b4b] text-white'
          : 'border-transparent bg-[#538d4e] text-white'
        : 'border-[#3a3a3c] bg-transparent text-[#818384] hover:border-[#818384] hover:text-white'
    }`

  const handleApply = async () => {
    const next: GameSettings = {
      ...pending,
      maxGuesses: pending.difficulty === 'easy' ? 8 : 6,
    }
    await onApply(next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-modal-in bg-[#1a1a1c] border border-[#3a3a3c] rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 64px)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-extrabold tracking-widest uppercase text-white">Settings</h2>
          <button onClick={onClose} className="text-[#818384] hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* Word Length */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#818384] mb-2">Word Length</p>
          <div className="flex gap-2 flex-wrap">
            {LENGTHS.map(len => (
              <button
                key={len}
                className={pillClass(pending.wordLength === len)}
                onClick={() => setPending(p => ({ ...p, wordLength: len }))}
              >
                {len} letters
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#818384] mb-2">Difficulty</p>
          <div className="flex gap-2 flex-wrap">
            {DIFFICULTIES.map(d => (
              <button
                key={d.value}
                className={pillClass(pending.difficulty === d.value, d.value === 'hard')}
                onClick={() => setPending(p => ({ ...p, difficulty: d.value }))}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#818384] mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={pillClass(pending.category === cat)}
                onClick={() => setPending(p => ({ ...p, category: cat }))}
              >
                {CATEGORY_DATA[cat].emoji} {CATEGORY_DATA[cat].label}
              </button>
            ))}
          </div>
          {warn && <p className="mt-2 text-xs text-[#c84b4b]">{warn}</p>}
        </div>

        <button
          onClick={handleApply}
          disabled={loading}
          className="w-full bg-[#538d4e] hover:bg-[#6aaf65] active:scale-95 text-white font-bold py-3 rounded-xl transition-all uppercase tracking-wide text-sm disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Apply & New Game'}
        </button>
      </div>
    </div>
  )
}
