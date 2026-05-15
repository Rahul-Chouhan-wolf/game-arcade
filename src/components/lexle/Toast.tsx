'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string | null
  persist: boolean
}

export function Toast({ message, persist }: ToastProps) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [currentMsg, setCurrentMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!message) {
      if (visible) {
        setExiting(true)
        const t = setTimeout(() => { setVisible(false); setExiting(false); setCurrentMsg(null) }, 280)
        return () => clearTimeout(t)
      }
      return
    }
    setCurrentMsg(message)
    setExiting(false)
    setVisible(true)

    if (!persist) {
      const t = setTimeout(() => {
        setExiting(true)
        setTimeout(() => { setVisible(false); setExiting(false); setCurrentMsg(null) }, 280)
      }, 1800)
      return () => clearTimeout(t)
    }
  }, [message, persist]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible && !currentMsg) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className={exiting ? 'animate-toast-out' : 'animate-toast-in'}
      style={{
        background: '#fff',
        color: '#000',
        fontWeight: 700,
        fontSize: '0.75rem',
        padding: '6px 16px',
        borderRadius: 9999,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        letterSpacing: '0.05em',
        pointerEvents: 'none',
      }}
    >
      {currentMsg}
    </div>
  )
}
