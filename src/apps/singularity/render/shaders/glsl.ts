// ─── Singularity · GLSL (WebGL2 / GLSL ES 3.00) ──────────────────────────────
// Original shaders: GPU particle integration + layered cosmic rendering + post.

export const MAX_BH = 6

export const QUAD_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`

// ── Shared noise ─────────────────────────────────────────────────────────────
const NOISE = /* glsl */ `
float hash21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
  vec2 u=f*f*(3.-2.*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){v+=a*vnoise(p); p*=2.02; a*=.5;} return v; }
`

// ── Particle state update: pos.xy + vel in .zw ──────────────────────────────
export const UPDATE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uState;
uniform vec4 uBH[${MAX_BH}];   // x,y (aspect space), mass, horizon
uniform int uBHCount;
uniform float uDt;
uniform float uTime;
uniform float uAspect;
uniform float uChaos;
${'' /* noise for respawn jitter */}
float h21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }

void main(){
  vec4 s = texture(uState, vUv);
  vec2 pos = s.xy;       // aspect space: x in [-aspect,aspect], y in [-1,1]
  vec2 vel = s.zw;

  float consumed = 0.0;
  for(int i=0;i<${MAX_BH};i++){
    if(i>=uBHCount) break;
    vec2 d = uBH[i].xy - pos;
    float r2 = dot(d,d) + 0.00025;
    float r = sqrt(r2);
    float m = uBH[i].z;
    vec2 dir = d / r;
    // gravity + tangential swirl
    float g = (0.55 * m) / r2;
    vec2 tang = vec2(-dir.y, dir.x);
    vel += dir * g * uDt;
    vel += tang * g * (0.9 + uChaos) * uDt;
    // consumption inside event horizon
    if(r < uBH[i].w){ consumed = 1.0; }
  }

  vel *= 0.992;
  float sp = length(vel);
  if(sp > 2.4) vel *= 2.4/sp;
  pos += vel * uDt;

  // respawn consumed or far-escaped particles at a random edge
  float esc = step(2.6, max(abs(pos.x)/max(uAspect,0.001), abs(pos.y)));
  if(consumed > 0.5 || esc > 0.5){
    float a = h21(vUv + uTime) * 6.28318;
    float rad = 1.6 + h21(vUv*1.7 - uTime)*1.2;
    pos = vec2(cos(a)*rad*uAspect, sin(a)*rad);
    vel = vec2(-sin(a), cos(a)) * (0.05 + h21(vUv*3.1)*0.05);
  }

  frag = vec4(pos, vel);
}`

// ── Particle render (reads state in the vertex shader) ──────────────────────
export const PARTICLE_VS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform int uSide;
uniform float uAspect;
uniform vec2 uResolution;
out float vSpeed;
void main(){
  int id = gl_VertexID;
  ivec2 uv = ivec2(id % uSide, id / uSide);
  vec4 s = texelFetch(uState, uv, 0);
  vec2 pos = s.xy;
  vSpeed = length(s.zw);
  vec2 clip = vec2(pos.x / uAspect, pos.y);
  gl_Position = vec4(clip, 0.0, 1.0);
  float sz = (1.2 + vSpeed * 2.2) * (uResolution.y / 900.0);
  gl_PointSize = clamp(sz, 1.0, 6.0);
}`

export const PARTICLE_FS = /* glsl */ `#version 300 es
precision highp float;
in float vSpeed;
out vec4 frag;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if(r > 0.5) discard;
  float glow = smoothstep(0.5, 0.0, r);
  // slow = cool blue, fast = hot white — additive, never muddy
  float t = clamp(vSpeed * 0.9, 0.0, 1.0);
  vec3 cool = vec3(0.3, 0.6, 1.0);
  vec3 hot  = vec3(1.0, 0.92, 0.78);
  vec3 col = mix(cool, hot, t);
  frag = vec4(col * glow * (0.5 + t*0.8), glow);
}`

// ── Starfield (static buffer of random points) ──────────────────────────────
export const STAR_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in float aSize;
layout(location=2) in float aPhase;
uniform float uTime;
uniform vec2 uDrift;
out float vTw;
void main(){
  vec2 p = aPos + uDrift;
  p = mod(p + 1.0, 2.0) - 1.0;
  gl_Position = vec4(p, 0.0, 1.0);
  vTw = 0.6 + 0.4 * sin(uTime * 0.6 + aPhase);
  gl_PointSize = aSize;
}`

export const STAR_FS = /* glsl */ `#version 300 es
precision highp float;
in float vTw;
out vec4 frag;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if(r>0.5) discard;
  float g = smoothstep(0.5,0.0,r);
  frag = vec4(vec3(0.85,0.9,1.0) * g * vTw, g);
}`

// ── Nebula fog (procedural, animated) ───────────────────────────────────────
export const NEBULA_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform float uTime;
uniform float uAspect;
${NOISE}
void main(){
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.2;
  float t = uTime * 0.02;
  float n = fbm(p * 1.3 + vec2(t, -t*0.7));
  float n2 = fbm(p * 2.1 - vec2(t*0.5, t));
  vec3 c1 = vec3(0.04, 0.03, 0.11);   // indigo
  vec3 c2 = vec3(0.11, 0.04, 0.15);   // violet
  vec3 c3 = vec3(0.01, 0.06, 0.13);   // teal-blue
  vec3 col = mix(c1, c2, n) + c3 * n2 * 0.5;
  col *= 0.28 + 0.45 * n;
  frag = vec4(col, 1.0);
}`

// ── Black hole: dark core + glowing accretion ring (one quad per hole) ───────
export const BH_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
uniform vec2 uCenter;   // clip space
uniform float uRadius;  // clip space
out vec2 vLocal;
void main(){
  vLocal = aPos;
  gl_Position = vec4(uCenter + aPos * uRadius, 0.0, 1.0);
}`

export const BH_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
out vec4 frag;
uniform vec3 uColor;
uniform float uSpin;
uniform float uHorizonFrac;  // horizon radius / quad radius
void main(){
  float r = length(vLocal);
  if(r > 1.0) discard;
  float ang = atan(vLocal.y, vLocal.x);
  // event horizon: pure black core
  float core = smoothstep(uHorizonFrac, uHorizonFrac*0.85, r);
  // accretion ring with rotating brightness
  float ring = smoothstep(0.18, 0.0, abs(r - (uHorizonFrac + 0.32)));
  float swirl = 0.6 + 0.4 * sin(ang*3.0 + uSpin*4.0);
  float doppler = 0.6 + 0.4 * cos(ang - uSpin);
  vec3 disk = uColor * ring * swirl * doppler * 2.2;
  // photon glow falloff outside
  float glow = smoothstep(1.0, uHorizonFrac, r) * 0.5;
  vec3 col = disk + uColor * glow;
  col *= core;  // punch out the black core
  frag = vec4(col, max(ring, glow) * core);
}`

// ── Bloom ────────────────────────────────────────────────────────────────────
export const BLOOM_PREFILTER_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag;
uniform sampler2D uTex; uniform float uThreshold;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float b = max(c.r, max(c.g, c.b));
  frag = vec4(c * smoothstep(uThreshold, uThreshold+0.3, b), 1.0);
}`

export const BLOOM_BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag;
uniform sampler2D uTex; uniform vec2 uDir; uniform vec2 uTexel;
void main(){
  vec3 sum = texture(uTex, vUv).rgb * 0.227;
  vec2 o1 = uDir * uTexel * 1.384;
  vec2 o2 = uDir * uTexel * 3.230;
  sum += texture(uTex, vUv + o1).rgb * 0.316;
  sum += texture(uTex, vUv - o1).rgb * 0.316;
  sum += texture(uTex, vUv + o2).rgb * 0.070;
  sum += texture(uTex, vUv - o2).rgb * 0.070;
  frag = vec4(sum, 1.0);
}`

// ── Final composite: lensing + bloom + chromatic aberration + vignette ──────
export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec4 uBH[${MAX_BH}];
uniform int uBHCount;
uniform float uAspect;
uniform float uBloomOn;
uniform float uLensOn;
uniform float uTime;

void main(){
  vec2 uv = vUv;
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = (uv - 0.5) * 2.0 * asp;

  // gravitational lensing: pull sample coords toward each black hole
  vec2 disp = vec2(0.0);
  if(uLensOn > 0.5){
    for(int i=0;i<${MAX_BH};i++){
      if(i>=uBHCount) break;
      vec2 d = uBH[i].xy - p;
      float r = length(d) + 0.001;
      float strength = uBH[i].z * 0.02;
      disp += normalize(d) * strength / (r*r + 0.05);
    }
  }
  vec2 suv = uv + disp / asp * 0.5;

  // subtle chromatic aberration scaled by lensing displacement
  float ca = min(length(disp) * 0.012, 0.004) + 0.0004;
  vec3 col;
  col.r = texture(uScene, suv + vec2(ca,0.0)).r;
  col.g = texture(uScene, suv).g;
  col.b = texture(uScene, suv - vec2(ca,0.0)).b;

  if(uBloomOn > 0.5) col += texture(uBloom, uv).rgb * 0.9;

  // tone + vignette
  col = col / (col + 0.6) * 1.6;
  float vig = smoothstep(1.25, 0.35, length((uv-0.5)*2.0));
  col *= mix(0.55, 1.0, vig);

  frag = vec4(col, 1.0);
}`

export const COPY_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag; uniform sampler2D uTex;
void main(){ frag = texture(uTex, vUv); }`
