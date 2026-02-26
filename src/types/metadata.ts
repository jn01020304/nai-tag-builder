export type Sampler =
  | 'k_euler'
  | 'k_euler_ancestral'
  | 'k_dpmpp_2s_ancestral'
  | 'k_dpmpp_2m_sde'
  | 'k_dpmpp_2m'
  | 'k_dpmpp_sde'
  | 'ddim_v3';

export type NoiseSchedule = 'karras' | 'exponential' | 'polyexponential' | 'native';

export interface CharCaption {
  char_caption: string;
  centers: Array<{ x: number; y: number }>;
}

export interface V4Prompt {
  caption: {
    base_caption: string;
    char_captions: CharCaption[];
  };
  use_coords: boolean;
  use_order: boolean;
  legacy_uc: boolean;
}

export interface CommentJson {
  prompt: string;
  steps: number;
  height: number;
  width: number;
  scale: number;
  uncond_scale: number;
  cfg_rescale: number;
  seed: number;
  n_samples: number;
  noise_schedule: NoiseSchedule;
  legacy_v3_extend: boolean;
  reference_information_extracted_multiple: unknown[];
  reference_strength_multiple: unknown[];
  v4_prompt: V4Prompt;
  v4_negative_prompt: V4Prompt;
  sampler: Sampler;
  controlnet_strength: number;
  controlnet_model: string | null;
  dynamic_thresholding: boolean;
  sm: boolean;
  sm_dyn: boolean;
  skip_cfg_above_sigma: number | null;
  skip_cfg_below_sigma: number;
  prefer_brownian: boolean;
  cfg_sched_eligibility: string;
  uncond_per_vibe: boolean;
  wonky_vibe_correlation: boolean;
  version: number;
  uc: string;
  request_type: string;
}

export interface CharacterEntry {
  id: string;
  caption: string;
  centerX: number;
  centerY: number;
}

export interface MetadataState {
  basePrompt: string;
  characters: CharacterEntry[];
  negativeBase: string;
  negativeCharacters: CharacterEntry[];

  steps: number;
  width: number;
  height: number;
  scale: number;
  sampler: Sampler;
  seed: number;
  noiseSchedule: NoiseSchedule;
  nSamples: number;

  cfgRescale: number;
  uncondScale: number;
  smea: boolean;
  smeaDyn: boolean;
  dynamicThresholding: boolean;
  skipCfgAboveSigma: number | null;
  skipCfgBelowSigma: number;
  preferBrownian: boolean;
  cfgSchedEligibility: string;
  uncondPerVibe: boolean;
  wonkyVibeCorrelation: boolean;

  useCoords: boolean;
  useOrder: boolean;
}
