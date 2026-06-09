import type { MetadataAction } from "../hooks/useMetadataState";
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from "../prompt/promptInsertTarget";
import type { PromptState } from "../types/metadata";
import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import CollapsiblePanel from "./CollapsiblePanel";
import PromptPairTabs from "./PromptPairTabs";
import ComposeCatalogChips from "./ComposeCatalogChips";

interface Props {
  prompt: PromptState;
  dispatch: React.Dispatch<MetadataAction>;
  activePromptTarget: PromptInsertTarget;
  getSelectionAfterRender: (target: PromptInsertTarget) => PromptSelectionAfterRender | undefined;
  onPromptSelection: (target: PromptInsertTarget, selection: { start: number; end: number }) => void;
  onToggleCatalogEntry: (entry: CoreCatalogEntry) => void;
  onReorderBasePrompt: (fromIndex: number, toIndex: number) => void;
}

export default function MainPromptSection({
  prompt,
  dispatch,
  activePromptTarget,
  getSelectionAfterRender,
  onPromptSelection,
  onToggleCatalogEntry,
  onReorderBasePrompt,
}: Props) {
  const activePromptValue = (() => {
    switch (activePromptTarget.kind) {
      case "base":
        return prompt.basePrompt;
      case "negativeBase":
        return prompt.negativeBase;
      case "character":
        return prompt.characters.find((character) => character.id === activePromptTarget.id)?.caption ?? "";
      case "negativeCharacter":
        return prompt.negativeCharacters.find((character) => character.id === activePromptTarget.id)?.caption ?? "";
    }
  })();

  return (
    <CollapsiblePanel title="Main Prompt" testId="main-prompt-section">
      <ComposeCatalogChips
        prompt={prompt}
        activePromptTarget={activePromptTarget}
        activePromptValue={activePromptValue}
        onToggle={onToggleCatalogEntry}
        onReorderBasePrompt={onReorderBasePrompt}
      />
      <PromptPairTabs
        testIdPrefix="base-prompt"
        activePromptTarget={activePromptTarget}
        getSelectionAfterRender={getSelectionAfterRender}
        onPromptSelection={onPromptSelection}
        primary={{
          tabLabel: "Main",
          target: { kind: "base" },
          value: prompt.basePrompt,
          placeholder: "main prompt tags...",
          testId: "main-prompt-textarea",
          minHeight: "128px",
          onChange: (value) => dispatch({ type: "SET_PROMPT", field: "basePrompt", value }),
        }}
        secondary={{
          tabLabel: "Negative",
          target: { kind: "negativeBase" },
          value: prompt.negativeBase,
          placeholder: "undesired content tags...",
          testId: "negative-prompt-textarea",
          minHeight: "108px",
          onChange: (value) => dispatch({ type: "SET_PROMPT", field: "negativeBase", value }),
        }}
      />
    </CollapsiblePanel>
  );
}
