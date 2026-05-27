/**
 * Ludo Audio Engine — Web Audio API, procedural sounds only, no assets.
 */

export class LudoAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Dice rolling on wooden board — multiple bouncing impacts with
   * low-pass-filtered noise bursts to simulate wood-on-wood resonance.
   */
  diceShake(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // 8 bouncing impacts, closer together as dice settles
    const impacts = [0, 0.07, 0.13, 0.18, 0.23, 0.27, 0.30, 0.33];

    impacts.forEach((t, i) => {
      const dur = 0.04 + (1 - i / impacts.length) * 0.04; // shorter as it settles
      const vol = 0.22 * (1 - i * 0.1); // quieter each bounce

      // Wood impact: band-pass filtered noise
      const bufLen = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufLen * 0.25));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;

      // Band-pass filter for wooden resonance
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.frequency.setValueAtTime(800 + i * 120, now + t);
      bpf.Q.setValueAtTime(2.5, now + t);

      // Low-pass to remove harshness
      const lpf = ctx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.setValueAtTime(2200 - i * 100, now + t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + dur);

      src.connect(bpf);
      bpf.connect(lpf);
      lpf.connect(gain);
      gain.connect(ctx.destination);
      src.start(now + t);

      // Subtle wooden resonance tone under each impact
      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(180 + Math.random() * 60, now + t);
      oGain.gain.setValueAtTime(vol * 0.3, now + t);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + t + dur * 1.5);
      osc.connect(oGain);
      oGain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + dur * 1.5);
    });
  }

  /**
   * Dice lands on wooden board — solid thud with board resonance.
   */
  diceLand(value: number): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Heavy wood thud — filtered noise burst
    const bufLen = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.setValueAtTime(1400, now);
    lpf.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    src.connect(lpf);
    lpf.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);

    // Board resonance — low warm tone
    const res = ctx.createOscillator();
    const rGain = ctx.createGain();
    res.type = "sine";
    res.frequency.setValueAtTime(120, now);
    res.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    rGain.gain.setValueAtTime(0.12, now);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    res.connect(rGain);
    rGain.connect(ctx.destination);
    res.start(now);
    res.stop(now + 0.22);

    // Subtle reveal tone — pitch rises with value
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(200 + value * 50, now + 0.14);
    oGain.gain.setValueAtTime(0.08, now + 0.14);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now + 0.14);
    osc.stop(now + 0.35);
  }

  /** Token enters board */
  tokenEnter(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    [440, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.15);
    });
  }

  /** Token moves one step */
  tokenStep(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Token captured */
  capture(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Low boom
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(160, now);
    osc1.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    g1.gain.setValueAtTime(0.25, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(g1);
    g1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // High zap
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(200, now + 0.18);
    g2.gain.setValueAtTime(0.15, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.2);
  }

  /** Token enters home stretch */
  homeStretch(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.0, now + i * 0.07);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.2);
    });
  }

  /** Token finishes */
  tokenFinish(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.0, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.35);
    });
  }

  /** Player wins — grand fanfare */
  victory(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Chord
    const chords = [
      [261.63, 329.63, 392.0],
      [293.66, 369.99, 440.0],
      [349.23, 440.0, 523.25],
      [392.0, 493.88, 587.33],
    ];

    chords.forEach((chord, ci) => {
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + ci * 0.22;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.04);
        gain.gain.setValueAtTime(0.1, t + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    });
  }

  /** UI click */
  click(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /** Six rolled — special chime */
  sixRolled(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    [800, 1000, 1200, 1600].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.12, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.15);
    });
  }
}
