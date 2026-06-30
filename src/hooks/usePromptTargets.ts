import { useState } from 'react';
import type { Dispatch } from 'react';
import type { MetadataState } from '../types/metadata';
import type { MetadataAction } from './useMetadataState';
import type {
  PromptInsertTarget,
  PromptSelection,
  PromptSelectionAfterRender,
} from '../prompt/promptInsertTarget';
import { promptTargetKey } from '../prompt/promptInsertTarget';
import type { CoreCatalogEntry } from '../prompt/catalog/catalogTypes';
import {
  toggleCatalogTagWithSelection,
  togglePromptTagWithSelection,
  addPromptTagAtCursorWithSelection,
  replacePartialTokenWithTag,
} from '../prompt/catalog/promptTagText';

/**
 * Owns the active prompt-insertion target plus the per-target cursor selections,
 * and exposes the canonical write path (toggle a catalog entry / dictionary tag
 * into the active target while preserving the caret). Extracted out of App.tsx so
 * the same accept path can be reused by inline tag autocomplete/recommendation
 * without threading half a dozen props through the prompt UI.
 */
export function usePromptTargets(state: MetadataState, dispatch: Dispatch<MetadataAction>) {
  const [activePromptTarget, setActivePromptTarget] = useState<PromptInsertTarget>({ kind: 'base' });
  const [promptSelections, setPromptSelections] = useState<Record<string, PromptSelection>>({});
  const [selectionAfterRenderByTarget, setSelectionAfterRenderByTarget] = useState<
    Record<string, PromptSelectionAfterRender | undefined>
  >({});

  const recordPromptSelection = (target: PromptInsertTarget, selection: PromptSelection) => {
    const key = promptTargetKey(target);
    setActivePromptTarget(target);
    setPromptSelections((current) => ({
      ...current,
      [key]: selection,
    }));
  };

  const getTargetPromptValue = (target: PromptInsertTarget): string => {
    switch (target.kind) {
      case 'base':
        return state.prompt.basePrompt;
      case 'negativeBase':
        return state.prompt.negativeBase;
      case 'character':
        return state.prompt.characters.find((character) => character.id === target.id)?.caption ?? '';
      case 'negativeCharacter':
        return state.prompt.negativeCharacters.find((character) => character.id === target.id)?.caption ?? '';
    }
  };

  const getTargetSelection = (target: PromptInsertTarget): PromptSelection => {
    const value = getTargetPromptValue(target);
    return promptSelections[promptTargetKey(target)] ?? { start: value.length, end: value.length };
  };

  const getSelectionAfterRender = (target: PromptInsertTarget): PromptSelectionAfterRender | undefined =>
    selectionAfterRenderByTarget[promptTargetKey(target)];

  const dispatchPromptTargetValue = (target: PromptInsertTarget, value: string) => {
    switch (target.kind) {
      case 'base':
        dispatch({ type: 'SET_PROMPT', field: 'basePrompt', value });
        return;
      case 'negativeBase':
        dispatch({ type: 'SET_PROMPT', field: 'negativeBase', value });
        return;
      case 'character':
        dispatch({ type: 'UPDATE_CHARACTER', id: target.id, field: 'caption', value });
        return;
      case 'negativeCharacter':
        dispatch({ type: 'UPDATE_NEG_CHARACTER', id: target.id, field: 'caption', value });
        return;
    }
  };

  const getPairedNegativeCharacterTarget = (characterId: string): PromptInsertTarget | null => {
    const index = state.prompt.characters.findIndex((character) => character.id === characterId);
    const negativeCharacter = index >= 0 ? state.prompt.negativeCharacters[index] : undefined;
    return negativeCharacter ? { kind: 'negativeCharacter', id: negativeCharacter.id } : null;
  };

  const resolveCatalogTarget = (entry: CoreCatalogEntry): PromptInsertTarget => {
    if (entry.target === 'negative' && activePromptTarget.kind === 'base') {
      return { kind: 'negativeBase' };
    }

    if (entry.target === 'negative' && activePromptTarget.kind === 'character') {
      return getPairedNegativeCharacterTarget(activePromptTarget.id) ?? activePromptTarget;
    }

    return activePromptTarget;
  };

  /**
   * Commit a prompt-string edit to `target` and, when the editor returns a new
   * caret index, record it as both the live selection and the post-render
   * selection so HighlightedTextarea restores the caret after React reconciles.
   */
  const commitTargetEdit = (
    target: PromptInsertTarget,
    result: { value: string; nextCursorIndex: number | null },
  ) => {
    dispatchPromptTargetValue(target, result.value);

    if (result.nextCursorIndex != null) {
      const targetKey = promptTargetKey(target);
      const nextSelection = {
        start: result.nextCursorIndex,
        end: result.nextCursorIndex,
        version: Date.now(),
      };
      setPromptSelections((current) => ({
        ...current,
        [targetKey]: nextSelection,
      }));
      setSelectionAfterRenderByTarget((current) => ({
        ...current,
        [targetKey]: nextSelection,
      }));
    }
  };

  const handleCatalogToggle = (entry: CoreCatalogEntry) => {
    const target = resolveCatalogTarget(entry);
    const selection = getTargetSelection(target);
    commitTargetEdit(target, toggleCatalogTagWithSelection(getTargetPromptValue(target), entry, selection.start));
  };

  const handleToggleDictionaryTag = (tag: string) => {
    const target = activePromptTarget;
    const selection = getTargetSelection(target);
    commitTargetEdit(target, togglePromptTagWithSelection(getTargetPromptValue(target), tag, selection.start));
  };

  /** Accept an inline autocomplete suggestion: replace the partial token at the caret. */
  const acceptAutocomplete = (target: PromptInsertTarget, caretIndex: number, tag: string) => {
    commitTargetEdit(target, replacePartialTokenWithTag(getTargetPromptValue(target), caretIndex, tag));
  };

  /** Accept a recommended tag: insert it at the target's current caret. */
  const addRelatedTag = (target: PromptInsertTarget, tag: string) => {
    const selection = getTargetSelection(target);
    commitTargetEdit(target, addPromptTagAtCursorWithSelection(getTargetPromptValue(target), tag, selection.start));
  };

  return {
    activePromptTarget,
    setActivePromptTarget,
    recordPromptSelection,
    getSelectionAfterRender,
    handleCatalogToggle,
    handleToggleDictionaryTag,
    // exposed for inline autocomplete/recommendation (Phase 1)
    acceptAutocomplete,
    addRelatedTag,
    getTargetPromptValue,
    getTargetSelection,
    commitTargetEdit,
  };
}
