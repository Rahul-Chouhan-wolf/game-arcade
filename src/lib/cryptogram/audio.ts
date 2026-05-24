// ─── Cryptogram · Audio engine ────────────────────────────────────────────────
// Procedural ambient hum + crisp UI feedback via Web Audio API.
// Mirrors the Orbital audio pattern — class-based, optional, silent fallback.

export class CryptogramAudio {
  private ctx:    AudioContext | null = null
  private master: GainNode    | null = null
  private drones: OscillatorNode[]   = []
  private running = false

  constructor() {
    try {
      this.ctx    = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.setValueAtTime(0.28, this.ctx.currentTime)
      this.master.connect(this.ctx.destination)
    } catch {
      /* silent fallback — no audio context available */
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
    for (const osc of this.drones) {
      try { osc.stop() } catch { /* already stopped */ }
    }
    this.drones  = []
    this.running = false
    this.ctx?.close()
    this.ctx    = null
    this.master = null
  }

  // ── Ambient layer ──────────────────────────────────────────────────────────
  // Subtle tension-building hum reminiscent of cold-war cipher rooms.

  private buildAmbience() {
    if (!this.ctx || !this.master) return
    this.addDrone(55,   0.014)   // deep sub bass
    this.addDrone(110,  0.009)   // bass
    this.addDrone(220,  0.005)   // mid (octave)
    this.addShimmer(3200, 0.002) // barely-audible high presence
  }

  private addDrone(freq: number, gain: number) {
    if (!this.ctx || !this.master) return
    const osc    = this.ctx.createOscillator()
    const gainN  = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type               = 'sine'
    osc.frequency.value    = freq
    gainN.gain.value       = gain
    filter.type            = 'lowpass'
    filter.frequency.value = freq * 4

    osc.connect(filter)
    filter.connect(gainN)
    gainN.connect(this.master)
    osc.start()
    this.drones.push(osc)

    // Slow LFO breathing
    const lfo  = this.ctx.createOscillator()
    const lfoG = this.ctx.createGain()
    lfo.frequency.value = 0.07 + Math.random() * 0.08
    lfoG.gain.value     = gain * 0.35
    lfo.connect(lfoG)
    lfoG.connect(gainN.gain)
    lfo.start()
    this.drones.push(lfo)
  }

  private addShimmer(freq: number, gain: number) {
    if (!this.ctx || !this.master) return
    const osc  = this.ctx.createOscillator()
    const gainN = this.ctx.createGain()
    osc.type           = 'sine'
    osc.frequency.value = freq
    gainN.gain.value    = gain
    osc.connect(gainN)
    gainN.connect(this.master)
    osc.start()
    this.drones.push(osc)
  }

  // ── Sound effects ──────────────────────────────────────────────────────────

  /** Soft typewriter-style click when selecting a cipher letter. */
  playSelect() {
    if (!this.ctx || !this.master) return
    const t    = this.ctx.currentTime
    const buf  = this.ctx.createBuffer(1, 512, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < 512; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 80)
    const src  = this.ctx.createBufferSource()
    const env  = this.ctx.createGain()
    const flt  = this.ctx.createBiquadFilter()
    flt.type           = 'bandpass'
    flt.frequency.value = 1800
    flt.Q.value        = 0.6
    src.buffer = buf
    env.gain.setValueAtTime(0.12, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    src.connect(flt)
    flt.connect(env)
    env.connect(this.master)
    src.start(t)
  }

  /** Satisfying click when typing a letter assignment. */
  playKeyClick() {
    if (!this.ctx || !this.master) return
    const t   = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type           = 'square'
    osc.frequency.setValueAtTime(1200, t)
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04)
    env.gain.setValueAtTime(0.07, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t); osc.stop(t + 0.07)
  }

  /** Ascending chime when a full word becomes correct. */
  playWordReveal() {
    if (!this.ctx || !this.master) return
    const t  = this.ctx.currentTime
    ;[880, 1047].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator()
      const env = this.ctx!.createGain()
      const st  = t + i * 0.09
      osc.type           = 'sine'
      osc.frequency.value = freq
      env.gain.setValueAtTime(0, st)
      env.gain.linearRampToValueAtTime(0.11, st + 0.02)
      env.gain.exponentialRampToValueAtTime(0.001, st + 0.38)
      osc.connect(env)
      env.connect(this.master!)
      osc.start(st); osc.stop(st + 0.40)
    })
  }

  /** Full solve fanfare — triumphant ascending arpeggio. */
  playSolve() {
    if (!this.ctx || !this.master) return
    const t     = this.ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.50] // C5 E5 G5 B5 C6
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator()
      const env = this.ctx!.createGain()
      const st  = t + i * 0.13
      osc.type           = 'sine'
      osc.frequency.value = freq
      env.gain.setValueAtTime(0, st)
      env.gain.linearRampToValueAtTime(0.22, st + 0.05)
      env.gain.exponentialRampToValueAtTime(0.001, st + 1.0)
      osc.connect(env)
      env.connect(this.master!)
      osc.start(st); osc.stop(st + 1.1)
    })
  }

  /** Short error buzz when input is conflicting / impossible. */
  playError() {
    if (!this.ctx || !this.master) return
    const t   = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type           = 'sawtooth'
    osc.frequency.value = 140
    env.gain.setValueAtTime(0.08, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t); osc.stop(t + 0.17)
  }

  /** Soft reveal chime for hint use. */
  playHint() {
    if (!this.ctx || !this.master) return
    const t   = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, t)
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.12)
    env.gain.setValueAtTime(0.13, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t); osc.stop(t + 0.37)
  }

  /** Backspace / clear sound. */
  playClear() {
    if (!this.ctx || !this.master) return
    const t   = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(500, t)
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.1)
    env.gain.setValueAtTime(0.06, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t); osc.stop(t + 0.14)
  }
}
