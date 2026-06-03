import type { MetadataState, Sampler, NoiseSchedule } from '../types/metadata';
import type { MetadataAction } from '../hooks/useMetadataState';
import { KNOWN_MODELS, getModelBySource } from '../model/models';
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
  const setP = (
    field: keyof MetadataState['params'],
    value: MetadataState['params'][keyof MetadataState['params']] | ''
  ) =>
    dispatch({ type: 'SET_PARAMS', field, value });

  return (
    <CollapsibleSection title="Parameters" defaultOpen>
      {/* Dimension presets */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {DIMENSION_PRESETS.map(p => {
          const active = state.params.width === p.w && state.params.height === p.h;
          return (
            <button
              key={p.label}
              onClick={() => { setP('width', p.w); setP('height', p.h); }}
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
            value={state.params.width}
            step={64}
            min={64}
            onChange={e => setP('width', Number(e.target.value))}
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
            value={state.params.height}
            step={64}
            min={64}
            onChange={e => setP('height', Number(e.target.value))}
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
              value={state.params.steps}
              min={1}
              max={50}
              onChange={e => setP('steps', e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={() => setP('steps', Math.max(1, Math.min(50, Number(state.params.steps) || 1)))}
              style={{ ...inputStyle, width: '48px', padding: '2px 4px', textAlign: 'center' }}
            />
          </div>
          <input
            type="range"
            value={state.params.steps}
            min={1}
            max={50}
            onChange={e => setP('steps', Number(e.target.value))}
            style={{ width: '100%', accentColor: theme.blue, marginTop: '4px' }}
          />
        </div>
        <div style={fieldStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>Scale</label>
            <input
              type="number"
              value={state.params.scale}
              min={0}
              max={10}
              step={0.1}
              onChange={e => setP('scale', e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={() => setP('scale', Math.max(0, Math.min(10, Number(state.params.scale) || 0)))}
              style={{ ...inputStyle, width: '48px', padding: '2px 4px', textAlign: 'center' }}
            />
          </div>
          <input
            type="range"
            value={state.params.scale}
            min={0}
            max={10}
            step={0.1}
            onChange={e => setP('scale', Number(e.target.value))}
            style={{ width: '100%', accentColor: theme.blue, marginTop: '4px' }}
          />
        </div>
      </div>

      {/* Sampler + Noise Schedule */}
      <div style={rowStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Sampler</label>
          <select
            value={state.params.sampler}
            onChange={e => setP('sampler', e.target.value as Sampler)}
            style={{ ...inputStyle, width: '100%' }}
          >
            {SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Noise</label>
          <select
            value={state.params.noiseSchedule}
            onChange={e => setP('noiseSchedule', e.target.value as NoiseSchedule)}
            style={{ ...inputStyle, width: '100%' }}
          >
            {NOISE_SCHEDULES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Model + Seed */}
      <div style={rowStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Model</label>
          <select
            value={getModelBySource(state.source)?.source || 'custom'}
            onChange={e => {
              if (e.target.value !== 'custom') {
                dispatch({ type: 'SET_META', field: 'source', value: e.target.value });
              }
            }}
            style={{ ...inputStyle, width: '100%' }}
          >
            {KNOWN_MODELS.map(m => <option key={m.source} value={m.source}>{m.label}</option>)}
            <option value="custom">Custom / Imported</option>
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Seed (0 = random)</label>
          <input
            type="number"
            value={state.params.seed}
            min={0}
            onChange={e => setP('seed', Number(e.target.value))}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      {!getModelBySource(state.source) && (
        <div style={{ marginBottom: '4px' }}>
          <label style={labelStyle}>Custom Model Hash</label>
          <input
            type="text"
            value={state.source || ''}
            onChange={e => dispatch({ type: 'SET_META', field: 'source', value: e.target.value })}
            style={{ ...inputStyle, width: '100%', fontSize: '11px' }}
            placeholder="e.g. NovelAI Diffusion V4.5 4BDE2A90"
          />
        </div>
      )}
    </CollapsibleSection>
  );
}
