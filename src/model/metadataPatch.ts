import type {
  AdvancedFlags,
  MetadataState,
  ParamsState,
  PromptState,
} from "../types/metadata";
import { pairCharacterEntries } from "./characterIdentity";

export interface MetadataPatch {
  prompt?: Partial<PromptState>;
  params?: Partial<ParamsState>;
  advanced?: Partial<AdvancedFlags>;
  useCoords?: boolean;
  useOrder?: boolean;
  source?: string;
}

export function mergeMetadataPatch(
  current: MetadataState,
  patch: MetadataPatch,
): MetadataState {
  const mergedPrompt = patch.prompt
    ? {
        ...current.prompt,
        ...patch.prompt,
      }
    : current.prompt;
  const prompt = patch.prompt
    ? {
        ...mergedPrompt,
        ...pairCharacterEntries(
          mergedPrompt.characters,
          mergedPrompt.negativeCharacters,
        ),
      }
    : current.prompt;

  return {
    ...current,
    ...(patch.prompt && { prompt }),
    ...(patch.params && {
      params: {
        ...current.params,
        ...patch.params,
      },
    }),
    ...(patch.advanced && {
      advanced: {
        ...current.advanced,
        ...patch.advanced,
      },
    }),
    ...(patch.useCoords !== undefined && { useCoords: patch.useCoords }),
    ...(patch.useOrder !== undefined && { useOrder: patch.useOrder }),
    ...(patch.source !== undefined && { source: patch.source }),
  };
}
