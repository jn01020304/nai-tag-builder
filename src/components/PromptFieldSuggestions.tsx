import type { PromptInsertTarget } from "../prompt/promptInsertTarget";
import type { PromptState } from "../types/metadata";
import { useTagAutocomplete } from "../hooks/useTagAutocomplete";
import type { TagSuggestionProvider } from "../catalog/providers/tagSuggestionProvider";
import TagSuggestionStrip from "./TagSuggestionStrip";
import TagRecommendationRow from "./TagRecommendationRow";

/**
 * The inline-autocomplete capability handed down to PromptPairTabs. Bundled into
 * one prop so adding suggestions to the prompt UI threads a single optional
 * value through MainPromptSection / CharacterCaptions rather than 4 props.
 */
export interface PromptAutocompleteApi {
  provider: TagSuggestionProvider;
  prompt: PromptState;
  recentTags: readonly string[];
  acceptAutocomplete: (target: PromptInsertTarget, caretIndex: number, tag: string) => void;
  acceptRecommendation: (target: PromptInsertTarget, tag: string) => void;
}

interface Props {
  api: PromptAutocompleteApi;
  target: PromptInsertTarget;
  value: string;
  caretIndex: number;
  testIdPrefix: string;
}

/**
 * Hook container mounted under a focused prompt field. Kept a component (not an
 * inline call) so useTagAutocomplete obeys the rules of hooks even though
 * PromptPairTabs renders fields through a callback / a variable-length list.
 */
export default function PromptFieldSuggestions({ api, target, value, caretIndex, testIdPrefix }: Props) {
  const { suggestions, recommendations } = useTagAutocomplete({
    provider: api.provider,
    prompt: api.prompt,
    target,
    value,
    caretIndex,
    recentTags: api.recentTags,
    enabled: true,
  });

  return (
    <>
      <TagSuggestionStrip
        suggestions={suggestions}
        testIdPrefix={testIdPrefix}
        onPick={(suggestion) => api.acceptAutocomplete(target, caretIndex, suggestion.english_name)}
      />
      <TagRecommendationRow
        recommendations={recommendations}
        testIdPrefix={testIdPrefix}
        onPick={(suggestion) => api.acceptRecommendation(target, suggestion.english_name)}
      />
    </>
  );
}
