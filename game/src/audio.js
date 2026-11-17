// audio.js — all sound is synthesized WebAudio (no external audio files):
// engine hum, siren, gunshot, waves, pickup chime and a sunny bassline loop.
export function createAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  const state = { ctx, master, muted: false, musicTimer: null, engine: null, siren: null, wave: null };

  function noiseBuffer(seconds = 1) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  const noiseBuf = noiseBuffer(1.5);

  function blip(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function noiseBurst(dur, vol, filterFreq, type = 'lowpass') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(); src.stop(ctx.currentTime + dur);
  }

  // Looping ocean waves: filtered noise swelling on an LFO.
  function startWaves() {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(); lfo.start();
    state.wave = { src, lfo };
  }

  // Engine hum: two detuned saws through a lowpass; pitch follows speed.
  function startEngine() {
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 58;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start();
    state.engine = { o1, o2, g, f };
  }
  function setEngine(speed01, on) {
    if (!state.engine) return;
    const t = ctx.currentTime;
    state.engine.g.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    state.engine.o1.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.1);
    state.engine.o2.frequency.setTargetAtTime(53 + speed01 * 135, t, 0.1);
  }

  // Two-tone police siren.
  function startSiren() {
    if (state.siren) return;
    const o = ctx.createOscillator(); o.type = 'triangle';
    const g = ctx.createGain(); g.gain.value = 0.0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.7;
    const lg = ctx.createGain(); lg.gain.value = 220;
    lfo.connect(lg); lg.connect(o.frequency);
    o.frequency.value = 760;
    o.connect(g); g.connect(master);
    o.start(); lfo.start();
    g.gain.setTargetAtTime(0.045, ctx.currentTime, 0.3);
    state.siren = { o, lfo, g };
  }
  function stopSiren() {
    if (!state.siren) return;
    const s = state.siren; state.siren = null;
    s.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch { /* already stopped */ } }, 600);
  }

  // Sunny bassline + hats loop (8-step funk pattern).
  const bassNotes = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4];
  let step = 0;
  function startMusic() {
    if (state.musicTimer) return;
    state.musicTimer = setInterval(() => {
      if (state.muted) return;
      const n = bassNotes[step % bassNotes.length];
      if (n) blip(n, 0.22, 'triangle', 0.16);
      if (step % 2 === 0) noiseBurst(0.04, 0.05, 6000, 'highpass');
      if (step % 8 === 4) blip(440, 0.1, 'sine', 0.06);
      step++;
    }, 230);
  }

  return {
    state,
    resume() { if (ctx.state === 'suspended') ctx.resume(); },
    startAmbience() { startWaves(); startEngine(); startMusic(); },
    setEngine, startSiren, stopSiren,
    gunshot() { noiseBurst(0.14, 0.5, 1800); blip(160, 0.1, 'square', 0.25, 60); },
    knifeSwing() { noiseBurst(0.12, 0.2, 3000, 'bandpass'); },
    punch() { noiseBurst(0.1, 0.35, 500); },
    pickup() { blip(660, 0.12, 'sine', 0.25); setTimeout(() => blip(990, 0.18, 'sine', 0.25), 90); },
    cash() { blip(880, 0.1, 'sine', 0.22); setTimeout(() => blip(1174, 0.14, 'sine', 0.22), 80); setTimeout(() => blip(1568, 0.2, 'sine', 0.2), 170); },
    hurt() { blip(220, 0.2, 'sawtooth', 0.25, 90); },
    busted() { blip(392, 0.3, 'square', 0.2); setTimeout(() => blip(311, 0.3, 'square', 0.2), 250); setTimeout(() => blip(233, 0.5, 'square', 0.2), 500); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
    toggleMute() {
      state.muted = !state.muted;
      master.gain.value = state.muted ? 0 : 0.5;
      return state.muted;
    },
  };
}
