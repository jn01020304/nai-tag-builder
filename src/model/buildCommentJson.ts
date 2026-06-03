import type { CommentJson, MetadataState, CharCaption } from '../types/metadata';

export function buildCommentJson(state: MetadataState): CommentJson {
  const charCaptions: CharCaption[] = state.prompt.characters.map(c => ({
    char_caption: c.caption,
    centers: [{ x: c.centerX, y: c.centerY }],
  }));

  const negCharCaptions: CharCaption[] = state.prompt.negativeCharacters.map(c => ({
    char_caption: c.caption,
    centers: [{ x: c.centerX, y: c.centerY }],
  }));

  return {
    prompt: state.prompt.basePrompt,
    steps: state.params.steps,
    height: state.params.height,
    width: state.params.width,
    scale: state.params.scale,
    uncond_scale: state.advanced.uncondScale,
    cfg_rescale: state.advanced.cfgRescale,
    seed: state.params.seed,
    n_samples: state.params.nSamples,
    noise_schedule: state.params.noiseSchedule,
    legacy_v3_extend: false,
    reference_information_extracted_multiple: [],
    reference_strength_multiple: [],
    v4_prompt: {
      caption: { base_caption: state.prompt.basePrompt, char_captions: charCaptions },
      use_coords: state.useCoords,
      use_order: state.useOrder,
      legacy_uc: false,
    },
    v4_negative_prompt: {
      caption: { base_caption: state.prompt.negativeBase, char_captions: negCharCaptions },
      use_coords: false,
      use_order: false,
      legacy_uc: false,
    },
    sampler: state.params.sampler,
    controlnet_strength: 1,
    controlnet_model: null,
    dynamic_thresholding: state.advanced.dynamicThresholding,
    sm: state.advanced.smea,
    sm_dyn: state.advanced.smeaDyn,
    skip_cfg_above_sigma: state.advanced.skipCfgAboveSigma,
    skip_cfg_below_sigma: state.advanced.skipCfgBelowSigma,
    prefer_brownian: state.advanced.preferBrownian,
    cfg_sched_eligibility: state.advanced.cfgSchedEligibility,
    uncond_per_vibe: state.advanced.uncondPerVibe,
    wonky_vibe_correlation: state.advanced.wonkyVibeCorrelation,
    deliberate_euler_ancestral_bug: state.advanced.deliberateEulerAncestralBug,
    explike_fine_detail: state.advanced.explikeFineDetail,
    minimize_sigma_inf: state.advanced.minimizeSigmaInf,
    dynamic_thresholding_percentile: state.advanced.dynamicThresholdingPercentile,
    dynamic_thresholding_mimic_scale: state.advanced.dynamicThresholdingMimicScale,
    director_reference_strengths: state.advanced.directorReferenceStrengths,
    director_reference_descriptions: state.advanced.directorReferenceDescriptions,
    director_reference_information_extracted: state.advanced.directorReferenceInformationExtracted,
    director_reference_secondary_strengths: state.advanced.directorReferenceSecondaryStrengths,
    lora_unet_weights: state.advanced.loraUnetWeights,
    lora_clip_weights: state.advanced.loraClipWeights,
    stream: 'msgpack',
    signed_hash: '',
    extra_passthrough_testing: {
      prompt: null, uc: null, hide_debug_overlay: false, r: 0, eta: 1,
      negative_momentum: 0, director_reference_images: null,
      director_reference_descriptions: null,
      director_reference_information_extracted: null,
      director_reference_strengths: null,
      director_reference_secondary_strengths: null,
    },
    version: 1,
    uc: state.prompt.negativeBase,
    request_type: 'PromptGenerateRequest',
  };
}
