import type { MetadataState } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import CollapsibleSection from './CollapsibleSection';
import HighlightedTextarea from './HighlightedTextarea';
import { theme, inputStyle, labelStyle } from '../styles/theme';

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
}

export default function NegativePrompt({ state, dispatch }: Props) {
  return (
    <CollapsibleSection title="Negative Prompt">
      <label style={labelStyle}>Base Negative</label>
      <HighlightedTextarea
        value={state.negativeBase}
        onChange={e => dispatch({ type: 'SET_FIELD', field: 'negativeBase', value: e.target.value })}
        placeholder="negative tags..."
        style={{
          ...inputStyle,
          width: '100%',
          minHeight: '50px',
          resize: 'vertical',
          marginBottom: '8px',
        }}
      />

      {state.negativeCharacters.map((nc, idx) => (
        <div key={nc.id} style={{ marginBottom: '6px' }}>
          <label style={labelStyle}>Character {idx + 1} Negative</label>
          <HighlightedTextarea
            value={nc.caption}
            onChange={e => dispatch({ type: 'UPDATE_NEG_CHARACTER', id: nc.id, field: 'caption', value: e.target.value })}
            placeholder="per-character negative tags..."
            style={{
              ...inputStyle,
              width: '100%',
              minHeight: '36px',
              resize: 'vertical',
            }}
          />
        </div>
      ))}

      {state.negativeCharacters.length === 0 && (
        <div style={{ fontSize: '12px', color: theme.overlay0, textAlign: 'center', padding: '4px 0' }}>
          Add characters above to set per-character negatives.
        </div>
      )}
    </CollapsibleSection>
  );
}
