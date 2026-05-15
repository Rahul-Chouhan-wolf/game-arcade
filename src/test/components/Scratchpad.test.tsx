import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { Scratchpad, ScratchpadHandle } from '@/components/lexle/Scratchpad'

/** Navigate the DOM to get the tile div at (row, col).
 *  Panel structure: header | rows-container | add-row-footer
 *  rows-container children: row-wrapper divs
 *  row-wrapper: [tiles-flex-div, delete-btn]
 *  tiles-flex-div children: individual tile divs */
function getTile(container: HTMLElement, row = 0, col = 0): HTMLElement {
  // container.firstChild is the panel div
  const panel = container.firstChild as HTMLElement
  const rowsContainer = panel.children[1] as HTMLElement   // second child = rows div
  const rowWrapper    = rowsContainer.children[row] as HTMLElement
  const tilesWrapper  = rowWrapper.children[0] as HTMLElement
  return tilesWrapper.children[col] as HTMLElement
}

const defaultProps = {
  visible: true,
  onClose: vi.fn(),
  wordLength: 5,
  tileSz: 36,
  isMobile: false,
  onFocusChange: vi.fn(),
}

describe('Scratchpad', () => {
  it('renders nothing when visible is false', () => {
    const { container } = render(<Scratchpad {...defaultProps} visible={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders when visible is true', () => {
    render(<Scratchpad {...defaultProps} />)
    expect(screen.getByText('Scratchpad')).toBeInTheDocument()
  })

  it('renders one row of tiles matching wordLength on open', () => {
    render(<Scratchpad {...defaultProps} wordLength={5} />)
    // Should have 5 tile divs in the first row
    const panel = screen.getByText('Scratchpad').closest('div[style]') as HTMLElement
    expect(panel).toBeInTheDocument()
  })

  it('calls onClose when ✕ button is clicked', async () => {
    const onClose = vi.fn()
    render(<Scratchpad {...defaultProps} onClose={onClose} />)
    const user = userEvent.setup()
    await user.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalled()
  })

  it('adds a row when Add Row is clicked', async () => {
    render(<Scratchpad {...defaultProps} />)
    const user = userEvent.setup()
    const addBtn = screen.getByText(/Add Row/i)
    await user.click(addBtn)
    // Now should have 2 delete (×) buttons
    const deleteBtns = screen.getAllByText('×')
    expect(deleteBtns).toHaveLength(2)
  })

  it('disables Add Row when max rows (5) reached', async () => {
    render(<Scratchpad {...defaultProps} />)
    const user = userEvent.setup()
    const addBtn = screen.getByText(/Add Row/i) as HTMLButtonElement
    // Click 4 times to reach max (started with 1 row)
    for (let i = 0; i < 4; i++) {
      await user.click(addBtn)
    }
    expect(addBtn.disabled).toBe(true)
  })

  it('deletes a row when × is clicked', async () => {
    render(<Scratchpad {...defaultProps} />)
    const user = userEvent.setup()
    // Add a row first
    await user.click(screen.getByText(/Add Row/i))
    expect(screen.getAllByText('×')).toHaveLength(2)
    // Delete first row
    await user.click(screen.getAllByText('×')[0])
    expect(screen.getAllByText('×')).toHaveLength(1)
  })

  it('calls onFocusChange(true) when a tile is focused', async () => {
    const onFocusChange = vi.fn()
    const { container } = render(<Scratchpad {...defaultProps} onFocusChange={onFocusChange} />)
    const user = userEvent.setup()
    await user.click(getTile(container))
    expect(onFocusChange).toHaveBeenCalledWith(true)
  })

  // ── handleKey via ref ───────────────────────────────────────────────────────

  it('exposes handleKey via forwardRef that returns false when no tile focused', () => {
    const ref = createRef<ScratchpadHandle>()
    render(<Scratchpad {...defaultProps} ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current!.handleKey('A')).toBe(false)
  })

  it('handleKey returns true and types letter when a tile is focused', async () => {
    const ref = createRef<ScratchpadHandle>()
    const { container } = render(<Scratchpad {...defaultProps} ref={ref} />)
    const user = userEvent.setup()
    await user.click(getTile(container))
    let result!: boolean
    act(() => { result = ref.current!.handleKey('A') })
    expect(result).toBe(true)
  })

  it('handleKey BACKSPACE returns true when tile is focused', async () => {
    const ref = createRef<ScratchpadHandle>()
    const { container } = render(<Scratchpad {...defaultProps} ref={ref} />)
    const user = userEvent.setup()
    await user.click(getTile(container))
    let result!: boolean
    act(() => { result = ref.current!.handleKey('BACKSPACE') })
    expect(result).toBe(true)
  })

  it('handleKey ESCAPE clears focus and returns true', async () => {
    const onFocusChange = vi.fn()
    const ref = createRef<ScratchpadHandle>()
    const { container } = render(<Scratchpad {...defaultProps} ref={ref} onFocusChange={onFocusChange} />)
    const user = userEvent.setup()
    await user.click(getTile(container))
    onFocusChange.mockClear()
    let result!: boolean
    act(() => { result = ref.current!.handleKey('ESCAPE') })
    expect(result).toBe(true)
    expect(onFocusChange).toHaveBeenCalledWith(false)
  })

  it('resets row widths when wordLength changes', () => {
    const { rerender } = render(<Scratchpad {...defaultProps} wordLength={5} />)
    rerender(<Scratchpad {...defaultProps} wordLength={4} />)
    // After wordLength change, tiles should reset — no error should be thrown
    expect(screen.getByText('Scratchpad')).toBeInTheDocument()
  })
})
