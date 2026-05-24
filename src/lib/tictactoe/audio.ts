// ── Tic Tac Toe · Audio Engine ────────────────────────────────────────────────
// Web Audio API — procedural sounds only, no assets required.

export class TicTacToeAudio {
  private ctx: AudioContext | null = null

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )()
    }
    return this.ctx
  }

  private tone(
    freq: number,
    type: OscillatorType,
    dur:  number,
    vol:  number,
    delay = 0,
  ) {
    try {
      const ctx  = this.getCtx()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
      gain.gain.setValueAtTime(0, ctx.currentTime + delay)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + dur + 0.02)
    } catch { /* AudioContext may be suspended in some browsers */ }
  }

  // UI hover tick
  hover() { this.tone(820, "sine", 0.055, 0.032) }

  // X placement — energetic sawtooth slash
  placeX() {
    this.tone(195, "sawtooth", 0.13, 0.075)
    this.tone(310, "sawtooth", 0.10, 0.045, 0.065)
  }

  // O placement — soft sine pulse
  placeO() {
    this.tone(455, "sine", 0.20, 0.075)
    this.tone(685, "sine", 0.13, 0.040, 0.085)
  }

  // Win fanfare — ascending chord arpeggiation
  win() {
    const notes = [440, 554, 659, 880, 1108]
    notes.forEach((f, i) => this.tone(f, "sine", 0.32, 0.11, i * 0.085))
  }

  // Draw — descending resolution
  draw() {
    [330, 294, 262, 220].forEach((f, i) => this.tone(f, "triangle", 0.24, 0.07, i * 0.075))
  }

  // Button select click
  select() { this.tone(660, "sine", 0.09, 0.055) }

  // CPU "thinking" ping
  cpuThink() { this.tone(340, "sine", 0.12, 0.028) }

  resume()  { this.ctx?.resume().catch(() => {}) }
  suspend() { this.ctx?.suspend().catch(() => {}) }
  dispose() { this.ctx?.close().catch(() => {}); this.ctx = null }
}
