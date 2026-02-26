import { theme } from '../styles/theme';

interface Props {
  isApplying: boolean;
  onApply: () => void;
}

export default function ApplyButton({ isApplying, onApply }: Props) {
  return (
    <button
      onClick={onApply}
      disabled={isApplying}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: isApplying ? theme.surface1 : theme.blue,
        color: theme.crust,
        border: 'none',
        borderRadius: '6px',
        fontWeight: 'bold',
        cursor: isApplying ? 'not-allowed' : 'pointer',
        fontSize: '14px',
      }}
    >
      {isApplying ? '...' : 'NovelAI에 적용'}
    </button>
  );
}
