import { useReducer } from 'react';
import type { MetadataState, CharacterEntry } from '../types/metadata';
import { DEFAULT_STATE } from '../model/defaults';

let nextId = 1;
function genId(): string {
  return 'char_' + (nextId++);
}

export type MetadataAction =
  | { type: 'SET_FIELD'; field: keyof MetadataState; value: MetadataState[keyof MetadataState] }
  | { type: 'ADD_CHARACTER' }
  | { type: 'REMOVE_CHARACTER'; id: string }
  | { type: 'UPDATE_CHARACTER'; id: string; field: keyof CharacterEntry; value: string | number }
  | { type: 'UPDATE_NEG_CHARACTER'; id: string; field: keyof CharacterEntry; value: string | number }
  | { type: 'SWAP_DIMENSIONS' }
  | { type: 'RESET_TO_DEFAULTS' }
  | { type: 'LOAD_PRESET'; state: MetadataState };

function reducer(state: MetadataState, action: MetadataAction): MetadataState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'ADD_CHARACTER': {
      const id = genId();
      const newChar: CharacterEntry = { id, caption: '', centerX: 0.5, centerY: 0.5 };
      const newNegChar: CharacterEntry = { id, caption: '', centerX: 0.5, centerY: 0.5 };
      return {
        ...state,
        characters: [...state.characters, newChar],
        negativeCharacters: [...state.negativeCharacters, newNegChar],
      };
    }

    case 'REMOVE_CHARACTER':
      return {
        ...state,
        characters: state.characters.filter(c => c.id !== action.id),
        negativeCharacters: state.negativeCharacters.filter(c => c.id !== action.id),
      };

    case 'UPDATE_CHARACTER':
      return {
        ...state,
        characters: state.characters.map(c =>
          c.id === action.id ? { ...c, [action.field]: action.value } : c
        ),
      };

    case 'UPDATE_NEG_CHARACTER':
      return {
        ...state,
        negativeCharacters: state.negativeCharacters.map(c =>
          c.id === action.id ? { ...c, [action.field]: action.value } : c
        ),
      };

    case 'SWAP_DIMENSIONS':
      return { ...state, width: state.height, height: state.width };

    case 'RESET_TO_DEFAULTS':
      return { ...DEFAULT_STATE };

    case 'LOAD_PRESET':
      return { ...action.state };

    default:
      return state;
  }
}

export function useMetadataState() {
  return useReducer(reducer, DEFAULT_STATE);
}
