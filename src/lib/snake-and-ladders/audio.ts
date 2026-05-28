/**
 * Snake & Ladders Audio — Web Audio API procedural sounds.
 * No external assets required.
 */

export class SNLAudio {
  private ctx: AudioContext | null = null
  private enabled = true
  private masterGain: GainNode | null = null

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      try {
        this.ctx = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )()
        this.masterGain = this.ctx.createGain()
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime)
        this.masterGain.connect(this.ctx.destination)
      } catch { return null }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {})
    return this.ctx
  }

  private dest(): AudioNode | null {
    const ctx = this.getCtx()
    return ctx ? (this.masterGain ?? ctx.destination) : null
  }

  setEnabled(v: boolean) { this.enabled = v }

  /** Cinematic dice roll — crystalline rattle then landing impact */
  diceRoll(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime

    // Crystal rattles — high-freq pings
    const pingTimes = [0, 0.06, 0.11, 0.155, 0.19, 0.22, 0.245, 0.265]
    pingTimes.forEach((t, i) => {
      const freq = 1800 + Math.random() * 800 - i * 80
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, now + t)
      g.gain.setValueAtTime(0.12 * (1 - i * 0.1), now + t)
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.07)
      osc.connect(g); g.connect(out)
      osc.start(now + t); osc.stop(now + t + 0.08)
    })

    // Noise burst per rattle
    pingTimes.slice(0, 5).forEach((t, i) => {
      const dur = 0.03 + i * 0.005
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (d.length * 0.3))
      const src = ctx.createBufferSource()
      src.buffer = buf
      const lpf = ctx.createBiquadFilter(); lpf.type = "bandpass"
      lpf.frequency.setValueAtTime(3000, now + t); lpf.Q.setValueAtTime(1.5, now + t)
      const g = ctx.createGain(); g.gain.setValueAtTime(0.08, now + t)
      src.connect(lpf); lpf.connect(g); g.connect(out)
      src.start(now + t)
    })
  }

  /** Dice lands — solid crystalline thud with shimmer */
  diceLand(value: number): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime

    // Impact thud
    const bufLen = Math.floor(ctx.sampleRate * 0.15)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02))
    const src = ctx.createBufferSource(); src.buffer = buf
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.setValueAtTime(1800, now)
    const g = ctx.createGain(); g.gain.setValueAtTime(0.28, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    src.connect(lpf); lpf.connect(g); g.connect(out); src.start(now)

    // Shimmer chime — pitch by value
    const baseFreq = 880 + value * 110
    ;[baseFreq, baseFreq * 1.5, baseFreq * 2].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const og = ctx.createGain()
      osc.type = "sine"; osc.frequency.setValueAtTime(freq, now + 0.04 + i * 0.03)
      og.gain.setValueAtTime(0.09 - i * 0.02, now + 0.04 + i * 0.03)
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.04 + i * 0.03 + 0.22)
      osc.connect(og); og.connect(out); osc.start(now + 0.04 + i * 0.03); osc.stop(now + 0.3)
    })
  }

  /** Token moves one step — soft magical hop */
  tokenStep(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator(); const g = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(660, now); osc.frequency.exponentialRampToValueAtTime(440, now + 0.07)
    g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + 0.1)
  }

  /** Snake encounter — ominous hiss descending */
  snakeHiss(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime

    // Hiss noise
    const dur = 0.9
    const bufLen = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      const env = Math.sin((i / bufLen) * Math.PI) * 0.9
      d[i] = (Math.random() * 2 - 1) * env
    }
    const src = ctx.createBufferSource(); src.buffer = buf
    const bpf = ctx.createBiquadFilter(); bpf.type = "bandpass"
    bpf.frequency.setValueAtTime(4000, now); bpf.frequency.exponentialRampToValueAtTime(800, now + dur)
    bpf.Q.setValueAtTime(4, now)
    const g = ctx.createGain(); g.gain.setValueAtTime(0.22, now); g.gain.linearRampToValueAtTime(0, now + dur)
    src.connect(bpf); bpf.connect(g); g.connect(out); src.start(now)

    // Descending rattle tones
    const rattleNotes = [440, 370, 311, 261, 220, 185, 155]
    rattleNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const og = ctx.createGain()
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(freq, now + i * 0.1)
      og.gain.setValueAtTime(0.07, now + i * 0.1)
      og.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15)
      osc.connect(og); og.connect(out)
      osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.18)
    })
  }

  /** Snake slide — descending whoosh */
  snakeSlide(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator(); const g = ctx.createGain()
    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.8)
    g.gain.setValueAtTime(0.18, now + 0.05); g.gain.linearRampToValueAtTime(0, now + 0.8)
    osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + 0.85)

    // Vibrato effect
    const lfo = ctx.createOscillator(); const lfoG = ctx.createGain()
    lfo.type = "sine"; lfo.frequency.setValueAtTime(12, now)
    lfoG.gain.setValueAtTime(30, now)
    lfo.connect(lfoG); lfoG.connect(osc.frequency)
    lfo.start(now); lfo.stop(now + 0.85)
  }

  /** Ladder encounter — magical ascending arpeggio */
  ladderChime(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, now + i * 0.08)
      g.gain.setValueAtTime(0, now + i * 0.08)
      g.gain.linearRampToValueAtTime(0.14, now + i * 0.08 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35)
      osc.connect(g); g.connect(out)
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.38)

      // Harmonics
      const harm = ctx.createOscillator(); const hg = ctx.createGain()
      harm.type = "sine"; harm.frequency.setValueAtTime(freq * 2, now + i * 0.08)
      hg.gain.setValueAtTime(0.04, now + i * 0.08); hg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25)
      harm.connect(hg); hg.connect(out); harm.start(now + i * 0.08); harm.stop(now + i * 0.08 + 0.28)
    })
  }

  /** Ladder ascent — glowing whoosh */
  ladderAscend(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator(); const g = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(1760, now + 0.7)
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.15, now + 0.1)
    g.gain.linearRampToValueAtTime(0, now + 0.75)
    osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + 0.78)

    // Sparkle atop
    ;[1047, 1319, 1568, 2093].forEach((freq, i) => {
      const s = ctx.createOscillator(); const sg = ctx.createGain()
      s.type = "triangle"; s.frequency.setValueAtTime(freq, now + 0.55 + i * 0.05)
      sg.gain.setValueAtTime(0.08, now + 0.55 + i * 0.05); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + i * 0.05 + 0.2)
      s.connect(sg); sg.connect(out); s.start(now + 0.55 + i * 0.05); s.stop(now + 0.78)
    })
  }

  /** Victory — grand cinematic fanfare */
  victory(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime

    const chords = [
      [261.63, 329.63, 392.0, 523.25],
      [293.66, 369.99, 440.0, 587.33],
      [349.23, 440.0, 523.25, 698.46],
      [392.0, 493.88, 587.33, 783.99],
      [523.25, 659.25, 783.99, 1046.5],
    ]

    chords.forEach((chord, ci) => {
      chord.forEach(freq => {
        ;(["triangle", "sine"] as OscillatorType[]).forEach((type, ti) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain()
          const t = now + ci * 0.18
          osc.type = type; osc.frequency.setValueAtTime(freq * (ti === 1 ? 2 : 1), t)
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(ti === 0 ? 0.09 : 0.04, t + 0.03)
          g.gain.setValueAtTime(ti === 0 ? 0.09 : 0.04, t + 0.14); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.22)
        })
      })
    })

    // Final sustained chord
    const finalNotes = [523.25, 659.25, 783.99, 1046.5]
    const ft = now + chords.length * 0.18
    finalNotes.forEach(freq => {
      const osc = ctx.createOscillator(); const g = ctx.createGain()
      osc.type = "triangle"; osc.frequency.setValueAtTime(freq, ft)
      g.gain.setValueAtTime(0, ft); g.gain.linearRampToValueAtTime(0.1, ft + 0.05)
      g.gain.setValueAtTime(0.1, ft + 0.5); g.gain.exponentialRampToValueAtTime(0.001, ft + 0.9)
      osc.connect(g); g.connect(out); osc.start(ft); osc.stop(ft + 1.0)
    })
  }

  /** UI click */
  click(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator(); const g = ctx.createGain()
    osc.type = "sine"; osc.frequency.setValueAtTime(920, now)
    g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + 0.06)
  }

  /** Turn-end chime */
  turnEnd(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime
    ;[440, 554, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain()
      osc.type = "sine"; osc.frequency.setValueAtTime(freq, now + i * 0.07)
      g.gain.setValueAtTime(0.07, now + i * 0.07); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18)
      osc.connect(g); g.connect(out); osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.2)
    })
  }

  /** Blocked / can't move */
  blocked(): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    const out = this.dest()
    if (!ctx || !out) return
    const now = ctx.currentTime
    ;[300, 260, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain()
      osc.type = "square"; osc.frequency.setValueAtTime(freq, now + i * 0.08)
      g.gain.setValueAtTime(0.06, now + i * 0.08); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.12)
      osc.connect(g); g.connect(out); osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.14)
    })
  }

  dispose(): void {
    this.ctx?.close().catch(() => {})
    this.ctx = null
    this.masterGain = null
  }
}
