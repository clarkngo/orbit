export interface Resource { title: string; url: string }
export interface Card { q: string; a: string }
export interface MapNode {
  id: string;
  title: string;
  summary: string;
  resources?: Resource[];
  /** One-line analogy or mental image: the intuition to hang the facts on. */
  hook: string;
  cards: Card[];
  children: MapNode[];
}
