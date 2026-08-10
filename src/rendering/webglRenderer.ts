import type { Lut3D } from '../color/lut'
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders'

export type WebGlRendererFailure =
  | 'context-unavailable'
  | 'shader-compilation'
  | 'program-linking'
  | 'texture-upload'

export class WebGlRendererError extends Error {
  constructor(
    readonly code: WebGlRendererFailure,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'WebGlRendererError'
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new WebGlRendererError('shader-compilation', 'Unable to create shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader) ?? 'unknown shader error'
    gl.deleteShader(shader)
    throw new WebGlRendererError('shader-compilation', detail)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!program) {
    throw new WebGlRendererError('program-linking', 'Unable to create program')
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const detail = gl.getProgramInfoLog(program) ?? 'unknown program error'
    gl.deleteProgram(program)
    throw new WebGlRendererError('program-linking', detail)
  }
  return program
}

function lutBytes(lut: Lut3D): Uint8Array {
  if (lut.data.length !== lut.size ** 3 * 3) {
    throw new RangeError('LUT data length does not match its dimensions')
  }
  return Uint8Array.from(lut.data, (channel) =>
    Math.round(Math.min(1, Math.max(0, channel)) * 255),
  )
}

export interface WebGlArtworkRenderer {
  render(image: HTMLImageElement, strength: number): void
  dispose(): void
}

export function createWebglArtworkRenderer(
  canvas: HTMLCanvasElement,
  lut: Lut3D,
): WebGlArtworkRenderer {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  })
  if (!gl) {
    throw new WebGlRendererError(
      'context-unavailable',
      'WebGL2 is unavailable on this display',
    )
  }

  const program = createProgram(gl)
  const position = gl.getAttribLocation(program, 'a_position')
  const sourceUniform = gl.getUniformLocation(program, 'u_source')
  const lutUniform = gl.getUniformLocation(program, 'u_lut')
  const strengthUniform = gl.getUniformLocation(program, 'u_strength')
  const sizeUniform = gl.getUniformLocation(program, 'u_lut_size')
  const buffer = gl.createBuffer()
  const sourceTexture = gl.createTexture()
  const lutTexture = gl.createTexture()
  if (!buffer || !sourceTexture || !lutTexture) {
    throw new WebGlRendererError('texture-upload', 'Unable to allocate GPU resources')
  }

  try {
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_3D, lutTexture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGB8,
      lut.size,
      lut.size,
      lut.size,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      lutBytes(lut),
    )
    gl.uniform1i(lutUniform, 1)
    gl.uniform1f(sizeUniform, lut.size)
  } catch (cause) {
    throw new WebGlRendererError(
      'texture-upload',
      'Unable to upload the compensation LUT',
      { cause },
    )
  }

  return {
    render(image, strength) {
      if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
        throw new RangeError('strength must be in [0, 1]')
      }
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      try {
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.useProgram(program)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image,
        )
        gl.uniform1i(sourceUniform, 0)
        gl.uniform1f(strengthUniform, strength)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      } catch (cause) {
        throw new WebGlRendererError(
          'texture-upload',
          'Unable to render the source image on the GPU',
          { cause },
        )
      }
    },
    dispose() {
      gl.deleteTexture(sourceTexture)
      gl.deleteTexture(lutTexture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    },
  }
}
