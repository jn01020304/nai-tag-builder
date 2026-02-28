import type { MetadataAction } from '../hooks/useMetadataState';
import { inputStyle } from '../styles/theme';

interface Props {
  value: string;
  dispatch: React.Dispatch<MetadataAction>;
}

export default function PromptSection({ value, dispatch }: Props) {
  return (
    <textarea
      value={value}
      onChange={e => dispatch({ type: 'SET_FIELD', field: 'basePrompt', value: e.target.value })}
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
