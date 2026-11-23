import { useEffect, useMemo, useState } from 'preact/hooks';
import type { MapNode } from '../lib/types';
import {
  load, save, review, flag, setNote, stateOf, mastery, isDue, MAX, UNLOCK_AT,
  type Progress, type Rating, type NodeState, type Want, type NodeProgress,
} from '../lib/progress';
import Sync from './Sync';
import { sfx, isMuted, setMuted } from '../lib/sfx';
import { isMusicOn, startMusic, stopMusic } from '../lib/music';

interface Props { maps: MapNode[] }
interface Entry { node: MapNode; parent?: MapNode; path: MapNode[] }

const UNIVERSE: Omit<MapNode, 'children'> = {
  id: '', title: 'Orbit', summary: 'Each topic is a sun. Pick one to fly in.', hook: '', cards: [],
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
  const [music, setMusic] = useState(() => isMusicOn());
  // Browsers only allow audio after a user gesture, so a remembered "on" starts at the first tap.
  useEffect(() => {
    if (!isMusicOn()) return;
    const go = () => startMusic();
    addEventListener('pointerdown', go, { once: true });
    return () => removeEventListener('pointerdown', go);
  }, []);
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
          <button class={`chip ${music ? 'on' : ''}`} aria-pressed={music} aria-label={music ? 'Stop ambient music' : 'Play ambient music'}
            title={music ? 'Ambient music on' : 'Ambient music off'}
            onClick={() => { music ? stopMusic() : startMusic(); setMusic(!music); }}>♪</button>
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
        onRate={(r, note) => {
          const before = mastery(progress, sel.node.id);
          let next = review(progress, sel.node.id, r);
          if ((next.nodes[sel.node.id]?.note ?? '') !== note.trim()) next = setNote(next, sel.node.id, note);
          const after = mastery(next, sel.node.id);
          if (r === 'forgot') sfx.fail();
          else if (after >= MAX && before < MAX) sfx.mastered();
          else if (before < UNLOCK_AT && after >= UNLOCK_AT && sel.node.children.length) sfx.unlock();
          else sfx.review(after);
          update(next);
        }}
        onWant={(w) => { sfx.beep(); update(flag(progress, sel.node.id, w)); }}
        onNote={(n) => { if ((progress.nodes[sel.node.id]?.note ?? '') !== n.trim()) update(setNote(progress, sel.node.id, n)); }}
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

function Detail({ entry, state, progress, onRate, onWant, onNote, onZoom }: {
  entry: Entry; state: NodeState; progress: Progress; onRate: (r: Rating, note: string) => void; onWant: (w: Want) => void;
  onNote: (n: string) => void; onZoom?: () => void;
}) {
  const { node, parent } = entry;
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
        <Review key={node.id} node={node} np={np} onRate={onRate} onNote={onNote} />
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

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const RATINGS: { r: Rating; label: string; hint: string; cls: string }[] = [
  { r: 'forgot', label: 'Forgot', hint: "Couldn't produce the key idea", cls: 'bad' },
  { r: 'hard', label: 'Hard', hint: 'Got there partly or slowly', cls: '' },
  { r: 'good', label: 'Good', hint: 'Got the key ideas', cls: '' },
  { r: 'easy', label: 'Easy', hint: 'Instant, could teach it', cls: 'good' },
];

/**
 * Study → test loop built on retrieval practice:
 * a new node shows its intuition hook and answers first (study); afterwards every review
 * hides them so you must generate the answer yourself, then compare, explain it in your
 * own words, and rate. Cards come in a fresh random order each time.
 */
function Review({ node, np, onRate, onNote }: {
  node: MapNode; np?: NodeProgress; onRate: (r: Rating, note: string) => void; onNote: (n: string) => void;
}) {
  const isNew = !np?.reviews;
  const [phase, setPhase] = useState<'idle' | 'study' | 'ask' | 'reveal' | 'reflect'>('idle');
  const [order, setOrder] = useState(() => shuffle(node.cards));
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [note, setNoteText] = useState(np?.note ?? '');
  const card = order[i];

  const start = (p: 'study' | 'ask') => { sfx.blip(); setOrder(shuffle(node.cards)); setI(0); setTyped(''); setPhase(p); };
  const next = () => {
    sfx.blip(); setTyped('');
    if (i + 1 < order.length) { setI(i + 1); setPhase('ask'); } else setPhase('reflect');
  };
  const finish = (r: Rating) => { setPhase('idle'); onRate(r, note); };

  if (phase === 'idle') return (
    <div class="recall">
      {isNew ? (
        <>
          <div class="hook"><span>💡</span><p>{node.hook}</p></div>
          <p class="muted small">New node: read the {node.cards.length} cards first, then test yourself.</p>
          <div class="row">
            <button class="btn primary" onClick={() => start('study')}>Study {node.cards.length} cards</button>
            <button class="btn" onClick={() => start('ask')}>Test myself</button>
          </div>
        </>
      ) : (
        <>
          <p class="muted small">Answer {node.cards.length} cards from memory, then compare. The intuition stays hidden until you've tried.</p>
          <button class="btn primary" onClick={() => start('ask')}>Start review</button>
        </>
      )}
    </div>
  );

  if (phase === 'study') return (
    <div class="recall">
      <div class="hook"><span>💡</span><p>{node.hook}</p></div>
      <ol class="study">{node.cards.map((c) => <li key={c.q}><strong>{c.q}</strong><p>{c.a}</p></li>)}</ol>
      <p class="muted small">Cover the answers in your head. Ready? Now pull them back out without looking.</p>
      <button class="btn primary" onClick={() => start('ask')}>Test myself →</button>
    </div>
  );

  if (phase === 'reflect') return (
    <div class="recall">
      <div class="hook"><span>💡</span><p>{node.hook}</p></div>
      <label class="note">
        <span>In your own words: why does it work, or what does it remind you of?</span>
        <textarea rows={3} value={note} placeholder="e.g. It's like… / The reason is…"
          onInput={(e) => setNoteText((e.target as HTMLTextAreaElement).value)} onBlur={() => onNote(note)} />
      </label>
      <p class="muted small">How well did you recall it overall?</p>
      <div class="rate" role="group" aria-label="How well did you recall it?">
        {RATINGS.map((x) => (
          <button key={x.r} class={`btn ${x.cls}`} title={x.hint} onClick={() => finish(x.r)}>
            {x.label}<small>{x.hint}</small>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div class="recall">
      <p class="eyebrow muted">Card {i + 1} of {order.length}</p>
      <p class="q">{card.q}</p>
      {phase === 'ask' ? (
        <>
          <textarea class="attempt" rows={3} value={typed} autoFocus placeholder="Type or say your answer first, even a guess. Generating it is what makes it stick."
            onInput={(e) => setTyped((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sfx.blip(); setPhase('reveal'); } }} />
          <button class="btn primary" onClick={() => { sfx.blip(); setPhase('reveal'); }}>Reveal answer</button>
        </>
      ) : (
        <>
          {typed.trim() && <div class="yours"><span class="muted small">You said</span><p>{typed}</p></div>}
          <div class="answer"><span class="muted small">Answer</span><p>{card.a}</p></div>
          {np?.note && <div class="yours"><span class="muted small">Your earlier explanation</span><p>{np.note}</p></div>}
          <button class="btn primary" onClick={next}>{i + 1 < order.length ? 'Next card →' : 'Wrap up →'}</button>
        </>
      )}
    </div>
  );
}
