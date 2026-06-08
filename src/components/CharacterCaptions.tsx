import type { CharacterEntry } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from '../prompt/promptInsertTarget';
import CollapsibleSection from './CollapsibleSection';
import { useThemeStyles } from '../contexts/themeContextCore';
import PromptPairTabs from './PromptPairTabs';

interface Props {
  characters: CharacterEntry[];
  negativeCharacters: CharacterEntry[];
  activePromptTarget: PromptInsertTarget;
  dispatch: React.Dispatch<MetadataAction>;
  getSelectionAfterRender: (target: PromptInsertTarget) => PromptSelectionAfterRender | undefined;
  onPromptSelection: (target: PromptInsertTarget, selection: { start: number; end: number }) => void;
}

export default function CharacterCaptions({
  characters,
  negativeCharacters,
  activePromptTarget,
  dispatch,
  getSelectionAfterRender,
  onPromptSelection,
}: Props) {
  const { theme, inputStyle, labelStyle, smallBtnStyle } = useThemeStyles();

  return (
    <CollapsibleSection title={`Characters (${characters.length})`} testId="characters-section">
      <button
        onClick={() => dispatch({ type: 'ADD_CHARACTER' })}
        style={{ ...smallBtnStyle, width: '100%', marginBottom: '8px', color: theme.green }}
      >
        + Add Character
      </button>

      {characters.map((char, idx) => (
        (() => {
          const negativeChar = negativeCharacters[idx];
          const negativeTargetId = negativeChar?.id ?? char.id;

          return (
            <div
              key={char.id}
              data-testid={`character-card-${idx}`}
              style={{
                marginBottom: '8px',
                padding: '8px',
                backgroundColor: theme.base,
                borderRadius: '6px',
                border: `1px solid ${theme.surface0}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Character {idx + 1}</label>
                <button
                  onClick={() => dispatch({ type: 'REMOVE_CHARACTER', id: char.id })}
                  style={{ background: 'none', border: 'none', color: theme.warningError, cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}
                >
                  &#10005;
                </button>
              </div>

              <PromptPairTabs
                testIdPrefix={`character-${idx}`}
                activePromptTarget={activePromptTarget}
                getSelectionAfterRender={getSelectionAfterRender}
                onPromptSelection={onPromptSelection}
                primary={{
                  tabLabel: "Prompt",
                  target: { kind: 'character', id: char.id },
                  value: char.caption,
                  placeholder: "character tags...",
                  testId: `character-prompt-textarea-${idx}`,
                  minHeight: "64px",
                  onChange: (value) => dispatch({ type: 'UPDATE_CHARACTER', id: char.id, field: 'caption', value }),
                }}
                secondary={{
                  tabLabel: "Negative",
                  target: { kind: 'negativeCharacter', id: negativeTargetId },
                  value: negativeChar?.caption ?? "",
                  placeholder: "per-character undesired tags...",
                  testId: `negative-character-prompt-textarea-${idx}`,
                  minHeight: "54px",
                  onChange: (value) => dispatch({
                    type: 'UPDATE_NEG_CHARACTER',
                    id: negativeTargetId,
                    field: 'caption',
                    value,
                  }),
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
          );
        })()
      ))}

      {characters.length === 0 && (
        <div style={{ fontSize: '12px', color: theme.overlay0, textAlign: 'center', padding: '4px 0' }}>
          No characters. Tags go into main prompt only.
        </div>
      )}
    </CollapsibleSection>
  );
}
