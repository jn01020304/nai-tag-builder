import type { CommentJson, MetadataState, NoiseSchedule, Sampler } from '../types/metadata';
import { DEFAULT_STATE, DEFAULT_PROMPT, DEFAULT_PARAMS, DEFAULT_ADVANCED } from '../model/defaults';

type NovelAiMetadata = Partial<CommentJson> & {
    guidance?: number;
    negative_prompt?: string;
    resolution?: string;
};

const SAMPLERS: readonly Sampler[] = [
    'k_euler',
    'k_euler_ancestral',
    'k_dpmpp_2s_ancestral',
    'k_dpmpp_2m_sde',
    'k_dpmpp_2m',
    'k_dpmpp_sde',
    'ddim_v3',
];

const NOISE_SCHEDULES: readonly NoiseSchedule[] = ['karras', 'exponential', 'polyexponential', 'native'];

function isNovelAiMetadata(data: unknown): data is NovelAiMetadata {
    return typeof data === 'object' && data !== null;
}

function isSampler(value: unknown): value is Sampler {
    return typeof value === 'string' && SAMPLERS.includes(value as Sampler);
}

function isNoiseSchedule(value: unknown): value is NoiseSchedule {
    return typeof value === 'string' && NOISE_SCHEDULES.includes(value as NoiseSchedule);
}

export function translateNovelAiMetadata(rawData: unknown, source?: string): MetadataState {
    const state: MetadataState = {
        prompt: { ...DEFAULT_PROMPT },
        params: { ...DEFAULT_PARAMS },
        advanced: { ...DEFAULT_ADVANCED },
        useCoords: DEFAULT_STATE.useCoords,
        useOrder: DEFAULT_STATE.useOrder,
    };

    if (!isNovelAiMetadata(rawData)) return state;
    const data = rawData;
    if (source) state.source = source;

    if (data.v4_prompt?.caption) {
        state.prompt.basePrompt = data.v4_prompt.caption.base_caption || '';
        const charCaptions = data.v4_prompt.caption.char_captions || [];
        state.prompt.characters = charCaptions.map((c, i) => ({
            id: 'char_' + Date.now() + '_' + i,
            caption: c.char_caption || '',
            centerX: c.centers?.[0]?.x ?? 0.5,
            centerY: c.centers?.[0]?.y ?? 0.5,
        }));
        if (typeof data.v4_prompt.use_coords === 'boolean') state.useCoords = data.v4_prompt.use_coords;
        if (typeof data.v4_prompt.use_order === 'boolean') state.useOrder = data.v4_prompt.use_order;
    } else if (typeof data.prompt === 'string') {
        state.prompt.basePrompt = data.prompt;
        state.prompt.characters = [];
    }

    if (data.v4_negative_prompt?.caption) {
        state.prompt.negativeBase = data.v4_negative_prompt.caption.base_caption || '';
        const charCaptions = data.v4_negative_prompt.caption.char_captions || [];
        state.prompt.negativeCharacters = charCaptions.map((c, i) => ({
            id: 'char_neg_' + Date.now() + '_' + i,
            caption: c.char_caption || '',
            centerX: c.centers?.[0]?.x ?? 0.5,
            centerY: c.centers?.[0]?.y ?? 0.5,
        }));
    } else {
        const neg = data.negative_prompt || data.uc;
        if (typeof neg === 'string') {
            state.prompt.negativeBase = neg;
            state.prompt.negativeCharacters = [];
        }
    }

    // Basic generation params
    if (typeof data.seed === 'number') state.params.seed = data.seed;
    if (typeof data.steps === 'number') state.params.steps = data.steps;
    if (isSampler(data.sampler)) state.params.sampler = data.sampler;
    if (typeof data.scale === 'number') state.params.scale = data.scale;
    else if (typeof data.guidance === 'number') state.params.scale = data.guidance;
    if (typeof data.sm === 'boolean') state.advanced.smea = data.sm;
    if (typeof data.sm_dyn === 'boolean') state.advanced.smeaDyn = data.sm_dyn;
    if (isNoiseSchedule(data.noise_schedule)) state.params.noiseSchedule = data.noise_schedule;
    if (typeof data.n_samples === 'number') state.params.nSamples = data.n_samples;

    // Advanced params
    if (typeof data.cfg_rescale === 'number') state.advanced.cfgRescale = data.cfg_rescale;
    if (typeof data.uncond_scale === 'number') state.advanced.uncondScale = data.uncond_scale;
    if (typeof data.dynamic_thresholding === 'boolean') state.advanced.dynamicThresholding = data.dynamic_thresholding;
    if (data.skip_cfg_above_sigma !== undefined) state.advanced.skipCfgAboveSigma = data.skip_cfg_above_sigma;
    if (typeof data.skip_cfg_below_sigma === 'number') state.advanced.skipCfgBelowSigma = data.skip_cfg_below_sigma;
    if (typeof data.prefer_brownian === 'boolean') state.advanced.preferBrownian = data.prefer_brownian;
    if (typeof data.cfg_sched_eligibility === 'string') state.advanced.cfgSchedEligibility = data.cfg_sched_eligibility;
    if (typeof data.uncond_per_vibe === 'boolean') state.advanced.uncondPerVibe = data.uncond_per_vibe;
    if (typeof data.wonky_vibe_correlation === 'boolean') state.advanced.wonkyVibeCorrelation = data.wonky_vibe_correlation;

    // R3: 생성 영향
    if (typeof data.deliberate_euler_ancestral_bug === 'boolean') state.advanced.deliberateEulerAncestralBug = data.deliberate_euler_ancestral_bug;
    if (typeof data.explike_fine_detail === 'boolean') state.advanced.explikeFineDetail = data.explike_fine_detail;
    if (typeof data.minimize_sigma_inf === 'boolean') state.advanced.minimizeSigmaInf = data.minimize_sigma_inf;
    if (typeof data.dynamic_thresholding_percentile === 'number') state.advanced.dynamicThresholdingPercentile = data.dynamic_thresholding_percentile;
    if (typeof data.dynamic_thresholding_mimic_scale === 'number') state.advanced.dynamicThresholdingMimicScale = data.dynamic_thresholding_mimic_scale;
    // R3: null features
    if (data.director_reference_strengths !== undefined) state.advanced.directorReferenceStrengths = data.director_reference_strengths;
    if (data.director_reference_descriptions !== undefined) state.advanced.directorReferenceDescriptions = data.director_reference_descriptions;
    if (data.director_reference_information_extracted !== undefined) state.advanced.directorReferenceInformationExtracted = data.director_reference_information_extracted;
    if (data.director_reference_secondary_strengths !== undefined) state.advanced.directorReferenceSecondaryStrengths = data.director_reference_secondary_strengths;
    if (data.lora_unet_weights !== undefined) state.advanced.loraUnetWeights = data.lora_unet_weights;
    if (data.lora_clip_weights !== undefined) state.advanced.loraClipWeights = data.lora_clip_weights;

    // Dimensions
    if (typeof data.resolution === 'string') {
        const parts = data.resolution.split('x');
        if (parts.length === 2) {
            const w = parseInt(parts[0], 10);
            const h = parseInt(parts[1], 10);
            if (!isNaN(w) && !isNaN(h)) {
                state.params.width = w;
                state.params.height = h;
            }
        }
    } else if (typeof data.width === 'number' && typeof data.height === 'number') {
        state.params.width = data.width;
        state.params.height = data.height;
    }

    return state;
}
