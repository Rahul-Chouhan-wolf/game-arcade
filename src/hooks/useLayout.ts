'use client'

import { useState, useEffect, useCallback } from 'react'
import { Layout } from '@/lib/lexle/types'
import { MAX_SIZES } from '@/lib/lexle/constants'

const DEFAULT_LAYOUT: Layout = {
  tileSize: 62,
  tileFontSize: '29px',
  keyH: 48,
  keyFontSize: '0.85rem',
  isMobile: false,
  scratchTileSz: 36,
}

export function useLayout(wordLength: number, maxGuesses: number): { layout: Layout; recompute: () => void } {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)

  const compute = useCallback(() => {
    if (typeof window === 'undefined') return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const isMobile = vw < 480

    const headerH = 52
    const toastH = 36
    const kbRows = 3
    const kbGap = 5
    const keyH = Math.max(38, Math.min(58, Math.floor(vh * 0.075)))
    const kbTotalH = kbRows * keyH + (kbRows - 1) * kbGap + 8
    const vertBuffer = 12

    const availW = Math.min(vw, 540) - 24
    const availH = vh - headerH - toastH - kbTotalH - vertBuffer

    const hGaps = (wordLength - 1) * 6
    const vGaps = (maxGuesses - 1) * 6
    const fromWidth = Math.floor((availW - hGaps) / wordLength)
    const fromHeight = Math.floor((availH - vGaps) / maxGuesses)
    const maxSz = MAX_SIZES[wordLength] ?? 62
    const tileSize = Math.max(28, Math.min(fromWidth, fromHeight, maxSz))

    const tileFontSize = Math.round(Math.max(14, tileSize * 0.47)) + 'px'
    const keyFontSize = Math.max(0.65, Math.min(0.85, vw / 480 * 0.85)) + 'rem'

    const scratchPanelW = isMobile ? vw - 24 : Math.min(vw - 24, 360)
    const scratchPad = 24
    const scratchDelBtn = 36
    const scratchGaps = (wordLength - 1) * 4
    const scratchTileSz = Math.max(26, Math.min(40, Math.floor((scratchPanelW - scratchPad * 2 - scratchDelBtn - scratchGaps) / wordLength)))

    setLayout({ tileSize, tileFontSize, keyH, keyFontSize, isMobile, scratchTileSz })
  }, [wordLength, maxGuesses])

  useEffect(() => {
    compute()
    let timer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(compute, 150)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
    }
  }, [compute])

  return { layout, recompute: compute }
}
