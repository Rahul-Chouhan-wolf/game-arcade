'use client'

import { useState, useRef, useCallback } from 'react'
import { Definition } from '@/lib/lexle/types'
import { CATEGORY_DATA } from '@/lib/lexle/categories'
import { FALLBACK } from '@/lib/lexle/fallback'
import { DATAMUSE_BASE, DATAMUSE_SUFFIX, DICTIONARY_URL } from '@/lib/lexle/constants'

interface WordPoolHook {
  pools: Record<number, string[]>
  loading: boolean
  loadingStatus: string
  fetchPool: (len: number) => Promise<string[]>
  isValidWord: (word: string) => Promise<boolean>
  fetchDefinition: (word: string) => Promise<Definition[] | null>
  getRandomWord: (wordLength: number, category: string, usedWords: Set<string>) => string
  preCacheAllCategories: () => void
}

function parseDef(data: unknown[]): Definition[] | null {
  if (!Array.isArray(data) || !(data[0] as { meanings?: unknown }).meanings) return null
  const entry = data[0] as { meanings: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }> }
  const out: Definition[] = []
  for (const m of entry.meanings) {
    const d = m.definitions?.[0]
    if (!d) continue
    out.push({ pos: m.partOfSpeech, definition: d.definition, example: d.example || undefined })
    if (out.length >= 3) break
  }
  return out.length ? out : null
}

export function useWordPool(): WordPoolHook {
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Fetching words…')
  const poolsByLength = useRef<Record<number, string[]>>({})
  const validationCache = useRef<Map<string, boolean>>(new Map())
  const definitionCache = useRef<Map<string, unknown[]>>(new Map())
  const [pools, setPools] = useState<Record<number, string[]>>({})

  const preCacheAllCategories = useCallback(() => {
    for (const cat of Object.values(CATEGORY_DATA)) {
      if (!cat.words) continue
      for (const wordList of Object.values(cat.words)) {
        for (const w of wordList) validationCache.current.set(w.toLowerCase(), true)
      }
    }
  }, [])

  const fetchPool = useCallback(async (len: number): Promise<string[]> => {
    if (poolsByLength.current[len]) return poolsByLength.current[len]
    const sp = '?'.repeat(len)
    setLoadingStatus(`Fetching ${len}-letter words…`)
    setLoading(true)
    try {
      const res = await fetch(`${DATAMUSE_BASE}${sp}${DATAMUSE_SUFFIX}`)
      if (!res.ok) throw new Error('bad response')
      const data = await res.json() as Array<{ word: string }>
      const words = data.map(w => w.word.toLowerCase()).filter(w => /^[a-z]+$/.test(w) && w.length === len)
      if (words.length < 20) throw new Error('too few')
      words.forEach(w => validationCache.current.set(w, true))
      poolsByLength.current[len] = words
      setPools(prev => ({ ...prev, [len]: words }))
      return words
    } catch {
      const fb = FALLBACK[len] || []
      poolsByLength.current[len] = [...fb]
      fb.forEach(w => validationCache.current.set(w, true))
      setPools(prev => ({ ...prev, [len]: poolsByLength.current[len] }))
      return poolsByLength.current[len]
    } finally {
      setLoading(false)
    }
  }, [])

  const isValidWord = useCallback(async (word: string): Promise<boolean> => {
    const lower = word.toLowerCase()
    if (validationCache.current.has(lower)) return validationCache.current.get(lower)!
    try {
      const res = await fetch(`${DICTIONARY_URL}${encodeURIComponent(lower)}`)
      const ok = res.ok
      if (ok) {
        const d = await res.json()
        definitionCache.current.set(lower, d)
      }
      validationCache.current.set(lower, ok)
      return ok
    } catch {
      validationCache.current.set(lower, true)
      return true
    }
  }, [])

  const fetchDefinition = useCallback(async (word: string): Promise<Definition[] | null> => {
    const lower = word.toLowerCase()
    if (definitionCache.current.has(lower)) return parseDef(definitionCache.current.get(lower)!)
    try {
      const res = await fetch(`${DICTIONARY_URL}${encodeURIComponent(lower)}`)
      if (!res.ok) return null
      const d = await res.json()
      definitionCache.current.set(lower, d)
      return parseDef(d)
    } catch {
      return null
    }
  }, [])

  const getRandomWord = useCallback((wordLength: number, category: string, usedWords: Set<string>): string => {
    let pool: string[]
    if (category !== 'any') {
      const catData = CATEGORY_DATA[category as keyof typeof CATEGORY_DATA]
      const catWords = catData?.words?.[wordLength as keyof typeof catData.words] as string[] | undefined
      if (catWords && catWords.length >= 4) {
        pool = catWords
      } else {
        pool = poolsByLength.current[wordLength] || FALLBACK[wordLength] || []
      }
    } else {
      pool = poolsByLength.current[wordLength] || FALLBACK[wordLength] || []
    }
    const remaining = pool.filter(w => !usedWords.has(w))
    const src = remaining.length ? remaining : pool
    if (!remaining.length) usedWords.clear()
    const w = src[Math.floor(Math.random() * src.length)]
    usedWords.add(w)
    // Ensure the word is marked as valid
    validationCache.current.set(w.toLowerCase(), true)
    return w
  }, [])

  return {
    pools,
    loading,
    loadingStatus,
    fetchPool,
    isValidWord,
    fetchDefinition,
    getRandomWord,
    preCacheAllCategories,
  }
}
