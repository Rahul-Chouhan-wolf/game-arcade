// ─── Singularity · self-contained WebGL2 helpers ─────────────────────────────
// Kept local to this app so it shares no logic with other modules.

export interface FBO {
  texture: WebGLTexture
  fbo: WebGLFramebuffer
  width: number
  height: number
  attach(id: number): number
}

export interface DoubleFBO {
  width: number
  height: number
  read: FBO
  write: FBO
  swap(): void
}

export function getGL(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance',
  }) as WebGL2RenderingContext | null
  if (!gl) return null
  gl.getExtension('EXT_color_buffer_float')
  gl.getExtension('OES_texture_float_linear')
  return gl
}

export function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const head = src.split('\n').slice(0, 3).join(' ').slice(0, 90)
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`Shader compile failed [${head}]: ${log}`)
  }
  return sh
}

export class Program {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation | null> = {}
  constructor(gl: WebGL2RenderingContext, vs: string, fs: string) {
    const v = compile(gl, gl.VERTEX_SHADER, vs)
    const f = compile(gl, gl.FRAGMENT_SHADER, fs)
    this.program = gl.createProgram()!
    gl.attachShader(this.program, v)
    gl.attachShader(this.program, f)
    gl.linkProgram(this.program)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(this.program))
    }
    gl.deleteShader(v); gl.deleteShader(f)
    const n = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS) as number
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(this.program, i)!
      const name = info.name.replace(/\[0\]$/, '')
      this.uniforms[name] = gl.getUniformLocation(this.program, info.name)
    }
  }
  use(gl: WebGL2RenderingContext) { gl.useProgram(this.program); return this }
}

export function createFBO(
  gl: WebGL2RenderingContext, w: number, h: number, filter: number = gl.NEAREST,
  internal: number = gl.RGBA16F, format: number = gl.RGBA, type: number = gl.HALF_FLOAT,
): FBO {
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null)
  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  return {
    texture, fbo, width: w, height: h,
    attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id },
  }
}

export function createDoubleFBO(
  gl: WebGL2RenderingContext, w: number, h: number, filter: number = gl.NEAREST,
): DoubleFBO {
  let a = createFBO(gl, w, h, filter)
  let b = createFBO(gl, w, h, filter)
  return {
    width: w, height: h,
    get read() { return a }, set read(v) { a = v },
    get write() { return b }, set write(v) { b = v },
    swap() { const t = a; a = b; b = t },
  }
}

/** Bind a quad and return a fullscreen-blit function. */
export function createQuad(gl: WebGL2RenderingContext) {
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  return {
    buffer: buf,
    draw(target: FBO | null) {
      if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, target.width, target.height) }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight) }
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
  }
}

export function deleteFBO(gl: WebGL2RenderingContext, f?: FBO) {
  if (!f) return
  gl.deleteTexture(f.texture)
  gl.deleteFramebuffer(f.fbo)
}
