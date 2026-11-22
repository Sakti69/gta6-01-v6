// Synthesised sound: no audio files, everything is WebAudio oscillators
// and filtered noise. All calls are guarded so a missing AudioContext
// (or a muted tab) never breaks the game.
export function createAudio() {
  const A = {
    ctx: null, master: null, muted: false, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenOn: false, musicTimer: 0, musicStep: 0,
    ensure() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        return true;
      } catch { return false; }
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
    tone(freq, dur, type, vol, slideTo) {
      if (!this.ensure() || this.muted) return;
      try {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
        g.gain.setValueAtTime(vol || 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.02);
      } catch { /* ignore */ }
    },
    noise(dur, vol, freq) {
      if (!this.ensure() || this.muted) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
        const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(t);
      } catch { /* ignore */ }
    },
    shot(kind) {
      if (kind === 'shotgun') { this.noise(0.22, 0.5, 900); this.tone(90, 0.15, 'square', 0.25, 40); }
      else if (kind === 'smg') { this.noise(0.07, 0.22, 2400); this.tone(220, 0.05, 'square', 0.1, 140); }
      else { this.noise(0.12, 0.3, 1600); this.tone(160, 0.08, 'square', 0.16, 70); }
    },
    pickup() { this.tone(880, 0.09, 'sine', 0.22); setTimeout(() => this.tone(1318, 0.12, 'sine', 0.22), 70); },
    cash() { this.tone(1046, 0.08, 'triangle', 0.22); setTimeout(() => this.tone(1568, 0.16, 'triangle', 0.22), 80); },
    sting() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.2), i * 90)); },
    fail() { this.tone(220, 0.3, 'sawtooth', 0.18, 110); },
    click() { this.tone(660, 0.05, 'square', 0.12); },
    crash() { this.noise(0.3, 0.4, 500); this.tone(70, 0.25, 'sine', 0.3, 35); },
    engine(on, speedRatio) {
      if (!this.ensure()) return;
      try {
        if (on && !this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineGain = this.ctx.createGain();
          this.engineOsc.type = 'sawtooth';
          this.engineGain.gain.value = 0.0;
          const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
          this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
          this.engineOsc.start();
        }
        if (!on && this.engineOsc) {
          const o = this.engineOsc; this.engineOsc = null;
          o.stop(this.ctx.currentTime + 0.1);
          return;
        }
        if (this.engineOsc) {
          this.engineOsc.frequency.value = 55 + speedRatio * 130;
          this.engineGain.gain.value = this.muted ? 0 : 0.05 + speedRatio * 0.05;
        }
      } catch { /* ignore */ }
    },
    siren(on) {
      if (!this.ensure()) return;
      try {
        if (on && !this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenGain = this.ctx.createGain();
          this.sirenOsc.type = 'triangle';
          this.sirenGain.gain.value = this.muted ? 0 : 0.045;
          this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
          this.sirenOsc.start();
          this.sirenOn = true;
        } else if (!on && this.sirenOsc) {
          const o = this.sirenOsc; this.sirenOsc = null; this.sirenOn = false;
          o.stop(this.ctx.currentTime + 0.05);
        }
      } catch { /* ignore */ }
    },
    // A lazy sunset bassline: one soft note every half beat, no melody
    // to memorise, just a pulse under the city.
    updateMusic(dt, playing) {
      if (!playing || this.muted) return;
      this.musicTimer -= dt;
      if (this.musicTimer > 0) return;
      this.musicTimer = 0.42;
      const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
      const n = bass[this.musicStep % bass.length];
      this.musicStep++;
      this.tone(n, 0.38, 'triangle', 0.07);
      if (this.musicStep % 4 === 0) this.tone(n * 4, 0.1, 'sine', 0.03);
    },
    update(dt, S) {
      if (!this.ctx) return;
      if (this.sirenOn) {
        const t = this.ctx.currentTime;
        this.sirenOsc.frequency.setValueAtTime(660 + Math.sin(t * 4.2) * 220, t);
      }
      this.updateMusic(dt, S.mode === 'playing');
    },
  };
  return A;
}
