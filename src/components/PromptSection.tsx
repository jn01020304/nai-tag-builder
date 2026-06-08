import type { MetadataAction } from "../hooks/useMetadataState";
import type { MetadataState } from "../types/metadata";
import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from "../prompt/promptInsertTarget";
import { movePromptTag } from "../prompt/catalog/promptTagText";
import MainPromptSection from "./MainPromptSection";
import TagDictionarySection from "./TagDictionarySection";

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
  activePromptTarget: PromptInsertTarget;
  getSelectionAfterRender: (target: PromptInsertTarget) => PromptSelectionAfterRender | undefined;
  onPromptSelection: (target: PromptInsertTarget, selection: { start: number; end: number }) => void;
  onToggleCatalogEntry: (entry: CoreCatalogEntry) => void;
}

export default function PromptSection({
  state,
  dispatch,
  activePromptTarget,
  getSelectionAfterRender,
  onPromptSelection,
  onToggleCatalogEntry,
}: Props) {
  const activePromptValue = (() => {
    switch (activePromptTarget.kind) {
      case "base":
        return state.prompt.basePrompt;
      case "negativeBase":
        return state.prompt.negativeBase;
      case "character":
        return state.prompt.characters.find((character) => character.id === activePromptTarget.id)?.caption ?? "";
      case "negativeCharacter":
        return state.prompt.negativeCharacters.find((character) => character.id === activePromptTarget.id)?.caption ?? "";
    }
  })();

  const reorderBasePrompt = (fromIndex: number, toIndex: number) => {
    dispatch({
      type: "SET_PROMPT",
      field: "basePrompt",
      value: movePromptTag(state.prompt.basePrompt, fromIndex, toIndex),
    });
  };

  return (
    <section style={{ marginBottom: "8px" }}>
      <TagDictionarySection
        prompt={state.prompt}
        activePromptTarget={activePromptTarget}
        activePromptValue={activePromptValue}
        onToggle={onToggleCatalogEntry}
        onReorderBasePrompt={reorderBasePrompt}
      />
      <MainPromptSection
        prompt={state.prompt}
        dispatch={dispatch}
        activePromptTarget={activePromptTarget}
        getSelectionAfterRender={getSelectionAfterRender}
        onPromptSelection={onPromptSelection}
      />
    </section>
  );
}
