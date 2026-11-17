// All sound is synthesised with WebAudio: no audio files, nothing fetched.
// Engine hum, siren, gunshots, waves, pickup blips and a sunny bass loop.
export function makeAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let sirenOsc = null;
  let sirenGain = null;
  let waveNode = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const api = {
    unlock,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    shoot() { noiseBurst(0.14, 0.35, 2600); blip(220, 0.08, 'square', 0.12, 60); },
    punch() { noiseBurst(0.08, 0.25, 500); },
    pickup() { blip(660, 0.12, 'sine', 0.2, 990); blip(990, 0.16, 'sine', 0.18, 1320); },
    cash() { blip(880, 0.1, 'triangle', 0.22); setTimeout(() => blip(1174, 0.14, 'triangle', 0.22), 90); },
    crash() { noiseBurst(0.3, 0.4, 700); },
    busted() { blip(392, 0.25, 'sawtooth', 0.2, 311); setTimeout(() => blip(311, 0.4, 'sawtooth', 0.2, 233), 200); },
    wasted() { blip(330, 0.3, 'sawtooth', 0.22, 165); setTimeout(() => blip(165, 0.6, 'sawtooth', 0.22, 82), 250); },
    missionDone() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => blip(n, 0.22, 'triangle', 0.22), i * 110));
    },
    missionFail() { blip(220, 0.3, 'sawtooth', 0.2, 147); },
    phone() { blip(1200, 0.09, 'sine', 0.15); setTimeout(() => blip(1200, 0.09, 'sine', 0.15), 140); },
    setEngine(on, speed01) {
      if (!ensure()) return;
      if (on && !muted) {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0.0;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 700;
          engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = 0.05 + speed01 * 0.05;
      } else if (engineOsc) {
        engineOsc.stop();
        engineOsc = null;
        engineGain = null;
      }
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !muted) {
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain); sirenGain.connect(master);
          sirenOsc.start();
          let hi = false;
          sirenOsc._iv = setInterval(() => {
            if (!sirenOsc) return;
            hi = !hi;
            sirenOsc.frequency.value = hi ? 880 : 660;
          }, 350);
        }
      } else if (sirenOsc) {
        clearInterval(sirenOsc._iv);
        sirenOsc.stop();
        sirenOsc = null;
        sirenGain = null;
      }
    },
    startWaves() {
      if (!ensure() || waveNode || muted) return;
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0.02;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lg = ctx.createGain(); lg.gain.value = 0.012;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(); lfo.start();
      waveNode = { src, lfo };
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      // Sunny bassline + sparkle: A minor groove, 8 steps, ~112 BPM.
      const bass = [110, 0, 110, 130.8, 98, 0, 123.5, 146.8];
      const lead = [440, 523, 659, 523, 587, 659, 784, 659];
      let step = 0;
      musicTimer = setInterval(() => {
        if (muted || !ctx) { step = (step + 1) % 8; return; }
        const b = bass[step];
        if (b) blip(b, 0.22, 'triangle', 0.16);
        if (step % 2 === 0) blip(lead[step], 0.16, 'sine', 0.06);
        step = (step + 1) % 8;
      }, 268);
    },
  };
  return api;
}
