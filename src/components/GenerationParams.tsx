import type { MetadataState, Sampler, NoiseSchedule } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import CollapsibleSection from './CollapsibleSection';
import { theme, inputStyle, labelStyle, smallBtnStyle } from '../styles/theme';

interface Props {
  state: MetadataState;
  dispatch: React.Dispatch<MetadataAction>;
}

const SAMPLERS: Sampler[] = [
  'k_euler_ancestral',
  'k_euler',
  'k_dpmpp_2s_ancestral',
  'k_dpmpp_2m_sde',
  'k_dpmpp_2m',
  'k_dpmpp_sde',
  'ddim_v3',
];

const NOISE_SCHEDULES: NoiseSchedule[] = ['karras', 'exponential', 'polyexponential', 'native'];

const DIMENSION_PRESETS = [
  { label: 'Portrait', w: 832, h: 1216 },
  { label: 'Landscape', w: 1216, h: 832 },
  { label: 'Square', w: 1024, h: 1024 },
];

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '8px',
  alignItems: 'flex-end',
};

const fieldStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

export default function GenerationParams({ state, dispatch }: Props) {
  const set = (field: keyof MetadataState, value: MetadataState[keyof MetadataState]) =>
    dispatch({ type: 'SET_FIELD', field, value });

  return (
    <CollapsibleSection title="Parameters" defaultOpen>
      {/* Dimension presets */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {DIMENSION_PRESETS.map(p => {
          const active = state.width === p.w && state.height === p.h;
          return (
            <button
              key={p.label}
              onClick={() => { set('width', p.w); set('height', p.h); }}
              style={{
                ...smallBtnStyle,
                flex: 1,
                backgroundColor: active ? theme.surface1 : 'transparent',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Width x Height */}
      <div style={rowStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Width</label>
          <input
            type="number"
            value={state.width}
            step={64}
            min={64}
            onChange={e => set('width', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <button
          onClick={() => dispatch({ type: 'SWAP_DIMENSIONS' })}
          style={{ ...smallBtnStyle, padding: '6px 10px', marginBottom: '1px' }}
          title="Swap W/H"
        >
          &#8596;
        </button>
        <div style={fieldStyle}>
          <label style={labelStyle}>Height</label>
          <input
            type="number"
            value={state.height}
            step={64}
            min={64}
            onChange={e => set('height', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      {/* Steps + Scale */}
      <div style={rowStyle}>
        <div style={fieldStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>Steps</label>
            <input
              type="number"
              value={state.steps}
              min={1}
              max={50}
              onChange={e => set('steps', e.target.value === '' ? '' as any : Number(e.target.value))}
              onBlur={() => set('steps', Math.max(1, Math.min(50, Number(state.steps) || 1)))}
              style={{ ...inputStyle, width: '48px', padding: '2px 4px', textAlign: 'center' }}
            />
          </div>
          <input
            type="range"
            value={state.steps}
            min={1}
            max={50}
            onChange={e => set('steps', Number(e.target.value))}
            style={{ width: '100%', accentColor: theme.blue, marginTop: '4px' }}
          />
        </div>
        <div style={fieldStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>Scale</label>
            <input
              type="number"
              value={state.scale}
              min={0}
              max={10}
              step={0.1}
              onChange={e => set('scale', e.target.value === '' ? '' as any : Number(e.target.value))}
              onBlur={() => set('scale', Math.max(0, Math.min(10, Number(state.scale) || 0)))}
              style={{ ...inputStyle, width: '48px', padding: '2px 4px', textAlign: 'center' }}
            />
          </div>
          <input
            type="range"
            value={state.scale}
            min={0}
            max={10}
            step={0.1}
            onChange={e => set('scale', Number(e.target.value))}
            style={{ width: '100%', accentColor: theme.blue, marginTop: '4px' }}
          />
        </div>
      </div>

      {/* Sampler + Noise Schedule */}
      <div style={rowStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Sampler</label>
          <select
            value={state.sampler}
            onChange={e => set('sampler', e.target.value as Sampler)}
            style={{ ...inputStyle, width: '100%' }}
          >
            {SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Noise</label>
          <select
            value={state.noiseSchedule}
            onChange={e => set('noiseSchedule', e.target.value as NoiseSchedule)}
            style={{ ...inputStyle, width: '100%' }}
          >
            {NOISE_SCHEDULES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Seed */}
      <div style={{ marginBottom: '4px' }}>
        <label style={labelStyle}>Seed (0 = random)</label>
        <input
          type="number"
          value={state.seed}
          min={0}
          onChange={e => set('seed', Number(e.target.value))}
          style={{ ...inputStyle, width: '100%' }}
        />
      </div>
    </CollapsibleSection>
  );
}
