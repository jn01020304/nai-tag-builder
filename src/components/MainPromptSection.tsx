import type { MetadataAction } from "../hooks/useMetadataState";
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from "../prompt/promptInsertTarget";
import { promptTargetLabel } from "../prompt/promptInsertTarget";
import type { PromptState } from "../types/metadata";
import { useTheme } from "../contexts/themeContextCore";
import CollapsiblePanel from "./CollapsiblePanel";
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
  const theme = useTheme();

  return (
    <CollapsiblePanel title="Main Prompt" testId="main-prompt-section">
      <div
        data-testid="active-prompt-target"
        style={{
          color: theme.subtext1,
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
          tabLabel: "Main Prompt",
          target: { kind: "base" },
          value: prompt.basePrompt,
          placeholder: "main prompt tags...",
          testId: "main-prompt-textarea",
          minHeight: "128px",
          onChange: (value) => dispatch({ type: "SET_PROMPT", field: "basePrompt", value }),
        }}
        secondary={{
          tabLabel: "Undesired Content",
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
