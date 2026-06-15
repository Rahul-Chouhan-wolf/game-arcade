// ─── Singularity · GPU particle system ───────────────────────────────────────
// Particle pos.xy + vel.zw live in an RGBA16F texture, integrated each frame by
// a ping-pong update pass. Nothing is read back to the CPU.

import {
  createDoubleFBO, createFBO, Program, deleteFBO,
  type DoubleFBO, type FBO,
} from '../utils/webgl'
import { QUAD_VS, UPDATE_FS } from '../render/shaders/glsl'
import { mulberry32 } from '../utils/math'

export class ParticleSystem {
  readonly side: number
  readonly count: number
  private gl: WebGL2RenderingContext
  state: DoubleFBO
  private update: Program
  private quadDraw: (t: FBO | null) => void

  constructor(gl: WebGL2RenderingContext, side: number, quadDraw: (t: FBO | null) => void) {
    this.gl = gl
    this.side = side
    this.count = side * side
    this.quadDraw = quadDraw
    this.update = new Program(gl, QUAD_VS, UPDATE_FS)
    this.state = createDoubleFBO(gl, side, side, gl.NEAREST)
  }

  /** Seed positions/velocities (a calm rotating disc) into both buffers. */
  seed(seed: number, aspect: number) {
    const rng = mulberry32(seed)
    const n = this.count
    const data = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      // distribute in a soft disc, gentle tangential drift → "living" universe
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * 1.7
      const x = Math.cos(a) * r * aspect
      const y = Math.sin(a) * r
      const sp = 0.04 + rng() * 0.05
      data[i * 4 + 0] = x
      data[i * 4 + 1] = y
      data[i * 4 + 2] = -Math.sin(a) * sp
      data[i * 4 + 3] = Math.cos(a) * sp
    }
    this.writeData(this.state.read, data)
    this.writeData(this.state.write, data)
  }

  private writeData(target: FBO, data: Float32Array) {
    const gl = this.gl
    // RGBA16F can't be uploaded from Float32 directly across all drivers; use a
    // temporary RGBA32F texture, then blit-copy is overkill — texImage2D with
    // HALF_FLOAT needs Uint16. Simplest robust path: upload as RGBA32F via a
    // separate full-float texture bound to the same FBO.
    gl.bindTexture(gl.TEXTURE_2D, target.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.side, this.side, 0, gl.RGBA, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  }

  step(opts: {
    bhData: Float32Array; bhCount: number; dt: number; time: number; aspect: number; chaos: number
  }) {
    const gl = this.gl
    const p = this.update.use(gl)
    gl.uniform1i(p.uniforms.uState, this.state.read.attach(0))
    gl.uniform4fv(p.uniforms.uBH, opts.bhData)
    gl.uniform1i(p.uniforms.uBHCount, opts.bhCount)
    gl.uniform1f(p.uniforms.uDt, opts.dt)
    gl.uniform1f(p.uniforms.uTime, opts.time)
    gl.uniform1f(p.uniforms.uAspect, opts.aspect)
    gl.uniform1f(p.uniforms.uChaos, opts.chaos)
    gl.disable(gl.BLEND)
    this.quadDraw(this.state.write)
    this.state.swap()
  }

  dispose() {
    deleteFBO(this.gl, this.state.read)
    deleteFBO(this.gl, this.state.write)
    this.gl.deleteProgram(this.update.program)
  }
}
