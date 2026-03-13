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
  deliberate_euler_ancestral_bug: boolean;
  explike_fine_detail: boolean;
  minimize_sigma_inf: boolean;
  dynamic_thresholding_percentile: number;
  dynamic_thresholding_mimic_scale: number;
  director_reference_strengths: unknown | null;
  director_reference_descriptions: unknown | null;
  director_reference_information_extracted: unknown | null;
  director_reference_secondary_strengths: unknown | null;
  lora_unet_weights: unknown | null;
  lora_clip_weights: unknown | null;
  stream: string;
  signed_hash: string;
  extra_passthrough_testing: unknown;
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

// D2: nested sub-interfaces
export interface PromptState {
  basePrompt: string;
  characters: CharacterEntry[];
  negativeBase: string;
  negativeCharacters: CharacterEntry[];
}

export interface ParamsState {
  steps: number;
  width: number;
  height: number;
  scale: number;
  sampler: Sampler;
  seed: number;
  noiseSchedule: NoiseSchedule;
  nSamples: number;
}

export interface AdvancedFlags {
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
  deliberateEulerAncestralBug: boolean;
  explikeFineDetail: boolean;
  minimizeSigmaInf: boolean;
  dynamicThresholdingPercentile: number;
  dynamicThresholdingMimicScale: number;
  directorReferenceStrengths: unknown | null;
  directorReferenceDescriptions: unknown | null;
  directorReferenceInformationExtracted: unknown | null;
  directorReferenceSecondaryStrengths: unknown | null;
  loraUnetWeights: unknown | null;
  loraClipWeights: unknown | null;
}

export interface MetadataState {
  prompt: PromptState;
  params: ParamsState;
  advanced: AdvancedFlags;
  useCoords: boolean;
  useOrder: boolean;
  source?: string;
}
