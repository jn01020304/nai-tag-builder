import type { CoreCatalogEntry } from "./catalogTypes";

function normalizePromptToken(value: string): string {
  return value
    .trim()
    .replace(/^[-+]?\d+(?:\.\d+)?::/, "")
    .replace(/::$/, "")
    .replace(/^[{[(\s]+/, "")
    .replace(/[}\])\s]+$/, "")
    .replace(/^artist:/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function splitPromptTags(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchEntryToken(token: string, entry: CoreCatalogEntry): boolean {
  const normalized = normalizePromptToken(token);
  return normalized === entry.tag || entry.aliases.some((alias) => normalized === alias);
}

export function hasCatalogTag(value: string, entry: CoreCatalogEntry): boolean {
  return splitPromptTags(value).some((token) => matchEntryToken(token, entry));
}

export function addPromptTag(value: string, tag: string): string {
  const cleanTag = normalizePromptToken(tag);
  if (!cleanTag) return value;

  const tags = splitPromptTags(value);
  if (tags.some((token) => normalizePromptToken(token) === cleanTag)) {
    return value;
  }

  if (tags.length === 0) return cleanTag;
  return `${tags.join(", ")}, ${cleanTag}`;
}

export function addPromptTagAtCursor(value: string, tag: string, cursorIndex: number | null): string {
  const cleanTag = normalizePromptToken(tag);
  if (!cleanTag) return value;

  const tags = splitPromptTags(value);
  if (tags.some((token) => normalizePromptToken(token) === cleanTag)) {
    return value;
  }

  if (cursorIndex == null || cursorIndex < 0 || cursorIndex > value.length) {
    return addPromptTag(value, cleanTag);
  }

  const before = value.slice(0, cursorIndex).trimEnd();
  const after = value.slice(cursorIndex).trimStart();
  const prefix = before ? `${before.replace(/,\s*$/, "")}, ` : "";
  const suffix = after ? `, ${after.replace(/^,\s*/, "")}` : "";
  return `${prefix}${cleanTag}${suffix}`;
}

export function removeCatalogTag(value: string, entry: CoreCatalogEntry): string {
  return splitPromptTags(value)
    .filter((token) => !matchEntryToken(token, entry))
    .join(", ");
}

export function toggleCatalogTag(
  value: string,
  entry: CoreCatalogEntry,
  cursorIndex: number | null = null,
): string {
  return hasCatalogTag(value, entry)
    ? removeCatalogTag(value, entry)
    : addPromptTagAtCursor(value, entry.tag, cursorIndex);
}

export function movePromptTag(value: string, fromIndex: number, toIndex: number): string {
  const tags = splitPromptTags(value);
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= tags.length ||
    toIndex >= tags.length
  ) {
    return value;
  }

  const [moved] = tags.splice(fromIndex, 1);
  tags.splice(toIndex, 0, moved);
  return tags.join(", ");
}
