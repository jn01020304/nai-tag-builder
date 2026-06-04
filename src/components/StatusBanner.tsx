import type { CSSProperties } from 'react';
import type { StatusFeedback } from '../types/feedback';
import { useTheme } from '../contexts/themeContextCore';
import { withAlpha } from '../styles/theme';

interface Props {
  feedback: StatusFeedback;
  onDismiss: () => void;
}

export default function StatusBanner({ feedback, onDismiss }: Props) {
  const theme = useTheme();
  const accentByTone = {
    info: theme.blue,
    success: theme.green,
    warning: theme.yellow,
    error: theme.warningError,
  };
  const accent = accentByTone[feedback.tone];

  const wrapperStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 10px',
    marginBottom: '10px',
    borderRadius: '6px',
    border: `1px solid ${withAlpha(accent, 0.55)}`,
    backgroundColor: withAlpha(accent, 0.14),
    color: theme.text,
    fontSize: '12px',
    lineHeight: 1.45,
  };

  const closeStyle: CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: theme.subtext0,
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: '1px 2px',
  };

  return (
    <div data-testid="status-banner" style={wrapperStyle} role={feedback.tone === 'error' ? 'alert' : 'status'}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{feedback.message}</div>
        {feedback.detail && (
          <div style={{ color: theme.subtext1, marginTop: '3px', overflowWrap: 'anywhere' }}>
            {feedback.detail}
          </div>
        )}
      </div>
      <button type="button" onClick={onDismiss} style={closeStyle} aria-label="알림 닫기">
        ×
      </button>
    </div>
  );
}
