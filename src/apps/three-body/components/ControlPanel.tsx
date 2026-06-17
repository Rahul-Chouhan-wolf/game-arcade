import styles from '../styles/ThreeBody.module.css'
import { PRESETS, type Preset } from '../simulation/presets'
import type { Settings } from '../types'

interface Props {
  settings: Settings
  activeId: string
  visible: boolean
  onChange: (p: Partial<Settings>) => void
  onLoad: (p: Preset) => void
  onRandom: () => void
  onReset: () => void
  onStep: () => void
  onScreenshot: () => void
  onFullscreen: () => void
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`${styles.chip} ${on ? styles.chipOn : ''}`} onClick={onClick}>
      {label}
    </button>
  )
}

export function ControlPanel(props: Props) {
  const { settings: s } = props
  return (
    <div className={`${styles.controls} ${props.visible ? '' : styles.hidden}`}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Scenario</div>
        <div className={styles.presetGrid}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              className={`${styles.preset} ${props.activeId === p.id ? styles.presetActive : ''}`}
              onClick={() => props.onLoad(p)}
              title={p.blurb}
            >
              <span className={styles.presetName}>{p.name}</span>
              <span className={styles.presetBlurb}>{p.blurb}</span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.preset} ${props.activeId.startsWith('random') ? styles.presetActive : ''}`}
            onClick={props.onRandom}
            title="Three random stars → chaos"
          >
            <span className={styles.presetName}>Random Triple ⟳</span>
            <span className={styles.presetBlurb}>Three random stars → chaos</span>
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.transport}>
          <button type="button" className={styles.bigBtn} onClick={() => props.onChange({ paused: !s.paused })}>
            {s.paused ? '▶ Play' : '❚❚ Pause'}
          </button>
          <button type="button" className={styles.btn} onClick={props.onStep} disabled={!s.paused} title="Advance one step (when paused)">Step</button>
          <button type="button" className={styles.btn} onClick={props.onReset} title="Restart this scenario">↺ Reset</button>
        </div>
        <label className={styles.speedRow}>
          <span className={styles.sliderLabel}>Speed</span>
          <input
            type="range" min={0.1} max={4} step={0.1} value={s.speed}
            onChange={e => props.onChange({ speed: parseFloat(e.target.value) })}
            aria-label="Simulation speed"
          />
          <span className={styles.speedVal}>{s.speed.toFixed(1)}×</span>
        </label>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Show</div>
        <div className={styles.chips}>
          <Toggle label="Trails" on={s.showTrails} onClick={() => props.onChange({ showTrails: !s.showTrails })} />
          <Toggle label="Velocity" on={s.showVectors} onClick={() => props.onChange({ showVectors: !s.showVectors })} />
          <Toggle label="Center of mass" on={s.showCom} onClick={() => props.onChange({ showCom: !s.showCom })} />
          <Toggle label="Labels" on={s.showLabels} onClick={() => props.onChange({ showLabels: !s.showLabels })} />
          <Toggle label="Chaos twin" on={s.chaosGhost} onClick={() => props.onChange({ chaosGhost: !s.chaosGhost })} />
        </div>
      </div>

      <div className={styles.footRow}>
        <button type="button" className={styles.btn} onClick={props.onScreenshot}>Screenshot</button>
        <button type="button" className={styles.btn} onClick={props.onFullscreen}>Fullscreen</button>
        <button type="button" className={styles.btn} onClick={() => props.onChange({ uiHidden: true })}>Hide UI</button>
      </div>
    </div>
  )
}
