"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './styles/ElementFlow.module.css'
import { useElementFlow } from './hooks/useElementFlow'
import { SettingsPanel } from './components/SettingsPanel'
import { LoadingScreen } from './components/LoadingScreen'
import { DEFAULT_SETTINGS, type ElementFlowSettings } from './types'
import { UI_AUTOHIDE_MS } from './constants/config'

export default function ElementFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Settings live in a ref (read every frame) mirrored to state (for the UI).
  const [settings, setSettings] = useState<ElementFlowSettings>(DEFAULT_SETTINGS)
  const settingsRef = useRef<ElementFlowSettings>(DEFAULT_SETTINGS)
  const patch = useCallback((p: Partial<ElementFlowSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...p }
      settingsRef.current = next
      return next
    })
  }, [])

  const { ready, error, actionsRef } = useElementFlow(canvasRef, settingsRef)

  const [panelOpen, setPanelOpen] = useState(false)
  const [faded, setFaded] = useState(true)        // start faded → fade in
  const [progress, setProgress] = useState(0.05)
  const [loaded, setLoaded] = useState(false)

  // Animated loading progress until the sim signals ready.
  useEffect(() => {
    if (loaded) return
    let p = 0.05
    const id = window.setInterval(() => {
      p = Math.min(0.92, p + Math.random() * 0.12)
      setProgress(p)
    }, 120)
    return () => clearInterval(id)
  }, [loaded])

  useEffect(() => {
    if (ready && !loaded) {
      setProgress(1)
      const t = window.setTimeout(() => { setLoaded(true); setFaded(false) }, 420)
      return () => clearTimeout(t)
    }
  }, [ready, loaded])

  // ── Idle auto-hide of the gear/panel ──────────────────────────────────────
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let t: number
    const wake = () => {
      setIdle(false)
      window.clearTimeout(t)
      t = window.setTimeout(() => setIdle(true), UI_AUTOHIDE_MS)
    }
    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('touchstart', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('touchstart', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }, [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case ' ': e.preventDefault(); patch({ paused: !settingsRef.current.paused }); break
        case 'r': case 'R': actionsRef.current?.reset(); break
        case 'f': case 'F': toggleFullscreen(); break
        case 'h': case 'H': patch({ uiHidden: true }); break
        case 'Escape': patch({ uiHidden: false }); setPanelOpen(false); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [patch, toggleFullscreen, actionsRef])

  const uiVisible = !settings.uiHidden && (!idle || panelOpen)

  if (error) {
    return (
      <div ref={rootRef} className={styles.root}>
        <div className={styles.error}>
          <h2>WebGL2 not available</h2>
          <p>{error}</p>
          <p>Element Flow needs a browser with WebGL2 support.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${faded ? styles.rootFaded : ''} ${settings.background === 'light' ? styles.light : ''}`}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Liquid art canvas" />

      <div className={`${styles.ui} ${uiVisible ? '' : styles.uiHidden}`}>
        <SettingsPanel
          open={panelOpen}
          settings={settings}
          onChange={patch}
          onToggleOpen={() => setPanelOpen(o => !o)}
          onReset={() => actionsRef.current?.reset()}
          onFullscreen={toggleFullscreen}
          onExport={() => actionsRef.current?.exportPNG()}
        />
      </div>

      {settings.uiHidden && (
        <button type="button" className={styles.showHint} onClick={() => patch({ uiHidden: false })}>
          Press Esc to show controls
        </button>
      )}

      <LoadingScreen progress={progress} visible={!loaded} />
    </div>
  )
}
