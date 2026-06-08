import type { MetadataAction } from "../hooks/useMetadataState";
import type { MetadataState } from "../types/metadata";
import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from "../prompt/promptInsertTarget";
import { promptTargetLabel } from "../prompt/promptInsertTarget";
import { movePromptTag } from "../prompt/catalog/promptTagText";
import ComposeCatalogChips from "./ComposeCatalogChips";
import PromptPairTabs from "./PromptPairTabs";

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
      <ComposeCatalogChips
        prompt={state.prompt}
        activePromptTarget={activePromptTarget}
        activePromptValue={activePromptValue}
        onToggle={onToggleCatalogEntry}
        onReorderBasePrompt={reorderBasePrompt}
      />
      <div
        data-testid="active-prompt-target"
        style={{
          color: "#15172f",
          fontSize: "11px",
          fontWeight: 700,
          marginBottom: "6px",
        }}
      >
        Insert target: {promptTargetLabel(activePromptTarget)}
      </div>
      <PromptPairTabs
        testIdPrefix="base-prompt"
        activePromptTarget={activePromptTarget}
        getSelectionAfterRender={getSelectionAfterRender}
        onPromptSelection={onPromptSelection}
        primary={{
          label: "Main Prompt",
          tabLabel: "Main Prompt",
          target: { kind: "base" },
          value: state.prompt.basePrompt,
          placeholder: "main prompt tags...",
          testId: "main-prompt-textarea",
          labelTestId: "main-prompt-label",
          minHeight: "128px",
          onChange: (value) => dispatch({ type: "SET_PROMPT", field: "basePrompt", value }),
        }}
        secondary={{
          label: "Undesired Content",
          tabLabel: "Undesired Content",
          target: { kind: "negativeBase" },
          value: state.prompt.negativeBase,
          placeholder: "undesired content tags...",
          testId: "negative-prompt-textarea",
          labelTestId: "negative-prompt-label",
          minHeight: "108px",
          onChange: (value) => dispatch({ type: "SET_PROMPT", field: "negativeBase", value }),
        }}
      />
    </section>
  );
}
