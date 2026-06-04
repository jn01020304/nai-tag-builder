import type { MetadataAction } from "../hooks/useMetadataState";
import type { MetadataState } from "../types/metadata";
import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from "../prompt/promptInsertTarget";
import { promptTargetLabel } from "../prompt/promptInsertTarget";
import { inputStyle } from "../styles/theme";
import { movePromptTag } from "../prompt/catalog/promptTagText";
import ComposeCatalogChips from "./ComposeCatalogChips";
import HighlightedTextarea from "./HighlightedTextarea";

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
  activePromptTarget: PromptInsertTarget;
  selectionAfterRender?: PromptSelectionAfterRender;
  onPromptSelection: (target: PromptInsertTarget, selection: { start: number; end: number }) => void;
  onToggleCatalogEntry: (entry: CoreCatalogEntry) => void;
}

const fieldLabelStyle: React.CSSProperties = {
  backgroundColor: "#15172f",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-flex",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1,
  marginBottom: "6px",
  padding: "4px 7px",
};

export default function PromptSection({
  state,
  dispatch,
  activePromptTarget,
  selectionAfterRender,
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

  const updateSelection = (target: HTMLTextAreaElement) => {
    onPromptSelection({ kind: "base" }, {
      start: target.selectionStart,
      end: target.selectionEnd,
    });
  };

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
      <label data-testid="raw-prompt-label" style={fieldLabelStyle}>Raw Prompt</label>
      <HighlightedTextarea
        data-testid="raw-prompt-textarea"
        value={state.prompt.basePrompt}
        onChange={(e) => {
          dispatch({ type: "SET_PROMPT", field: "basePrompt", value: e.target.value });
          updateSelection(e.target);
        }}
        onSelect={(e) => updateSelection(e.currentTarget)}
        onKeyUp={(e) => updateSelection(e.currentTarget)}
        onFocus={(e) => updateSelection(e.currentTarget)}
        selectionAfterRender={selectionAfterRender}
        placeholder="base prompt tags..."
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          ...inputStyle,
          width: "100%",
          boxSizing: "border-box",
          minHeight: "128px",
          resize: "none",
          marginBottom: "8px",
        }}
      />
    </section>
  );
}
