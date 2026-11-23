// Generative space-ambient background music, synthesized live with Web Audio (no files).
// Layers: a slow-breathing drone pad, sparse pentatonic chimes through a long echo, and
// faint filtered "solar wind". It never repeats exactly, so it loops without a seam.
const KEY = 'orbit.music';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timers: number[] = [];
let stopFns: (() => void)[] = [];
let playing = false;

export const isMusicOn = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {} };
export const isPlaying = () => playing;

// D minor pentatonic-ish, low and calm.
const ROOT = 146.83; // D3
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const hz = (semi: number, base = ROOT) => base * 2 ** (semi / 12);
const CHORDS = [[0, 7, 15, 19], [-2, 5, 12, 17], [3, 10, 15, 22], [-4, 3, 10, 15]];

function echo(c: AudioContext, out: AudioNode) {
  const input = c.createGain();
  const d1 = c.createDelay(2); d1.delayTime.value = 0.61;
  const d2 = c.createDelay(2); d2.delayTime.value = 0.97;
  const fb = c.createGain(); fb.gain.value = 0.55;
  const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200;
  input.connect(out);
  input.connect(d1); d1.connect(d2); d2.connect(tone); tone.connect(fb); fb.connect(d1);
  const wet = c.createGain(); wet.gain.value = 0.6;
  d1.connect(wet); d2.connect(wet); wet.connect(out);
  return input;
}

function pad(c: AudioContext, out: AudioNode) {
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 700; filter.Q.value = 0.7;
  // slow LFO opening and closing the filter: the "breathing"
  const lfo = c.createOscillator(); lfo.frequency.value = 1 / 16;
  const lfoAmt = c.createGain(); lfoAmt.gain.value = 350;
  lfo.connect(lfoAmt).connect(filter.frequency); lfo.start();
  filter.connect(out);

  const voices = [0, 1, 2, 3].map(() => {
    const g = c.createGain(); g.gain.value = 0; g.connect(filter);
    const oscs = [-7, 7].map((det, k) => {
      const o = c.createOscillator(); o.type = k ? 'triangle' : 'sine'; o.detune.value = det;
      o.connect(g); o.start(); return o;
    });
    return { g, oscs };
  });

  let ci = 0;
  const change = () => {
    const t = c.currentTime;
    const chord = CHORDS[ci++ % CHORDS.length];
    voices.forEach((v, i) => {
      v.oscs.forEach((o) => o.frequency.setTargetAtTime(hz(chord[i]), t, 2.5));
      v.g.gain.setTargetAtTime(i === 0 ? 0.09 : 0.05, t, 3);
    });
  };
  change();
  timers.push(window.setInterval(change, 16000));
  stopFns.push(() => { lfo.stop(); voices.forEach((v) => v.oscs.forEach((o) => o.stop())); });
}

function chimes(c: AudioContext, out: AudioNode) {
  const bus = echo(c, out);
  const ping = () => {
    const t = c.currentTime + 0.05;
    const semi = SCALE[Math.floor(Math.random() * SCALE.length)] + 12;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz(semi);
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(semi) * 2.01; // bell partial
    const g = c.createGain(); const g2 = c.createGain();
    const pan = c.createStereoPanner(); pan.pan.value = Math.random() * 1.4 - 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.012, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(g).connect(pan); o2.connect(g2).connect(pan); pan.connect(bus);
    o.start(t); o2.start(t); o.stop(t + 4.2); o2.stop(t + 1.7);
    timers.push(window.setTimeout(ping, 2500 + Math.random() * 6000));
  };
  timers.push(window.setTimeout(ping, 3000));
}

function wind(c: AudioContext, out: AudioNode) {
  const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brown noise
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.8;
  const lfo = c.createOscillator(); lfo.frequency.value = 1 / 23;
  const amt = c.createGain(); amt.gain.value = 300;
  lfo.connect(amt).connect(f.frequency);
  const g = c.createGain(); g.gain.value = 0.05;
  src.connect(f).connect(g).connect(out);
  src.start(); lfo.start();
  stopFns.push(() => { src.stop(); lfo.stop(); });
}

export function startMusic() {
  if (playing) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { return; }
  const c = ctx;
  master = c.createGain();
  master.gain.setValueAtTime(0.0001, c.currentTime);
  master.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 4); // slow fade in
  master.connect(c.destination);
  pad(c, master); chimes(c, master); wind(c, master);
  playing = true; remember(true);
}

export function stopMusic() {
  remember(false);
  if (!playing || !ctx || !master) return;
  playing = false;
  const c = ctx, m = master, fns = stopFns;
  timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  timers = []; stopFns = [];
  m.gain.cancelScheduledValues(c.currentTime);
  m.gain.setTargetAtTime(0.0001, c.currentTime, 0.6); // fade out
  setTimeout(() => { fns.forEach((f) => { try { f(); } catch {} }); m.disconnect(); }, 3000);
}
