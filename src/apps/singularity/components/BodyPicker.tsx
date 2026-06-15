import styles from '../styles/Singularity.module.css'
import { BODY_ORDER, BODY_CONFIG } from '../utils/constants'
import type { BodyKind } from '../types'

function Icon({ kind }: { kind: BodyKind }) {
  const c = BODY_CONFIG[kind].color
  const col = `rgb(${c.map(v => Math.round(v * 255)).join(',')})`
  switch (kind) {
    case 'blackhole':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke={col} strokeWidth="2.4" opacity="0.9" />
          <circle cx="12" cy="12" r="4.5" fill="#000" stroke={col} strokeWidth="1" />
        </svg>
      )
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 10.5} y2={12 + Math.sin(a) * 10.5} stroke={col} strokeWidth="1.8" strokeLinecap="round" />
          })}
          <circle cx="12" cy="12" r="5.5" fill={col} />
        </svg>
      )
    case 'planet':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="12" r="6" fill={col} />
          <ellipse cx="12" cy="12" rx="10" ry="3.4" fill="none" stroke={col} strokeWidth="1.6" opacity="0.8" transform="rotate(-20 12 12)" />
        </svg>
      )
    case 'whitehole':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2
            return <line key={i} x1={12 + Math.cos(a) * 4} y1={12 + Math.sin(a) * 4} x2={12 + Math.cos(a) * 11} y2={12 + Math.sin(a) * 11} stroke={col} strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
          })}
          <circle cx="12" cy="12" r="3.5" fill="#fff" />
        </svg>
      )
    default: // star, whitestar
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" fill={col} />
          <circle cx="12" cy="12" r="8.5" fill="none" stroke={col} strokeWidth="1" opacity="0.4" />
        </svg>
      )
  }
}

interface Props {
  selected: BodyKind
  visible: boolean
  onSelect: (k: BodyKind) => void
}

export function BodyPicker({ selected, visible, onSelect }: Props) {
  return (
    <div className={`${styles.picker} ${visible ? '' : styles.hidden}`} role="radiogroup" aria-label="Object to spawn">
      {BODY_ORDER.map(kind => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={selected === kind}
          aria-label={BODY_CONFIG[kind].label}
          title={BODY_CONFIG[kind].label}
          className={`${styles.pick} ${selected === kind ? styles.pickActive : ''}`}
          onClick={() => onSelect(kind)}
        >
          <Icon kind={kind} />
          <span className={styles.pickLabel}>{BODY_CONFIG[kind].label}</span>
        </button>
      ))}
    </div>
  )
}
