import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Keyboard } from '@/components/lexle/Keyboard'

const defaultProps = {
  keyMap: {} as Record<string, import('@/lib/lexle/types').TileState>,
  keyH: 48,
  keyFontSize: '0.8rem',
  onKey: vi.fn(),
}

describe('Keyboard', () => {
  it('renders all 26 letter keys', () => {
    render(<Keyboard {...defaultProps} />)
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
      expect(screen.getByRole('button', { name: letter })).toBeInTheDocument()
    })
  })

  it('renders ENTER and ⌫ keys', () => {
    render(<Keyboard {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'ENTER' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '⌫' })).toBeInTheDocument()
  })

  it('calls onKey with the correct key when a letter is clicked', async () => {
    const onKey = vi.fn()
    render(<Keyboard {...defaultProps} onKey={onKey} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'A' }))
    expect(onKey).toHaveBeenCalledWith('A')
  })

  it('calls onKey with ENTER when ENTER is clicked', async () => {
    const onKey = vi.fn()
    render(<Keyboard {...defaultProps} onKey={onKey} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'ENTER' }))
    expect(onKey).toHaveBeenCalledWith('ENTER')
  })

  it('calls onKey with ⌫ when backspace key is clicked', async () => {
    const onKey = vi.fn()
    render(<Keyboard {...defaultProps} onKey={onKey} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '⌫' }))
    expect(onKey).toHaveBeenCalledWith('⌫')
  })

  it('colours correct keys green', () => {
    render(<Keyboard {...defaultProps} keyMap={{ A: 'correct' }} />)
    const btn = screen.getByRole('button', { name: 'A' }) as HTMLButtonElement
    expect(btn.style.background).toBe('rgb(83, 141, 78)') // #538d4e
  })

  it('colours present keys yellow', () => {
    render(<Keyboard {...defaultProps} keyMap={{ B: 'present' }} />)
    const btn = screen.getByRole('button', { name: 'B' }) as HTMLButtonElement
    expect(btn.style.background).toBe('rgb(181, 159, 59)') // #b59f3b
  })

  it('colours absent keys dark grey', () => {
    render(<Keyboard {...defaultProps} keyMap={{ C: 'absent' }} />)
    const btn = screen.getByRole('button', { name: 'C' }) as HTMLButtonElement
    expect(btn.style.background).toBe('rgb(58, 58, 60)') // #3a3a3c
  })

  it('has aria-label on the keyboard container', () => {
    render(<Keyboard {...defaultProps} />)
    expect(screen.getByLabelText('Keyboard')).toBeInTheDocument()
  })
})
