import type { CharacterEntry } from "../types/metadata";

export function createCharacterId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `char_${globalThis.crypto.randomUUID()}`;
  }

  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `char_${timestamp}_${random}`;
}

export function pairCharacterEntries(
  characters: readonly CharacterEntry[],
  negativeCharacters: readonly CharacterEntry[],
): {
  characters: CharacterEntry[];
  negativeCharacters: CharacterEntry[];
} {
  const usedIds = new Set<string>();
  const pairedCharacters: CharacterEntry[] = [];
  const pairedNegativeCharacters: CharacterEntry[] = [];

  const appendPair = (
    id: string,
    character: CharacterEntry | undefined,
    negativeCharacter: CharacterEntry | undefined,
  ) => {
    const fallback = character ?? negativeCharacter;
    pairedCharacters.push({
      id,
      caption: character?.caption ?? "",
      centerX: character?.centerX ?? fallback?.centerX ?? 0.5,
      centerY: character?.centerY ?? fallback?.centerY ?? 0.5,
    });
    pairedNegativeCharacters.push({
      id,
      caption: negativeCharacter?.caption ?? "",
      centerX: negativeCharacter?.centerX ?? fallback?.centerX ?? 0.5,
      centerY: negativeCharacter?.centerY ?? fallback?.centerY ?? 0.5,
    });
  };

  const characterById = new Map(characters.map((character) => [character.id, character]));
  const negativeCharacterById = new Map(
    negativeCharacters.map((character) => [character.id, character]),
  );
  const hasUniqueIds = (
    characterById.size === characters.length &&
    negativeCharacterById.size === negativeCharacters.length
  );
  const hasSharedId = characters.some((character) => (
    negativeCharacterById.has(character.id)
  ));

  if (hasUniqueIds && hasSharedId) {
    const orderedIds = [
      ...characters.map((character) => character.id),
      ...negativeCharacters.map((character) => character.id),
    ];
    for (const id of orderedIds) {
      if (usedIds.has(id)) continue;
      usedIds.add(id);
      appendPair(
        id,
        characterById.get(id),
        negativeCharacterById.get(id),
      );
    }
  } else {
    const count = Math.max(characters.length, negativeCharacters.length);
    for (let index = 0; index < count; index += 1) {
      const character = characters[index];
      const negativeCharacter = negativeCharacters[index];
      let id = character?.id || negativeCharacter?.id || createCharacterId();
      while (usedIds.has(id)) id = createCharacterId();
      usedIds.add(id);
      appendPair(id, character, negativeCharacter);
    }
  }

  return {
    characters: pairedCharacters,
    negativeCharacters: pairedNegativeCharacters,
  };
}
