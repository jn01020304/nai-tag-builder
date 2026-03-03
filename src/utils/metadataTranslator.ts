import type { MetadataState } from '../types/metadata';
import { DEFAULT_STATE } from '../model/defaults';

/**
 * Translates a JSON payload from a NovelAI generated PNG into the local MetadataState.
 * Note: NovelAI prompt format contains all characters compiled into one string.
 * Therefore, we map it entirely to `basePrompt` and clear `characters` to avoid duplications.
 */
export function translateNovelAiMetadata(data: any, source?: string): MetadataState {
    console.log('[TRANSLATE-DEBUG] v3 called');
    const state: MetadataState = { ...DEFAULT_STATE };

    if (!data) { console.log('[TRANSLATE-DEBUG] data is falsy, returning defaults'); return state; }
    if (source) state.source = source;

    // Deep inspect data
    console.log('[TRANSLATE-DEBUG] data type:', typeof data);
    console.log('[TRANSLATE-DEBUG] data.prompt type:', typeof data.prompt, 'value:', typeof data.prompt === 'string' ? data.prompt.substring(0, 40) : data.prompt);
    console.log('[TRANSLATE-DEBUG] data.v4_prompt type:', typeof data.v4_prompt);
    console.log('[TRANSLATE-DEBUG] data.v4_prompt?.caption:', data.v4_prompt?.caption ? 'EXISTS' : 'MISSING');
    console.log('[TRANSLATE-DEBUG] data.steps:', data.steps, 'data.seed:', data.seed, 'data.scale:', data.scale);

    if (data.v4_prompt?.caption) {
        console.log('[TRANSLATE-DEBUG] ENTERING v4_prompt branch');
        state.basePrompt = data.v4_prompt.caption.base_caption || '';
        const charCaptions = data.v4_prompt.caption.char_captions || [];
        state.characters = charCaptions.map((c: any, i: number) => ({
            id: 'char_' + Date.now() + '_' + i,
            caption: c.char_caption || '',
            centerX: c.centers?.[0]?.x ?? 0.5,
            centerY: c.centers?.[0]?.y ?? 0.5,
        }));
        console.log('[TRANSLATE-DEBUG] v4_prompt basePrompt:', state.basePrompt.substring(0, 60), '| chars:', state.characters.length);
    } else if (typeof data.prompt === 'string') {
        console.log('[TRANSLATE-DEBUG] ENTERING flat prompt branch');
        state.basePrompt = data.prompt;
        state.characters = [];
    } else {
        console.log('[TRANSLATE-DEBUG] NO PROMPT BRANCH TAKEN');
    }

    if (data.v4_negative_prompt?.caption) {
        state.negativeBase = data.v4_negative_prompt.caption.base_caption || '';
        const charCaptions = data.v4_negative_prompt.caption.char_captions || [];
        state.negativeCharacters = charCaptions.map((c: any, i: number) => ({
            id: 'char_neg_' + Date.now() + '_' + i,
            caption: c.char_caption || '',
            centerX: c.centers?.[0]?.x ?? 0.5,
            centerY: c.centers?.[0]?.y ?? 0.5,
        }));
    } else {
        const neg = data.negative_prompt || data.uc;
        if (typeof neg === 'string') {
            state.negativeBase = neg;
            state.negativeCharacters = [];
        }
    }

    // Basic generation params
    if (typeof data.seed === 'number') state.seed = data.seed;
    if (typeof data.steps === 'number') state.steps = data.steps;
    if (typeof data.sampler === 'string') state.sampler = data.sampler;
    if (typeof data.scale === 'number') state.scale = data.scale;
    else if (typeof data.guidance === 'number') state.scale = data.guidance;
    if (typeof data.sm === 'boolean') state.smea = data.sm;
    if (typeof data.sm_dyn === 'boolean') state.smeaDyn = data.sm_dyn;
    if (typeof data.noise_schedule === 'string') state.noiseSchedule = data.noise_schedule;
    if (typeof data.n_samples === 'number') state.nSamples = data.n_samples;

    // Advanced params
    if (typeof data.cfg_rescale === 'number') state.cfgRescale = data.cfg_rescale;
    if (typeof data.uncond_scale === 'number') state.uncondScale = data.uncond_scale;
    if (typeof data.dynamic_thresholding === 'boolean') state.dynamicThresholding = data.dynamic_thresholding;
    if (data.skip_cfg_above_sigma !== undefined) state.skipCfgAboveSigma = data.skip_cfg_above_sigma;
    if (typeof data.skip_cfg_below_sigma === 'number') state.skipCfgBelowSigma = data.skip_cfg_below_sigma;
    if (typeof data.prefer_brownian === 'boolean') state.preferBrownian = data.prefer_brownian;
    if (typeof data.cfg_sched_eligibility === 'string') state.cfgSchedEligibility = data.cfg_sched_eligibility;
    if (typeof data.uncond_per_vibe === 'boolean') state.uncondPerVibe = data.uncond_per_vibe;
    if (typeof data.wonky_vibe_correlation === 'boolean') state.wonkyVibeCorrelation = data.wonky_vibe_correlation;

    console.log('[TRANSLATE-DEBUG] Final: prompt=', state.basePrompt.substring(0, 40), '| scale=', state.scale, '| steps=', state.steps, '| seed=', state.seed, '| sampler=', state.sampler, '| size=', state.width, 'x', state.height);

    // Dimensions
    if (typeof data.resolution === 'string') {
        const parts = data.resolution.split('x');
        if (parts.length === 2) {
            const w = parseInt(parts[0], 10);
            const h = parseInt(parts[1], 10);
            if (!isNaN(w) && !isNaN(h)) {
                state.width = w;
                state.height = h;
            }
        }
    } else if (typeof data.width === 'number' && typeof data.height === 'number') {
        state.width = data.width;
        state.height = data.height;
    }

    return state;
}
