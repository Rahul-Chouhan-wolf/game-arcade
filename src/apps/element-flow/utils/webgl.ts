// ─── Element Flow · WebGL2 helpers ───────────────────────────────────────────
// Thin wrappers around WebGL2 for the ping-pong fluid solver. No globals.

export interface FBO {
  texture: WebGLTexture
  fbo: WebGLFramebuffer
  width: number
  height: number
  texelSizeX: number
  texelSizeY: number
  attach(id: number): number
}

export interface DoubleFBO {
  width: number
  height: number
  texelSizeX: number
  texelSizeY: number
  read: FBO
  write: FBO
  swap(): void
}

export function getWebGL2(canvas: HTMLCanvasElement): {
  gl: WebGL2RenderingContext
  halfFloat: boolean
} | null {
  const params: WebGLContextAttributes = {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  }
  const gl = canvas.getContext('webgl2', params) as WebGL2RenderingContext | null
  if (!gl) return null
  // RGBA16F render targets require this extension in WebGL2.
  const halfFloat = !!gl.getExtension('EXT_color_buffer_float')
  gl.getExtension('OES_texture_float_linear')
  return { gl, halfFloat }
}

export function compileShader(
  gl: WebGL2RenderingContext, type: number, source: string,
): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    const head = source.split('\n').slice(0, 3).join(' ').slice(0, 80)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error [${head}]: ${log}`)
  }
  return shader
}

export class Program {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation> = {}

  constructor(gl: WebGL2RenderingContext, vert: WebGLShader, frag: WebGLShader) {
    this.program = gl.createProgram()!
    gl.attachShader(this.program, vert)
    gl.attachShader(this.program, frag)
    gl.linkProgram(this.program)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(this.program))
    }
    const count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS) as number
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(this.program, i)!.name
      this.uniforms[name] = gl.getUniformLocation(this.program, name)!
    }
  }
}

export function createFBO(
  gl: WebGL2RenderingContext,
  w: number, h: number, internalFormat: number, format: number, type: number, filter: number,
): FBO {
  gl.activeTexture(gl.TEXTURE0)
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)

  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.viewport(0, 0, w, h)
  gl.clear(gl.COLOR_BUFFER_BIT)

  return {
    texture, fbo, width: w, height: h,
    texelSizeX: 1 / w, texelSizeY: 1 / h,
    attach(id: number) {
      gl.activeTexture(gl.TEXTURE0 + id)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      return id
    },
  }
}

export function createDoubleFBO(
  gl: WebGL2RenderingContext,
  w: number, h: number, internalFormat: number, format: number, type: number, filter: number,
): DoubleFBO {
  let fbo1 = createFBO(gl, w, h, internalFormat, format, type, filter)
  let fbo2 = createFBO(gl, w, h, internalFormat, format, type, filter)
  return {
    width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
    get read() { return fbo1 },
    set read(v) { fbo1 = v },
    get write() { return fbo2 },
    set write(v) { fbo2 = v },
    swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t },
  }
}

/** Fullscreen-triangle blitter bound to a quad buffer. */
export function createBlit(gl: WebGL2RenderingContext) {
  const buffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW)
  const elem = gl.createBuffer()!
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elem)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(0)

  return (target: FBO | null) => {
    if (target == null) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    } else {
      gl.viewport(0, 0, target.width, target.height)
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
  }
}
