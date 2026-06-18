import styles from '../styles/ThreeBody.module.css'
import type { Stats } from '../types'
import type { Preset } from '../simulation/presets'

function fmt(v: number, d = 2): string {
  if (!isFinite(v)) return '—'
  if (Math.abs(v) >= 1000 || (v !== 0 && Math.abs(v) < 0.01)) return v.toExponential(1)
  return v.toFixed(d)
}

export function InfoPanel({ preset, stats, visible }: { preset: Preset; stats: Stats; visible: boolean }) {
  const conserved = stats.drift < 0.5
  const keFrac = stats.ke + Math.abs(stats.pe) > 0 ? stats.ke / (stats.ke + Math.abs(stats.pe)) : 0

  return (
    <aside className={`${styles.info} ${visible ? '' : styles.hidden}`} aria-label="Simulation readouts">
      <div className={styles.infoHead}>
        <span className={styles.infoKicker}>Scenario</span>
        <h2 className={styles.infoTitle}>{preset.name}</h2>
      </div>
      <p className={styles.lesson}>{preset.lesson}</p>

      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Time</span>
        <span className={styles.metricVal}>{fmt(stats.time, 1)}</span>
      </div>

      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Total energy</span>
        <span className={styles.metricVal}>{fmt(stats.energy)}</span>
      </div>
      <div className={styles.conserveRow}>
        <span className={`${styles.badge} ${conserved ? styles.badgeOk : styles.badgeWarn}`}>
          {conserved ? '✓ conserved' : `drift ${fmt(stats.drift, 2)}%`}
        </span>
        <span className={styles.conserveHint}>energy must stay constant</span>
      </div>

      <div className={styles.barRow} title="Kinetic vs potential energy">
        <span className={styles.metricLabel}>KE / PE</span>
        <div className={styles.bar}>
          <div className={styles.barKe} style={{ width: `${(keFrac * 100).toFixed(0)}%` }} />
        </div>
      </div>

      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Momentum</span>
        <span className={styles.metricVal}>{fmt(stats.momentum, 3)} <em className={styles.unit}>≈ const</em></span>
      </div>

      {stats.divergence != null && (
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>Twin divergence</span>
          <span className={styles.metricVal} style={{ color: '#ff8a70' }}>{fmt(stats.divergence, 3)}</span>
        </div>
      )}

      {stats.ejected && (
        <div className={styles.eject}>★ A body has been ejected — the rest form a stable binary, the usual end of a chaotic triple.</div>
      )}
    </aside>
  )
}
