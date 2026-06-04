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

function resolveSafeInsertIndex(value: string, cursorIndex: number): number {
  const safeCursorIndex = Math.max(0, Math.min(cursorIndex, value.length));
  const leftCommaIndex = value.lastIndexOf(",", safeCursorIndex - 1);
  const rightCommaIndex = value.indexOf(",", safeCursorIndex);
  const tokenStartBoundary = leftCommaIndex + 1;
  const tokenEndBoundary = rightCommaIndex === -1 ? value.length : rightCommaIndex;

  const tokenText = value.slice(tokenStartBoundary, tokenEndBoundary);
  const leadingSpaces = tokenText.match(/^\s*/)?.[0].length ?? 0;
  const trailingSpaces = tokenText.match(/\s*$/)?.[0].length ?? 0;
  const tokenStart = tokenStartBoundary + leadingSpaces;
  const tokenEnd = tokenEndBoundary - trailingSpaces;

  if (safeCursorIndex > tokenStart && safeCursorIndex < tokenEnd) {
    return tokenEnd;
  }

  return safeCursorIndex;
}

export function addPromptTagAtCursor(value: string, tag: string, cursorIndex: number | null): string {
  return addPromptTagAtCursorWithSelection(value, tag, cursorIndex).value;
}

export function addPromptTagAtCursorWithSelection(
  value: string,
  tag: string,
  cursorIndex: number | null,
): { value: string; nextCursorIndex: number | null } {
  const cleanTag = normalizePromptToken(tag);
  if (!cleanTag) return { value, nextCursorIndex: cursorIndex };

  const tags = splitPromptTags(value);
  if (tags.some((token) => normalizePromptToken(token) === cleanTag)) {
    return { value, nextCursorIndex: cursorIndex };
  }

  if (cursorIndex == null || cursorIndex < 0 || cursorIndex > value.length) {
    const nextValue = addPromptTag(value, cleanTag);
    return { value: nextValue, nextCursorIndex: nextValue.length };
  }

  const insertIndex = resolveSafeInsertIndex(value, cursorIndex);
  const before = value.slice(0, insertIndex).trimEnd();
  const after = value.slice(insertIndex).trimStart();
  const prefix = before ? `${before.replace(/,\s*$/, "")}, ` : "";
  const suffix = after ? `, ${after.replace(/^,\s*/, "")}` : "";
  return {
    value: `${prefix}${cleanTag}${suffix}`,
    nextCursorIndex: prefix.length + cleanTag.length + (suffix ? 2 : 0),
  };
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

export function toggleCatalogTagWithSelection(
  value: string,
  entry: CoreCatalogEntry,
  cursorIndex: number | null = null,
): { value: string; nextCursorIndex: number | null } {
  if (hasCatalogTag(value, entry)) {
    const nextValue = removeCatalogTag(value, entry);
    return {
      value: nextValue,
      nextCursorIndex: Math.min(cursorIndex ?? nextValue.length, nextValue.length),
    };
  }

  return addPromptTagAtCursorWithSelection(value, entry.tag, cursorIndex);
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
