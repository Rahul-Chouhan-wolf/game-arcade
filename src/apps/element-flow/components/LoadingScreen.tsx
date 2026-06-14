import styles from '../styles/ElementFlow.module.css'

interface Props {
  progress: number   // 0..1
  visible: boolean
}

export function LoadingScreen({ progress, visible }: Props) {
  return (
    <div
      className={`${styles.loading} ${visible ? '' : styles.loadingHidden}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className={styles.loadingInner}>
        <div className={styles.loadingOrb} aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className={styles.loadingTitle}>Element Flow</div>
        <div className={styles.loadingBarTrack}>
          <div className={styles.loadingBarFill} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className={styles.loadingHint}>Compiling shaders…</div>
      </div>
    </div>
  )
}
