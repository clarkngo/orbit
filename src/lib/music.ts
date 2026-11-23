// Looping background music: "Space" by Nikita Kondrashev (leberch) via Pixabay.
// Off by default; fades in and out; the on/off choice is remembered.
const KEY = 'orbit.music';
const VOLUME = 0.45;
const SRC = `${import.meta.env.BASE_URL}music/space.mp3`;

let el: HTMLAudioElement | null = null;
let fade: number | undefined;
let playing = false;

export const isMusicOn = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {} };
export const isPlaying = () => playing;

function rampTo(target: number, ms: number, done?: () => void) {
  if (!el) return;
  clearInterval(fade);
  const a = el, from = a.volume, steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  fade = window.setInterval(() => {
    i++;
    a.volume = Math.min(1, Math.max(0, from + ((target - from) * i) / steps));
    if (i >= steps) { clearInterval(fade); done?.(); }
  }, 50);
}

export function startMusic() {
  if (playing) return;
  el ??= Object.assign(new Audio(SRC), { loop: true, preload: 'auto' });
  el.volume = 0;
  playing = true; remember(true);
  el.play().then(() => rampTo(VOLUME, 2500)).catch(() => { playing = false; });
}

export function stopMusic() {
  remember(false);
  if (!playing || !el) return;
  playing = false;
  const a = el;
  rampTo(0, 1200, () => a.pause());
}
