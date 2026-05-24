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

  /** Dice shake — rattling noise */
  diceShake(): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) {
        data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.08, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.04);
      src.start(now + i * 0.06);
    }
  }

  /** Dice land — satisfying thud + number reveal tone */
  diceLand(value: number): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Thud
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);

    // Reveal tone — pitch matches value
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200 + value * 60, now + 0.12);
    oGain.gain.setValueAtTime(0.12, now + 0.12);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now + 0.12);
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
