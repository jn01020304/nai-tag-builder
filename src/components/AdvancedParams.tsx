import type { MetadataState, AdvancedFlags } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import CollapsibleSection from './CollapsibleSection';
import { theme, inputStyle, labelStyle } from '../styles/theme';

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
}

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
  const checkboxRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
    fontSize: '13px',
    color: theme.text,
  };

  const setA = (field: keyof AdvancedFlags, value: AdvancedFlags[keyof AdvancedFlags]) =>
    dispatch({ type: 'SET_ADVANCED', field, value });

  return (
    <CollapsibleSection title="Advanced">
      {/* Numeric params */}
      <div style={numRowStyle}>
        <div style={numFieldStyle}>
          <label style={labelStyle}>CFG Rescale</label>
          <input
            type="number"
            value={state.advanced.cfgRescale}
            min={0}
            max={1}
            step={0.01}
            onChange={e => setA('cfgRescale', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div style={numFieldStyle}>
          <label style={labelStyle}>Uncond Scale</label>
          <input
            type="number"
            value={state.advanced.uncondScale}
            min={0}
            max={1.5}
            step={0.1}
            onChange={e => setA('uncondScale', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      <div style={numRowStyle}>
        <div style={numFieldStyle}>
          <label style={labelStyle}>Skip CFG Above Sigma</label>
          <input
            type="number"
            value={state.advanced.skipCfgAboveSigma ?? ''}
            placeholder="null"
            onChange={e => setA('skipCfgAboveSigma', e.target.value === '' ? null : Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div style={numFieldStyle}>
          <label style={labelStyle}>Skip CFG Below Sigma</label>
          <input
            type="number"
            value={state.advanced.skipCfgBelowSigma}
            min={0}
            step={0.1}
            onChange={e => setA('skipCfgBelowSigma', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      {/* Checkboxes */}
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.smea} onChange={e => setA('smea', e.target.checked)} />
        SMEA
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.smeaDyn} onChange={e => setA('smeaDyn', e.target.checked)} />
        SMEA + DYN
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.dynamicThresholding} onChange={e => setA('dynamicThresholding', e.target.checked)} />
        Dynamic Thresholding
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.preferBrownian} onChange={e => setA('preferBrownian', e.target.checked)} />
        Prefer Brownian
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.uncondPerVibe} onChange={e => setA('uncondPerVibe', e.target.checked)} />
        Uncond Per Vibe
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.wonkyVibeCorrelation} onChange={e => setA('wonkyVibeCorrelation', e.target.checked)} />
        Wonky Vibe Correlation
      </label>

      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.deliberateEulerAncestralBug} onChange={e => setA('deliberateEulerAncestralBug', e.target.checked)} />
        Deliberate Euler Ancestral Bug
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.explikeFineDetail} onChange={e => setA('explikeFineDetail', e.target.checked)} />
        Explike Fine Detail
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.advanced.minimizeSigmaInf} onChange={e => setA('minimizeSigmaInf', e.target.checked)} />
        Minimize Sigma Inf
      </label>

      <div style={numRowStyle}>
        <div style={numFieldStyle}>
          <label style={labelStyle}>DynThresh Percentile</label>
          <input
            type="number"
            value={state.advanced.dynamicThresholdingPercentile}
            min={0}
            max={1}
            step={0.001}
            onChange={e => setA('dynamicThresholdingPercentile', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div style={numFieldStyle}>
          <label style={labelStyle}>DynThresh Mimic Scale</label>
          <input
            type="number"
            value={state.advanced.dynamicThresholdingMimicScale}
            min={0}
            step={0.5}
            onChange={e => setA('dynamicThresholdingMimicScale', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: `1px solid ${theme.surface0}`, margin: '8px 0' }} />

      {/* V4 prompt toggles */}
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.useCoords} onChange={e => dispatch({ type: 'SET_META', field: 'useCoords', value: e.target.checked })} />
        Use Coords
      </label>
      <label style={checkboxRowStyle}>
        <input type="checkbox" checked={state.useOrder} onChange={e => dispatch({ type: 'SET_META', field: 'useOrder', value: e.target.checked })} />
        Use Order
      </label>
    </CollapsibleSection>
  );
}
