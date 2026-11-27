// Sound, all synthesised with WebAudio — no audio files. An engine drone that
// follows the throttle, wind that follows the speed, a chime for each ring and
// a thud for a hard landing or a crash. Created on the first gesture, since
// browsers keep audio locked until the player interacts.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineSub = null;
  let engineFilter = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    started = true;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    // Engine: a sawtooth plus a sub sine through a lowpass.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 62;
    engineSub = ctx.createOscillator();
    engineSub.type = 'sine';
    engineSub.frequency.value = 31;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineSub.start();

    // Wind: looped noise through a bandpass.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    noise.start();
    return true;
  }

  function update(throttle, speed, flying) {
    if (!started) return;
    const t = ctx.currentTime;
    const rpm = 62 + throttle * 96;
    engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    engineSub.frequency.setTargetAtTime(rpm / 2, t, 0.08);
    engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
    engineGain.gain.setTargetAtTime(flying ? 0.045 + throttle * 0.05 : 0.02, t, 0.1);
    windFilter.frequency.setTargetAtTime(380 + speed * 22, t, 0.1);
    windGain.gain.setTargetAtTime(flying ? Math.min(0.12, speed * 0.0016) : 0, t, 0.15);
  }

  function blip(freq, at, dur, type = 'sine', vol = 0.22) {
    if (!started) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + at);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
    o.connect(g);
    g.connect(master);
    o.start(ctx.currentTime + at);
    o.stop(ctx.currentTime + at + dur + 0.05);
  }

  function ring() {
    blip(659.25, 0, 0.5);
    blip(830.61, 0.09, 0.5);
    blip(987.77, 0.18, 0.7);
  }

  function thud() {
    if (!started) return;
    const len = ctx.sampleRate * 0.35;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g);
    g.connect(master);
    src.start();
    blip(55, 0, 0.5, 'sine', 0.5);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.9;
    return muted;
  }

  return { ensure, update, ring, thud, toggleMute };
}
