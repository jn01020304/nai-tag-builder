export type PromptTone = "base" | "negative" | "character" | "negativeCharacter";

export interface PromptTonePalette {
  background: string;
  border: string;
  color: string;
  shadow: string;
}

export const promptTonePalettes: Record<PromptTone, PromptTonePalette> = {
  base: {
    background: "#4A6B82",
    border: "#86A0B2",
    color: "#ffffff",
    shadow: "rgba(74, 107, 130, 0.24)",
  },
  negative: {
    background: "#8F5955",
    border: "#BF918D",
    color: "#ffffff",
    shadow: "rgba(143, 89, 85, 0.22)",
  },
  character: {
    background: "#6B5B82",
    border: "#A99CB9",
    color: "#ffffff",
    shadow: "rgba(107, 91, 130, 0.22)",
  },
  negativeCharacter: {
    background: "#8A5A6D",
    border: "#BD93A4",
    color: "#ffffff",
    shadow: "rgba(138, 90, 109, 0.22)",
  },
};
