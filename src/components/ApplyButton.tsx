import { useTheme } from '../contexts/themeContextCore';

interface Props {
  isApplying: boolean;
  label?: string;
  onApply: () => void;
}

export default function ApplyButton({ isApplying, label, onApply }: Props) {
  const theme = useTheme();

  return (
    <button
      data-testid="apply-button"
      onClick={onApply}
      disabled={isApplying}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: isApplying ? theme.surface1 : theme.actionAccent,
        color: isApplying ? theme.subtext0 : theme.actionAccentText,
        border: 'none',
        borderRadius: '6px',
        fontWeight: 'bold',
        cursor: isApplying ? 'not-allowed' : 'pointer',
        fontSize: '14px',
      }}
    >
      {isApplying ? label ?? 'Applying...' : 'Load to Canvas'}
    </button>
  );
}
