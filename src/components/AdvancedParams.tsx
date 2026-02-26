import type { MetadataState } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import CollapsibleSection from './CollapsibleSection';
import { theme, inputStyle, labelStyle } from '../styles/theme';

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
}

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '6px',
  fontSize: '13px',
  color: theme.text,
};

const numRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '8px',
};

const numFieldStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

export default function AdvancedParams({ state, dispatch }: Props) {
  const set = (field: keyof MetadataState, value: MetadataState[keyof MetadataState]) =>
    dispatch({ type: 'SET_FIELD', field, value });

  return (
    <CollapsibleSection title="Advanced">
      {/* Numeric params */}
      <div style={numRowStyle}>
        <div style={numFieldStyle}>
          <label style={labelStyle}>CFG Rescale</label>
          <input
            type="number"
            value={state.cfgRescale}
            min={0}
            max={1}
            step={0.01}
            onChange={e => set('cfgRescale', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div style={numFieldStyle}>
          <label style={labelStyle}>Uncond Scale</label>
          <input
            type="number"
            value={state.uncondScale}
            min={0}
            max={1.5}
            step={0.1}
            onChange={e => set('uncondScale', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      <div style={numRowStyle}>
        <div style={numFieldStyle}>
          <label style={labelStyle}>Skip CFG Above Sigma</label>
          <input
            type="number"
            value={state.skipCfgAboveSigma ?? ''}
            placeholder="null"
            onChange={e => set('skipCfgAboveSigma', e.target.value === '' ? null : Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div style={numFieldStyle}>
          <label style={labelStyle}>Skip CFG Below Sigma</label>
          <input
            type="number"
            value={state.skipCfgBelowSigma}
            min={0}
            step={0.1}
            onChange={e => set('skipCfgBelowSigma', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      {/* Checkboxes */}
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.smea} onChange={e => set('smea', e.target.checked)} />
        SMEA
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.smeaDyn} onChange={e => set('smeaDyn', e.target.checked)} />
        SMEA + DYN
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.dynamicThresholding} onChange={e => set('dynamicThresholding', e.target.checked)} />
        Dynamic Thresholding
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.preferBrownian} onChange={e => set('preferBrownian', e.target.checked)} />
        Prefer Brownian
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.uncondPerVibe} onChange={e => set('uncondPerVibe', e.target.checked)} />
        Uncond Per Vibe
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.wonkyVibeCorrelation} onChange={e => set('wonkyVibeCorrelation', e.target.checked)} />
        Wonky Vibe Correlation
      </label>

      <hr style={{ border: 'none', borderTop: `1px solid ${theme.surface0}`, margin: '8px 0' }} />

      {/* V4 prompt toggles */}
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.useCoords} onChange={e => set('useCoords', e.target.checked)} />
        Use Coords
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.useOrder} onChange={e => set('useOrder', e.target.checked)} />
        Use Order
      </label>
    </CollapsibleSection>
  );
}
