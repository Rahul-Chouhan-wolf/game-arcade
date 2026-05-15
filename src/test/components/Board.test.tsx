import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Board } from '@/components/lexle/Board'
import type { Tile } from '@/lib/lexle/types'

function makeBoard(rows: number, cols: number): Tile[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ letter: '', state: 'empty' as const }))
  )
}

const defaultProps = {
  wordLength: 5,
  maxGuesses: 6,
  tileSize: 52,
  tileFontSize: '24px',
  shakingRow: null,
  bouncingRow: null,
  flippingTiles: new Map<string, 'first' | 'second'>(),
}

describe('Board', () => {
  it('renders the correct number of rows and tiles', () => {
    const board = makeBoard(6, 5)
    render(<Board board={board} {...defaultProps} />)
    const grid = screen.getByRole('grid')
    // 6 rows × 5 tiles = 30 cells
    const rows = grid.children
    expect(rows).toHaveLength(6)
    expect(rows[0].children).toHaveLength(5)
  })

  it('renders a 4-letter board', () => {
    const board = makeBoard(6, 4)
    render(<Board board={board} {...defaultProps} wordLength={4} />)
    const rows = screen.getByRole('grid').children
    expect(rows[0].children).toHaveLength(4)
  })

  it('displays letters in tiles', () => {
    const board = makeBoard(6, 5)
    board[0][0] = { letter: 'C', state: 'tbd' }
    board[0][1] = { letter: 'R', state: 'tbd' }
    render(<Board board={board} {...defaultProps} />)
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
  })

  it('applies shake animation class to the shaking row', () => {
    const board = makeBoard(6, 5)
    const { container } = render(<Board board={board} {...defaultProps} shakingRow={2} />)
    const grid = container.querySelector('[role="grid"]')!
    const rows = Array.from(grid.children)
    expect(rows[2].className).toContain('animate-shake')
    expect(rows[0].className).not.toContain('animate-shake')
  })

  it('applies correct background colour for correct tiles', () => {
    const board = makeBoard(6, 5)
    board[0][0] = { letter: 'C', state: 'correct' }
    const { container } = render(<Board board={board} {...defaultProps} />)
    const tile = container.querySelector('[role="grid"]')!.children[0].children[0] as HTMLElement
    expect(tile.style.background).toBe('rgb(83, 141, 78)') // #538d4e
  })

  it('applies present background colour for present tiles', () => {
    const board = makeBoard(6, 5)
    board[0][0] = { letter: 'R', state: 'present' }
    const { container } = render(<Board board={board} {...defaultProps} />)
    const tile = container.querySelector('[role="grid"]')!.children[0].children[0] as HTMLElement
    expect(tile.style.background).toBe('rgb(181, 159, 59)') // #b59f3b
  })

  it('applies rotateX transform for flip-first phase', () => {
    const board = makeBoard(6, 5)
    board[0][0] = { letter: 'A', state: 'tbd' }
    const flipping = new Map<string, 'first' | 'second'>([['0-0', 'first']])
    const { container } = render(<Board board={board} {...defaultProps} flippingTiles={flipping} />)
    const tile = container.querySelector('[role="grid"]')!.children[0].children[0] as HTMLElement
    expect(tile.style.transform).toBe('rotateX(-90deg)')
  })

  it('removes rotateX transform for flip-second phase', () => {
    const board = makeBoard(6, 5)
    board[0][0] = { letter: 'A', state: 'correct' }
    const flipping = new Map<string, 'first' | 'second'>([['0-0', 'second']])
    const { container } = render(<Board board={board} {...defaultProps} flippingTiles={flipping} />)
    const tile = container.querySelector('[role="grid"]')!.children[0].children[0] as HTMLElement
    expect(tile.style.transform).toBe('rotateX(0deg)')
  })

  it('has aria-label on the grid', () => {
    const board = makeBoard(6, 5)
    render(<Board board={board} {...defaultProps} />)
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Game board')
  })
})
