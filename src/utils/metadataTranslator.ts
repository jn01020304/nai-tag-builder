import type { MetadataState } from '../types/metadata';
import { DEFAULT_STATE } from '../model/defaults';

/**
 * Translates a JSON payload from a NovelAI generated PNG into the local MetadataState.
 * Note: NovelAI prompt format contains all characters compiled into one string.
 * Therefore, we map it entirely to `basePrompt` and clear `characters` to avoid duplications.
 */
export function translateNovelAiMetadata(data: any): MetadataState {
    const state: MetadataState = { ...DEFAULT_STATE };

    if (!data) return state;

    if (typeof data.prompt === 'string') {
        state.basePrompt = data.prompt;
        state.characters = []; // Prevent multiplying characters on import
    }

    const neg = data.negative_prompt || data.uc;
    if (typeof neg === 'string') {
        state.negativeBase = neg;
        state.negativeCharacters = [];
    }

    if (typeof data.seed === 'number') state.seed = data.seed;
    if (typeof data.steps === 'number') state.steps = data.steps;
    if (typeof data.sampler === 'string') state.sampler = data.sampler;
    if (typeof data.guidance === 'number') state.scale = data.guidance;
    if (typeof data.sm === 'boolean') state.smea = data.sm;
    if (typeof data.sm_dyn === 'boolean') state.smeaDyn = data.sm_dyn;

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
