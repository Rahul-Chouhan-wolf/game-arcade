// ─── Orbital · Audio engine ───────────────────────────────────────────────────
// Procedural cosmic ambient soundtrack + UI sound effects via Web Audio API.

export class OrbitalAudio {
  private ctx:    AudioContext | null = null
  private master: GainNode    | null = null
  private drones: (OscillatorNode | AudioBufferSourceNode)[] = []
  private running = false

  constructor() {
    try {
      this.ctx    = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.setValueAtTime(0.35, this.ctx.currentTime)
      this.master.connect(this.ctx.destination)
    } catch {
      /* no audio context — silent fallback */
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start() {
    if (!this.ctx || !this.master || this.running) return
    this.running = true
    this.ctx.resume().then(() => this.buildAmbience())
  }

  pause()  { this.ctx?.suspend() }
  resume() { this.ctx?.resume() }

  dispose() {
    for (const node of this.drones) {
      try { (node as OscillatorNode).stop?.() } catch { /* already stopped */ }
    }
    this.drones = []
    this.ctx?.close()
    this.ctx    = null
    this.master = null
    this.running = false
  }

  // ── Ambient layer ──────────────────────────────────────────────────────────

  private buildAmbience() {
    if (!this.ctx || !this.master) return

    // Deep sub-bass drone (40 Hz)
    this.addDrone(40,  0.018, 'sine')
    // Bass harmonic (80 Hz)
    this.addDrone(80,  0.012, 'sine')
    // Mid pad (160 Hz — cosmic hum)
    this.addDrone(160, 0.007, 'sine')
    // High shimmer — barely audible presence
    this.addShimmer()
  }

  private addDrone(freq: number, gain: number, type: OscillatorType) {
    if (!this.ctx || !this.master) return
    const osc    = this.ctx.createOscillator()
    const gainN  = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type              = type
    osc.frequency.value   = freq
    gainN.gain.value      = gain
    filter.type           = 'lowpass'
    filter.frequency.value = freq * 3.5

    osc.connect(filter)
    filter.connect(gainN)
    gainN.connect(this.master)
    osc.start()
    this.drones.push(osc)

    // Slow LFO modulation for organic breathing feel
    const lfo   = this.ctx.createOscillator()
    const lfoG  = this.ctx.createGain()
    lfo.frequency.value = 0.08 + Math.random() * 0.12
    lfoG.gain.value     = gain * 0.4
    lfo.connect(lfoG)
    lfoG.connect(gainN.gain)
    lfo.start()
    this.drones.push(lfo)
  }

  private addShimmer() {
    if (!this.ctx || !this.master) return
    const osc   = this.ctx.createOscillator()
    const gainN = this.ctx.createGain()
    osc.type           = 'sine'
    osc.frequency.value = 2800
    gainN.gain.value    = 0.003
    osc.connect(gainN)
    gainN.connect(this.master)
    osc.start()
    this.drones.push(osc)
  }

  // ── Sound effects ──────────────────────────────────────────────────────────

  playLaunch() {
    if (!this.ctx || !this.master) return
    const t   = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, t)
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.35)
    env.gain.setValueAtTime(0.28, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.40)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t); osc.stop(t + 0.42)
  }

  playWin() {
    if (!this.ctx || !this.master) return
    const t     = this.ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.50]  // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator()
      const env = this.ctx!.createGain()
      const st  = t + i * 0.17
      osc.type           = 'sine'
      osc.frequency.value = freq
      env.gain.setValueAtTime(0, st)
      env.gain.linearRampToValueAtTime(0.22, st + 0.06)
      env.gain.exponentialRampToValueAtTime(0.001, st + 0.90)
      osc.connect(env)
      env.connect(this.master!)
      osc.start(st); osc.stop(st + 0.95)
    })
  }

  playAbsorb() {
    if (!this.ctx || !this.master) return
    const t   = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(280, t)
    osc.frequency.exponentialRampToValueAtTime(18, t + 0.75)
    env.gain.setValueAtTime(0.22, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.80)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t); osc.stop(t + 0.82)
  }

  playAimStart() {
    if (!this.ctx || !this.master) return
    const t   = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type           = 'sine'
    osc.frequency.value = 880
    env.gain.setValueAtTime(0.06, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t); osc.stop(t + 0.16)
  }

  // Adjust master volume for gravity proximity (call from game loop)
  setGravityIntensity(n: number) {
    if (!this.master || !this.ctx) return
    const vol = 0.30 + Math.min(n * 0.25, 0.25)
    this.master.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.3)
  }
}
