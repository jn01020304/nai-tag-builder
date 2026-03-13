import type { MetadataAction } from '../hooks/useMetadataState';
import { inputStyle } from '../styles/theme';
import HighlightedTextarea from './HighlightedTextarea';

interface Props {
  value: string;
  dispatch: React.Dispatch<MetadataAction>;
}

export default function PromptSection({ value, dispatch }: Props) {
  return (
    <HighlightedTextarea
      value={value}
      onChange={e => dispatch({ type: 'SET_PROMPT', field: 'basePrompt', value: e.target.value })}
      placeholder="base prompt tags..."
      style={{
        ...inputStyle,
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '80px',
        resize: 'vertical',
        marginBottom: '8px',
      }}
    />
  );
}
