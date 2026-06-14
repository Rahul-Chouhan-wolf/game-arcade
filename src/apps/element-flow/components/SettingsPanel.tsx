import styles from '../styles/ElementFlow.module.css'
import type { ElementFlowSettings, Level, BackgroundMode } from '../types'

interface Props {
  open: boolean
  settings: ElementFlowSettings
  onChange: (patch: Partial<ElementFlowSettings>) => void
  onToggleOpen: () => void
  onReset: () => void
  onFullscreen: () => void
  onExport: () => void
}

function Segmented<T extends string>(props: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onPick: (v: T) => void
}) {
  return (
    <div className={styles.row} role="group" aria-label={props.label}>
      <span className={styles.rowLabel}>{props.label}</span>
      <div className={styles.segmented}>
        {props.options.map(o => (
          <button
            key={o.value}
            type="button"
            className={`${styles.seg} ${props.value === o.value ? styles.segActive : ''}`}
            aria-pressed={props.value === o.value}
            onClick={() => props.onPick(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const LEVELS: { value: Level; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
]

export function SettingsPanel(props: Props) {
  const { open, settings, onChange } = props
  return (
    <>
      <button
        type="button"
        className={styles.gear}
        aria-label={open ? 'Close settings' : 'Open settings'}
        aria-expanded={open}
        onClick={props.onToggleOpen}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4c0-.5 0-1-.1-1.5l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L15 2H9l-.3 2.5A7.6 7.6 0 0 0 6 6L3.7 5l-2 3.4 2 1.6a8 8 0 0 0 0 3l-2 1.6 2 3.4 2.4-1c.8.6 1.6 1.1 2.6 1.5L9 22h6l.3-2.5c1-.4 1.8-.9 2.6-1.5l2.4 1 2-3.4-2-1.6c.1-.5.1-1 .1-1.5z"/>
        </svg>
      </button>

      <div
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        role="dialog"
        aria-label="Element Flow settings"
        aria-hidden={!open}
      >
        <div className={styles.panelTitle}>Settings</div>

        <Segmented
          label="Bloom"
          value={settings.bloom ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onPick={(v) => onChange({ bloom: v === 'on' })}
        />
        <Segmented<BackgroundMode>
          label="Background"
          value={settings.background}
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
          onPick={(v) => onChange({ background: v })}
        />
        <Segmented<Level>
          label="Color"
          value={settings.colorRandomization}
          options={LEVELS}
          onPick={(v) => onChange({ colorRandomization: v })}
        />
        <Segmented<Level>
          label="Strength"
          value={settings.fluidStrength}
          options={LEVELS}
          onPick={(v) => onChange({ fluidStrength: v })}
        />
        <Segmented
          label="Audio"
          value={settings.audio ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onPick={(v) => onChange({ audio: v === 'on' })}
        />

        <div className={styles.panelDivider} />

        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={() => onChange({ paused: !settings.paused })}>
            {settings.paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className={styles.action} onClick={props.onReset}>Reset</button>
          <button type="button" className={styles.action} onClick={props.onFullscreen}>Fullscreen</button>
          <button type="button" className={styles.action} onClick={() => onChange({ uiHidden: true })}>Hide UI</button>
          <button type="button" className={`${styles.action} ${styles.actionWide}`} onClick={props.onExport}>Export PNG</button>
        </div>

        <div className={styles.shortcuts}>
          <span>Space pause</span><span>R reset</span><span>F fullscreen</span><span>H hide</span>
        </div>
      </div>
    </>
  )
}
