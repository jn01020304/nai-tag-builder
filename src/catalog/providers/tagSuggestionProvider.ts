import type { PromptState } from "../../types/metadata";
import type { PromptInsertTarget } from "../../prompt/promptInsertTarget";
import { coreCatalog } from "../../prompt/catalog/coreCatalog.generated";
import { splitPromptTags, normalizePromptToken } from "../../prompt/catalog/promptTagText";
import { tagDictionaryLoader } from "../tagDictionaryLoader";
import { tagRelationsLoader } from "../tagRelationsLoader";
import {
  type TagSuggestion,
  catalogEntryToSuggestion,
  dictionaryEntryToSuggestion,
  filterAndRankByQuery,
  recommendFromCatalogSiblings,
  recommendFromRelations,
} from "../../utils/tagRankingAndFilter";

export type { TagSuggestion };

export interface TagSuggestionContext {
  prompt: PromptState;
  activeTarget: PromptInsertTarget;
  /** Current text of the field being edited. */
  activeValue: string;
  recentTags: readonly string[];
}

export interface TagSuggestionQueryOptions {
  limit: number;
  signal?: AbortSignal;
  /** Normalized tags already present in the field, excluded from results. */
  excludeNormalized?: ReadonlySet<string>;
}

/**
 * The seam every suggestion source plugs into. Phase 1 ships the in-memory
 * offline provider below; Phase 2's offline relations asset and an optional
 * live provider implement the same interface so the UI never re-plumbs.
 */
export interface TagSuggestionProvider {
  readonly id: string;
  autocomplete(query: string, options: TagSuggestionQueryOptions): Promise<TagSuggestion[]>;
  related(context: TagSuggestionContext, options: TagSuggestionQueryOptions): Promise<TagSuggestion[]>;
}

/**
 * Corpus = the 57 curated catalog tags (always bundled) plus every Full Tag
 * Dictionary chunk currently in the loader's LRU cache. Autocomplete therefore
 * gets richer as the user browses the dictionary, with zero extra network cost.
 */
function buildCorpus(): TagSuggestion[] {
  const corpus: TagSuggestion[] = coreCatalog.map(catalogEntryToSuggestion);
  for (const cached of tagDictionaryLoader.chunkCache.values()) {
    for (const entry of cached.data.tags) {
      corpus.push(dictionaryEntryToSuggestion(entry));
    }
  }
  return corpus;
}

function presentTagSet(value: string): Set<string> {
  const present = new Set<string>();
  for (const token of splitPromptTags(value)) {
    const norm = normalizePromptToken(token);
    if (norm) present.add(norm);
  }
  return present;
}

export const offlineTagSuggestionProvider: TagSuggestionProvider = {
  id: "offline-dictionary",

  async autocomplete(query, { limit, excludeNormalized }) {
    return filterAndRankByQuery(buildCorpus(), query, { limit, excludeNormalized });
  },

  async related(context, { limit }) {
    const present = presentTagSet(context.activeValue);

    // Prefer the offline relations asset; fall back to the category/recent
    // heuristic when it is unavailable or none of the present tags are seeds.
    const relations = await tagRelationsLoader.load();
    if (relations) {
      const fromRelations = recommendFromRelations(relations, present, limit);
      if (fromRelations.length > 0) return fromRelations;
    }
    return recommendFromCatalogSiblings(coreCatalog, present, context.recentTags, limit);
  },
};
