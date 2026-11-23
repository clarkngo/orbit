import { useEffect, useMemo, useState } from 'preact/hooks';
import type { MapNode } from '../lib/types';
import {
  load, save, review, flag, stateOf, mastery, isDue, MAX, UNLOCK_AT,
  type Progress, type Rating, type NodeState, type Want,
} from '../lib/progress';
import Sync from './Sync';
import { sfx, isMuted, setMuted } from '../lib/sfx';

interface Props { maps: MapNode[] }
interface Entry { node: MapNode; parent?: MapNode; path: MapNode[] }

const UNIVERSE: Omit<MapNode, 'children'> = {
  id: '', title: 'Orbit', summary: 'Every topic is a sun. Click a planet to fly in.', prompts: [],
};

const STATE_LABEL: Record<NodeState, string> = {
  locked: 'Locked', unlocked: 'Unlocked', progress: 'In progress', mastered: 'Mastered', due: 'Due for review',
};

function readHash() {
  try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; }
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

export default function App({ maps }: Props) {
  const universe: MapNode = useMemo(() => ({ ...UNIVERSE, children: maps }), [maps]);
  const index = useMemo(() => {
    const m = new Map<string, Entry>();
    const walk = (n: MapNode, path: MapNode[], parent?: MapNode) => {
      m.set(n.id, { node: n, parent: parent && parent.id ? parent : undefined, path: [...path, n] });
      n.children.forEach((c) => walk(c, [...path, n], n));
    };
    walk(universe, []);
    return m;
  }, [universe]);

  const home = maps.length === 1 ? maps[0].id : '';
  const [progress, setProgress] = useState<Progress>(() => load());
  const [focus, setFocus] = useState<string>(() => (readHash() && index.has(readHash()) ? readHash() : home));
  const [selected, setSelected] = useState<string>(focus);
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [syncOpen, setSyncOpen] = useState(false);
  const [muted, setM] = useState(() => isMuted());
  const [, tick] = useState(0);

  // Keep the URL hash in step with the focused node so the back button zooms out.
  useEffect(() => {
    const onHash = () => {
      const id = readHash() || home;
      if (!index.has(id)) return;
      setFocus((prev) => {
        const inward = depth(id) >= depth(prev);
        setDir(inward ? 'in' : 'out');
        if (id !== prev) inward ? sfx.warpIn() : sfx.warpOut();
        return id;
      });
      setSelected(id);
    };
    addEventListener('popstate', onHash);
    const t = setInterval(() => tick((x) => x + 1), 60_000); // due states refresh
    return () => { removeEventListener('popstate', onHash); clearInterval(t); };
  }, [index]);

  const depth = (id: string) => index.get(id)?.path.length ?? 0;
  const go = (id: string) => {
    if (id === focus) return;
    history.pushState(null, '', id === home ? location.pathname : `#${encodeURIComponent(id)}`);
    setFocus(id);
  };

  const update = (p: Progress) => { save(p); setProgress({ ...p }); };
  const state = (id: string): NodeState => (id === '' ? 'unlocked' : stateOf(progress, id, index.get(id)?.parent?.id));

  const focusEntry = index.get(focus)!;
  const sun = focusEntry.node;
  const planets = sun.children;
  const sel = index.get(selected) ?? focusEntry;

  const due = useMemo(
    () => [...index.values()].filter((e) => e.node.id && isDue(progress, e.node.id) && state(e.node.id) !== 'locked'),
    [progress, index, focus],
  );
  const learnable = [...index.values()].filter((e) => e.node.id);
  const masteredCount = learnable.filter((e) => mastery(progress, e.node.id) >= MAX).length;

  const onPlanet = (n: MapNode) => {
    if (n.children.length) { sfx.warpIn(); setDir('in'); go(n.id); setSelected(n.id); }
    else { state(n.id) === 'locked' ? sfx.denied() : sfx.blip(); setSelected(n.id); }
  };

  const R = planets.length > 7 ? 340 : 310;
  const pos = (i: number, n: number, r = R) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };

  return (
    <div class="app">
      <div class="bar">
        <nav class="crumbs" aria-label="Breadcrumb">
          {focusEntry.path.filter((n) => maps.length > 1 || n.id !== '').map((n, i, arr) => (
            <span key={n.id}>
              {i > 0 && <span class="sep">›</span>}
              {i === arr.length - 1 ? <strong>{n.title}</strong> : (
                <button class="link" onClick={() => { sfx.warpOut(); setDir('out'); go(n.id); setSelected(n.id); }}>{n.title}</button>
              )}
            </span>
          ))}
        </nav>
        <div class="bar-right">
          <span class="chip" title="Mastered nodes">★ {masteredCount}/{learnable.length}</span>
          <button class={`chip ${due.length ? 'due' : ''}`} disabled={!due.length}
            onClick={() => { const e = due[0]; const p = e.parent?.id ?? home; if (p !== focus) sfx.warpIn(); else sfx.blip(); setDir('in'); go(p); setSelected(e.node.id); }}>
            {due.length} due
          </button>
          <button class="chip" onClick={() => setSyncOpen(true)}>Sync</button>
          <button class="chip" aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} title={muted ? 'Sound off' : 'Sound on'}
            onClick={() => { setMuted(!muted); setM(!muted); if (muted) sfx.beep(); }}>{muted ? '🔇' : '🔊'}</button>
        </div>
      </div>

      <div class="stage">
        <svg class="sky" viewBox="-500 -500 1000 1000" role="group" aria-label={`${sun.title} and its subtopics`}>
          <defs>
            <radialGradient id="sunGlow"><stop offset="0" stop-color="var(--sun)" stop-opacity=".55" /><stop offset="1" stop-color="var(--sun)" stop-opacity="0" /></radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <g key={focus} class={`scene zoom-${dir}`}>
            <circle r={R} class="orbit-ring" />
            {planets.map((p, i) => {
              const [x, y] = pos(i, planets.length);
              const s = state(p.id);
              return <line key={`l${p.id}`} x1={0} y1={0} x2={x} y2={y} class={`path ${s === 'locked' ? '' : 'lit'} ${s === 'mastered' ? 'gold' : ''}`} />;
            })}
            <g class={`node sun ${focus === '' ? 'universe' : state(focus)} ${selected === focus ? 'sel' : ''}`}
              onClick={() => { sfx.blip(); setSelected(focus); }} role="button" tabIndex={0} aria-label={`${sun.title}, ${focus ? STATE_LABEL[state(focus)] : ''}`}>
              <circle r={150} fill="url(#sunGlow)" class="halo" />
              <circle r={78} class="body" />
              {focus !== '' && <Ring id={focus} r={90} progress={progress} />}
              <Label text={sun.title} y={0} size={28} max={10} cls="sun-label" />
            </g>
            {planets.map((p, i) => {
              const [x, y] = pos(i, planets.length);
              const s = state(p.id);
              return (
                <g key={p.id} class={`node planet ${s} ${selected === p.id ? 'sel' : ''}`} transform={`translate(${x} ${y})`}
                  onClick={() => onPlanet(p)} role="button" tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPlanet(p))}
                  aria-label={`${p.title}, ${STATE_LABEL[s]}${p.children.length ? `, ${p.children.length} subtopics` : ''}`}>
                  <circle r={70} class="hit" />
                  {p.children.map((c, j) => {
                    const [mx, my] = pos(j, p.children.length, 62);
                    return <circle key={c.id} cx={mx} cy={my} r={7} class={`moon ${state(c.id)}`} />;
                  })}
                  <circle r={44} class="body" filter={s === 'mastered' ? 'url(#glow)' : undefined} />
                  <Ring id={p.id} r={52} progress={progress} />
                  {progress.nodes[p.id]?.want && <text class="flag" x={34} y={-30} text-anchor="middle">{progress.nodes[p.id]?.want === 'depth' ? '↓' : '↔'}</text>}
                  {s === 'locked' && <text class="lock" y={9} text-anchor="middle">🔒</text>}
                  {s !== 'locked' && <text class="lvl" y={10} text-anchor="middle">{mastery(progress, p.id)}</text>}
                  <Label text={p.title} y={y > 150 ? -108 : 86} size={24} max={16} cls="planet-label" />
                </g>
              );
            })}
          </g>
        </svg>
        <Legend />
      </div>

      <Detail entry={sel} state={sel.node.id ? state(sel.node.id) : 'unlocked'} progress={progress}
        onRate={(r) => {
          const before = mastery(progress, sel.node.id);
          const next = review(progress, sel.node.id, r);
          const after = mastery(next, sel.node.id);
          if (r === 'forgot') sfx.fail();
          else if (after >= MAX && before < MAX) sfx.mastered();
          else if (before < UNLOCK_AT && after >= UNLOCK_AT && sel.node.children.length) sfx.unlock();
          else sfx.review(after);
          update(next);
        }}
        onWant={(w) => { sfx.beep(); update(flag(progress, sel.node.id, w)); }}
        onZoom={sel.node.children.length && sel.node.id !== focus ? () => { sfx.warpIn(); setDir('in'); go(sel.node.id); setSelected(sel.node.id); } : undefined} />

      {syncOpen && <Sync progress={progress} knownIds={new Set(index.keys())} onClose={() => setSyncOpen(false)} onReplace={update} />}
    </div>
  );
}

function Ring({ id, r, progress }: { id: string; r: number; progress: Progress }) {
  const m = mastery(progress, id);
  if (!m) return null;
  const c = 2 * Math.PI * r;
  return <circle r={r} class="ring" stroke-dasharray={`${(c * m) / MAX} ${c}`} transform="rotate(-90)" />;
}

/** Wraps a title onto up to 2 lines. */
function Label({ text, y, size, max, cls }: { text: string; y: number; size: number; max: number; cls: string }) {
  const words = text.split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= max) lines[lines.length - 1] = last + ' ' + w;
    else lines.push(w);
  }
  const shown = lines.length > 2 ? [lines[0], lines.slice(1).join(' ')] : lines;
  const y0 = y - ((shown.length - 1) * size * 1.1) / 2 + size * 0.35;
  return (
    <text class={cls} text-anchor="middle" font-size={size}>
      {shown.map((l, i) => <tspan key={i} x={0} y={y0 + i * size * 1.1}>{l}</tspan>)}
    </text>
  );
}

function Legend() {
  const items: NodeState[] = ['locked', 'unlocked', 'progress', 'mastered', 'due'];
  return (
    <ul class="legend">
      {items.map((s) => <li key={s}><span class={`dot ${s}`} />{STATE_LABEL[s]}</li>)}
    </ul>
  );
}

function Detail({ entry, state, progress, onRate, onWant, onZoom }: {
  entry: Entry; state: NodeState; progress: Progress; onRate: (r: Rating) => void; onWant: (w: Want) => void; onZoom?: () => void;
}) {
  const { node, parent } = entry;
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(false), [node.id]);
  const np = progress.nodes[node.id];
  if (!node.id) return (
    <section class="detail"><h2>{node.title}</h2><p class="muted">{node.summary}</p></section>
  );
  const m = np?.mastery ?? 0;
  return (
    <section class={`detail ${state}`} aria-live="polite">
      <div class="detail-head">
        <div>
          <p class="eyebrow">{STATE_LABEL[state]}</p>
          <h2>{node.title}</h2>
        </div>
        <div class="pips" aria-label={`Mastery ${m} of ${MAX}`}>
          {Array.from({ length: MAX }, (_, i) => <span key={i} class={i < m ? 'on' : ''} />)}
        </div>
      </div>
      <p>{node.summary}</p>
      <p class="meta muted">
        Next review {fmtDate(np?.nextReview)} · {np?.reviews ?? 0} reviews
        {node.children.length > 0 && <> · children unlock at mastery {UNLOCK_AT}</>}
      </p>
      {node.resources?.length ? (
        <ul class="resources">{node.resources.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener">{r.title} ↗</a></li>)}</ul>
      ) : null}
      {state === 'locked' ? (
        <p class="locked-note">Locked: raise <strong>{parent?.title}</strong> to mastery {UNLOCK_AT} to unlock this.</p>
      ) : (
        <div class="recall">
          <h3>Recall</h3>
          <ol>{node.prompts.map((q) => <li key={q}>{q}</li>)}</ol>
          {!shown ? (
            <button class="btn primary" onClick={() => { sfx.blip(); setShown(true); }}>I've answered from memory → rate it</button>
          ) : (
            <div class="rate" role="group" aria-label="How well did you recall it?">
              <button class="btn bad" onClick={() => { setShown(false); onRate('forgot'); }}>Forgot</button>
              <button class="btn" onClick={() => { setShown(false); onRate('hard'); }}>Hard</button>
              <button class="btn" onClick={() => { setShown(false); onRate('good'); }}>Good</button>
              <button class="btn good" onClick={() => { setShown(false); onRate('easy'); }}>Easy</button>
            </div>
          )}
        </div>
      )}
      {state !== 'locked' && (
        <div class="want">
          <h3>Next time Claude grows the map</h3>
          <div class="row" role="group" aria-label="Ask for more here">
            <button class={`btn ${np?.want === 'depth' ? 'on' : ''}`} aria-pressed={np?.want === 'depth'} onClick={() => onWant('depth')}>↓ More depth</button>
            <button class={`btn ${np?.want === 'breadth' ? 'on' : ''}`} aria-pressed={np?.want === 'breadth'} onClick={() => onWant('breadth')}>↔ More breadth</button>
          </div>
          <p class="muted small">Depth: go deeper under this node. Breadth: add sibling topics next to it. Saved with your progress export.</p>
        </div>
      )}
      {onZoom && <button class="btn ghost" onClick={onZoom}>Fly into {node.title} →</button>}
    </section>
  );
}
