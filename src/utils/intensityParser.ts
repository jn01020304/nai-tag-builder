export type IntensityType = 'none' | 'high' | 'mid' | 'low';

export interface Token {
    text: string;
    type: IntensityType;
    level: number;
}

// NovelAI highlight levels: NAI starts {tag} at level 9
const calculateWeightLevel = (weight: number): number => {
    const diff = Math.abs(weight - 1.0);
    return Math.min(40, 9 + Math.floor(diff * 20));
};

export function parsePromptToTokens(prompt: string): Token[] {
    if (!prompt) return [];

    const tokens: Token[] = [];
    let lastIndex = 0;

    // Regex matches:
    // 1. Weight syntax: 1.5::tag:: or 1.5::tag
    //    Group 1: weight (e.g. 1.5)
    //    Group 2: the first ::
    //    Group 3: tag content
    //    Group 4: the second :: (if present)
    // 2. High brackets: {{tag}}
    //    Group 5: string starting with { and ending with }
    // 3. Low brackets: [[tag]]
    //    Group 6: string starting with [ and ending with ]
    const regex = /([-+]?\d*\.?\d+)(::)(.*?)(?:(::)|(?=[,\n]|$))|(\{+[^{}]+\}+)|(\[+[^[\]]+\]+)/g;

    let match;
    while ((match = regex.exec(prompt)) !== null) {
        const matchStart = match.index;

        // Push preceding unhighlighted text
        if (matchStart > lastIndex) {
            tokens.push({
                text: prompt.substring(lastIndex, matchStart),
                type: 'none',
                level: 0
            });
        }

        if (match[1]) {
            // Weight syntax matched
            const weightStr = match[1];
            const sep1 = match[2];
            const tagContent = match[3];
            const sep2 = match[4];

            const weight = parseFloat(weightStr);
            let type: IntensityType = 'none';
            if (!isNaN(weight)) {
                if (weight > 1.0) type = 'high';
                else if (weight < 1.0) type = 'low';
            }
            const level = isNaN(weight) ? 0 : calculateWeightLevel(weight);

            // Add weight token
            tokens.push({ text: weightStr, type, level });
            // Add first ::
            tokens.push({ text: sep1, type: 'mid', level: 0 }); // mid doesn't really use level in this context, or we can say level 20
            // Add tag content
            if (tagContent) {
                tokens.push({ text: tagContent, type, level });
            }
            // Add second :: if present
            if (sep2) {
                tokens.push({ text: sep2, type: 'mid', level: 0 });
            }

        } else if (match[5]) {
            // High brackets {tag}
            const text = match[5];
            // Count leading '{' to determine depth
            const depth = text.match(/^\{+/)?.[0].length || 1;
            tokens.push({ text, type: 'high', level: 8 + depth });
        } else if (match[6]) {
            // Low brackets [tag]
            const text = match[6];
            // Count leading '[' to determine depth
            const depth = text.match(/^\[+/)?.[0].length || 1;
            tokens.push({ text, type: 'low', level: 8 + depth });
        }

        lastIndex = regex.lastIndex;
    }

    // Push remaining text
    if (lastIndex < prompt.length) {
        tokens.push({
            text: prompt.substring(lastIndex),
            type: 'none',
            level: 0
        });
    }

    return tokens;
}
