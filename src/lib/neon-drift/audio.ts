// ─── Neon Drift · Audio engine ────────────────────────────────────────────────
// Synthesised engine hum + tyre screech via Web Audio API.
// Instantiate once, call update() each game frame, dispose() on unmount.

export class AudioEngine {
  private ctx: AudioContext

  // Engine hum chain
  private engineOsc: OscillatorNode
  private engineGain: GainNode
  private engineFilter: BiquadFilterNode

  // Screech chain (tyre drift)
  private screechOsc: OscillatorNode
  private screechGain: GainNode
  private screechFilter: BiquadFilterNode

  // Low-frequency bass thump
  private bassOsc: OscillatorNode
  private bassGain: GainNode

  // Master
  private masterGain: GainNode

  constructor() {
    this.ctx = new AudioContext()

    const ctx = this.ctx
    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0.35
    this.masterGain.connect(ctx.destination)

    // ── Engine oscillator (sawtooth → band-pass filter → gain) ────────────
    this.engineOsc    = ctx.createOscillator()
    this.engineFilter = ctx.createBiquadFilter()
    this.engineGain   = ctx.createGain()

    this.engineOsc.type = 'sawtooth'
    this.engineOsc.frequency.value = 90
    this.engineFilter.type = 'bandpass'
    this.engineFilter.frequency.value = 300
    this.engineFilter.Q.value = 1.4
    this.engineGain.gain.value = 0.0   // starts silent (no throttle)

    this.engineOsc.connect(this.engineFilter)
    this.engineFilter.connect(this.engineGain)
    this.engineGain.connect(this.masterGain)
    this.engineOsc.start()

    // ── Screech oscillator (noise-like square + low-pass) ─────────────────
    this.screechOsc    = ctx.createOscillator()
    this.screechFilter = ctx.createBiquadFilter()
    this.screechGain   = ctx.createGain()

    this.screechOsc.type = 'square'
    this.screechOsc.frequency.value = 480
    this.screechFilter.type = 'lowpass'
    this.screechFilter.frequency.value = 2800
    this.screechFilter.Q.value = 0.5
    this.screechGain.gain.value = 0.0  // silent until drift

    this.screechOsc.connect(this.screechFilter)
    this.screechFilter.connect(this.screechGain)
    this.screechGain.connect(this.masterGain)
    this.screechOsc.start()

    // ── Bass thump (sine) ─────────────────────────────────────────────────
    this.bassOsc  = ctx.createOscillator()
    this.bassGain = ctx.createGain()
    this.bassOsc.type = 'sine'
    this.bassOsc.frequency.value = 60
    this.bassGain.gain.value = 0.0

    this.bassOsc.connect(this.bassGain)
    this.bassGain.connect(this.masterGain)
    this.bassOsc.start()
  }

  /**
   * Called each game frame. Feed it the current car speed and drift angle.
   * @param speed   car speed in px/s (max ~460)
   * @param drift   abs(driftAngle) in radians (0 = no drift, ~0.8 = heavy drift)
   * @param throttle whether throttle is pressed
   */
  update(speed: number, drift: number, throttle: boolean): void {
    if (this.ctx.state !== 'running') return

    const now = this.ctx.currentTime
    const smooth = 0.08   // ramp time (seconds)

    // Speed normalised 0→1
    const speedN = Math.min(speed / 460, 1)

    // Engine hum: idle ≈ 80 Hz, floor ≈ 90 Hz, max ≈ 260 Hz
    const engineHz = 80 + speedN * 180
    this.engineOsc.frequency.setTargetAtTime(engineHz, now, smooth)

    const engineVol = throttle ? 0.55 + speedN * 0.3 : 0.12 + speedN * 0.12
    this.engineGain.gain.setTargetAtTime(engineVol, now, smooth)

    // Screech: ramps from 0 at no-drift to 0.3 at heavy drift
    const screechThresh = 0.12
    const driftAmt = Math.max(0, (drift - screechThresh) / (1.0 - screechThresh))
    const screechVol = Math.min(driftAmt * 0.32, 0.32)

    // Screech pitch rises with drift angle + speed
    const screechHz = 380 + drift * 200 + speedN * 120
    this.screechOsc.frequency.setTargetAtTime(screechHz, now, 0.04)
    this.screechGain.gain.setTargetAtTime(screechVol, now, 0.04)

    // Bass: idle throb, louder at higher speed
    this.bassOsc.frequency.setTargetAtTime(55 + speedN * 25, now, smooth)
    this.bassGain.gain.setTargetAtTime(0.05 + speedN * 0.18, now, smooth)
  }

  resume(): void {
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  suspend(): void {
    if (this.ctx.state === 'running') this.ctx.suspend()
  }

  dispose(): void {
    this.engineOsc.stop()
    this.screechOsc.stop()
    this.bassOsc.stop()
    this.ctx.close()
  }
}
