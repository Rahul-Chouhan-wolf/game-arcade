import { useEffect } from 'react'

export interface PointerHandlers {
  spawn(x: number, y: number): number       // returns black-hole id
  drag(id: number, x: number, y: number, speed: number): void
  release(id: number): void
}

/**
 * Wires mouse + multi-touch to black-hole creation. Each pointer controls its
 * own singularity: down → spawn (held=growing), move → drag + velocity, up →
 * stabilize. Coordinates are converted to clip space (-1..1).
 */
export function usePointer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  handlers: React.RefObject<PointerHandlers>,
) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const active = new Map<number, { id: number; x: number; y: number; t: number }>()

    const toClip = (cx: number, cy: number): [number, number] => {
      const r = canvas.getBoundingClientRect()
      return [((cx - r.left) / r.width) * 2 - 1, 1 - ((cy - r.top) / r.height) * 2]
    }

    function down(pid: number, cx: number, cy: number) {
      const [x, y] = toClip(cx, cy)
      const id = handlers.current!.spawn(x, y)
      active.set(pid, { id, x, y, t: performance.now() })
    }
    function move(pid: number, cx: number, cy: number) {
      const a = active.get(pid); if (!a) return
      const [x, y] = toClip(cx, cy)
      const now = performance.now()
      const dt = Math.max(1, now - a.t) / 1000
      const speed = Math.hypot(x - a.x, y - a.y) / dt
      handlers.current!.drag(a.id, x, y, speed)
      a.x = x; a.y = y; a.t = now
    }
    function up(pid: number) {
      const a = active.get(pid); if (!a) return
      handlers.current!.release(a.id)
      active.delete(pid)
    }

    const onMouseDown = (e: MouseEvent) => down(-1, e.clientX, e.clientY)
    const onMouseMove = (e: MouseEvent) => move(-1, e.clientX, e.clientY)
    const onMouseUp = () => up(-1)
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) down(t.identifier, t.clientX, t.clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) move(t.identifier, t.clientX, t.clientY)
    }
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) up(t.identifier)
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [canvasRef, handlers])
}
