'use client'

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'

export interface ScratchpadHandle {
  handleKey: (key: string) => boolean
}

interface ScratchpadProps {
  visible: boolean
  onClose: () => void
  wordLength: number
  tileSz: number
  isMobile: boolean
  onFocusChange?: (hasFocus: boolean) => void
}

interface RoughFocus {
  row: number
  col: number
}

const MAX_SCRATCH_ROWS = 5

export const Scratchpad = forwardRef<ScratchpadHandle, ScratchpadProps>(function Scratchpad({ visible, onClose, wordLength, tileSz, isMobile, onFocusChange }, ref) {
  const [rows, setRows] = useState<string[][]>(() => [Array(wordLength).fill('')])
  const [roughFocus, setRoughFocus] = useState<RoughFocus | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const wasDragged = useRef(false)

  // Notify parent of focus changes
  useEffect(() => {
    onFocusChange?.(roughFocus !== null)
  }, [roughFocus, onFocusChange])

  // Reset rows when wordLength changes
  useEffect(() => {
    setRows(prev => prev.map(() => Array(wordLength).fill('')))
    setRoughFocus(null)
  }, [wordLength])

  // Click outside clears focus
  useEffect(() => {
    if (!visible) return
    const handler = (e: MouseEvent) => {
      if (roughFocus !== null && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setRoughFocus(null)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [visible, roughFocus])

  // Drag handling
  useEffect(() => {
    if (isMobile) return
    const panel = panelRef.current
    if (!panel) return

    const startDrag = (cx: number, cy: number) => {
      isDragging.current = true
      wasDragged.current = true
      const rect = panel.getBoundingClientRect()
      dragOffset.current = { x: cx - rect.left, y: cy - rect.top }
      panel.style.bottom = 'auto'
      panel.style.right = 'auto'
      panel.style.left = `${rect.left}px`
      panel.style.top = `${rect.top}px`
    }

    const moveDrag = (cx: number, cy: number) => {
      if (!isDragging.current) return
      const rect = panel.getBoundingClientRect()
      const maxX = window.innerWidth - rect.width
      const maxY = window.innerHeight - rect.height
      panel.style.left = `${Math.max(0, Math.min(cx - dragOffset.current.x, maxX))}px`
      panel.style.top  = `${Math.max(0, Math.min(cy - dragOffset.current.y, maxY))}px`
    }

    const onMouseDown = (e: MouseEvent) => { e.preventDefault(); startDrag(e.clientX, e.clientY) }
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY)
    const onMouseUp = () => { isDragging.current = false }
    const onTouchStart = (e: TouchEvent) => { startDrag(e.touches[0].clientX, e.touches[0].clientY) }
    const onTouchMove = (e: TouchEvent) => moveDrag(e.touches[0].clientX, e.touches[0].clientY)
    const onTouchEnd = () => { isDragging.current = false }

    const handle = panel.querySelector('.scratch-drag-handle') as HTMLElement | null
    handle?.addEventListener('mousedown', onMouseDown)
    handle?.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      handle?.removeEventListener('mousedown', onMouseDown)
      handle?.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [isMobile, visible])

  // Reset position when settings change / panel opens
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !visible) return
    if (!wasDragged.current || isMobile) {
      if (isMobile) {
        panel.style.top = 'auto'
        panel.style.left = '8px'
        panel.style.right = '8px'
        panel.style.bottom = '80px'
        panel.style.width = 'auto'
      } else {
        panel.style.top = 'auto'
        panel.style.left = 'auto'
        panel.style.right = '12px'
        panel.style.bottom = '90px'
      }
    }
  }, [visible, isMobile])

  const handleKey = useCallback((key: string): boolean => {
    if (!roughFocus) return false
    const { row, col } = roughFocus

    if (/^[A-Z]$/.test(key)) {
      setRows(prev => {
        const next = prev.map(r => [...r])
        next[row][col] = key
        return next
      })
      setRoughFocus(col + 1 < wordLength ? { row, col: col + 1 } : { row, col })
      return true
    }
    if (key === 'BACKSPACE') {
      setRows(prev => {
        const next = prev.map(r => [...r])
        if (next[row][col]) {
          next[row][col] = ''
        } else if (col > 0) {
          next[row][col - 1] = ''
          setRoughFocus({ row, col: col - 1 })
        }
        return next
      })
      return true
    }
    if (key === 'ESCAPE') { setRoughFocus(null); return true }
    if (key === 'ENTER') {
      const nextRow = row + 1
      setRoughFocus(nextRow < rows.length ? { row: nextRow, col: 0 } : null)
      return true
    }
    return false
  }, [roughFocus, wordLength, rows.length])

  // Expose handleKey to parent via forwardRef
  useImperativeHandle(ref, () => ({ handleKey }), [handleKey])

  if (!visible) return null

  const addRow = () => {
    if (rows.length >= MAX_SCRATCH_ROWS) return
    setRows(prev => [...prev, Array(wordLength).fill('')])
  }

  const deleteRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
    setRoughFocus(prev => {
      if (!prev) return null
      if (prev.row === idx) return null
      if (prev.row > idx) return { row: prev.row - 1, col: prev.col }
      return prev
    })
  }

  const panelStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', bottom: 80, left: 8, right: 8, zIndex: 30 }
    : { position: 'fixed', bottom: 90, right: 12, zIndex: 30, maxWidth: 'calc(100vw - 24px)' }

  return (
    <div
      ref={panelRef}
      style={panelStyle}
      className="bg-[#1a1a1c] border border-[#3a3a3c] rounded-2xl shadow-2xl animate-modal-in"
    >
      {/* Header / Drag handle */}
      <div
        className="scratch-drag-handle flex items-center justify-between px-4 py-2.5 border-b border-[#3a3a3c] rounded-t-2xl select-none"
        style={{ cursor: isMobile ? 'default' : 'grab' }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-[#555]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest text-[#818384]">Scratchpad</span>
        </div>
        <button
          onClick={onClose}
          className="text-[#818384] hover:text-white text-lg leading-none transition-colors ml-4 w-7 h-7 flex items-center justify-center"
        >✕</button>
      </div>

      {/* Rows */}
      <div className="px-3 py-2.5 flex flex-col gap-2">
        {rows.map((tileRow, ri) => (
          <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {tileRow.map((letter, ci) => {
                const focused = roughFocus?.row === ri && roughFocus?.col === ci
                return (
                  <div
                    key={ci}
                    onClick={e => { e.stopPropagation(); setRoughFocus({ row: ri, col: ci }) }}
                    style={{
                      width: tileSz,
                      height: tileSz,
                      fontSize: Math.round(Math.max(11, tileSz * 0.37)),
                      border: focused ? '2px solid #538d4e' : letter ? '2px solid #565758' : '2px solid #3a3a3c',
                      background: focused ? '#0f2b1e' : 'transparent',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      color: '#fff',
                      transition: 'border-color .1s',
                      flexShrink: 0,
                    }}
                  >
                    {letter}
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => deleteRow(ri)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: '#2a1a1a',
                color: '#c84b4b',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >×</button>
          </div>
        ))}
      </div>

      {/* Add row button */}
      <div className="px-3 pb-3">
        <button
          onClick={addRow}
          disabled={rows.length >= MAX_SCRATCH_ROWS}
          className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-[#3a3a3c] hover:border-[#818384] rounded-xl py-2 text-[#555] hover:text-[#818384] text-sm font-bold transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <span className="text-base leading-none">+</span> Add Row
        </button>
      </div>
    </div>
  )
})

export type { RoughFocus }
