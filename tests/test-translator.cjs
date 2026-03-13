const fs = require('fs');

// We will test if our parsed JSON converts correctly.
const data = JSON.parse(fs.readFileSync('resource/original-json.json', 'utf8'));

// Now mock the DEFAULT_STATE
const DEFAULT_STATE = { basePrompt: "default", characters: [], steps: 28 };

function translateNovelAiMetadata(data, source) {
    const state = { ...DEFAULT_STATE };
    if (!data) return state;
    if (source) state.source = source;

    if (data.v4_prompt?.caption) {
        state.basePrompt = data.v4_prompt.caption.base_caption || '';
        const charCaptions = data.v4_prompt.caption.char_captions || [];
        state.characters = charCaptions.map((c, i) => ({
            id: 'char_' + Date.now() + '_' + i,
            caption: c.char_caption || '',
            centerX: c.centers?.[0]?.x ?? 0.5,
            centerY: c.centers?.[0]?.y ?? 0.5,
        }));
    } else if (typeof data.prompt === 'string') {
        state.basePrompt = data.prompt;
        state.characters = []; 
    }
    
    // Check some primitive fields
    if (typeof data.seed === 'number') state.seed = data.seed;
    if (typeof data.steps === 'number') state.steps = data.steps;
    
    return state;
}

const newState = translateNovelAiMetadata(data, 'some-source');
console.log('Base Prompt:', newState.basePrompt.substring(0, 30) + '...');
console.log('Characters:', newState.characters.length);
console.log('Seed:', newState.seed);
