export type IntensityType = "none" | "high" | "mid" | "low";

export interface Token {
  text: string;
  type: IntensityType;
  level: number;
}

const calculateWeightLevel = (weight: number): number => {
  const diff = Math.abs(weight - 1.0);
  return Math.min(40, 9 + Math.floor(diff * 20));
};

export function parsePromptToTokens(prompt: string): Token[] {
  if (!prompt) return [];

  const tokens: Token[] = [];
  let lastIndex = 0;

  const regex = /([-+]?\d*\.?\d+)::|(\{+[^{}]+\}+)|(\[+[^[\]]+\]+)/g;

  let match;
  while ((match = regex.exec(prompt)) !== null) {
    const matchStart = match.index;

    if (matchStart > lastIndex) {
      tokens.push({
        text: prompt.substring(lastIndex, matchStart),
        type: "none",
        level: 0,
      });
    }

    if (match[1]) {
      const weightStr = match[1];
      const contentStart = regex.lastIndex;
      const nextNewline = prompt.indexOf("\n", contentStart);
      const rawExplicitEnd = prompt.indexOf("::", contentStart);
      const explicitEnd = rawExplicitEnd >= 0 && (nextNewline < 0 || rawExplicitEnd < nextNewline)
        ? rawExplicitEnd
        : -1;
      const implicitEnd = (() => {
        const comma = prompt.indexOf(",", contentStart);
        const candidates = [comma, nextNewline].filter((index) => index >= 0);
        return candidates.length > 0 ? Math.min(...candidates) : prompt.length;
      })();
      const contentEnd = explicitEnd >= 0 ? explicitEnd : implicitEnd;
      const tagContent = prompt.substring(contentStart, contentEnd);
      const sep2 = explicitEnd >= 0 ? "::" : "";

      const weight = parseFloat(weightStr);
      let type: IntensityType = "none";
      if (!isNaN(weight)) {
        if (weight > 1.0) type = "high";
        else if (weight < 1.0) type = "low";
      }
      const level = isNaN(weight) ? 0 : calculateWeightLevel(weight);

      tokens.push({ text: weightStr, type, level });
      tokens.push({ text: "::", type: "mid", level: 0 });
      if (tagContent) {
        tokens.push({ text: tagContent, type, level });
      }
      if (sep2) {
        tokens.push({ text: sep2, type: "mid", level: 0 });
      }

      regex.lastIndex = contentEnd + sep2.length;
    } else if (match[2]) {
      const text = match[2];
      const depth = text.match(/^\{+/)?.[0].length || 1;
      tokens.push({ text, type: "high", level: 8 + depth });
    } else if (match[3]) {
      const text = match[3];
      const depth = text.match(/^\[+/)?.[0].length || 1;
      tokens.push({ text, type: "low", level: 8 + depth });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < prompt.length) {
    tokens.push({
      text: prompt.substring(lastIndex),
      type: "none",
      level: 0,
    });
  }

  return tokens;
}
