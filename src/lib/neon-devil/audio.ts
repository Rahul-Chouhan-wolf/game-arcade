// ═══════════════════════════════════════════════════════════════════════════
// Neon Devil — Web Audio Synth System
// All sounds synthesized — no external files needed
// ═══════════════════════════════════════════════════════════════════════════

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.3
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function getMaster(): GainNode {
  getCtx()
  return masterGain!
}

// ── Jump ──
export function playJump(): void {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(280, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(560, c.currentTime + 0.08)
  gain.gain.setValueAtTime(0.15, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12)
  osc.connect(gain).connect(getMaster())
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.12)
}

// ── Land ──
export function playLand(): void {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(120, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.06)
  gain.gain.setValueAtTime(0.1, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08)
  osc.connect(gain).connect(getMaster())
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.08)
}

// ── Death ──
export function playDeath(): void {
  const c = getCtx()
  // Noise burst + low thud
  const bufSize = c.sampleRate * 0.15
  const buffer = c.createBuffer(1, bufSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2)
  }
  const noise = c.createBufferSource()
  noise.buffer = buffer
  const nGain = c.createGain()
  nGain.gain.setValueAtTime(0.25, c.currentTime)
  nGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15)
  noise.connect(nGain).connect(getMaster())
  noise.start(c.currentTime)

  // Low thud
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(80, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.2)
  gain.gain.setValueAtTime(0.2, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25)
  osc.connect(gain).connect(getMaster())
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.25)
}

// ── Checkpoint ──
export function playCheckpoint(): void {
  const c = getCtx()
  const notes = [523, 659, 784] // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    const t = c.currentTime + i * 0.08
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.connect(gain).connect(getMaster())
    osc.start(t)
    osc.stop(t + 0.2)
  })
}

// ── Bounce / Spring ──
export function playBounce(): void {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.1)
  gain.gain.setValueAtTime(0.12, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15)
  osc.connect(gain).connect(getMaster())
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.15)
}

// ── Dash ──
export function playDash(): void {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(440, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.06)
  gain.gain.setValueAtTime(0.08, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08)
  osc.connect(gain).connect(getMaster())
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.08)
}

// ── Collapse ──
export function playCollapse(): void {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(150, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.15)
  gain.gain.setValueAtTime(0.1, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
  osc.connect(gain).connect(getMaster())
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.2)
}

// ── Level Complete ──
export function playLevelComplete(): void {
  const c = getCtx()
  const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    const t = c.currentTime + i * 0.12
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(gain).connect(getMaster())
    osc.start(t)
    osc.stop(t + 0.35)
  })
}

// ── Background ambience (low drone) ──
let droneOsc: OscillatorNode | null = null
let droneGain: GainNode | null = null

export function startDrone(): void {
  if (droneOsc) return
  const c = getCtx()
  droneOsc = c.createOscillator()
  droneGain = c.createGain()
  droneOsc.type = 'sine'
  droneOsc.frequency.setValueAtTime(55, c.currentTime) // A1
  droneGain.gain.setValueAtTime(0, c.currentTime)
  droneGain.gain.linearRampToValueAtTime(0.04, c.currentTime + 2)
  droneOsc.connect(droneGain).connect(getMaster())
  droneOsc.start()

  // Add subtle LFO modulation
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.type = 'sine'
  lfo.frequency.value = 0.3
  lfoGain.gain.value = 3
  lfo.connect(lfoGain).connect(droneOsc.frequency)
  lfo.start()
}

export function stopDrone(): void {
  if (!droneOsc || !droneGain) return
  const c = getCtx()
  droneGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.5)
  setTimeout(() => {
    droneOsc?.stop()
    droneOsc = null
    droneGain = null
  }, 600)
}

// ── Volume control ──
export function setVolume(v: number): void {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v))
}

// ── Initialize (call on first user interaction) ──
export function initAudio(): void {
  getCtx()
}
