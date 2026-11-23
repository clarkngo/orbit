import { useEffect, useRef } from 'preact/hooks';

interface Star { x: number; y: number; r: number; z: number; tw: number; ph: number; hue: number }

/**
 * Drifting, twinkling starfield on a fixed canvas behind the page.
 * Nearer (bigger) stars drift faster for parallax. Capped at ~30fps, paused while the tab is
 * hidden, and drawn once without motion when the user prefers reduced motion.
 */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0, h = 0, raf = 0, last = 0;
    let stars: Star[] = [];

    const make = (): Star => {
      const z = Math.random() ** 2; // most stars far away
      return {
        x: Math.random() * w, y: Math.random() * h,
        r: 0.4 + z * 1.5, z,
        tw: 0.4 + Math.random() * 1.4, ph: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.25 ? 190 : 215, // a few cyan stars among blue-white ones
      };
    };

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(150, Math.max(70, (w * h) / 9000)));
      stars = Array.from({ length: count }, make);
      draw(performance.now(), 0);
    };

    const draw = (t: number, dt: number) => {
      g.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.x -= (2 + s.z * 10) * dt;  // slow drift left
        s.y += (0.6 + s.z * 3) * dt; // and slightly down
        if (s.x < -2) { s.x = w + 2; s.y = Math.random() * h; }
        if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; }
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.tw + s.ph)) * (0.4 + s.z * 0.6);
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fillStyle = `hsla(${s.hue}, 90%, 90%, ${a})`;
        g.fill();
        if (s.r > 1.4) { // soft halo on the nearest stars
          g.beginPath();
          g.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
          g.fillStyle = `hsla(${s.hue}, 90%, 80%, ${a * 0.12})`;
          g.fill();
        }
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return; // ~30fps
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      draw(t, dt);
    };
    const start = () => { cancelAnimationFrame(raf); last = 0; if (!still.matches && !document.hidden) raf = requestAnimationFrame(loop); };
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : start());

    resize();
    start();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    still.addEventListener?.('change', start);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      still.removeEventListener?.('change', start);
    };
  }, []);

  return <canvas ref={ref} class="starfield" aria-hidden="true" />;
}
