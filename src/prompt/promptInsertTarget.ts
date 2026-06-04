export type PromptInsertTarget =
  | { kind: "base" }
  | { kind: "negativeBase" }
  | { kind: "character"; id: string }
  | { kind: "negativeCharacter"; id: string };

export interface PromptSelection {
  start: number;
  end: number;
}

export interface PromptSelectionAfterRender extends PromptSelection {
  version: number;
}

export function promptTargetKey(target: PromptInsertTarget): string {
  if (target.kind === "character" || target.kind === "negativeCharacter") {
    return `${target.kind}:${target.id}`;
  }

  return target.kind;
}

export function promptTargetLabel(target: PromptInsertTarget): string {
  switch (target.kind) {
    case "base":
      return "Base Prompt";
    case "negativeBase":
      return "Negative Prompt";
    case "character":
      return "Character Prompt";
    case "negativeCharacter":
      return "Character Negative";
  }
}

export function promptTargetGroup(target: PromptInsertTarget): "base" | "negative" | "character" | "negativeCharacter" {
  if (target.kind === "negativeCharacter") {
    return "negativeCharacter";
  }

  if (target.kind === "negativeBase") {
    return "negative";
  }

  if (target.kind === "character") {
    return "character";
  }

  return "base";
}
