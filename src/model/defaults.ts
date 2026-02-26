import type { MetadataState } from '../types/metadata';

export const DEFAULT_STATE: MetadataState = {
  basePrompt: '1girl, silver hair, red eyes, looking at viewer',
  characters: [],
  negativeBase: 'lowres, bad anatomy, bad hands, worst quality, low quality',
  negativeCharacters: [],

  steps: 28,
  width: 832,
  height: 1216,
  scale: 5,
  sampler: 'k_euler_ancestral',
  seed: 0,
  noiseSchedule: 'karras',
  nSamples: 1,

  cfgRescale: 0,
  uncondScale: 0,
  smea: false,
  smeaDyn: false,
  dynamicThresholding: false,
  skipCfgAboveSigma: null,
  skipCfgBelowSigma: 0,
  preferBrownian: true,
  cfgSchedEligibility: 'enable_for_post_summer_samplers',
  uncondPerVibe: true,
  wonkyVibeCorrelation: true,

  useCoords: false,
  useOrder: true,
};
