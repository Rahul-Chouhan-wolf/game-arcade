import styles from '../styles/Singularity.module.css'

export function LoadingScreen({ visible, progress }: { visible: boolean; progress: number }) {
  return (
    <div
      className={`${styles.loading} ${visible ? '' : styles.loadingHidden}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className={styles.loadingInner}>
        <div className={styles.singularityOrb} aria-hidden="true" />
        <div className={styles.loadingTitle}>Singularity</div>
        <div className={styles.loadingBar}>
          <div className={styles.loadingFill} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className={styles.loadingHint}>Igniting the universe…</div>
      </div>
    </div>
  )
}
