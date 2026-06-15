import styles from '../styles/Singularity.module.css'

export function Canvas({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  return <canvas ref={canvasRef} className={styles.canvas} aria-label="Black hole simulation canvas" />
}
