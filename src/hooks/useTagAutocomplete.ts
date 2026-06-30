import { useEffect, useState } from "react";
import type { PromptState } from "../types/metadata";
import type { PromptInsertTarget } from "../prompt/promptInsertTarget";
import { getPartialTokenAtCursor, splitPromptTags, normalizePromptToken } from "../prompt/catalog/promptTagText";
import type { TagSuggestion, TagSuggestionProvider } from "../catalog/providers/tagSuggestionProvider";

export interface UseTagAutocompleteParams {
  provider: TagSuggestionProvider;
  prompt: PromptState;
  target: PromptInsertTarget;
  /** Current text of the field being edited. */
  value: string;
  caretIndex: number;
  recentTags: readonly string[];
  enabled: boolean;
  autocompleteLimit?: number;
  recommendationLimit?: number;
  debounceMs?: number;
}

export interface UseTagAutocompleteResult {
  /** The partial token under the caret driving autocomplete ("" when inactive). */
  partial: string;
  suggestions: TagSuggestion[];
  recommendations: TagSuggestion[];
}

const MIN_QUERY_LENGTH = 2;

/**
 * Drives inline tag autocomplete (typeahead on the partial token under the
 * caret) and heuristic recommendations (related tags for the field content).
 * Both queries are debounced and latest-wins via an AbortController so a stale
 * async provider response never overwrites a newer one.
 */
export function useTagAutocomplete(params: UseTagAutocompleteParams): UseTagAutocompleteResult {
  const {
    provider,
    prompt,
    target,
    value,
    caretIndex,
    recentTags,
    enabled,
    autocompleteLimit = 8,
    recommendationLimit = 8,
    debounceMs = 140,
  } = params;

  const partial = enabled ? getPartialTokenAtCursor(value, caretIndex) : "";
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [recommendations, setRecommendations] = useState<TagSuggestion[]>([]);

  // Tags already in the field, normalized — dropped from results so the field's
  // own tags (including one just accepted) never appear as suggestions. The
  // partial being typed is itself a token here, but it is filtered by exact
  // normalized match, so a prefix like "lo" still surfaces "long hair".
  const presentKey = enabled ? value : "";

  const shouldQuery = enabled && partial.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!shouldQuery) {
        setSuggestions([]);
        return;
      }
      const excludeNormalized = new Set(splitPromptTags(presentKey).map(normalizePromptToken));
      provider
        .autocomplete(partial, { limit: autocompleteLimit, signal: controller.signal, excludeNormalized })
        .then((result) => {
          if (!controller.signal.aborted) setSuggestions(result);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        });
    }, shouldQuery ? debounceMs : 0);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [shouldQuery, partial, presentKey, provider, autocompleteLimit, debounceMs]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!enabled) {
        setRecommendations([]);
        return;
      }
      provider
        .related(
          { prompt, activeTarget: target, activeValue: value, recentTags },
          { limit: recommendationLimit, signal: controller.signal },
        )
        .then((result) => {
          if (!controller.signal.aborted) setRecommendations(result);
        })
        .catch(() => {
          if (!controller.signal.aborted) setRecommendations([]);
        });
    }, enabled ? debounceMs : 0);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, provider, prompt, target, value, recentTags, recommendationLimit, debounceMs]);

  return { partial, suggestions, recommendations };
}
