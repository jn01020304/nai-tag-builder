import type { MetadataState } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import CollapsibleSection from './CollapsibleSection';
import { theme, inputStyle, labelStyle } from '../styles/theme';

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
}

export default function NegativePrompt({ state, dispatch }: Props) {
  return (
    <CollapsibleSection title="Negative Prompt">
      <label style={labelStyle}>Base Negative</label>
      <textarea
        value={state.negativeBase}
        onChange={e => dispatch({ type: 'SET_FIELD', field: 'negativeBase', value: e.target.value })}
        placeholder="negative tags..."
        style={{
          ...inputStyle,
          width: '100%',
          height: '50px',
          resize: 'none',
          marginBottom: '8px',
        }}
      />

      {state.negativeCharacters.map((nc, idx) => (
        <div key={nc.id} style={{ marginBottom: '6px' }}>
          <label style={labelStyle}>Character {idx + 1} Negative</label>
          <textarea
            value={nc.caption}
            onChange={e => dispatch({ type: 'UPDATE_NEG_CHARACTER', id: nc.id, field: 'caption', value: e.target.value })}
            placeholder="per-character negative tags..."
            style={{
              ...inputStyle,
              width: '100%',
              height: '36px',
              resize: 'none',
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
