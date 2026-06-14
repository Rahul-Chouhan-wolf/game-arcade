// ─── Element Flow · GLSL (WebGL2 / GLSL ES 3.00) ─────────────────────────────
// Standard grid-based Navier–Stokes solver shaders, written for this app.

export const BASE_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

export const COPY_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
out vec4 fragColor;
void main () { fragColor = texture(uTexture, vUv); }`

export const CLEAR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
out vec4 fragColor;
void main () { fragColor = value * texture(uTexture, vUv); }`

export const SPLAT_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
out vec4 fragColor;
void main () {
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  vec3 base = texture(uTarget, vUv).xyz;
  fragColor = vec4(base + splat, 1.0);
}`

export const ADVECTION_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform vec2 dyeTexelSize;
uniform float dt;
uniform float dissipation;
out vec4 fragColor;

vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}
void main () {
  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
  vec4 result = bilerp(uSource, coord, dyeTexelSize);
  float decay = 1.0 + dissipation * dt;
  fragColor = result / decay;
}`

export const DIVERGENCE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  float div = 0.5 * (R - L + T - B);
  fragColor = vec4(div, 0.0, 0.0, 1.0);
}`

export const CURL_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  float vorticity = R - L - T + B;
  fragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}`

export const VORTICITY_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
out vec4 fragColor;
void main () {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity += force * dt;
  velocity = clamp(velocity, -1000.0, 1000.0);
  fragColor = vec4(velocity, 0.0, 1.0);
}`

export const PRESSURE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
out vec4 fragColor;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}`

export const GRADIENT_SUBTRACT_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity.xy -= vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}`

// ── Bloom ──────────────────────────────────────────────────────────────────
export const BLOOM_PREFILTER_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform vec3 curve;
uniform float threshold;
out vec4 fragColor;
void main () {
  vec3 c = texture(uTexture, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - curve.x, 0.0, curve.y);
  rq = curve.z * rq * rq;
  c *= max(rq, br - threshold) / max(br, 0.0001);
  fragColor = vec4(c, 1.0);
}`

export const BLOOM_BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
uniform sampler2D uTexture;
out vec4 fragColor;
void main () {
  vec4 sum = texture(uTexture, vL);
  sum += texture(uTexture, vR);
  sum += texture(uTexture, vT);
  sum += texture(uTexture, vB);
  sum *= 0.25;
  fragColor = sum;
}`

export const BLOOM_FINAL_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
uniform sampler2D uTexture;
uniform float intensity;
out vec4 fragColor;
void main () {
  vec4 sum = texture(uTexture, vL);
  sum += texture(uTexture, vR);
  sum += texture(uTexture, vT);
  sum += texture(uTexture, vB);
  sum *= 0.25;
  fragColor = sum * intensity;
}`

// ── Final display: dye + bloom + vignette + grain ──────────────────────────
export const DISPLAY_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform sampler2D uBloom;
uniform float uBloomEnabled;
uniform float uBackground;   // 0 = dark, 1 = light
uniform float uTime;
uniform vec2 uResolution;
out vec4 fragColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main () {
  vec3 c = texture(uTexture, vUv).rgb;

  if (uBloomEnabled > 0.5) {
    vec3 bloom = texture(uBloom, vUv).rgb;
    // soft additive glow with a gentle filmic shoulder
    c += bloom;
  }

  // tone shaping — keep highlights from clipping to white (avoids "muddy")
  c = c / (c + vec3(0.5)) * 1.5;

  // background tint
  if (uBackground > 0.5) {
    c = mix(vec3(0.93, 0.94, 0.97), c, clamp(length(c) * 1.2, 0.0, 1.0));
  }

  // subtle vignette
  vec2 q = vUv - 0.5;
  float vig = smoothstep(0.95, 0.3, length(q));
  c *= mix(1.0, vig, 0.5);

  // tiny film grain so flat areas never look dead
  float g = (hash(vUv * uResolution + uTime) - 0.5) * 0.025;
  c += g;

  fragColor = vec4(c, 1.0);
}`
