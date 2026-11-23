export interface Resource { title: string; url: string }
export interface MapNode {
  id: string;
  title: string;
  summary: string;
  resources?: Resource[];
  prompts: string[];
  children: MapNode[];
}
