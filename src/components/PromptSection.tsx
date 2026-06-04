import { useState } from "react";
import type { MetadataAction } from "../hooks/useMetadataState";
import type { MetadataState } from "../types/metadata";
import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import { inputStyle } from "../styles/theme";
import { movePromptTag, toggleCatalogTag, toggleCatalogTagWithSelection } from "../prompt/catalog/promptTagText";
import ComposeCatalogChips from "./ComposeCatalogChips";
import HighlightedTextarea from "./HighlightedTextarea";

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
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

export default function PromptSection({ state, dispatch }: Props) {
  const [baseSelection, setBaseSelection] = useState<{ start: number; end: number } | null>(null);
  const [selectionAfterRender, setSelectionAfterRender] = useState<{
    start: number;
    end: number;
    version: number;
  } | null>(null);

  const updateSelection = (target: HTMLTextAreaElement) => {
    setBaseSelection({
      start: target.selectionStart,
      end: target.selectionEnd,
    });
  };

  const toggleEntry = (entry: CoreCatalogEntry) => {
    if (entry.target === "negative") {
      dispatch({
        type: "SET_PROMPT",
        field: "negativeBase",
        value: toggleCatalogTag(state.prompt.negativeBase, entry),
      });
      return;
    }

    const result = toggleCatalogTagWithSelection(
      state.prompt.basePrompt,
      entry,
      baseSelection?.start ?? null,
    );

    dispatch({
      type: "SET_PROMPT",
      field: "basePrompt",
      value: result.value,
    });

    if (result.nextCursorIndex != null) {
      const nextSelection = {
        start: result.nextCursorIndex,
        end: result.nextCursorIndex,
        version: Date.now(),
      };
      setBaseSelection(nextSelection);
      setSelectionAfterRender(nextSelection);
    }
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
        basePrompt={state.prompt.basePrompt}
        negativePrompt={state.prompt.negativeBase}
        onToggle={toggleEntry}
        onReorderBasePrompt={reorderBasePrompt}
      />
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
