// Progress lives in localStorage, keyed by node id. Ids that no longer exist in any map are kept
// untouched so renames can be undone and nothing is silently lost.
import LZString from 'lz-string';

export const VERSION = 1;
const KEY = 'orbit.progress';
const DAY = 86_400_000;
/** Days until next review, by mastery level after the review (index 0 = failed). */
export const INTERVALS = [1, 1, 3, 7, 21, 60];
export const UNLOCK_AT = 2;
export const MAX = 5;

export interface NodeProgress {
  mastery: number;      // 0..5
  nextReview?: string;  // ISO date
  lastReview?: string;  // ISO date
  reviews: number;
  lapses: number;
}
export interface Progress {
  version: number;
  updatedAt: string;
  nodes: Record<string, NodeProgress>;
}
export type Rating = 'forgot' | 'hard' | 'good' | 'easy';
export type NodeState = 'locked' | 'unlocked' | 'progress' | 'mastered' | 'due';

export const empty = (): Progress => ({ version: VERSION, updatedAt: new Date().toISOString(), nodes: {} });

export function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {}
  return empty();
}

export function save(p: Progress) {
  p.updatedAt = new Date().toISOString();
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

/** Accepts anything that looks like progress; throws on garbage. Unknown ids are preserved. */
export function normalize(data: unknown): Progress {
  const d = data as Partial<Progress>;
  if (!d || typeof d !== 'object' || typeof d.nodes !== 'object' || d.nodes === null)
    throw new Error('Not an Orbit progress file');
  if (typeof d.version === 'number' && d.version > VERSION)
    throw new Error(`Progress version ${d.version} is newer than this app (${VERSION}). Reload the page.`);
  const nodes: Record<string, NodeProgress> = {};
  for (const [id, n] of Object.entries(d.nodes as Record<string, Partial<NodeProgress>>)) {
    if (!n || typeof n !== 'object') continue;
    nodes[id] = {
      mastery: Math.max(0, Math.min(MAX, Math.round(Number(n.mastery) || 0))),
      nextReview: typeof n.nextReview === 'string' ? n.nextReview : undefined,
      lastReview: typeof n.lastReview === 'string' ? n.lastReview : undefined,
      reviews: Number(n.reviews) || 0,
      lapses: Number(n.lapses) || 0,
    };
  }
  return { version: VERSION, updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date().toISOString(), nodes };
}

/** Merge two devices' progress: per node, the most recently reviewed copy wins. */
export function merge(a: Progress, b: Progress): Progress {
  const nodes = { ...a.nodes };
  for (const [id, n] of Object.entries(b.nodes)) {
    const cur = nodes[id];
    if (!cur || (n.lastReview ?? '') > (cur.lastReview ?? '')) nodes[id] = n;
  }
  return { version: VERSION, updatedAt: new Date().toISOString(), nodes };
}

export function review(p: Progress, id: string, rating: Rating, now = new Date()): Progress {
  const cur = p.nodes[id] ?? { mastery: 0, reviews: 0, lapses: 0 };
  let m = cur.mastery;
  if (rating === 'forgot') m = Math.max(0, m - 2);
  else if (rating === 'hard') m = Math.max(1, m);
  else if (rating === 'good') m = Math.min(MAX, m + 1);
  else m = Math.min(MAX, m + 2);
  const days = rating === 'forgot' ? INTERVALS[0] : rating === 'hard' ? Math.max(1, Math.round(INTERVALS[m] / 2)) : INTERVALS[m];
  const next: NodeProgress = {
    mastery: m,
    lastReview: now.toISOString(),
    nextReview: new Date(now.getTime() + days * DAY).toISOString(),
    reviews: cur.reviews + 1,
    lapses: cur.lapses + (rating === 'forgot' ? 1 : 0),
  };
  return { ...p, nodes: { ...p.nodes, [id]: next } };
}

export const mastery = (p: Progress, id: string) => p.nodes[id]?.mastery ?? 0;
export const isDue = (p: Progress, id: string, now = Date.now()) => {
  const n = p.nodes[id];
  return !!n?.nextReview && n.reviews > 0 && Date.parse(n.nextReview) <= now;
};

/** parentId undefined = a map root, which is always unlocked. */
export function stateOf(p: Progress, id: string, parentId?: string): NodeState {
  if (parentId && mastery(p, parentId) < UNLOCK_AT) return 'locked';
  if (isDue(p, id)) return 'due';
  const m = mastery(p, id);
  if (m >= MAX) return 'mastered';
  if (m > 0) return 'progress';
  return 'unlocked';
}

export const toCode = (p: Progress) => LZString.compressToEncodedURIComponent(JSON.stringify(p));
export function fromCode(code: string): Progress {
  const json = LZString.decompressFromEncodedURIComponent(code.trim().replace(/\s+/g, ''));
  if (!json) throw new Error('That sync code is damaged or incomplete.');
  return normalize(JSON.parse(json));
}
