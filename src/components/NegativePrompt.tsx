import type { MetadataState } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from '../prompt/promptInsertTarget';
import CollapsibleSection from './CollapsibleSection';
import HighlightedTextarea from './HighlightedTextarea';
import { theme, inputStyle, labelStyle } from '../styles/theme';

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
  getSelectionAfterRender: (target: PromptInsertTarget) => PromptSelectionAfterRender | undefined;
  onPromptSelection: (target: PromptInsertTarget, selection: { start: number; end: number }) => void;
}

export default function NegativePrompt({
  state,
  dispatch,
  getSelectionAfterRender,
  onPromptSelection,
}: Props) {
  const updateSelection = (target: PromptInsertTarget, element: HTMLTextAreaElement) => {
    onPromptSelection(target, {
      start: element.selectionStart,
      end: element.selectionEnd,
    });
  };

  return (
    <CollapsibleSection title="Negative Prompt">
      <label style={labelStyle}>Base Negative</label>
      <HighlightedTextarea
        data-testid="negative-prompt-textarea"
        value={state.prompt.negativeBase}
        onChange={e => {
          dispatch({ type: 'SET_PROMPT', field: 'negativeBase', value: e.target.value });
          updateSelection({ kind: 'negativeBase' }, e.target);
        }}
        onSelect={e => updateSelection({ kind: 'negativeBase' }, e.currentTarget)}
        onKeyUp={e => updateSelection({ kind: 'negativeBase' }, e.currentTarget)}
        onFocus={e => updateSelection({ kind: 'negativeBase' }, e.currentTarget)}
        selectionAfterRender={getSelectionAfterRender({ kind: 'negativeBase' })}
        placeholder="negative tags..."
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          ...inputStyle,
          width: '100%',
          minHeight: '50px',
          resize: 'vertical',
          marginBottom: '8px',
        }}
      />

      {state.prompt.negativeCharacters.map((nc, idx) => (
        <div key={nc.id} style={{ marginBottom: '6px' }}>
          <label style={labelStyle}>Character {idx + 1} Negative</label>
          <HighlightedTextarea
            data-testid={`negative-character-prompt-textarea-${idx}`}
            value={nc.caption}
            onChange={e => {
              dispatch({ type: 'UPDATE_NEG_CHARACTER', id: nc.id, field: 'caption', value: e.target.value });
              updateSelection({ kind: 'negativeCharacter', id: nc.id }, e.target);
            }}
            onSelect={e => updateSelection({ kind: 'negativeCharacter', id: nc.id }, e.currentTarget)}
            onKeyUp={e => updateSelection({ kind: 'negativeCharacter', id: nc.id }, e.currentTarget)}
            onFocus={e => updateSelection({ kind: 'negativeCharacter', id: nc.id }, e.currentTarget)}
            selectionAfterRender={getSelectionAfterRender({ kind: 'negativeCharacter', id: nc.id })}
            placeholder="per-character negative tags..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            style={{
              ...inputStyle,
              width: '100%',
              minHeight: '36px',
              resize: 'vertical',
            }}
          />
        </div>
      ))}

      {state.prompt.negativeCharacters.length === 0 && (
        <div style={{ fontSize: '12px', color: theme.overlay0, textAlign: 'center', padding: '4px 0' }}>
          Add characters above to set per-character negatives.
        </div>
      )}
    </CollapsibleSection>
  );
}
