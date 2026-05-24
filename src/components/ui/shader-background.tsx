"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

// ── Aurora Borealis background ────────────────────────────────────────────────
// Layered sinusoidal + noise aurora curtains rendered in WebGL via Three.js.

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const refsRef   = useRef<{
    renderer:    THREE.WebGLRenderer | null
    scene:       THREE.Scene | null
    camera:      THREE.OrthographicCamera | null
    mesh:        THREE.Mesh | null
    uniforms:    Record<string, { value: unknown }> | null
    animationId: number | null
  }>({ renderer: null, scene: null, camera: null, mesh: null, uniforms: null, animationId: null })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const refs = refsRef.current

    // ── Vertex shader (full-screen quad) ─────────────────────────────────────
    const vertexShader = /* glsl */ `
      attribute vec3 position;
      void main() { gl_Position = vec4(position, 1.0); }
    `

    // ── Aurora fragment shader ────────────────────────────────────────────────
    const fragmentShader = /* glsl */ `
      precision highp float;
      uniform vec2  resolution;
      uniform float time;

      // ── Noise utilities ───────────────────────────────────────────────────

      float hash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), f.x),
          mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x),
          f.y
        );
      }

      // 5-octave fBm — provides organic, large-scale undulation
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        vec2  s = vec2(3.1, 1.7);
        for (int i = 0; i < 5; i++) {
          v += a * smoothNoise(p);
          p  = p * 2.1 + s;
          s *= 1.3;
          a *= 0.5;
        }
        return v;
      }

      // ── Single aurora curtain ─────────────────────────────────────────────
      // Returns brightness at (uv) for a band centred at yCenter.
      float aurora(vec2 uv, float yCenter, float speed, float freq, float phase) {
        float t    = time * speed + phase;
        float wave = fbm(vec2(uv.x * freq + t * 0.35, t * 0.28)) * 0.26 - 0.08;
        float dy   = uv.y - yCenter - wave;
        float curl = smoothNoise(vec2(uv.x * 9.0 + t * 0.28, t * 0.14));
        float shp  = 14.0 + curl * 9.0;
        return exp(-dy * dy * shp * shp) * (0.50 + 0.50 * curl);
      }

      void main() {
        vec2  uv = gl_FragCoord.xy / resolution;
        // uv.y == 0 → bottom of screen,  uv.y == 1 → top

        // ── Base sky ─────────────────────────────────────────────────────
        // Deep midnight navy — stays visible behind the aurora
        vec3 col = vec3(0.008, 0.008, 0.028);

        // ── Aurora layers ─────────────────────────────────────────────────
        // Five bands at different heights, colours, and drift speeds.

        // 1. Emerald-green primary (brightest, widest)
        float a1 = aurora(uv, 0.56, 0.08, 1.9, 0.0);
        col += a1 * vec3(0.04, 0.78, 0.40) * 0.60;

        // 2. Cyan-teal secondary
        float a2 = aurora(uv, 0.49, 0.07, 2.5, 2.2);
        col += a2 * vec3(0.00, 0.60, 0.80) * 0.42;

        // 3. Deep violet-purple
        float a3 = aurora(uv, 0.63, 0.09, 1.4, 4.4);
        col += a3 * vec3(0.36, 0.06, 0.88) * 0.36;

        // 4. Rose-pink fringe (high, faint)
        float a4 = aurora(uv, 0.70, 0.10, 1.0, 6.8);
        col += a4 * vec3(0.88, 0.14, 0.58) * 0.25;

        // 5. Warm teal lower shimmer
        float a5 = aurora(uv, 0.42, 0.06, 3.1, 1.3);
        col += a5 * vec3(0.00, 0.82, 0.62) * 0.28;

        // ── Stars ─────────────────────────────────────────────────────────
        vec2  sg  = uv * 115.0;
        vec2  sgi = floor(sg);
        vec2  sgf = fract(sg);
        float sv  = hash(sgi);
        float sb  = smoothstep(0.90, 1.0, sv);
        float twk = 0.45 + 0.55 * sin(time * (1.2 + hash(sgi * 7.3 + 41.0) * 4.0));
        float sd  = length(sgf - 0.5);
        col += vec3(sb * twk * smoothstep(0.18, 0.0, sd) * 0.58);

        // ── Fades ─────────────────────────────────────────────────────────
        // Darken the very bottom so the dark panel area blends in
        col *= smoothstep(0.0, 0.20, uv.y);

        // Soft side vignette — keeps aurora centred
        float vx = clamp(uv.x * (1.0 - uv.x) * 5.0, 0.0, 1.0);
        col *= 0.68 + 0.32 * vx;

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `

    // ── Three.js setup ────────────────────────────────────────────────────────

    refs.scene    = new THREE.Scene()
    refs.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    refs.renderer.setClearColor(0x000000)
    refs.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

    refs.uniforms = {
      resolution: { value: [window.innerWidth, window.innerHeight] },
      time:       { value: 0.0 },
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,-1,0, -1,1,0, 1,1,0]),
        3,
      ),
    )

    refs.mesh = new THREE.Mesh(
      geo,
      new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: refs.uniforms,
        side: THREE.DoubleSide,
      }),
    )
    refs.scene.add(refs.mesh)

    const handleResize = () => {
      if (!refs.renderer || !refs.uniforms) return
      refs.renderer.setSize(window.innerWidth, window.innerHeight, false)
      refs.uniforms.resolution.value = [window.innerWidth, window.innerHeight]
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    const animate = () => {
      if (refs.uniforms)  refs.uniforms.time.value = (refs.uniforms.time.value as number) + 0.008
      if (refs.renderer && refs.scene && refs.camera)
        refs.renderer.render(refs.scene, refs.camera)
      refs.animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (refs.animationId) cancelAnimationFrame(refs.animationId)
      window.removeEventListener("resize", handleResize)
      refs.mesh?.geometry.dispose()
      if (refs.mesh?.material instanceof THREE.Material) refs.mesh.material.dispose()
      refs.renderer?.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full block"
      style={{ imageRendering: "auto" }}
    />
  )
}
