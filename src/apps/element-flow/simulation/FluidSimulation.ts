// ─── Element Flow · GPU fluid solver ─────────────────────────────────────────
// WebGL2 ping-pong Navier–Stokes: advection · divergence · pressure (Jacobi) ·
// curl · vorticity confinement · dye buffer · bloom. Everything runs on the GPU.

import {
  getWebGL2, compileShader, Program, createDoubleFBO, createFBO, createBlit,
  type FBO, type DoubleFBO,
} from '../utils/webgl'
import {
  BASE_VERT, COPY_FRAG, CLEAR_FRAG, SPLAT_FRAG, ADVECTION_FRAG, DIVERGENCE_FRAG,
  CURL_FRAG, VORTICITY_FRAG, PRESSURE_FRAG, GRADIENT_SUBTRACT_FRAG,
  BLOOM_PREFILTER_FRAG, BLOOM_BLUR_FRAG, BLOOM_FINAL_FRAG, DISPLAY_FRAG,
} from '../shaders/glsl'
import {
  SIM_RESOLUTION, DENSITY_DISSIPATION, VELOCITY_DISSIPATION, PRESSURE,
  PRESSURE_ITERATIONS, CURL, BLOOM_ITERATIONS, BLOOM_INTENSITY,
  BLOOM_THRESHOLD, BLOOM_SOFT_KNEE,
} from '../constants/config'

export interface SplatInput {
  x: number; y: number; dx: number; dy: number; color: [number, number, number]
  radius: number
}

export class FluidSimulation {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private blit: (t: FBO | null) => void

  private programs!: Record<string, Program>
  private velocity!: DoubleFBO
  private dye!: DoubleFBO
  private pressure!: DoubleFBO
  private divergence!: FBO
  private curlFbo!: FBO
  private bloomTarget!: FBO
  private bloomFramebuffers: FBO[] = []

  private dyeRes: number
  private texType: number
  private rgba: number
  private r: number
  private disposed = false

  bloomEnabled = true
  background = 0          // 0 dark, 1 light
  curlAmount = CURL

  constructor(canvas: HTMLCanvasElement, dyeResolution: number) {
    const ctx = getWebGL2(canvas)
    if (!ctx) throw new Error('WebGL2 is required for Element Flow.')
    this.gl = ctx.gl
    this.canvas = canvas
    this.dyeRes = dyeResolution

    const gl = this.gl
    this.texType = gl.HALF_FLOAT
    this.rgba = gl.RGBA16F
    this.r = gl.R16F

    this.blit = createBlit(gl)
    this.compilePrograms()
    this.initFramebuffers()
  }

  // ── Setup ────────────────────────────────────────────────────────────────
  private compilePrograms() {
    const gl = this.gl
    const vert = compileShader(gl, gl.VERTEX_SHADER, BASE_VERT)
    const mk = (frag: string) =>
      new Program(gl, vert, compileShader(gl, gl.FRAGMENT_SHADER, frag))
    this.programs = {
      copy: mk(COPY_FRAG),
      clear: mk(CLEAR_FRAG),
      splat: mk(SPLAT_FRAG),
      advection: mk(ADVECTION_FRAG),
      divergence: mk(DIVERGENCE_FRAG),
      curl: mk(CURL_FRAG),
      vorticity: mk(VORTICITY_FRAG),
      pressure: mk(PRESSURE_FRAG),
      gradient: mk(GRADIENT_SUBTRACT_FRAG),
      bloomPrefilter: mk(BLOOM_PREFILTER_FRAG),
      bloomBlur: mk(BLOOM_BLUR_FRAG),
      bloomFinal: mk(BLOOM_FINAL_FRAG),
      display: mk(DISPLAY_FRAG),
    }
  }

  private initFramebuffers() {
    const gl = this.gl
    const simRes = this.getResolution(SIM_RESOLUTION)
    const dyeRes = this.getResolution(this.dyeRes)
    const lin = gl.LINEAR, near = gl.NEAREST

    this.velocity = createDoubleFBO(gl, simRes.w, simRes.h, this.rgba, gl.RGBA, this.texType, lin)
    this.dye = createDoubleFBO(gl, dyeRes.w, dyeRes.h, this.rgba, gl.RGBA, this.texType, lin)
    this.divergence = createFBO(gl, simRes.w, simRes.h, this.r, gl.RED, this.texType, near)
    this.curlFbo = createFBO(gl, simRes.w, simRes.h, this.r, gl.RED, this.texType, near)
    this.pressure = createDoubleFBO(gl, simRes.w, simRes.h, this.r, gl.RED, this.texType, near)
    this.initBloomFramebuffers()
  }

  private initBloomFramebuffers() {
    const gl = this.gl
    const res = this.getResolution(256)
    this.bloomFramebuffers.length = 0
    this.bloomTarget = createFBO(gl, res.w, res.h, this.rgba, gl.RGBA, this.texType, gl.LINEAR)
    let w = res.w, h = res.h
    for (let i = 0; i < BLOOM_ITERATIONS; i++) {
      w = w >> 1; h = h >> 1
      if (w < 2 || h < 2) break
      this.bloomFramebuffers.push(createFBO(gl, w, h, this.rgba, gl.RGBA, this.texType, gl.LINEAR))
    }
  }

  private getResolution(res: number): { w: number; h: number } {
    const gl = this.gl
    let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight
    if (aspect < 1) aspect = 1 / aspect
    const min = Math.round(res)
    const max = Math.round(res * aspect)
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: max, h: min } : { w: min, h: max }
  }

  resize() {
    // Recreate dye + velocity at the new aspect; cheap state textures just reset.
    this.initFramebuffers()
  }

  // ── Pointer injection ──────────────────────────────────────────────────────
  splat({ x, y, dx, dy, color, radius }: SplatInput) {
    const gl = this.gl
    const p = this.programs.splat
    gl.useProgram(p.program)
    // velocity
    gl.uniform1i(p.uniforms.uTarget, this.velocity.read.attach(0))
    gl.uniform1f(p.uniforms.aspectRatio, this.canvas.width / this.canvas.height)
    gl.uniform2f(p.uniforms.point, x, y)
    gl.uniform3f(p.uniforms.color, dx, dy, 0)
    gl.uniform1f(p.uniforms.radius, radius)
    this.blit(this.velocity.write); this.velocity.swap()
    // dye
    gl.uniform1i(p.uniforms.uTarget, this.dye.read.attach(0))
    gl.uniform3f(p.uniforms.color, color[0], color[1], color[2])
    this.blit(this.dye.write); this.dye.swap()
  }

  // ── One simulation step ──────────────────────────────────────────────────
  step(dt: number) {
    const gl = this.gl
    gl.disable(gl.BLEND)

    // curl
    let p = this.programs.curl
    gl.useProgram(p.program)
    gl.uniform2f(p.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY)
    gl.uniform1i(p.uniforms.uVelocity, this.velocity.read.attach(0))
    this.blit(this.curlFbo)

    // vorticity confinement
    p = this.programs.vorticity
    gl.useProgram(p.program)
    gl.uniform2f(p.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY)
    gl.uniform1i(p.uniforms.uVelocity, this.velocity.read.attach(0))
    gl.uniform1i(p.uniforms.uCurl, this.curlFbo.attach(1))
    gl.uniform1f(p.uniforms.curl, this.curlAmount)
    gl.uniform1f(p.uniforms.dt, dt)
    this.blit(this.velocity.write); this.velocity.swap()

    // divergence
    p = this.programs.divergence
    gl.useProgram(p.program)
    gl.uniform2f(p.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY)
    gl.uniform1i(p.uniforms.uVelocity, this.velocity.read.attach(0))
    this.blit(this.divergence)

    // clear pressure
    p = this.programs.clear
    gl.useProgram(p.program)
    gl.uniform1i(p.uniforms.uTexture, this.pressure.read.attach(0))
    gl.uniform1f(p.uniforms.value, PRESSURE)
    this.blit(this.pressure.write); this.pressure.swap()

    // pressure (Jacobi iterations)
    p = this.programs.pressure
    gl.useProgram(p.program)
    gl.uniform2f(p.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY)
    gl.uniform1i(p.uniforms.uDivergence, this.divergence.attach(0))
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(p.uniforms.uPressure, this.pressure.read.attach(1))
      this.blit(this.pressure.write); this.pressure.swap()
    }

    // gradient subtract → divergence-free velocity
    p = this.programs.gradient
    gl.useProgram(p.program)
    gl.uniform2f(p.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY)
    gl.uniform1i(p.uniforms.uPressure, this.pressure.read.attach(0))
    gl.uniform1i(p.uniforms.uVelocity, this.velocity.read.attach(1))
    this.blit(this.velocity.write); this.velocity.swap()

    // advect velocity
    p = this.programs.advection
    gl.useProgram(p.program)
    gl.uniform2f(p.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY)
    gl.uniform2f(p.uniforms.dyeTexelSize, this.velocity.texelSizeX, this.velocity.texelSizeY)
    gl.uniform1i(p.uniforms.uVelocity, this.velocity.read.attach(0))
    gl.uniform1i(p.uniforms.uSource, this.velocity.read.attach(0))
    gl.uniform1f(p.uniforms.dt, dt)
    gl.uniform1f(p.uniforms.dissipation, VELOCITY_DISSIPATION)
    this.blit(this.velocity.write); this.velocity.swap()

    // advect dye
    gl.uniform2f(p.uniforms.dyeTexelSize, this.dye.texelSizeX, this.dye.texelSizeY)
    gl.uniform1i(p.uniforms.uVelocity, this.velocity.read.attach(0))
    gl.uniform1i(p.uniforms.uSource, this.dye.read.attach(1))
    gl.uniform1f(p.uniforms.dissipation, DENSITY_DISSIPATION)
    this.blit(this.dye.write); this.dye.swap()
  }

  // ── Bloom ──────────────────────────────────────────────────────────────────
  private applyBloom(source: FBO, destination: FBO) {
    const gl = this.gl
    if (this.bloomFramebuffers.length < 2) return
    let last = destination

    let p = this.programs.bloomPrefilter
    gl.useProgram(p.program)
    const knee = BLOOM_THRESHOLD * BLOOM_SOFT_KNEE + 0.0001
    gl.uniform3f(p.uniforms.curve, BLOOM_THRESHOLD - knee, knee * 2, 0.25 / knee)
    gl.uniform1f(p.uniforms.threshold, BLOOM_THRESHOLD)
    gl.uniform1i(p.uniforms.uTexture, source.attach(0))
    this.blit(last)

    p = this.programs.bloomBlur
    gl.useProgram(p.program)
    for (let i = 0; i < this.bloomFramebuffers.length; i++) {
      const dest = this.bloomFramebuffers[i]
      gl.uniform2f(p.uniforms.texelSize, last.texelSizeX, last.texelSizeY)
      gl.uniform1i(p.uniforms.uTexture, last.attach(0))
      this.blit(dest)
      last = dest
    }
    for (let i = this.bloomFramebuffers.length - 2; i >= 0; i--) {
      const baseTex = this.bloomFramebuffers[i]
      gl.uniform2f(p.uniforms.texelSize, last.texelSizeX, last.texelSizeY)
      gl.uniform1i(p.uniforms.uTexture, last.attach(0))
      this.blit(baseTex)
      last = baseTex
    }
    p = this.programs.bloomFinal
    gl.useProgram(p.program)
    gl.uniform2f(p.uniforms.texelSize, last.texelSizeX, last.texelSizeY)
    gl.uniform1i(p.uniforms.uTexture, last.attach(0))
    gl.uniform1f(p.uniforms.intensity, BLOOM_INTENSITY)
    this.blit(destination)
  }

  // ── Final composite to screen ──────────────────────────────────────────────
  render(time: number) {
    const gl = this.gl
    if (this.bloomEnabled) this.applyBloom(this.dye.read, this.bloomTarget)

    const p = this.programs.display
    gl.useProgram(p.program)
    gl.uniform1i(p.uniforms.uTexture, this.dye.read.attach(0))
    gl.uniform1i(p.uniforms.uBloom, this.bloomTarget.attach(1))
    gl.uniform1f(p.uniforms.uBloomEnabled, this.bloomEnabled ? 1 : 0)
    gl.uniform1f(p.uniforms.uBackground, this.background)
    gl.uniform1f(p.uniforms.uTime, time)
    gl.uniform2f(p.uniforms.uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight)
    this.blit(null)
  }

  reset() {
    const gl = this.gl
    const p = this.programs.clear
    gl.useProgram(p.program)
    for (const dfbo of [this.dye, this.velocity, this.pressure]) {
      gl.uniform1i(p.uniforms.uTexture, dfbo.read.attach(0))
      gl.uniform1f(p.uniforms.value, 0)
      this.blit(dfbo.write); dfbo.swap()
    }
  }

  exportPNG(): string {
    return this.canvas.toDataURL('image/png')
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    const delFBO = (f?: FBO) => { if (f) { gl.deleteTexture(f.texture); gl.deleteFramebuffer(f.fbo) } }
    const delDouble = (d?: DoubleFBO) => { if (d) { delFBO(d.read); delFBO(d.write) } }
    delDouble(this.velocity); delDouble(this.dye); delDouble(this.pressure)
    delFBO(this.divergence); delFBO(this.curlFbo); delFBO(this.bloomTarget)
    this.bloomFramebuffers.forEach(delFBO)
    Object.values(this.programs).forEach(p => gl.deleteProgram(p.program))
    // Note: we deliberately do NOT call WEBGL_lose_context.loseContext().
    // The context is owned by the <canvas>; losing it would break a remount
    // that reuses the same canvas (e.g. React StrictMode in development).
  }
}
