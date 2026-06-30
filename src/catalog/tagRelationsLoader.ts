import { getCatalogBaseUrl } from './catalogBaseUrl';
import type { TagRelationsData } from './tagRelationsTypes';

/**
 * Loads the offline tag-relations asset once and caches it. The asset is a
 * single bounded file (top-N seed tags), so unlike the dictionary loader there
 * is no per-category chunking or LRU — one fetch, kept in memory. A failed or
 * missing fetch resolves to null so recommendations fall back to the heuristic.
 */
export class TagRelationsLoader {
  private data: TagRelationsData | null = null;
  private inflight: Promise<TagRelationsData | null> | null = null;

  async load(): Promise<TagRelationsData | null> {
    if (this.data) return this.data;
    if (!this.inflight) {
      const url = `${getCatalogBaseUrl()}catalog/tag-relations/relations.json`;
      this.inflight = (async () => {
        try {
          const response = await fetch(url);
          if (!response.ok) return null;
          const json = (await response.json()) as TagRelationsData;
          this.data = json;
          return json;
        } catch (error) {
          console.error('TagRelationsLoader: Error loading relations', error);
          return null;
        } finally {
          this.inflight = null;
        }
      })();
    }
    return this.inflight;
  }
}

export const tagRelationsLoader = new TagRelationsLoader();
