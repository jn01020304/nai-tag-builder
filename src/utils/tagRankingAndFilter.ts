import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import type { TagDictionaryEntry } from "../catalog/tagDictionaryTypes";
import { normalizePromptToken } from "../prompt/catalog/promptTagText";

/**
 * A provider-agnostic tag suggestion. Shaped after TagDictionaryEntry so the
 * inline suggestion UI renders catalog-, dictionary-, and (future) provider-
 * sourced tags identically.
 */
export interface TagSuggestion {
  english_name: string;
  korean_name: string;
  count: number;
  source: "catalog" | "dictionary";
  productCategory?: string;
}

export function catalogEntryToSuggestion(entry: CoreCatalogEntry): TagSuggestion {
  return {
    english_name: entry.tag,
    korean_name: entry.koreanLabel,
    count: entry.count,
    source: "catalog",
    productCategory: entry.productCategory,
  };
}

export function dictionaryEntryToSuggestion(entry: TagDictionaryEntry): TagSuggestion {
  return {
    english_name: entry.english_name,
    korean_name: entry.korean_name,
    count: entry.count,
    source: "dictionary",
  };
}

export interface RankOptions {
  limit: number;
  /** Normalized tags already present that should not be suggested again. */
  excludeNormalized?: ReadonlySet<string>;
}

/**
 * Filter a corpus by a typed query (english prefix > english substring > korean
 * substring) and rank by match quality, then post-count, then catalog-before-
 * dictionary. Dedups by normalized english name. Pure and synchronous.
 */
export function filterAndRankByQuery(
  corpus: readonly TagSuggestion[],
  query: string,
  options: RankOptions,
): TagSuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const exclude = options.excludeNormalized ?? EMPTY_SET;
  const seen = new Set<string>();
  const scored: { suggestion: TagSuggestion; score: number }[] = [];

  for (const suggestion of corpus) {
    const norm = normalizePromptToken(suggestion.english_name);
    if (!norm || exclude.has(norm) || seen.has(norm)) continue;

    const nameLc = suggestion.english_name.toLowerCase();
    let matchScore: number;
    if (nameLc.startsWith(q)) matchScore = 3_000_000;
    else if (nameLc.includes(q)) matchScore = 2_000_000;
    else if (suggestion.korean_name && suggestion.korean_name.includes(query.trim())) matchScore = 1_000_000;
    else continue;

    seen.add(norm);
    const sourceBoost = suggestion.source === "catalog" ? 250_000 : 0;
    const countBoost = Math.min(suggestion.count, 9_000_000) / 18; // <500_000, never overtakes a match tier
    scored.push({ suggestion, score: matchScore + sourceBoost + countBoost });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, options.limit).map((entry) => entry.suggestion);
}

/**
 * Heuristic recommendation (Phase 1 interim, no relatedness data): recently used
 * tags first, then curated catalog siblings sharing a productCategory with a tag
 * already in the active prompt, ranked by priority then post-count. Excludes tags
 * already present. Pure and synchronous.
 */
export function recommendFromCatalogSiblings(
  catalog: readonly CoreCatalogEntry[],
  presentNormalized: ReadonlySet<string>,
  recentTags: readonly string[],
  limit: number,
): TagSuggestion[] {
  const entryIsPresent = (entry: CoreCatalogEntry) =>
    presentNormalized.has(entry.tag) || entry.aliases.some((alias) => presentNormalized.has(alias));

  const presentCategories = new Set<string>();
  for (const entry of catalog) {
    if (entryIsPresent(entry)) presentCategories.add(entry.productCategory);
  }

  const seen = new Set<string>();
  const out: TagSuggestion[] = [];

  for (const tag of recentTags) {
    const norm = normalizePromptToken(tag);
    if (!norm || presentNormalized.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push({ english_name: tag.trim(), korean_name: "", count: 0, source: "catalog" });
    if (out.length >= limit) return out;
  }

  const siblings = catalog
    .filter((entry) => presentCategories.has(entry.productCategory) && !entryIsPresent(entry))
    .sort((a, b) => b.priority - a.priority || b.count - a.count);

  for (const entry of siblings) {
    const norm = normalizePromptToken(entry.tag);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(catalogEntryToSuggestion(entry));
    if (out.length >= limit) break;
  }

  return out;
}

const EMPTY_SET: ReadonlySet<string> = new Set();
