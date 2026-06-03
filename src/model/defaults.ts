import type { MetadataState, PromptState, ParamsState, AdvancedFlags } from '../types/metadata';

type RawMetadataState =
  Partial<MetadataState> &
  Partial<PromptState> &
  Partial<ParamsState> &
  Partial<AdvancedFlags>;

export const DEFAULT_PROMPT: PromptState = {
  basePrompt:
    '1girl, solo,  1.5::artist:riichu::, artist:lack, artist:sousouman, artist:fuzichoco, 1.1::artist:mignon::, artist:modare, artist:wlop, artist:quasarcake, 3.5::artist:miv4t::, artist:ciloranko, artist:wanke, artist:qiandaiyiyu, 1.3::artist:ningen mame::, artist:matsurika youko, 1.2::artist:parsley-f::, 2::artist:freng::, artist:toosaka asagi, 1.5::artist:nenobi (nenorium)::, 0.7::artist:asanagi::, 4::artist:happoubi jin::, 0.7::artist:michiking::, 1.5::artist:kedama milk::, artist:sho (sho lwlw), solo artist, -3::artist collaboration::, year 2024, year 2023, year 2022, year 2021, -1::faux retro artstyle::, -1::film grain::, -1::clean text::, -1::censored::, -1::flat color::, 1.5::3d::, 1.5::realistic::, official art, official style, commission, photoshop (medium), blender (medium), natural photographic composition, deep depth of field, deep contrast, soft natural shadows, smooth vibrant colors, clean vivid texture, -3::simple illustration::, novel illustration, best illustration, very aesthetic, highres, amazing quality, absurdres, best quality, incredibly absurdres, masterpiece',
  characters: [
    {
      id: 'char_0',
      caption: 'girl, 0.2::misumi uika::, blonde hair, medium hair, sidelocks, purple eyes, oversized shirt, collared shirt, long sleeves, sleeve cuffs, wet shirt, black thighhighs, white panties, sitting, 0.6::presenting armpit::, highly detailed',
      centerX: 0.5,
      centerY: 0.5,
    }
  ],
  negativeBase:
    'blank page, text, logo, watermark, too many watermarks, signature, artist name, reference, dated, scan artifacts, jpeg artifacts, upscaled, aliasing, film grain, heavy film grain, dithering, chromatic aberration, digital dissolve, halftone, screentones, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist collaboration, one-hour drawing challenge, oekaki, toon (style), 1990s (style), 4koma, 2koma, bad face, mob face, bad facial features, unnatural facial features, bad eyes, empty eyes, pointy ears, distorted, deformed, super deformed, malformed, disfigured, bad anatomy, distorted anatomy, anatomical error, bad proportions, bad body parts, disproportionate body parts, bad limbs, impossible limb position, amputee, bad arm, bad hands, extra hands, bad hand structure, imperfect fingers, unclear fingertips, extra digits, fewer digits, bad leg, distorted composition, bad perspective, wrong perspective, multiple views, inconsistent art, disorganized colors, flat color, no lineart, messy lines, unnatural body pose, anatomically impossible pose, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, artistic error, amateurish, worst quality, bad quality, blurry, lowres, fewer details, bad portrait, bad illustration, worst portrait, worst illustration',
  negativeCharacters: [
    {
      id: 'char_0',
      caption: '',
      centerX: 0.5,
      centerY: 0.5,
    }
  ],
};

export const DEFAULT_PARAMS: ParamsState = {
  steps: 28,
  width: 832,
  height: 1216,
  scale: 8,
  sampler: 'k_euler_ancestral',
  seed: 0,
  noiseSchedule: 'karras',
  nSamples: 1,
};

export const DEFAULT_ADVANCED: AdvancedFlags = {
  cfgRescale: 0.3,
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
  deliberateEulerAncestralBug: false,
  explikeFineDetail: false,
  minimizeSigmaInf: false,
  dynamicThresholdingPercentile: 0.999,
  dynamicThresholdingMimicScale: 10,
  directorReferenceStrengths: null,
  directorReferenceDescriptions: null,
  directorReferenceInformationExtracted: null,
  directorReferenceSecondaryStrengths: null,
  loraUnetWeights: null,
  loraClipWeights: null,
};

export const DEFAULT_STATE: MetadataState = {
  prompt: DEFAULT_PROMPT,
  params: DEFAULT_PARAMS,
  advanced: DEFAULT_ADVANCED,
  useCoords: true,
  useOrder: true,
  source: 'NovelAI Diffusion V4.5 4BDE2A90',
};

// R4: 로드 타임 정규화 — 기존 프리셋/상태에 없는 필드를 DEFAULT_STATE로 채움
// flat → nested 마이그레이션도 처리
export function normalizeMetadataState(raw?: RawMetadataState | null): MetadataState {
  // flat 구조 감지 (D2 이전 데이터)
  if (raw && 'basePrompt' in raw && !('prompt' in raw)) {
    return {
      prompt: {
        basePrompt: raw.basePrompt ?? DEFAULT_PROMPT.basePrompt,
        characters: raw.characters ?? DEFAULT_PROMPT.characters,
        negativeBase: raw.negativeBase ?? DEFAULT_PROMPT.negativeBase,
        negativeCharacters: raw.negativeCharacters ?? DEFAULT_PROMPT.negativeCharacters,
      },
      params: {
        steps: raw.steps ?? DEFAULT_PARAMS.steps,
        width: raw.width ?? DEFAULT_PARAMS.width,
        height: raw.height ?? DEFAULT_PARAMS.height,
        scale: raw.scale ?? DEFAULT_PARAMS.scale,
        sampler: raw.sampler ?? DEFAULT_PARAMS.sampler,
        seed: raw.seed ?? DEFAULT_PARAMS.seed,
        noiseSchedule: raw.noiseSchedule ?? DEFAULT_PARAMS.noiseSchedule,
        nSamples: raw.nSamples ?? DEFAULT_PARAMS.nSamples,
      },
      advanced: {
        ...DEFAULT_ADVANCED,
        ...(raw.cfgRescale !== undefined && { cfgRescale: raw.cfgRescale }),
        ...(raw.uncondScale !== undefined && { uncondScale: raw.uncondScale }),
        ...(raw.smea !== undefined && { smea: raw.smea }),
        ...(raw.smeaDyn !== undefined && { smeaDyn: raw.smeaDyn }),
        ...(raw.dynamicThresholding !== undefined && { dynamicThresholding: raw.dynamicThresholding }),
        ...(raw.skipCfgAboveSigma !== undefined && { skipCfgAboveSigma: raw.skipCfgAboveSigma }),
        ...(raw.skipCfgBelowSigma !== undefined && { skipCfgBelowSigma: raw.skipCfgBelowSigma }),
        ...(raw.preferBrownian !== undefined && { preferBrownian: raw.preferBrownian }),
        ...(raw.cfgSchedEligibility !== undefined && { cfgSchedEligibility: raw.cfgSchedEligibility }),
        ...(raw.uncondPerVibe !== undefined && { uncondPerVibe: raw.uncondPerVibe }),
        ...(raw.wonkyVibeCorrelation !== undefined && { wonkyVibeCorrelation: raw.wonkyVibeCorrelation }),
        ...(raw.deliberateEulerAncestralBug !== undefined && { deliberateEulerAncestralBug: raw.deliberateEulerAncestralBug }),
        ...(raw.explikeFineDetail !== undefined && { explikeFineDetail: raw.explikeFineDetail }),
        ...(raw.minimizeSigmaInf !== undefined && { minimizeSigmaInf: raw.minimizeSigmaInf }),
        ...(raw.dynamicThresholdingPercentile !== undefined && { dynamicThresholdingPercentile: raw.dynamicThresholdingPercentile }),
        ...(raw.dynamicThresholdingMimicScale !== undefined && { dynamicThresholdingMimicScale: raw.dynamicThresholdingMimicScale }),
        ...(raw.directorReferenceStrengths !== undefined && { directorReferenceStrengths: raw.directorReferenceStrengths }),
        ...(raw.directorReferenceDescriptions !== undefined && { directorReferenceDescriptions: raw.directorReferenceDescriptions }),
        ...(raw.directorReferenceInformationExtracted !== undefined && { directorReferenceInformationExtracted: raw.directorReferenceInformationExtracted }),
        ...(raw.directorReferenceSecondaryStrengths !== undefined && { directorReferenceSecondaryStrengths: raw.directorReferenceSecondaryStrengths }),
        ...(raw.loraUnetWeights !== undefined && { loraUnetWeights: raw.loraUnetWeights }),
        ...(raw.loraClipWeights !== undefined && { loraClipWeights: raw.loraClipWeights }),
      },
      useCoords: raw.useCoords ?? DEFAULT_STATE.useCoords,
      useOrder: raw.useOrder ?? DEFAULT_STATE.useOrder,
      source: raw.source ?? DEFAULT_STATE.source,
    };
  }
  // nested 구조 — 각 그룹별 default 병합
  return {
    prompt: { ...DEFAULT_PROMPT, ...raw?.prompt },
    params: { ...DEFAULT_PARAMS, ...raw?.params },
    advanced: { ...DEFAULT_ADVANCED, ...raw?.advanced },
    useCoords: raw?.useCoords ?? DEFAULT_STATE.useCoords,
    useOrder: raw?.useOrder ?? DEFAULT_STATE.useOrder,
    source: raw?.source ?? DEFAULT_STATE.source,
  };
}
