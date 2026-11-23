// Synthesized sci-fi sound kit (Web Audio, no files). Silent when muted or unsupported.
const MUTE_KEY = 'orbit.muted';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function setMuted(m: boolean) {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch {}
}

function audio(): AudioContext | null {
  if (isMuted()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

interface ToneOpts { type?: OscillatorType; gain?: number; slideTo?: number; detune?: number }

function tone(freq: number, start: number, dur: number, { type = 'sine', gain = 0.12, slideTo, detune = 0 }: ToneOpts = {}) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Filtered noise sweep: the "whoosh" of warping through space. */
function whoosh(start: number, dur: number, from: number, to: number, gain = 0.09) {
  const c = audio();
  if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 4;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const note = (semi: number) => 440 * 2 ** (semi / 12);

export const sfx = {
  /** Zoom into a planet: rising warp. */
  warpIn() { whoosh(0, 0.5, 300, 3200); tone(110, 0, 0.45, { type: 'sawtooth', gain: 0.035, slideTo: 440 }); },
  /** Zoom out: falling warp. */
  warpOut() { whoosh(0, 0.45, 3000, 280); tone(440, 0, 0.4, { type: 'sawtooth', gain: 0.03, slideTo: 110 }); },
  /** Select a node: short sonar blip. */
  blip() { tone(1320, 0, 0.09, { type: 'sine', gain: 0.07 }); tone(1980, 0.04, 0.08, { gain: 0.04 }); },
  /** Tapped a locked node: shield buzz. */
  denied() { tone(140, 0, 0.18, { type: 'square', gain: 0.05 }); tone(132, 0.09, 0.18, { type: 'square', gain: 0.05 }); },
  /** Review rated; pitch climbs with the new mastery level. */
  review(level: number) {
    const base = [0, 3, 5, 7, 10, 12][level] ?? 0;
    tone(note(base), 0, 0.16, { type: 'triangle', gain: 0.1 });
    tone(note(base + 7), 0.08, 0.22, { type: 'triangle', gain: 0.08 });
  },
  /** Forgot: power-down. */
  fail() { tone(392, 0, 0.35, { type: 'sawtooth', gain: 0.05, slideTo: 98 }); },
  /** Children unlocked: transmission chirp sequence. */
  unlock() { [0, 4, 7, 12, 16].forEach((s, i) => tone(note(s + 3), i * 0.06, 0.18, { type: 'square', gain: 0.035 })); whoosh(0.05, 0.4, 1200, 4000, 0.04); },
  /** Mastered (5): shimmering star chord. */
  mastered() {
    [0, 4, 7, 11, 14].forEach((s, i) => {
      tone(note(s + 3), i * 0.05, 1.3, { gain: 0.05, detune: -6 });
      tone(note(s + 15), i * 0.05 + 0.02, 1.1, { gain: 0.03, detune: 6 });
    });
  },
  /** Flag toggled / sync done: comm beep. */
  beep() { tone(880, 0, 0.07, { type: 'square', gain: 0.04 }); tone(1175, 0.08, 0.09, { type: 'square', gain: 0.04 }); },
  /** Something went wrong (bad import). */
  error() { tone(220, 0, 0.12, { type: 'square', gain: 0.05 }); tone(165, 0.13, 0.2, { type: 'square', gain: 0.05 }); },
};
