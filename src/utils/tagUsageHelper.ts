import type { PromptState } from "../types/metadata";
import type { TagDictionaryEntry } from "../catalog/tagDictionaryTypes";
import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import { hasPromptTag, hasCatalogTag, splitPromptTags, normalizePromptToken } from "../prompt/catalog/promptTagText";
import type { PromptTone } from "../styles/promptTonePalettes";

export type TargetKind = PromptTone;

export interface TagAssignment {
  key: string;
  label: string;
  group: TargetKind;
  order: number; // Order of appearance within the target value
}

interface PromptTargetSlot {
  value: string;
  key: string;
  label: string;
  group: TargetKind;
}

/**
 * The ordered list of prompt fields a tag can live in. Base and negative base
 * first, then each character paired with its negative character (c1, nc1, c2, nc2…).
 */
function promptTargetSlots(prompt: PromptState): PromptTargetSlot[] {
  const slots: PromptTargetSlot[] = [
    { value: prompt.basePrompt, key: "base", label: "m", group: "base" },
    { value: prompt.negativeBase, key: "negativeBase", label: "n", group: "negative" },
  ];

  prompt.characters.forEach((char, index) => {
    slots.push({ value: char.caption, key: `character:${char.id}`, label: `c${index + 1}`, group: "character" });
    const negChar = prompt.negativeCharacters[index];
    if (negChar) {
      slots.push({ value: negChar.caption, key: `negativeCharacter:${negChar.id}`, label: `nc${index + 1}`, group: "negativeCharacter" });
    }
  });

  return slots;
}

function collectAssignments(
  prompt: PromptState,
  matches: (value: string) => boolean,
  orderIn: (value: string) => number,
): TagAssignment[] {
  const assignments: TagAssignment[] = [];
  for (const slot of promptTargetSlots(prompt)) {
    if (matches(slot.value)) {
      assignments.push({ key: slot.key, label: slot.label, group: slot.group, order: orderIn(slot.value) });
    }
  }
  return assignments;
}

/** Where a plain string tag currently appears across the prompt targets. */
export function getPromptAssignments(tag: string, prompt: PromptState): TagAssignment[] {
  const cleanMatch = normalizePromptToken(tag);
  const orderIn = (value: string) => {
    const index = splitPromptTags(value).findIndex((t) => normalizePromptToken(t) === cleanMatch);
    return index >= 0 ? index : 9999;
  };
  return collectAssignments(prompt, (value) => hasPromptTag(value, tag), orderIn);
}

/**
 * Where a curated catalog entry currently appears. Alias-aware via hasCatalogTag,
 * so it matches any of the entry's canonical tag or aliases.
 */
export function getCatalogEntryAssignments(entry: CoreCatalogEntry, prompt: PromptState): TagAssignment[] {
  return collectAssignments(prompt, (value) => hasCatalogTag(value, entry), () => 0);
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
