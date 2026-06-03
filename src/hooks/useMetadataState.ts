import { useReducer } from 'react';
import type { MetadataState, CharacterEntry, PromptState, ParamsState, AdvancedFlags } from '../types/metadata';
import { DEFAULT_STATE, normalizeMetadataState } from '../model/defaults';

let nextId = 1;
function genId(): string {
  return 'char_' + (nextId++);
}

export type MetadataAction =
  | { type: 'SET_PROMPT'; field: keyof PromptState; value: PromptState[keyof PromptState] }
  | { type: 'SET_PARAMS'; field: keyof ParamsState; value: ParamsState[keyof ParamsState] | '' }
  | { type: 'SET_ADVANCED'; field: keyof AdvancedFlags; value: AdvancedFlags[keyof AdvancedFlags] }
  | { type: 'SET_META'; field: 'useCoords' | 'useOrder' | 'source'; value: boolean | string }
  | { type: 'ADD_CHARACTER' }
  | { type: 'REMOVE_CHARACTER'; id: string }
  | { type: 'UPDATE_CHARACTER'; id: string; field: keyof CharacterEntry; value: string | number }
  | { type: 'UPDATE_NEG_CHARACTER'; id: string; field: keyof CharacterEntry; value: string | number }
  | { type: 'SWAP_DIMENSIONS' }
  | { type: 'RESET_TO_DEFAULTS' }
  | { type: 'LOAD_PRESET'; state: MetadataState };

function reducer(state: MetadataState, action: MetadataAction): MetadataState {
  switch (action.type) {
    case 'SET_PROMPT':
      return { ...state, prompt: { ...state.prompt, [action.field]: action.value } };

    case 'SET_PARAMS':
      return { ...state, params: { ...state.params, [action.field]: action.value } };

    case 'SET_ADVANCED':
      return { ...state, advanced: { ...state.advanced, [action.field]: action.value } };

    case 'SET_META':
      return { ...state, [action.field]: action.value };

    case 'ADD_CHARACTER': {
      const id = genId();
      const newChar: CharacterEntry = { id, caption: '', centerX: 0.5, centerY: 0.5 };
      const newNegChar: CharacterEntry = { id, caption: '', centerX: 0.5, centerY: 0.5 };
      return {
        ...state,
        prompt: {
          ...state.prompt,
          characters: [...state.prompt.characters, newChar],
          negativeCharacters: [...state.prompt.negativeCharacters, newNegChar],
        },
      };
    }

    case 'REMOVE_CHARACTER':
      return {
        ...state,
        prompt: {
          ...state.prompt,
          characters: state.prompt.characters.filter(c => c.id !== action.id),
          negativeCharacters: state.prompt.negativeCharacters.filter(c => c.id !== action.id),
        },
      };

    case 'UPDATE_CHARACTER':
      return {
        ...state,
        prompt: {
          ...state.prompt,
          characters: state.prompt.characters.map(c =>
            c.id === action.id ? { ...c, [action.field]: action.value } : c
          ),
        },
      };

    case 'UPDATE_NEG_CHARACTER':
      return {
        ...state,
        prompt: {
          ...state.prompt,
          negativeCharacters: state.prompt.negativeCharacters.map(c =>
            c.id === action.id ? { ...c, [action.field]: action.value } : c
          ),
        },
      };

    case 'SWAP_DIMENSIONS':
      return { ...state, params: { ...state.params, width: state.params.height, height: state.params.width } };

    case 'RESET_TO_DEFAULTS':
      return { ...DEFAULT_STATE };

    case 'LOAD_PRESET':
      return { ...action.state };

    default:
      return state;
  }
}

import { useEffect, useRef } from 'react';
import { db } from '../model/db';

export function useMetadataState() {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);
  const isInitialized = useRef(false);

  // Load from DB on mount
  useEffect(() => {
    db.appState.get('current').then(entry => {
      if (entry) {
        dispatch({ type: 'LOAD_PRESET', state: normalizeMetadataState(JSON.parse(entry.stateJson)) });
      }
      isInitialized.current = true;
    }).catch(e => {
      console.error("Failed to load state", e);
      isInitialized.current = true;
    });
  }, []);

  // Save to DB on change
  useEffect(() => {
    if (!isInitialized.current) return;

    db.appState.put({ id: 'current', stateJson: JSON.stringify(state) }).catch(e => {
      console.error("Failed to save state", e);
    });
  }, [state]);

  return [state, dispatch] as const;
}
