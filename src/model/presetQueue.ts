import type { Preset } from "../types/preset";

export function createUniquePresetNames(
  fileNames: readonly string[],
  existingNames: readonly string[],
): string[] {
  const usedNames = new Set(existingNames);

  return fileNames.map((fileName) => {
    const baseName = fileName.replace(/\.[^/.]+$/, "").trim() || "Imported image";
    let candidate = baseName;
    let suffix = 2;

    while (usedNames.has(candidate)) {
      candidate = `${baseName} (${suffix})`;
      suffix += 1;
    }

    usedNames.add(candidate);
    return candidate;
  });
}

export function togglePresetInQueue(
  queue: readonly string[],
  presetId: string,
): string[] {
  return queue.includes(presetId)
    ? queue.filter((id) => id !== presetId)
    : [...queue, presetId];
}

export function movePresetInQueue(
  queue: readonly string[],
  presetId: string,
  direction: -1 | 1,
): string[] {
  const index = queue.indexOf(presetId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= queue.length) {
    return [...queue];
  }

  const nextQueue = [...queue];
  [nextQueue[index], nextQueue[target]] = [
    nextQueue[target],
    nextQueue[index],
  ];
  return nextQueue;
}

export function resolveQueuedPresets(
  queue: readonly string[],
  presets: readonly Preset[],
): Preset[] {
  const presetById = new Map(presets.map((preset) => [preset.id, preset]));
  return queue
    .map((id) => presetById.get(id))
    .filter((preset): preset is Preset => preset !== undefined);
}
