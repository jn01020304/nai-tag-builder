import type { CharacterEntry } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import CollapsibleSection from './CollapsibleSection';
import { theme, inputStyle, labelStyle, smallBtnStyle } from '../styles/theme';

interface Props {
  characters: CharacterEntry[];
  dispatch: React.Dispatch<MetadataAction>;
}

export default function CharacterCaptions({ characters, dispatch }: Props) {
  return (
    <CollapsibleSection title={`Characters (${characters.length})`}>
      <button
        onClick={() => dispatch({ type: 'ADD_CHARACTER' })}
        style={{ ...smallBtnStyle, width: '100%', marginBottom: '8px', color: theme.green }}
      >
        + Add Character
      </button>

      {characters.map((char, idx) => (
        <div
          key={char.id}
          style={{
            marginBottom: '8px',
            padding: '8px',
            backgroundColor: theme.mantle,
            borderRadius: '6px',
            border: `1px solid ${theme.surface0}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Character {idx + 1}</label>
            <button
              onClick={() => dispatch({ type: 'REMOVE_CHARACTER', id: char.id })}
              style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}
            >
              &#10005;
            </button>
          </div>

          <textarea
            value={char.caption}
            onChange={e => dispatch({ type: 'UPDATE_CHARACTER', id: char.id, field: 'caption', value: e.target.value })}
            placeholder="character tags..."
            style={{
              ...inputStyle,
              width: '100%',
              height: '50px',
              resize: 'none',
              marginBottom: '4px',
            }}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>X</label>
              <input
                type="number"
                value={char.centerX}
                min={0}
                max={1}
                step={0.1}
                onChange={e => dispatch({ type: 'UPDATE_CHARACTER', id: char.id, field: 'centerX', value: Number(e.target.value) })}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Y</label>
              <input
                type="number"
                value={char.centerY}
                min={0}
                max={1}
                step={0.1}
                onChange={e => dispatch({ type: 'UPDATE_CHARACTER', id: char.id, field: 'centerY', value: Number(e.target.value) })}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
          </div>
        </div>
      ))}

      {characters.length === 0 && (
        <div style={{ fontSize: '12px', color: theme.overlay0, textAlign: 'center', padding: '4px 0' }}>
          No characters. Tags go into base prompt only.
        </div>
      )}
    </CollapsibleSection>
  );
}
