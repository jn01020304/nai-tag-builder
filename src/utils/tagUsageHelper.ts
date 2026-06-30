import type { PromptState } from "../types/metadata";
import type { TagDictionaryEntry } from "../catalog/tagDictionaryTypes";
import { hasPromptTag, splitPromptTags, normalizePromptToken } from "../prompt/catalog/promptTagText";
import type { PromptTone } from "../styles/promptTonePalettes";

export type TargetKind = PromptTone;

export interface TagAssignment {
  key: string;
  label: string;
  group: TargetKind;
  order: number; // Order of appearance
}

export function getPromptAssignments(tag: string, prompt: PromptState): TagAssignment[] {
  const assignments: TagAssignment[] = [];
  const cleanMatch = normalizePromptToken(tag);

  const checkTarget = (
    value: string,
    key: string,
    label: string,
    group: TargetKind
  ) => {
    if (hasPromptTag(value, tag)) {
      const tags = splitPromptTags(value);
      const index = tags.findIndex(t => normalizePromptToken(t) === cleanMatch);
      assignments.push({ key, label, group, order: index >= 0 ? index : 9999 });
    }
  };

  // 1. Main
  checkTarget(prompt.basePrompt, "base", "m", "base");
  // 2. Negative
  checkTarget(prompt.negativeBase, "negativeBase", "n", "negative");
  
  // 3. Characters
  prompt.characters.forEach((char, index) => {
    checkTarget(char.caption, `character:${char.id}`, `c${index + 1}`, "character");
    
    // Check corresponding negative character if it exists
    const negChar = prompt.negativeCharacters[index];
    if (negChar) {
      checkTarget(negChar.caption, `negativeCharacter:${negChar.id}`, `nc${index + 1}`, "negativeCharacter");
    }
  });

  return assignments;
}

export function sortTagsByUsage(tags: TagDictionaryEntry[], prompt: PromptState): {
  sortedTags: TagDictionaryEntry[];
  assignmentsMap: Map<string, TagAssignment[]>;
} {
  const assignmentsMap = new Map<string, TagAssignment[]>();

  // Pre-calculate assignments
  for (const tag of tags) {
    const assignments = getPromptAssignments(tag.english_name, prompt);
    assignmentsMap.set(tag.english_name, assignments);
  }

  const sortedTags = [...tags].sort((a, b) => {
    const aAssigns = assignmentsMap.get(a.english_name) || [];
    const bAssigns = assignmentsMap.get(b.english_name) || [];

    const aUsed = aAssigns.length > 0;
    const bUsed = bAssigns.length > 0;

    // 1st: Used tags first
    if (aUsed && !bUsed) return -1;
    if (!aUsed && bUsed) return 1;

    // 2nd: Appearance order (based on highest priority target's order)
    if (aUsed && bUsed) {
      // Prioritize the primary target assignment for sorting
      const aPrimary = aAssigns[0];
      const bPrimary = bAssigns[0];

      // Compare target priority if they are different
      // Order is already established by getPromptAssignments pushing order
      const groupPriority: Record<TargetKind, number> = {
        base: 1,
        negative: 2,
        character: 3,
        negativeCharacter: 4
      };

      const aGroupPri = groupPriority[aPrimary.group] ?? 99;
      const bGroupPri = groupPriority[bPrimary.group] ?? 99;

      if (aGroupPri !== bGroupPri) {
        return aGroupPri - bGroupPri;
      }

      // If same group, sort by order of appearance
      if (aPrimary.order !== bPrimary.order) {
        return aPrimary.order - bPrimary.order;
      }
    }

    // 3rd: Unused tags maintain original order (0 means keep original relative order if stable sort)
    // To ensure stable sort in JS, we can just return 0 here
    return 0;
  });

  return { sortedTags, assignmentsMap };
}
