// ─── Neon Drift · Synthwave Music Synthesizer ────────────────────────────────
// 100% procedurally generated via Web Audio API — zero copyright concerns.
// Produces: kick, snare, hi-hat, sub-bass, sawtooth arp, pad chords, lead.

const BPM      = 128
const BEAT     = 60 / BPM          // seconds per beat
const STEP     = BEAT / 4          // 16th-note step
const BAR      = STEP * 16         // one 4/4 bar (16 steps)

// ─── Note frequencies (Hz) ───────────────────────────────────────────────────
// Scale: A minor pentatonic (A C D E G)

const NOTE: Record<string, number> = {
  A1:  55,   A2: 110,   A3: 220,   A4: 440,
  C2:  65.4, C3: 130.8, C4: 261.6, C5: 523.3,
  D2:  73.4, D3: 146.8, D4: 293.7,
  E2:  82.4, E3: 164.8, E4: 329.6,
  G2:  98,   G3: 196,   G4: 392,
  B2: 123.5, B3: 247,
}

// ─── 8-bar chord progression (Am / Am / C / G / Am / F / C / G) ──────────────
// Each "chord" = [ bass_freq, pad_freq1, pad_freq2, pad_freq3 ]

const CHORDS: [number, number, number, number][] = [
  [NOTE.A2, NOTE.A3, NOTE.C4, NOTE.E4],   // Am
  [NOTE.A2, NOTE.A3, NOTE.C4, NOTE.E4],   // Am
  [NOTE.C2, NOTE.C3, NOTE.E3, NOTE.G3],   // C
  [NOTE.G2, NOTE.G3, NOTE.B3, NOTE.D4],   // G
  [NOTE.A2, NOTE.A3, NOTE.C4, NOTE.E4],   // Am
  [NOTE.A2, NOTE.A3, NOTE.C4, NOTE.E4],   // Am (with lead)
  [NOTE.C2, NOTE.C3, NOTE.E3, NOTE.G3],   // C
  [NOTE.G2, NOTE.G3, NOTE.B3, NOTE.D4],   // G
]

// Arp patterns (indexes into current chord's pad notes: 0=root, 1, 2, 3)
const ARP_PATTERN = [1, 2, 3, 2, 1, 3, 2, 1, 1, 2, 3, 2, 3, 1, 2, 3]

// Bass pattern (step offsets from chord root, -1 = rest)
const BASS_PATTERN = [0, -1, -1, -1, 0, -1, 4, -1, 0, -1, -1, 3, 0, -1, 5, -1]

// Lead melody (bar 5-6, note indexes from chord, -1 = rest)
const LEAD_PATTERN = [3, -1, 2, -1, 1, 2, 3, -1, 3, 4, 3, 2, 1, -1, -1, -1]

// ─── SynthwaveMusic class ─────────────────────────────────────────────────────

export class SynthwaveMusic {
  private ctx:        AudioContext
  private master:     GainNode
  private drumGain:   GainNode
  private bassGain:   GainNode
  private arpGain:    GainNode
  private padGain:    GainNode
  private leadGain:   GainNode

  private nextStepTime = 0
  private step = 0
  private timerId: ReturnType<typeof setTimeout> | null = null

  private _intensity  = 0   // 0-1 from gameplay
  private _volume     = 0.7
  private _muted      = false
  private _running    = false

  constructor() {
    this.ctx    = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(this.ctx.destination)

    // Layer gains
    this.drumGain = this.layer(0.85)
    this.bassGain = this.layer(0.80)
    this.arpGain  = this.layer(0.0)   // starts silent, fades in
    this.padGain  = this.layer(0.0)
    this.leadGain = this.layer(0.0)
  }

  private layer(vol: number): GainNode {
    const g = this.ctx.createGain()
    g.gain.value = vol
    g.connect(this.master)
    return g
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start(): void {
    if (this._running) return
    this._running    = true
    this.nextStepTime = this.ctx.currentTime + 0.05
    this.ctx.resume().then(() => this.tick())
    this.fadeMaster(this._volume)
  }

  pause(): void {
    this.fadeMaster(0)
    setTimeout(() => this.ctx.suspend(), 600)
  }

  resume(): void {
    this.ctx.resume().then(() => {
      if (!this._running) { this._running = true; this.nextStepTime = this.ctx.currentTime + 0.05; this.tick() }
      this.fadeMaster(this._volume)
    })
  }

  /** 0-1: gameplay intensity → layers thickness */
  setIntensity(v: number): void {
    this._intensity = Math.max(0, Math.min(1, v))
    const now = this.ctx.currentTime
    this.arpGain.gain.setTargetAtTime(this._intensity * 0.55, now, 1.5)
    this.padGain.gain.setTargetAtTime(this._intensity * 0.25, now, 2.0)
    this.leadGain.gain.setTargetAtTime(Math.max(0, this._intensity - 0.5) * 0.4, now, 2.5)
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (!this._muted) this.fadeMaster(this._volume)
  }

  toggleMute(): boolean {
    this._muted = !this._muted
    this.fadeMaster(this._muted ? 0 : this._volume)
    return this._muted
  }

  dispose(): void {
    this._running = false
    if (this.timerId) clearTimeout(this.timerId)
    this.ctx.close()
  }

  // ── Scheduler ─────────────────────────────────────────────────────────────

  private tick(): void {
    if (!this._running) return
    const lookahead = 0.22  // schedule 220ms ahead
    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.step, this.nextStepTime)
      this.step++
      this.nextStepTime += STEP
    }
    this.timerId = setTimeout(() => this.tick(), 50)
  }

  private scheduleStep(step: number, t: number): void {
    const stepInBar  = step % 16
    const barIndex   = Math.floor(step / 16)
    const chordIdx   = barIndex % CHORDS.length
    const chord      = CHORDS[chordIdx]

    // ── Drums ─────────────────────────────────────────────────────────────
    // Kick: steps 0, 8 (beats 1, 3)
    if (stepInBar === 0 || stepInBar === 8) this.kick(t)
    // Snare: steps 4, 12 (beats 2, 4)
    if (stepInBar === 4 || stepInBar === 12) this.snare(t)
    // Closed hi-hat: every even step
    if (stepInBar % 2 === 0) this.hat(t, 0.045)
    // Open hi-hat accent: step 14
    if (stepInBar === 14) this.hat(t, 0.08)

    // ── Bass ──────────────────────────────────────────────────────────────
    const bassOff = BASS_PATTERN[stepInBar]
    if (bassOff >= 0) {
      const bassFreq = bassOff === 0 ? chord[0] : chord[0] * Math.pow(2, bassOff / 12)
      this.bass(bassFreq, t, STEP * 3.5)
    }

    // ── Pad (every bar on beat 1) ─────────────────────────────────────────
    if (stepInBar === 0) {
      chord.slice(1).forEach(f => this.pad(f, t, BAR))
    }

    // ── Arp ───────────────────────────────────────────────────────────────
    const arpNote = chord[1 + (ARP_PATTERN[stepInBar] % 3)]
    this.arp(arpNote * 2, t)   // one octave up

    // ── Lead (bars 5 & 6 of each 8-bar loop) ─────────────────────────────
    if (chordIdx === 5 || chordIdx === 6) {
      const lidx = LEAD_PATTERN[stepInBar]
      if (lidx >= 0) {
        const lf = chord[Math.min(lidx, 3)] * 4  // two octaves up
        this.lead(lf, t, STEP * 1.8)
      }
    }
  }

  // ── Instrument generators ─────────────────────────────────────────────────

  private kick(t: number): void {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.connect(g); g.connect(this.drumGain)
    o.type = 'sine'
    o.frequency.setValueAtTime(160, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12)
    g.gain.setValueAtTime(1.0, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
    o.start(t); o.stop(t + 0.42)
  }

  private snare(t: number): void {
    const len  = this.ctx.sampleRate * 0.22
    const buf  = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const flt = this.ctx.createBiquadFilter()
    flt.type = 'bandpass'; flt.frequency.value = 1800; flt.Q.value = 0.8
    const g = this.ctx.createGain()
    src.connect(flt); flt.connect(g); g.connect(this.drumGain)
    g.gain.setValueAtTime(0.40, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20)
    src.start(t)
  }

  private hat(t: number, vol: number): void {
    const len  = this.ctx.sampleRate * 0.055
    const buf  = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const flt = this.ctx.createBiquadFilter()
    flt.type = 'highpass'; flt.frequency.value = 9000
    const g = this.ctx.createGain()
    src.connect(flt); flt.connect(g); g.connect(this.drumGain)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
    src.start(t)
  }

  private bass(freq: number, t: number, dur: number): void {
    const o  = this.ctx.createOscillator()
    const f  = this.ctx.createBiquadFilter()
    const g  = this.ctx.createGain()
    o.type = 'sawtooth'; o.frequency.value = freq
    f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 2
    o.connect(f); f.connect(g); g.connect(this.bassGain)
    g.gain.setValueAtTime(0.7, t)
    g.gain.setValueAtTime(0.55, t + 0.06)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.start(t); o.stop(t + dur + 0.02)
  }

  private arp(freq: number, t: number): void {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = 'sawtooth'; o.frequency.value = freq
    o.connect(g); g.connect(this.arpGain)
    g.gain.setValueAtTime(0.25, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.7)
    o.start(t); o.stop(t + STEP * 0.8)
  }

  private pad(freq: number, t: number, dur: number): void {
    // Detuned pair for thickness
    for (const detune of [-6, 0, 6]) {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      const f = this.ctx.createBiquadFilter()
      o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = detune
      f.type = 'lowpass'; f.frequency.value = 900
      o.connect(f); f.connect(g); g.connect(this.padGain)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.09, t + 0.55)
      g.gain.setValueAtTime(0.09, t + dur - 0.45)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.start(t); o.stop(t + dur + 0.05)
    }
  }

  private lead(freq: number, t: number, dur: number): void {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    const f = this.ctx.createBiquadFilter()
    o.type = 'sawtooth'; o.frequency.value = freq
    f.type = 'lowpass'; f.frequency.value = 3000
    o.connect(f); f.connect(g); g.connect(this.leadGain)
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.start(t); o.stop(t + dur + 0.02)
  }

  private fadeMaster(target: number): void {
    this.master.gain.setTargetAtTime(target * 0.38, this.ctx.currentTime, 0.5)
  }
}
