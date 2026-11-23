# Orbit

A learning map shaped like a solar system. Each topic is a sun and its subtopics orbit it as planets.
Click a planet to fly in, and its own children orbit it in turn. Paths light up as you master nodes,
in the spirit of a sphere grid.

Live: https://clarkngo.github.io/orbit/

## How it works

- **Node states:** locked (dim), unlocked, in progress, mastered (gold glow), and due for review (pulsing orange).
- **Answer cards:** every node has a one-line intuition hook (an analogy) and 2–3 question/answer cards.
  - *New node:* study the hook and the cards, then test yourself right away.
  - *Review:* the cards come in a random order with the answers and hook hidden. You type or say an answer, reveal it, and compare.
    At the end you see the hook and write the idea in your own words; that note comes back on later reviews.
  - This uses retrieval practice, generation, elaboration, spacing and varied order, the techniques with the strongest evidence for long-term memory.
- **Mastery 0–5:** after the cards, rate yourself:
  Forgot (−2, back to 1 day), Hard (same level, half interval), Good (+1), Easy (+2).
- **Spaced repetition:** the next review comes 1 → 3 → 7 → 21 → 60 days out by mastery level.
  The **N due** chip jumps to the next node that's due.
- **Unlocking:** a node's children unlock once it reaches mastery 2.
- **Sound:** synthesized sci-fi effects (warp in and out, sonar blips, unlock chirps, a star chord on mastery). Use the 🔊 chip to mute.
- **Ambient music:** the ♪ chip plays generative space ambient (a slow breathing drone pad, sparse echoing chimes, soft solar wind), made live in the browser. It never repeats exactly, so it loops without a seam. It's off by default and remembers your choice.

## Progress and sync

Progress is stored in `localStorage` (`orbit.progress`) under a `version` field and keyed by node id.
Progress for ids that are no longer in any map is kept, never deleted. localStorage doesn't sync
between devices, so **Sync** offers two ways to move it:

1. **File:** download `progress.json`, then import it on the other device.
2. **Sync code:** an lz-string-compressed code. Copy it on one device (e.g. iPad) and paste it on the other (e.g. MacBook).

Imports merge per node, and the most recent review wins.

## Growing the map with Claude

1. In Orbit, go to **Sync → Download progress.json**.
2. Save it as `progress/progress.json` in this repo.
   Before exporting, you can flag any node **↓ More depth** or **↔ More breadth** in its panel; flags travel in the file.
3. Ask Claude Code: **"read my progress and expand the map"**.
4. Claude adds new child nodes under flagged nodes first, then branches you've mastered (mastery ≥ 4) in `src/data/maps/*.json`,
   keeps every existing id unchanged, runs `npm run build` to validate, and commits.

## Maps

Each map is one JSON file in `src/data/maps/<topic>.json`. The schema is described in [CLAUDE.md](CLAUDE.md),
and it's validated with Zod at build time in `src/lib/maps.ts`.

## Develop

```bash
npm install
npm run dev     # http://localhost:4322/orbit/
npm run build   # type-check, validate maps, build
```

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`.

Designed and built by Clark Ngo.
