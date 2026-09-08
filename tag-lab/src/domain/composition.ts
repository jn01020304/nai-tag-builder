export interface ArtistNode {
  kind: "artist";
  id: string;
  tag: string;
  weight: number;
}

export interface ChunkNode {
  kind: "chunk";
  id: string;
  name: string;
  weight: number;
  children: CompositionNode[];
  sourceChunkId?: string;
  forkedFrom?: string;
}

export type CompositionNode = ArtistNode | ChunkNode;

export interface FlattenedArtist {
  tag: string;
  weight: number;
  occurrences: number;
}

export interface PromptArtist {
  tag: string;
  weight: number;
}

const weightedTokenPattern = /^(-?\d+(?:\.\d+)?)\s*::\s*([\s\S]+?)\s*::$/;

export function createArtist(id: string, tag: string, weight = 1): ArtistNode {
  return {
    kind: "artist",
    id,
    tag: stripArtistPrefix(tag),
    weight,
  };
}

export function createChunk(
  id: string,
  name: string,
  children: CompositionNode[],
  weight = 1,
  sourceChunkId?: string,
): ChunkNode {
  return { kind: "chunk", id, name, children, weight, sourceChunkId };
}

export function stripArtistPrefix(tag: string): string {
  return tag.trim().replace(/^artist:/i, "");
}

export function flattenComposition(root: CompositionNode): FlattenedArtist[] {
  const flattened = new Map<string, FlattenedArtist>();

  const visit = (node: CompositionNode, inheritedWeight: number) => {
    const effectiveWeight = inheritedWeight * node.weight;
    if (node.kind === "artist") {
      const current = flattened.get(node.tag);
      if (current) {
        current.weight += effectiveWeight;
        current.occurrences += 1;
      } else {
        flattened.set(node.tag, {
          tag: node.tag,
          weight: effectiveWeight,
          occurrences: 1,
        });
      }
      return;
    }

    node.children.forEach((child) => visit(child, effectiveWeight));
  };

  visit(root, 1);
  return [...flattened.values()];
}

export function countArtistLeaves(root: CompositionNode): number {
  if (root.kind === "artist") return 1;
  return root.children.reduce((total, child) => total + countArtistLeaves(child), 0);
}

export function getEffectiveWeight(root: CompositionNode, nodeId: string): number | null {
  const visit = (node: CompositionNode, inheritedWeight: number): number | null => {
    const effectiveWeight = inheritedWeight * node.weight;
    if (node.id === nodeId) return effectiveWeight;
    if (node.kind === "artist") return null;

    for (const child of node.children) {
      const result = visit(child, effectiveWeight);
      if (result != null) return result;
    }
    return null;
  };

  return visit(root, 1);
}

export function updateNodeWeight(
  root: CompositionNode,
  nodeId: string,
  weight: number,
): CompositionNode {
  if (root.id === nodeId) return { ...root, weight };
  if (root.kind === "artist") return root;

  let changed = false;
  const children = root.children.map((child) => {
    const next = updateNodeWeight(child, nodeId, weight);
    changed ||= next !== child;
    return next;
  });

  return changed ? { ...root, children } : root;
}

export function parseArtistPrompt(prompt: string): PromptArtist[] {
  const artists = new Map<string, PromptArtist>();

  for (const rawToken of prompt.split(",")) {
    const token = rawToken.trim();
    if (!token) continue;
    const weighted = weightedTokenPattern.exec(token);
    const weight = weighted ? Number.parseFloat(weighted[1]) : 1;
    const name = weighted ? weighted[2] : token;
    if (!/^artist:/i.test(name)) continue;
    const tag = stripArtistPrefix(name);
    artists.set(tag, { tag, weight });
  }

  return [...artists.values()];
}

export function forkCompositionFromPrompt(
  source: ChunkNode | null,
  prompt: string,
  forkId: string,
  forkName?: string,
): ChunkNode {
  const sourceName = source?.name ?? "프롬프트";
  const children = parseArtistPrompt(prompt).map((artist, index) =>
    createArtist(`${forkId}-artist-${index + 1}`, artist.tag, artist.weight),
  );

  return {
    kind: "chunk",
    id: forkId,
    name: forkName ?? `${sourceName} 사본`,
    weight: 1,
    children,
    forkedFrom: sourceName,
  };
}

export function serializeArtistPrompt(root: CompositionNode): string {
  return flattenComposition(root)
    .map(({ tag, weight }) => {
      const name = `artist:${tag}`;
      const roundedWeight = roundWeight(weight);
      return roundedWeight === 1 ? name : `${formatWeight(roundedWeight)}::${name}::`;
    })
    .join(", ");
}

export function roundWeight(weight: number): number {
  return Math.round(weight * 100) / 100;
}

function formatWeight(weight: number): string {
  return String(roundWeight(weight));
}
