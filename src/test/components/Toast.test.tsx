import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Toast } from '@/components/lexle/Toast'

describe('Toast', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders nothing when message is null', () => {
    const { container } = render(<Toast message={null} persist={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the message text', () => {
    render(<Toast message="Not enough letters" persist={false} />)
    expect(screen.getByText('Not enough letters')).toBeInTheDocument()
  })

  it('renders persistent messages', () => {
    render(<Toast message="CRANE" persist={true} />)
    expect(screen.getByText('CRANE')).toBeInTheDocument()
  })

  it('has role="alert" for accessibility', () => {
    render(<Toast message="Test message" persist={false} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('applies toast-enter animation class on mount', () => {
    render(<Toast message="Hello" persist={false} />)
    const el = screen.getByRole('alert')
    expect(el.className).toContain('animate-toast-in')
  })
})
