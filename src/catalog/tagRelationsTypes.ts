export interface RelatedTag {
  english_name: string;
  korean_name: string;
  count: number;
}

/**
 * Offline-built tag relations asset. `relations` is keyed by the NORMALIZED
 * seed tag (must match runtime normalizePromptToken output) so a tag present in
 * the prompt can look up its related tags directly. Each related tag is enriched
 * with its korean name and danbooru count from the dictionary at build time.
 */
export interface TagRelationsData {
  generatedAt: string;
  seedCount: number;
  relations: Record<string, RelatedTag[]>;
}
