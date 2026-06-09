import { getCatalogBaseUrl } from './catalogBaseUrl';
import type { TagDictionaryManifest, TagDictionaryChunkData, TagDictionaryCategoryMeta } from './tagDictionaryTypes';

export class TagDictionaryLoader {
  manifest: TagDictionaryManifest | null = null;
  chunkCache: Map<string, { data: TagDictionaryChunkData; sizeBytes: number; lastAccess: number }> = new Map();
  maxCachedChunks: number = 5;
  maxCachedBytes: number = 5 * 1024 * 1024; // 5MB
  currentCacheBytes: number = 0;

  async loadManifest(): Promise<TagDictionaryManifest> {
    if (this.manifest) return this.manifest;

    const baseUrl = getCatalogBaseUrl();
    const manifestUrl = `${baseUrl}catalog/tag-dictionary/manifest.json`;

    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to load manifest from ${manifestUrl}: ${response.status} ${response.statusText}`);
      }
      this.manifest = await response.json();
      return this.manifest!;
    } catch (error) {
      console.error("TagDictionaryLoader: Error loading manifest", error);
      throw error;
    }
  }

  async loadChunk(categoryId: string): Promise<TagDictionaryChunkData> {
    const cached = this.chunkCache.get(categoryId);
    if (cached) {
      cached.lastAccess = Date.now();
      return cached.data;
    }

    if (!this.manifest) {
      await this.loadManifest();
    }

    const categoryMeta = this.manifest!.categories.find((c) => c.id === categoryId);
    if (!categoryMeta) {
      throw new Error(`Category ${categoryId} not found in manifest`);
    }

    const baseUrl = getCatalogBaseUrl();
    const chunkUrl = `${baseUrl}catalog/tag-dictionary/${categoryMeta.file}`;

    try {
      const response = await fetch(chunkUrl);
      if (!response.ok) {
        throw new Error(`Failed to load chunk ${categoryId} from ${chunkUrl}: ${response.status} ${response.statusText}`);
      }
      
      const chunkData: TagDictionaryChunkData = await response.json();
      
      const sizeBytes = categoryMeta.bytes;

      this.addChunkToCache(categoryId, chunkData, sizeBytes);

      return chunkData;
    } catch (error) {
      console.error(`TagDictionaryLoader: Error loading chunk ${categoryId}`, error);
      throw error;
    }
  }

  private addChunkToCache(categoryId: string, data: TagDictionaryChunkData, sizeBytes: number) {
    this.chunkCache.set(categoryId, {
      data,
      sizeBytes,
      lastAccess: Date.now()
    });
    this.currentCacheBytes += sizeBytes;

    this.evictLeastRecentlyUsed();
  }

  private evictLeastRecentlyUsed(): void {
    while (
      this.chunkCache.size > 0 && 
      (this.chunkCache.size > this.maxCachedChunks || this.currentCacheBytes > this.maxCachedBytes)
    ) {
      let lruKey: string | null = null;
      let minAccess = Infinity;

      for (const [key, value] of this.chunkCache.entries()) {
        if (value.lastAccess < minAccess) {
          minAccess = value.lastAccess;
          lruKey = key;
        }
      }

      if (lruKey) {
        const evicted = this.chunkCache.get(lruKey)!;
        this.currentCacheBytes -= evicted.sizeBytes;
        this.chunkCache.delete(lruKey);
      }
    }
  }

  getGroups(): { groupId: string; groupLabel: string; categories: TagDictionaryCategoryMeta[] }[] {
    if (!this.manifest) return [];

    const groupsMap = new Map<string, { groupId: string; groupLabel: string; categories: TagDictionaryCategoryMeta[] }>();

    for (const category of this.manifest.categories) {
      if (!groupsMap.has(category.groupId)) {
        groupsMap.set(category.groupId, {
          groupId: category.groupId,
          groupLabel: category.groupLabel,
          categories: []
        });
      }
      groupsMap.get(category.groupId)!.categories.push(category);
    }

    return Array.from(groupsMap.values());
  }
}

export const tagDictionaryLoader = new TagDictionaryLoader();
