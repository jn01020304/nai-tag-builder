import type { MetadataState, AdvancedFlags } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import CollapsibleSection from './CollapsibleSection';
import { useThemeStyles } from '../contexts/themeContextCore';
import NumberField from '../ui/primitives/NumberField';

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
}

const numRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '8px',
};

export default function AdvancedParams({ state, dispatch }: Props) {
  const { theme } = useThemeStyles();
  const checkboxGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(136px, 1fr))',
    gap: '6px 8px',
    margin: '8px 0',
    minWidth: 0,
  };
  const checkboxRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '16px minmax(0, 1fr)',
    alignItems: 'center',
    gap: '6px',
    boxSizing: 'border-box',
    fontSize: '13px',
    color: theme.subtext1,
    lineHeight: 1.25,
    minHeight: '24px',
    minWidth: 0,
    textAlign: 'left',
    width: '100%',
  };
  const checkboxInputStyle: React.CSSProperties = {
    accentColor: theme.actionAccent,
    margin: 0,
  };
  const checkboxTextStyle: React.CSSProperties = {
    minWidth: 0,
    overflowWrap: 'normal',
    whiteSpace: 'normal',
    wordBreak: 'normal',
  };

  const setA = (field: keyof AdvancedFlags, value: AdvancedFlags[keyof AdvancedFlags]) =>
    dispatch({ type: 'SET_ADVANCED', field, value });

  const renderAdvancedCheckbox = (
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ) => (
    <label style={checkboxRowStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={checkboxInputStyle}
      />
      <span style={checkboxTextStyle}>{label}</span>
    </label>
  );

  return (
    <CollapsibleSection title="Advanced Settings" testId="advanced-section">
      {/* Numeric params */}
      <div style={numRowStyle}>
        <NumberField
          label="CFG Rescale"
          value={state.advanced.cfgRescale}
          min={0}
          max={1}
          step={0.01}
          onChange={e => setA('cfgRescale', Number(e.target.value))}
        />
        <NumberField
          label="Uncond Scale"
          value={state.advanced.uncondScale}
          min={0}
          max={1.5}
          step={0.1}
          onChange={e => setA('uncondScale', Number(e.target.value))}
        />
      </div>

      <div style={numRowStyle}>
        <NumberField
          label="Skip CFG Above Sigma"
          value={state.advanced.skipCfgAboveSigma ?? ''}
          placeholder="null"
          onChange={e => setA('skipCfgAboveSigma', e.target.value === '' ? null : Number(e.target.value))}
        />
        <NumberField
          label="Skip CFG Below Sigma"
          value={state.advanced.skipCfgBelowSigma}
          min={0}
          step={0.1}
          onChange={e => setA('skipCfgBelowSigma', Number(e.target.value))}
        />
      </div>

      {/* Checkboxes */}
      <div style={checkboxGridStyle}>
        {renderAdvancedCheckbox('SMEA', state.advanced.smea, value => setA('smea', value))}
        {renderAdvancedCheckbox('SMEA + DYN', state.advanced.smeaDyn, value => setA('smeaDyn', value))}
        {renderAdvancedCheckbox('Dynamic Thresholding', state.advanced.dynamicThresholding, value => setA('dynamicThresholding', value))}
        {renderAdvancedCheckbox('Prefer Brownian', state.advanced.preferBrownian, value => setA('preferBrownian', value))}
        {renderAdvancedCheckbox('Uncond Per Vibe', state.advanced.uncondPerVibe, value => setA('uncondPerVibe', value))}
        {renderAdvancedCheckbox('Wonky Vibe Correlation', state.advanced.wonkyVibeCorrelation, value => setA('wonkyVibeCorrelation', value))}
        {renderAdvancedCheckbox('Deliberate Euler Ancestral Bug', state.advanced.deliberateEulerAncestralBug, value => setA('deliberateEulerAncestralBug', value))}
        {renderAdvancedCheckbox('Explike Fine Detail', state.advanced.explikeFineDetail, value => setA('explikeFineDetail', value))}
        {renderAdvancedCheckbox('Minimize Sigma Inf', state.advanced.minimizeSigmaInf, value => setA('minimizeSigmaInf', value))}
      </div>

      <div style={numRowStyle}>
        <NumberField
          label="DynThresh Percentile"
          value={state.advanced.dynamicThresholdingPercentile}
          min={0}
          max={1}
          step={0.001}
          onChange={e => setA('dynamicThresholdingPercentile', Number(e.target.value))}
        />
        <NumberField
          label="DynThresh Mimic Scale"
          value={state.advanced.dynamicThresholdingMimicScale}
          min={0}
          step={0.5}
          onChange={e => setA('dynamicThresholdingMimicScale', Number(e.target.value))}
        />
      </div>

      <hr style={{ border: 'none', borderTop: `1px solid ${theme.surface0}`, margin: '8px 0' }} />

      {/* V4 prompt toggles */}
      <div style={checkboxGridStyle}>
        {renderAdvancedCheckbox('Use Coords', state.useCoords, value => dispatch({ type: 'SET_META', field: 'useCoords', value }))}
        {renderAdvancedCheckbox('Use Order', state.useOrder, value => dispatch({ type: 'SET_META', field: 'useOrder', value }))}
      </div>
    </CollapsibleSection>
  );
}
