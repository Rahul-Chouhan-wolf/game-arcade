import styles from '../styles/ThreeBody.module.css'

export function Canvas({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  return <canvas ref={canvasRef} className={styles.canvas} aria-label="Three-body simulation" />
}
