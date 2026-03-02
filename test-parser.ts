import { parsePromptToTokens } from './src/utils/intensityParser.js';

console.log(JSON.stringify(parsePromptToTokens('1girl, {{pink hair}}, [[[long hair]]], 1.5::huge breasts::, -1.0::ugly::, 0.5::small breasts'), null, 2));
