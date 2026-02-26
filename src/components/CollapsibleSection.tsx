import { useState } from 'react';
import { theme } from '../styles/theme';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({ title, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: '8px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: theme.subtext1,
          fontSize: '13px',
          fontWeight: 'bold',
          cursor: 'pointer',
          padding: '6px 0',
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
          fontSize: '10px',
        }}>
          &#9654;
        </span>
        {title}
      </button>
      {open && (
        <div style={{ padding: '4px 0 0 0' }}>
          {children}
        </div>
      )}
    </div>
  );
}
