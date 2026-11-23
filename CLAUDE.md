# Orbit: notes for Claude

Astro + Preact + TypeScript learning map. UI: `src/components/App.tsx` (SVG orbit view) and `Sync.tsx`.
Progress logic: `src/lib/progress.ts`. Map loading and validation: `src/lib/maps.ts`.

## Map schema (`src/data/maps/<topic>.json`, one root node per file)

```jsonc
{
  "id": "ai.transformers.attention", // stable dotted slug: parent id + "." + segment; root has no dot
  "title": "Self-Attention",
  "summary": "10–240 chars, one or two sentences.",
  "resources": [{ "title": "…", "url": "https://…" }], // optional
  "hook": "One-line analogy or mental image (10–200 chars).",
  "cards": [{ "q": "Recall question", "a": "1–2 sentence answer (≤400 chars)" }], // 1+, aim for 2–3
  "children": []                                       // same shape, recursive
}
```

Ids must be globally unique and must start with their parent's id. `npm run build` fails on violations.

## Workflow: "read my progress and expand the map"

1. Read `progress/progress.json` (`{ version, updatedAt, nodes: { [id]: { mastery 0–5, nextReview, lastReview, reviews, lapses, want?, note?, touched } } }`).
   `want` is the learner's explicit request: `"depth"` = add children under that node (even if not yet mastered);
   `"breadth"` = add siblings next to it (children of its parent). Flagged nodes come first; clear nothing yourself,
   the user unflags in the app.
2. Find branches the user has mastered (mastery ≥ 4), especially leaves with no children yet.
   Note weak spots too (lapses, low mastery) and don't expand those.
3. Add 2–5 child nodes under each, going deeper or more applied. Give each a vivid concrete `hook` (an analogy the learner already knows),
   2–3 cards that ask *why/how* rather than definitions alone, short precise answers, and 0–2 reputable resources.
   Read the learner's `note` fields: their own analogies show how they think, so build new hooks on them.
4. **Never rename, move or delete existing ids.** Progress is keyed by id. If a rename is unavoidable, say so;
   old progress is kept quietly but would be orphaned.
5. Run `npm run build`, then summarize what was added and why. Commit only when asked.
