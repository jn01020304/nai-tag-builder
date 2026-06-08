import type { CSSProperties, Dispatch } from "react";
import type { MetadataState, Sampler, NoiseSchedule } from "../types/metadata";
import type { MetadataAction } from "../hooks/useMetadataState";
import { KNOWN_MODELS, getModelBySource } from "../model/models";
import CollapsibleSection from "./CollapsibleSection";
import { useThemeStyles } from "../contexts/themeContextCore";
import Button from "../ui/primitives/Button";
import Field from "../ui/primitives/Field";
import IconButton from "../ui/primitives/IconButton";
import NumberField from "../ui/primitives/NumberField";
import RangeNumberField from "../ui/primitives/RangeNumberField";
import SelectField from "../ui/primitives/SelectField";

interface Props {
  state: MetadataState;
  dispatch: Dispatch<MetadataAction>;
}

const SAMPLERS: Sampler[] = [
  "k_euler_ancestral",
  "k_euler",
  "k_dpmpp_2s_ancestral",
  "k_dpmpp_2m_sde",
  "k_dpmpp_2m",
  "k_dpmpp_sde",
  "ddim_v3",
];

const NOISE_SCHEDULES: NoiseSchedule[] = ["karras", "exponential", "polyexponential", "native"];

const DIMENSION_PRESETS = [
  { label: "Portrait", w: 832, h: 1216 },
  { label: "Landscape", w: 1216, h: 832 },
  { label: "Square", w: 1024, h: 1024 },
];

const rowStyle: CSSProperties = {
  alignItems: "flex-end",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "8px",
};

export default function GenerationParams({ state, dispatch }: Props) {
  const { inputStyle } = useThemeStyles();

  const setP = (
    field: keyof MetadataState["params"],
    value: MetadataState["params"][keyof MetadataState["params"]] | ""
  ) =>
    dispatch({ type: "SET_PARAMS", field, value });

  return (
    <CollapsibleSection title="Parameters" defaultOpen>
      <div data-testid="generation-params" style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
        {DIMENSION_PRESETS.map((preset) => {
          const active = state.params.width === preset.w && state.params.height === preset.h;

          return (
            <Button
              key={preset.label}
              active={active}
              onClick={() => {
                setP("width", preset.w);
                setP("height", preset.h);
              }}
              style={{ flex: 1 }}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      <div style={rowStyle}>
        <NumberField
          data-testid="width-input"
          label="Width"
          min={64}
          step={64}
          value={state.params.width}
          onChange={(event) => setP("width", Number(event.target.value))}
        />
        <IconButton
          onClick={() => dispatch({ type: "SWAP_DIMENSIONS" })}
          style={{ marginBottom: "1px" }}
          title="Swap W/H"
        >
          &#8596;
        </IconButton>
        <NumberField
          data-testid="height-input"
          label="Height"
          min={64}
          step={64}
          value={state.params.height}
          onChange={(event) => setP("height", Number(event.target.value))}
        />
      </div>

      <div style={rowStyle}>
        <RangeNumberField
          label="Steps"
          max={50}
          min={1}
          testId="steps-input"
          value={state.params.steps}
          onBlur={() => setP("steps", Math.max(1, Math.min(50, Number(state.params.steps) || 1)))}
          onNumberChange={(value) => setP("steps", value === "" ? "" : Number(value))}
          onRangeChange={(value) => setP("steps", Number(value))}
        />
        <RangeNumberField
          label="Scale"
          max={10}
          min={0}
          step={0.1}
          value={state.params.scale}
          onBlur={() => setP("scale", Math.max(0, Math.min(10, Number(state.params.scale) || 0)))}
          onNumberChange={(value) => setP("scale", value === "" ? "" : Number(value))}
          onRangeChange={(value) => setP("scale", Number(value))}
        />
      </div>

      <div style={rowStyle}>
        <SelectField
          label="Sampler"
          value={state.params.sampler}
          onChange={(event) => setP("sampler", event.target.value as Sampler)}
        >
          {SAMPLERS.map((sampler) => (
            <option key={sampler} value={sampler}>
              {sampler}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Noise"
          value={state.params.noiseSchedule}
          onChange={(event) => setP("noiseSchedule", event.target.value as NoiseSchedule)}
        >
          {NOISE_SCHEDULES.map((noiseSchedule) => (
            <option key={noiseSchedule} value={noiseSchedule}>
              {noiseSchedule}
            </option>
          ))}
        </SelectField>
      </div>

      <div style={rowStyle}>
        <SelectField
          label="Model"
          value={getModelBySource(state.source)?.source || "custom"}
          onChange={(event) => {
            if (event.target.value !== "custom") {
              dispatch({ type: "SET_META", field: "source", value: event.target.value });
            }
          }}
        >
          {KNOWN_MODELS.map((model) => (
            <option key={model.source} value={model.source}>
              {model.label}
            </option>
          ))}
          <option value="custom">Custom / Imported</option>
        </SelectField>
        <NumberField
          label="Seed (0 = random)"
          min={0}
          value={state.params.seed}
          onChange={(event) => setP("seed", Number(event.target.value))}
        />
      </div>

      {!getModelBySource(state.source) && (
        <Field label="Custom Model Hash" style={{ marginBottom: "4px" }}>
          <input
            type="text"
            value={state.source || ""}
            onChange={(event) => dispatch({ type: "SET_META", field: "source", value: event.target.value })}
            style={{ ...inputStyle, fontSize: "11px", width: "100%" }}
            placeholder="e.g. NovelAI Diffusion V4.5 4BDE2A90"
          />
        </Field>
      )}
    </CollapsibleSection>
  );
}
