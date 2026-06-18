import styles from '../styles/ThreeBody.module.css'
import type { EnergySample } from '../types'

const W = 240, H = 120, PAD = 6

export function EnergyGraph({ series, visible }: { series: EnergySample[]; visible: boolean }) {
  let body = (
    <div className={styles.graphEmpty}>collecting data…</div>
  )

  if (series.length >= 2) {
    let lo = Infinity, hi = -Infinity
    for (const s of series) {
      lo = Math.min(lo, s.ke, s.pe, s.total)
      hi = Math.max(hi, s.ke, s.pe, s.total)
    }
    if (hi - lo < 1e-9) { hi += 1; lo -= 1 }
    const t0 = series[0].t, t1 = series[series.length - 1].t || 1
    const x = (t: number) => PAD + ((t - t0) / (t1 - t0 || 1)) * (W - 2 * PAD)
    const y = (v: number) => PAD + (1 - (v - lo) / (hi - lo)) * (H - 2 * PAD)
    const line = (pick: (s: EnergySample) => number) =>
      series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)} ${y(pick(s)).toFixed(1)}`).join(' ')

    const zeroY = lo < 0 && hi > 0 ? y(0) : null

    body = (
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.graphSvg} preserveAspectRatio="none" aria-hidden="true">
        {zeroY != null && (
          <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="3 3" />
        )}
        <path d={line(s => s.pe)} fill="none" stroke="#ff8a5c" strokeWidth="1.4" />
        <path d={line(s => s.ke)} fill="none" stroke="#6ad6ff" strokeWidth="1.4" />
        <path d={line(s => s.total)} fill="none" stroke="#ffffff" strokeWidth="1.6" />
      </svg>
    )
  }

  return (
    <section className={`${styles.graph} ${visible ? '' : styles.hidden}`} aria-label="Energy over time">
      <div className={styles.graphHead}>
        <span className={styles.graphTitle}>Energy over time</span>
        <div className={styles.legend}>
          <span><i style={{ background: '#ffffff' }} />Total</span>
          <span><i style={{ background: '#6ad6ff' }} />Kinetic</span>
          <span><i style={{ background: '#ff8a5c' }} />Potential</span>
        </div>
      </div>
      {body}
      <p className={styles.graphNote}>Kinetic and potential trade off as bodies speed up and slow down, yet their sum — the total — stays flat. That flat line is energy conservation.</p>
    </section>
  )
}
