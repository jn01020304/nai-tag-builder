import type { CommentJson, MetadataState, CharCaption } from '../types/metadata';

export function buildCommentJson(state: MetadataState): CommentJson {
  const charCaptions: CharCaption[] = state.characters.map(c => ({
    char_caption: c.caption,
    centers: [{ x: c.centerX, y: c.centerY }],
  }));

  const negCharCaptions: CharCaption[] = state.negativeCharacters.map(c => ({
    char_caption: c.caption,
    centers: [{ x: c.centerX, y: c.centerY }],
  }));

  const seed = state.seed === 0
    ? Math.floor(Math.random() * 2 ** 32)
    : state.seed;

  return {
    prompt: state.basePrompt,
    steps: state.steps,
    height: state.height,
    width: state.width,
    scale: state.scale,
    uncond_scale: state.uncondScale,
    cfg_rescale: state.cfgRescale,
    seed,
    n_samples: state.nSamples,
    noise_schedule: state.noiseSchedule,
    legacy_v3_extend: false,
    reference_information_extracted_multiple: [],
    reference_strength_multiple: [],
    v4_prompt: {
      caption: { base_caption: state.basePrompt, char_captions: charCaptions },
      use_coords: state.useCoords,
      use_order: state.useOrder,
      legacy_uc: false,
    },
    v4_negative_prompt: {
      caption: { base_caption: state.negativeBase, char_captions: negCharCaptions },
      use_coords: false,
      use_order: false,
      legacy_uc: false,
    },
    sampler: state.sampler,
    controlnet_strength: 1,
    controlnet_model: null,
    dynamic_thresholding: state.dynamicThresholding,
    sm: state.smea,
    sm_dyn: state.smeaDyn,
    skip_cfg_above_sigma: state.skipCfgAboveSigma,
    skip_cfg_below_sigma: state.skipCfgBelowSigma,
    prefer_brownian: state.preferBrownian,
    cfg_sched_eligibility: state.cfgSchedEligibility,
    uncond_per_vibe: state.uncondPerVibe,
    wonky_vibe_correlation: state.wonkyVibeCorrelation,
    version: 1,
    uc: state.negativeBase,
    request_type: 'PromptGenerateRequest',
  };
}
