// ─── Rail Runner · sound ──────────────────────────────────────────────────────
// All audio is synthesised with the Web Audio API (no downloaded assets).
// Must be created/resumed after a user gesture (the Play tap), per browser rules.

export class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private musicTimer: number | null = null
  private step = 0
  muted = false

  /** Lazily create the context (call on the first user gesture). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.9
    this.master.connect(this.ctx.destination)
    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.16
    this.musicGain.connect(this.master)
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02)
    }
  }

  // ── One-shot voice ──────────────────────────────────────────────────────────
  private blip(
    freq: number, dur: number, type: OscillatorType, gain: number,
    bend = 0, dest?: AudioNode,
  ) {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + bend), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g); g.connect(dest ?? this.master)
    osc.start(t); osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, gain: number, hp = 800) {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const n = Math.floor(this.ctx.sampleRate * dur)
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
    const src = this.ctx.createBufferSource(); src.buffer = buf
    const filt = this.ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = hp
    const g = this.ctx.createGain(); g.gain.value = gain
    src.connect(filt); filt.connect(g); g.connect(this.master)
    src.start(t)
  }

  // ── SFX ──────────────────────────────────────────────────────────────────────
  jump()  { this.blip(330, 0.22, 'square', 0.18, 480) }
  land()  { this.blip(150, 0.12, 'sine', 0.22, -60); this.noise(0.09, 0.05, 500) }
  roll()  { this.noise(0.25, 0.12, 1200) }
  coin()  { this.blip(880, 0.07, 'square', 0.16); this.blip(1320, 0.1, 'square', 0.14) }
  power() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.2), i * 70))
  }
  crash() {
    this.blip(180, 0.5, 'sawtooth', 0.32, -150)
    this.noise(0.4, 0.3, 300)
  }

  // ── Background music: a looping minor-key arpeggio + bass ─────────────────────
  startMusic() {
    if (!this.ctx || !this.musicGain || this.musicTimer != null) return
    // A natural-minor pentatonic-ish bounce
    const lead = [440, 523, 659, 587, 523, 659, 880, 659]
    const bass = [110, 110, 165, 146]
    const beat = 200 // ms
    this.step = 0
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain) return
      const i = this.step % lead.length
      this.blip(lead[i], 0.18, 'triangle', 0.5, 0, this.musicGain)
      if (i % 2 === 0) this.blip(bass[(this.step / 2) % bass.length | 0], 0.34, 'sine', 0.7, 0, this.musicGain)
      this.step++
    }, beat)
  }

  stopMusic() {
    if (this.musicTimer != null) { clearInterval(this.musicTimer); this.musicTimer = null }
  }

  dispose() {
    this.stopMusic()
    if (this.ctx) { void this.ctx.close(); this.ctx = null }
  }
}
