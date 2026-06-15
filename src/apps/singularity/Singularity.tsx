"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './styles/Singularity.module.css'
import { Canvas } from './components/Canvas'
import { UI } from './components/UI'
import { BodyPicker } from './components/BodyPicker'
import { LoadingScreen } from './components/LoadingScreen'
import { useSimulation } from './hooks/useSimulation'
import { DEFAULT_SETTINGS, type Settings, type BodyKind } from './types'
import { UI_AUTOHIDE_MS } from './utils/constants'

export default function Singularity() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS)
  const patch = useCallback((p: Partial<Settings>) => {
    setSettings(prev => { const next = { ...prev, ...p }; settingsRef.current = next; return next })
  }, [])

  const [spawnKind, setSpawnKind] = useState<BodyKind>('blackhole')
  const spawnKindRef = useRef<BodyKind>('blackhole')
  const selectKind = useCallback((k: BodyKind) => { setSpawnKind(k); spawnKindRef.current = k }, [])

  const { ready, error, actionsRef } = useSimulation(canvasRef, settingsRef, spawnKindRef)

  const [panelOpen, setPanelOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState(0.06)
  const [faded, setFaded] = useState(true)

  useEffect(() => {
    if (loaded) return
    let p = 0.06
    const id = window.setInterval(() => { p = Math.min(0.9, p + Math.random() * 0.13); setProgress(p) }, 110)
    return () => clearInterval(id)
  }, [loaded])
  useEffect(() => {
    if (ready && !loaded) {
      setProgress(1)
      const t = window.setTimeout(() => { setLoaded(true); setFaded(false) }, 450)
      return () => clearTimeout(t)
    }
  }, [ready, loaded])

  // Idle auto-hide
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let t: number
    const wake = () => { setIdle(false); clearTimeout(t); t = window.setTimeout(() => setIdle(true), UI_AUTOHIDE_MS) }
    wake()
    for (const ev of ['mousemove', 'touchstart', 'keydown'] as const) window.addEventListener(ev, wake)
    return () => { clearTimeout(t); for (const ev of ['mousemove', 'touchstart', 'keydown'] as const) window.removeEventListener(ev, wake) }
  }, [])

  // Subtle deep-space audio drone (toggleable)
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null)
  useEffect(() => {
    if (settings.audio) {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination)
        for (const f of [42, 63, 84]) {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
          const g = ctx.createGain(); g.gain.value = f === 42 ? 0.5 : 0.18
          o.connect(g); g.connect(gain); o.start()
        }
        audioRef.current = { ctx, gain }
      }
      const a = audioRef.current
      void a.ctx.resume()
      a.gain.gain.setTargetAtTime(0.12, a.ctx.currentTime, 1.2)
    } else if (audioRef.current) {
      const a = audioRef.current
      a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.4)
    }
  }, [settings.audio])
  useEffect(() => () => { void audioRef.current?.ctx.close() }, [])

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }, [])

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
          <p>Singularity needs a browser with WebGL2 support.</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className={`${styles.root} ${faded ? styles.faded : ''}`}>
      <Canvas canvasRef={canvasRef} />

      <UI
        open={panelOpen}
        visible={uiVisible}
        settings={settings}
        onToggle={() => setPanelOpen(o => !o)}
        onChange={patch}
        onReset={() => actionsRef.current?.reset()}
        onRandom={() => actionsRef.current?.randomSeed()}
        onScreenshot={() => actionsRef.current?.screenshot()}
        onFullscreen={toggleFullscreen}
      />

      <BodyPicker selected={spawnKind} visible={uiVisible} onSelect={selectKind} />

      {settings.uiHidden && (
        <button type="button" className={styles.showHint} onClick={() => patch({ uiHidden: false })}>
          Press Esc to show controls
        </button>
      )}

      <LoadingScreen visible={!loaded} progress={progress} />
    </div>
  )
}
