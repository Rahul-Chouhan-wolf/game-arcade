import styles from '../styles/Singularity.module.css'
import type { Settings, Level } from '../types'

interface Props {
  open: boolean
  settings: Settings
  visible: boolean
  onToggle: () => void
  onChange: (p: Partial<Settings>) => void
  onReset: () => void
  onRandom: () => void
  onScreenshot: () => void
  onFullscreen: () => void
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`${styles.switch} ${on ? styles.switchOn : ''}`}
        onClick={onClick}
      >
        <span className={styles.knob} />
      </button>
    </div>
  )
}

const LEVELS: Level[] = ['low', 'medium', 'high']

export function UI(props: Props) {
  const { settings: s, onChange } = props
  return (
    <>
      <button
        type="button"
        className={`${styles.gear} ${props.visible ? '' : styles.hidden}`}
        aria-label={props.open ? 'Close controls' : 'Open controls'}
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6"/>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3"/>
        </svg>
      </button>

      <div
        className={`${styles.panel} ${props.open && props.visible ? styles.panelOpen : ''}`}
        role="dialog"
        aria-label="Singularity controls"
        aria-hidden={!(props.open && props.visible)}
      >
        <div className={styles.panelTitle}>Universe</div>

        <Toggle label="Bloom" on={s.bloom} onClick={() => onChange({ bloom: !s.bloom })} />
        <Toggle label="Lensing" on={s.lensing} onClick={() => onChange({ lensing: !s.lensing })} />
        <Toggle label="Audio" on={s.audio} onClick={() => onChange({ audio: !s.audio })} />

        <div className={styles.row}>
          <span className={styles.rowLabel}>Density</span>
          <div className={styles.segmented}>
            {LEVELS.map(l => (
              <button
                key={l}
                type="button"
                className={`${styles.seg} ${s.density === l ? styles.segActive : ''}`}
                aria-pressed={s.density === l}
                onClick={() => onChange({ density: l })}
              >
                {l === 'low' ? 'Low' : l === 'medium' ? 'Med' : 'High'}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={() => onChange({ paused: !s.paused })}>
            {s.paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className={styles.action} onClick={props.onRandom}>New Seed</button>
          <button type="button" className={styles.action} onClick={props.onReset}>Reset</button>
          <button type="button" className={styles.action} onClick={props.onFullscreen}>Fullscreen</button>
          <button type="button" className={styles.action} onClick={() => onChange({ uiHidden: true })}>Hide UI</button>
          <button type="button" className={styles.action} onClick={props.onScreenshot}>Screenshot</button>
        </div>

        <div className={styles.hintRow}>
          <span>Click ✦ spawn</span><span>Hold ✦ grow</span><span>Drag ✦ feed</span>
        </div>
        <div className={styles.hintRow}>
          <span>Space pause</span><span>R reset</span><span>F full</span><span>H hide</span>
        </div>
      </div>
    </>
  )
}
