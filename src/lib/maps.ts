// Loads every map in src/data/maps at build time and validates it. Any bad node fails the build.
import { z } from 'astro/zod';
import type { MapNode } from './types';

const ID = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

const nodeSchema: z.ZodType<MapNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().regex(ID, 'ids are lowercase dotted slugs, e.g. ai.transformers.attention'),
    title: z.string().min(1),
    summary: z.string().min(10).max(240),
    resources: z.array(z.object({ title: z.string().min(1), url: z.string().url() })).optional(),
    hook: z.string().min(10).max(200),
    cards: z.array(z.object({ q: z.string().min(5), a: z.string().min(1).max(400) })).min(1),
    children: z.array(nodeSchema).default([]),
  }),
);

function check(file: string, root: MapNode, seen: Set<string>) {
  const errors: string[] = [];
  const walk = (n: MapNode, parent?: MapNode) => {
    if (seen.has(n.id)) errors.push(`[${file}] duplicate id "${n.id}"`);
    seen.add(n.id);
    if (parent && !n.id.startsWith(parent.id + '.'))
      errors.push(`[${file}] "${n.id}" must start with its parent id "${parent.id}."`);
    n.children.forEach((c) => walk(c, n));
  };
  walk(root);
  if (root.id.includes('.')) errors.push(`[${file}] root id "${root.id}" must have no dots`);
  if (errors.length) throw new Error(`Map errors:\n${errors.join('\n')}`);
}

const files = import.meta.glob('../data/maps/*.json', { eager: true, import: 'default' });
const seen = new Set<string>();
export const maps: MapNode[] = Object.entries(files)
  .map(([file, data]) => {
    const root = nodeSchema.parse(data, { path: [file] });
    check(file, root, seen);
    return root;
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export const nodeCount = seen.size;
