"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './styles/ThreeBody.module.css'
import { Canvas } from './components/Canvas'
import { ControlPanel } from './components/ControlPanel'
import { InfoPanel } from './components/InfoPanel'
import { EnergyGraph } from './components/EnergyGraph'
import { useThreeBody } from './hooks/useThreeBody'
import { DEFAULT_SETTINGS, EMPTY_STATS, type Settings, type Stats, type BodyInfo } from './types'
import { PRESETS, type Preset } from './simulation/presets'

const AUTOHIDE_MS = 4000

export default function ThreeBody() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS)
  const patch = useCallback((p: Partial<Settings>) => {
    setSettings(prev => { const next = { ...prev, ...p }; settingsRef.current = next; return next })
  }, [])

  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [preset, setPreset] = useState<Preset>(PRESETS[0])
  const [bodies, setBodies] = useState<BodyInfo[]>([])
  const onStats = useCallback((s: Stats) => setStats(s), [])
  const onPreset = useCallback((p: Preset) => setPreset(p), [])
  const onBodies = useCallback((b: BodyInfo[]) => setBodies(b), [])

  const { ready, actionsRef } = useThreeBody(canvasRef, settingsRef, onStats, onPreset, onBodies)

  const [faded, setFaded] = useState(true)
  useEffect(() => { if (ready) { const t = setTimeout(() => setFaded(false), 80); return () => clearTimeout(t) } }, [ready])

  // idle auto-hide
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let t: number
    const wake = () => { setIdle(false); clearTimeout(t); t = window.setTimeout(() => setIdle(true), AUTOHIDE_MS) }
    wake()
    for (const ev of ['mousemove', 'pointerdown', 'keydown'] as const) window.addEventListener(ev, wake)
    return () => { clearTimeout(t); for (const ev of ['mousemove', 'pointerdown', 'keydown'] as const) window.removeEventListener(ev, wake) }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current; if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case ' ': e.preventDefault(); patch({ paused: !settingsRef.current.paused }); break
        case 'r': case 'R': actionsRef.current?.reset(); break
        case 'n': case 'N': actionsRef.current?.randomize(); break
        case 'f': case 'F': toggleFullscreen(); break
        case 'h': case 'H': patch({ uiHidden: true }); break
        case 'Escape': patch({ uiHidden: false }); break
        case 'ArrowRight': patch({ speed: Math.min(4, +(settingsRef.current.speed + 0.1).toFixed(1)) }); break
        case 'ArrowLeft': patch({ speed: Math.max(0.1, +(settingsRef.current.speed - 0.1).toFixed(1)) }); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [patch, toggleFullscreen, actionsRef])

  const uiVisible = !settings.uiHidden && !idle

  return (
    <div ref={rootRef} className={`${styles.root} ${faded ? styles.faded : ''}`}>
      <Canvas canvasRef={canvasRef} />

      <header className={`${styles.title} ${uiVisible ? '' : styles.hidden}`}>
        <h1>The Three-Body Problem</h1>
        <p>Three masses, one law of gravity, and no formula for the future — only chaos.</p>
      </header>

      <InfoPanel preset={preset} stats={stats} visible={uiVisible} />

      <EnergyGraph series={stats.series} visible={uiVisible} />

      <ControlPanel
        settings={settings}
        activeId={preset.id}
        visible={uiVisible}
        bodies={bodies}
        onChange={patch}
        onLoad={(p) => actionsRef.current?.loadPreset(p)}
        onRandom={() => actionsRef.current?.randomize()}
        onReset={() => actionsRef.current?.reset()}
        onStep={() => actionsRef.current?.step()}
        onScreenshot={() => actionsRef.current?.screenshot()}
        onFullscreen={toggleFullscreen}
        onSetMass={(i, m) => actionsRef.current?.setMass(i, m)}
      />

      {settings.uiHidden && (
        <button type="button" className={styles.showHint} onClick={() => patch({ uiHidden: false })}>
          Press Esc to show controls
        </button>
      )}
    </div>
  )
}
