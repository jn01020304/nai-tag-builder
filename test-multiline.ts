import { parsePromptToTokens } from './src/utils/intensityParser.js';

const prompt = `1girl, solo, full body, simple background,
1.8::artist:kim eb::, 0.9::artist:mika pikazo::,
1.6::artist:torino aqua::, 1.6::artist:yoya yogurt::, artist:fuzichoco,
artist:momoko (momopoco),
artist:riichu, artist:ningen mame,
artist:parsley-f, artist:freng,
artist:toosaka asagi,
1.1::artist:dishwasher1910 ::,`;

console.log(JSON.stringify(parsePromptToTokens(prompt).filter(t => t.type !== 'none'), null, 2));
