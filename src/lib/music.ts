// Looping background music: "Space" by Nikita Kondrashev (leberch) via Pixabay.
// <audio loop> leaves a gap (MP3 encoder padding plus the jump from the ending back to the
// intro), so the track is decoded with Web Audio instead: silent edges are trimmed, and each
// pass is crossfaded into the next for a seamless loop.
// On by default (browsers start it at the first tap); turning it off is remembered.
const KEY = 'orbit.music';
const VOLUME = 0.45;
const XFADE = 4; // seconds of overlap between the end of one pass and the start of the next
const SRC = `${import.meta.env.BASE_URL}music/space.mp3`;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let buffer: Promise<Track> | null = null;
let timer: number | undefined;
let live: AudioBufferSourceNode[] = [];
let playing = false;

interface Track { buf: AudioBuffer; start: number; end: number }

export const isMusicOn = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
const remember = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {} };
export const isPlaying = () => playing;

/** Finds where the audio actually starts and ends, skipping near-silent padding. */
function trim(buf: AudioBuffer): Track {
  const d = buf.getChannelData(0);
  const quiet = 0.002;
  let a = 0, b = d.length - 1;
  while (a < b && Math.abs(d[a]) < quiet) a++;
  while (b > a && Math.abs(d[b]) < quiet) b--;
  return { buf, start: a / buf.sampleRate, end: (b + 1) / buf.sampleRate };
}

function load(c: AudioContext) {
  buffer ??= fetch(SRC)
    .then((r) => r.arrayBuffer())
    .then((ab) => c.decodeAudioData(ab))
    .then(trim)
    .catch((e) => { buffer = null; throw e; });
  return buffer;
}

/** Plays one pass from time `at`, fading in and out, and schedules the next pass to overlap its tail. */
function pass(c: AudioContext, out: AudioNode, t: Track, at: number, first: boolean) {
  if (!playing) return;
  const len = t.end - t.start;
  const src = c.createBufferSource();
  src.buffer = t.buf;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(1, at + (first ? 2.5 : XFADE));
  g.gain.setValueAtTime(1, at + len - XFADE);
  g.gain.linearRampToValueAtTime(0.0001, at + len);
  src.connect(g).connect(out);
  src.start(at, t.start, len);
  src.onended = () => { live = live.filter((s) => s !== src); g.disconnect(); };
  live.push(src);
  const next = at + len - XFADE;
  timer = window.setTimeout(() => pass(c, out, t, next, false), Math.max(0, (next - c.currentTime - 2) * 1000));
}

export function startMusic() {
  if (playing) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { return; }
  const c = ctx;
  playing = true; remember(true);
  master = c.createGain();
  master.gain.value = VOLUME;
  master.connect(c.destination);
  const out = master;
  load(c).then((t) => pass(c, out, t, c.currentTime + 0.05, true)).catch(() => { playing = false; });
}

export function stopMusic() {
  remember(false);
  if (!playing || !ctx || !master) return;
  playing = false;
  clearTimeout(timer);
  const c = ctx, m = master, srcs = live;
  live = [];
  m.gain.cancelScheduledValues(c.currentTime);
  m.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
  setTimeout(() => { srcs.forEach((s) => { try { s.stop(); } catch {} }); m.disconnect(); }, 2000);
}
