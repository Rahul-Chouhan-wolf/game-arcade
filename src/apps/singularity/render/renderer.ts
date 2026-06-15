// ─── Singularity · renderer ──────────────────────────────────────────────────
// Composites the six visual layers each frame and runs post (bloom, lensing,
// chromatic aberration, vignette). Simulation lives in ../simulation.

import {
  getGL, Program, createFBO, deleteFBO, createQuad, type FBO,
} from '../utils/webgl'
import { ParticleSystem } from '../simulation/particles'
import {
  QUAD_VS, PARTICLE_VS, PARTICLE_FS, STAR_VS, STAR_FS, NEBULA_FS,
  BH_VS, BH_FS, BURST_VS, BURST_FS, BLOOM_PREFILTER_FS, BLOOM_BLUR_FS, COMPOSITE_FS, COPY_FS,
} from './shaders/glsl'
import type { NebulaBurst } from '../types'
import { STARFIELD_COUNT, BLOOM_THRESHOLD, BLOOM_INTENSITY } from '../utils/constants'
import { mulberry32, massColor } from '../utils/math'
import { packHoles } from '../simulation/blackhole'
import type { BlackHole } from '../types'

export class Renderer {
  gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  particles: ParticleSystem
  aspect = 1

  private quad: ReturnType<typeof createQuad>
  private progParticle: Program
  private progStar: Program
  private progNebula: Program
  private progBH: Program
  private progBurst: Program
  private progPrefilter: Program
  private progBlur: Program
  private progComposite: Program
  private progCopy: Program

  private scene!: FBO
  private bloomA!: FBO
  private bloomB!: FBO
  private starBuf: WebGLBuffer
  private bhQuadBuf: WebGLBuffer
  private particleVAO: WebGLVertexArrayObject

  bloom = true
  lensing = true

  constructor(canvas: HTMLCanvasElement, side: number) {
    const gl = getGL(canvas)
    if (!gl) throw new Error('WebGL2 is required for Singularity.')
    this.gl = gl
    this.canvas = canvas
    this.quad = createQuad(gl)

    this.progParticle = new Program(gl, PARTICLE_VS, PARTICLE_FS)
    this.progStar = new Program(gl, STAR_VS, STAR_FS)
    this.progNebula = new Program(gl, QUAD_VS, NEBULA_FS)
    this.progBH = new Program(gl, BH_VS, BH_FS)
    this.progBurst = new Program(gl, BURST_VS, BURST_FS)
    this.progPrefilter = new Program(gl, QUAD_VS, BLOOM_PREFILTER_FS)
    this.progBlur = new Program(gl, QUAD_VS, BLOOM_BLUR_FS)
    this.progComposite = new Program(gl, QUAD_VS, COMPOSITE_FS)
    this.progCopy = new Program(gl, QUAD_VS, COPY_FS)

    this.particles = new ParticleSystem(gl, side, t => this.quad.draw(t))

    // empty VAO for attribute-less particle draw (positions come from texture)
    this.particleVAO = gl.createVertexArray()!

    // starfield buffer: pos(2) + size(1) + phase(1)
    const rng = mulberry32(20260614)
    const star = new Float32Array(STARFIELD_COUNT * 4)
    for (let i = 0; i < STARFIELD_COUNT; i++) {
      star[i * 4 + 0] = rng() * 2 - 1
      star[i * 4 + 1] = rng() * 2 - 1
      star[i * 4 + 2] = 0.6 + rng() * rng() * 2.4
      star[i * 4 + 3] = rng() * 6.28
    }
    this.starBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuf)
    gl.bufferData(gl.ARRAY_BUFFER, star, gl.STATIC_DRAW)

    // unit quad for black-hole sprites
    this.bhQuadBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bhQuadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

    this.resize()
  }

  seed(seed: number) { this.particles.seed(seed, this.aspect) }

  resize() {
    const gl = this.gl
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    const w = Math.max(2, Math.floor(this.canvas.clientWidth * dpr))
    const h = Math.max(2, Math.floor(this.canvas.clientHeight * dpr))
    this.canvas.width = w; this.canvas.height = h
    this.aspect = w / h
    deleteFBO(gl, this.scene); deleteFBO(gl, this.bloomA); deleteFBO(gl, this.bloomB)
    this.scene = createFBO(gl, w, h, gl.LINEAR)
    const bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1)
    this.bloomA = createFBO(gl, bw, bh, gl.LINEAR)
    this.bloomB = createFBO(gl, bw, bh, gl.LINEAR)
  }

  private renderScene(holes: HoleRender[], bursts: NebulaBurst[], time: number, drift: [number, number]) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo)
    gl.viewport(0, 0, this.scene.width, this.scene.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Layer 3: nebula (opaque base)
    let p = this.progNebula.use(gl)
    gl.uniform1f(p.uniforms.uTime, time)
    gl.uniform1f(p.uniforms.uAspect, this.aspect)
    gl.disable(gl.BLEND)
    this.quad.draw(this.scene)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)   // additive for all glowing layers

    // Layer 1: starfield
    p = this.progStar.use(gl)
    gl.uniform1f(p.uniforms.uTime, time)
    gl.uniform2f(p.uniforms.uDrift, drift[0], drift[1])
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuf)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 8)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 16, 12)
    gl.drawArrays(gl.POINTS, 0, STARFIELD_COUNT)
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2)

    // Layer 4: dynamic particles (positions sampled from state texture)
    p = this.progParticle.use(gl)
    gl.bindVertexArray(this.particleVAO)
    gl.uniform1i(p.uniforms.uState, this.particles.state.read.attach(0))
    gl.uniform1i(p.uniforms.uSide, this.particles.side)
    gl.uniform1f(p.uniforms.uAspect, this.aspect)
    gl.uniform2f(p.uniforms.uResolution, this.scene.width, this.scene.height)
    gl.drawArrays(gl.POINTS, 0, this.particles.count)
    gl.bindVertexArray(null)

    // Layer 5: accretion disks + event horizons
    // Nebula bursts (merge / collapse) — colourful additive clouds
    if (bursts.length) {
      p = this.progBurst.use(gl)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bhQuadBuf)
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      for (const b of bursts) {
        const age = Math.min(1, b.age / b.life)
        gl.uniform2f(p.uniforms.uCenter, b.x, b.y)
        gl.uniform1f(p.uniforms.uRadius, b.radius)
        gl.uniform1f(p.uniforms.uAge, age)
        gl.uniform1f(p.uniforms.uSeed, b.seed)
        gl.uniform3f(p.uniforms.uColA, b.colors[0][0], b.colors[0][1], b.colors[0][2])
        gl.uniform3f(p.uniforms.uColB, b.colors[1][0], b.colors[1][1], b.colors[1][2])
        gl.uniform3f(p.uniforms.uColC, b.colors[2][0], b.colors[2][1], b.colors[2][2])
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    }

    // Accretion disks + event horizons
    p = this.progBH.use(gl)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bhQuadBuf)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    for (const b of holes) {
      const col = massColor(b.mass)
      const horizonClip = b.w_horizon ?? 0
      const radius = Math.max(0.04, horizonClip * 3.4)
      gl.uniform2f(p.uniforms.uCenter, b.x, b.y)
      gl.uniform1f(p.uniforms.uRadius, radius)
      gl.uniform3f(p.uniforms.uColor, col[0], col[1], col[2])
      gl.uniform1f(p.uniforms.uSpin, b.spin)
      gl.uniform1f(p.uniforms.uHorizonFrac, Math.min(0.9, horizonClip / radius))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    gl.disable(gl.BLEND)
  }

  private renderBloom() {
    const gl = this.gl
    let p = this.progPrefilter.use(gl)
    gl.uniform1i(p.uniforms.uTex, this.scene.attach(0))
    gl.uniform1f(p.uniforms.uThreshold, BLOOM_THRESHOLD)
    this.quad.draw(this.bloomA)
    // separable blur ping-pong
    p = this.progBlur.use(gl)
    const texel: [number, number] = [1 / this.bloomA.width, 1 / this.bloomA.height]
    for (let i = 0; i < 3; i++) {
      gl.uniform1i(p.uniforms.uTex, this.bloomA.attach(0))
      gl.uniform2f(p.uniforms.uTexel, texel[0], texel[1])
      gl.uniform2f(p.uniforms.uDir, 1, 0)
      this.quad.draw(this.bloomB)
      gl.uniform1i(p.uniforms.uTex, this.bloomB.attach(0))
      gl.uniform2f(p.uniforms.uDir, 0, 1)
      this.quad.draw(this.bloomA)
    }
  }

  render(holes: HoleRender[], bursts: NebulaBurst[], time: number, drift: [number, number]) {
    const gl = this.gl
    this.renderScene(holes, bursts, time, drift)
    if (this.bloom) this.renderBloom()

    const { data, count } = packHoles(holes, this.aspect)
    const p = this.progComposite.use(gl)
    gl.uniform1i(p.uniforms.uScene, this.scene.attach(0))
    gl.uniform1i(p.uniforms.uBloom, (this.bloom ? this.bloomA : this.scene).attach(1))
    gl.uniform4fv(p.uniforms.uBH, data)
    gl.uniform1i(p.uniforms.uBHCount, count)
    gl.uniform1f(p.uniforms.uAspect, this.aspect)
    gl.uniform1f(p.uniforms.uBloomOn, this.bloom ? BLOOM_INTENSITY : 0)
    gl.uniform1f(p.uniforms.uLensOn, this.lensing ? 1 : 0)
    gl.uniform1f(p.uniforms.uTime, time)
    this.quad.draw(null)
  }

  screenshot(): string { return this.canvas.toDataURL('image/png') }

  dispose() {
    const gl = this.gl
    this.particles.dispose()
    deleteFBO(gl, this.scene); deleteFBO(gl, this.bloomA); deleteFBO(gl, this.bloomB)
    gl.deleteBuffer(this.starBuf); gl.deleteBuffer(this.bhQuadBuf); gl.deleteBuffer(this.quad.buffer)
    gl.deleteVertexArray(this.particleVAO)
    for (const pr of [this.progParticle, this.progStar, this.progNebula, this.progBH, this.progBurst,
      this.progPrefilter, this.progBlur, this.progComposite, this.progCopy]) {
      gl.deleteProgram(pr.program)
    }
  }
}

// Black hole augmented with its clip-space horizon radius for rendering.
export type HoleRender = BlackHole & { w_horizon?: number }
