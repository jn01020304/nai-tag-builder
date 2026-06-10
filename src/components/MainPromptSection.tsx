import type { MetadataAction } from "../hooks/useMetadataState";
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from "../prompt/promptInsertTarget";
import type { PromptState } from "../types/metadata";
import CollapsibleSection from "./CollapsibleSection";
import PromptPairTabs from "./PromptPairTabs";

interface Props {
  prompt: PromptState;
  dispatch: React.Dispatch<MetadataAction>;
  activePromptTarget: PromptInsertTarget;
  getSelectionAfterRender: (target: PromptInsertTarget) => PromptSelectionAfterRender | undefined;
  onPromptSelection: (target: PromptInsertTarget, selection: { start: number; end: number }) => void;
}

export default function MainPromptSection({
  prompt,
  dispatch,
  activePromptTarget,
  getSelectionAfterRender,
  onPromptSelection,
}: Props) {
  return (
    <CollapsibleSection title="Main Prompt" testId="main-prompt-section">
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
    </CollapsibleSection>
  );
}
